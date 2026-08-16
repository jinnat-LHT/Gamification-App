import { createClient } from "npm:@supabase/supabase-js@2";

type QuizRow = { topic?: string; question_text?: string; option_a?: string; option_b?: string; option_c?: string; option_d?: string; correct_option?: string; difficulty?: string; };

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://jinnat-lht.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clean = (value: unknown) => String(value ?? "").trim();

async function getAdminRoles(admin: any, userId: string) {
  const { data: account } = await admin.from("user_accounts").select("id, account_type, status").eq("id", userId).maybeSingle();
  if (!account || account.account_type !== "ADMIN" || account.status !== "ACTIVE") return null;
  const { data: roles } = await admin.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id", userId).eq("role", "ADMIN").is("revoked_at", null);
  return roles ?? [];
}
async function resolveScopedBatch(admin: any, roles: any[], batchId: string) {
  const { data: batch } = await admin.from("batches").select("id, program_id").eq("id", batchId).is("deleted_at", null).maybeSingle();
  if (!batch) return null;
  const { data: program } = await admin.from("programs").select("id, client_organization_id, current_version_id").eq("id", batch.program_id).is("deleted_at", null).maybeSingle();
  if (!program) return null;
  const { data: client } = await admin.from("client_organizations").select("id, provider_organization_id").eq("id", program.client_organization_id).is("deleted_at", null).maybeSingle();
  if (!client) return null;
  const allowed = roles.some((role: any) =>
    (role.scope_type === "PROVIDER" && role.provider_organization_id === client.provider_organization_id) ||
    (role.scope_type === "CLIENT_ORGANIZATION" && role.client_organization_id === client.id) ||
    (role.scope_type === "PROGRAM" && role.program_id === program.id) ||
    (role.scope_type === "BATCH" && role.batch_id === batch.id)
  );
  return allowed ? { batch, program, client } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  if (!token || !url || !anonKey || !secretKey) return json({ error: "Authentication or function configuration missing" }, 401);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const roles = await getAdminRoles(admin, user.id);
  if (!roles) return json({ error: "Admin access required" }, 403);

  const payload = await req.json().catch(() => ({}));
  const action = clean(payload.action || "validate").toLowerCase();
  const batchId = clean(payload.batch_id);
  const rows: QuizRow[] = Array.isArray(payload.rows) ? payload.rows : [];
  if (!batchId || !rows.length) return json({ error: "กรุณาเลือก Batch และไฟล์คำถาม" }, 400);
  if (rows.length > 500) return json({ error: "Maximum 500 questions per import" }, 400);

  const scope = await resolveScopedBatch(admin, roles, batchId);
  if (!scope) return json({ error: "ไม่มีสิทธิ์เข้าถึง Batch ที่เลือก" }, 403);
  const batch = scope.batch, program = scope.program;
  if (!program.current_version_id) return json({ error: "Program has no current version" }, 422);

  const errors: Array<{ row: number; field: string; message: string }> = [];
  const validRows = rows.map((row, index) => {
    const normalised = {
      topic: clean(row.topic),
      question_text: clean(row.question_text),
      option_a: clean(row.option_a), option_b: clean(row.option_b), option_c: clean(row.option_c), option_d: clean(row.option_d),
      correct_option: clean(row.correct_option).toUpperCase(), difficulty: clean(row.difficulty),
    };
    const rowNumber = index + 2;
    if (!normalised.question_text) errors.push({ row: rowNumber, field: "question_text", message: "Question is required" });
    ["option_a", "option_b", "option_c", "option_d"].forEach((key) => { if (!normalised[key as keyof typeof normalised]) errors.push({ row: rowNumber, field: key, message: "Option is required" }); });
    if (!["A", "B", "C", "D"].includes(normalised.correct_option)) errors.push({ row: rowNumber, field: "correct_option", message: "Use A, B, C, or D" });
    return normalised;
  });

  if (action === "validate") return json({ valid: !errors.length, total_rows: rows.length, valid_rows: errors.length ? 0 : validRows.length, errors });
  if (action !== "commit") return json({ error: "Unsupported action" }, 400);
  if (errors.length) return json({ error: "Fix validation errors before confirming", errors }, 422);

  const { data: job, error: jobError } = await admin.from("import_jobs").insert({
    import_type: "QUIZ_BANK", status: "CONFIRMED", client_organization_id: program.client_organization_id,
    program_id: program.id, batch_id: batch.id, source_filename: "browser-quiz-import", template_version: "1.0",
    uploaded_by: user.id, total_rows: validRows.length, valid_rows: validRows.length,
  }).select("id").single();
  if (jobError || !job) return json({ error: "Unable to create import audit record" }, 500);

  try {
    for (const [index, row] of validRows.entries()) {
      const { data: question, error: questionError } = await admin.from("quiz_questions").insert({ program_id: program.id, topic: row.topic || null }).select("id").single();
      if (questionError || !question) throw new Error(`Question ${index + 1} could not be created`);
      const { error: versionError } = await admin.from("quiz_question_versions").insert({
        quiz_question_id: question.id, program_version_id: program.current_version_id, question_text: row.question_text,
        option_a: row.option_a, option_b: row.option_b, option_c: row.option_c, option_d: row.option_d,
        correct_option: row.correct_option, difficulty: row.difficulty || null, sort_order: index + 1,
      });
      if (versionError) throw new Error(`Question ${index + 1} could not be saved`);
    }
    await admin.from("import_jobs").update({ status: "COMMITTED", committed_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("audit_events").insert({ actor_user_id: user.id, client_organization_id: program.client_organization_id, batch_id: batch.id, event_type: "QUIZ_BANK_IMPORTED", target_type: "IMPORT_JOB", target_id: job.id, after_json: { imported_count: validRows.length }, reason: "Admin confirmed quiz import" });
    return json({ committed: true, import_job_id: job.id, imported_count: validRows.length });
  } catch (error) {
    await admin.from("import_jobs").update({ status: "FAILED" }).eq("id", job.id);
    return json({ error: error instanceof Error ? error.message : "Quiz import failed" }, 400);
  }
});