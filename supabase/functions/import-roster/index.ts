import { createClient } from "npm:@supabase/supabase-js@2";

type RosterRow = {
  email?: string;
  display_name?: string;
  employee_code?: string;
  group_code?: string;
};

type ValidatedRow = {
  email: string;
  display_name: string;
  employee_code: string;
  group_code: string;
  group_id: string;
};

const appUrl = "https://jinnat-lht.github.io/Gamification-App/";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://jinnat-lht.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (value: unknown) => String(value ?? "").trim();
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function validateRoster(
  admin: ReturnType<typeof createClient>,
  batchCode: string,
  rows: RosterRow[],
) {
  if (!batchCode || rows.length === 0) throw new Error("batch_code and rows are required");
  if (rows.length > 500) throw new Error("Maximum 500 learners per import");

  const { data: batch } = await admin
    .from("batches")
    .select("id, program_id, status")
    .eq("external_code", batchCode)
    .is("deleted_at", null)
    .maybeSingle();
  if (!batch) throw new Error("Batch not found");

  const { data: program } = await admin
    .from("programs")
    .select("id, client_organization_id")
    .eq("id", batch.program_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!program) throw new Error("Program not found");

  const { data: groups } = await admin
    .from("groups")
    .select("id, external_code")
    .eq("batch_id", batch.id)
    .is("deleted_at", null);
  const groupByCode = new Map((groups ?? []).map((group) => [group.external_code.toUpperCase(), group.id]));

  const emails = new Set<string>();
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const validRows: ValidatedRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = clean(row.email).toLowerCase();
    const displayName = clean(row.display_name);
    const employeeCode = clean(row.employee_code);
    const groupCode = clean(row.group_code).toUpperCase();
    const groupId = groupByCode.get(groupCode);

    if (!validEmail(email)) errors.push({ row: rowNumber, field: "email", message: "Invalid email" });
    else if (emails.has(email)) errors.push({ row: rowNumber, field: "email", message: "Duplicate email in file" });
    else emails.add(email);
    if (!displayName) errors.push({ row: rowNumber, field: "display_name", message: "Display name is required" });
    if (!groupId) errors.push({ row: rowNumber, field: "group_code", message: "Unknown group code" });
    if (validEmail(email) && displayName && groupId) {
      validRows.push({ email, display_name: displayName, employee_code: employeeCode, group_code: groupCode, group_id: groupId });
    }
  });

  const uniqueEmails = [...emails];
  if (uniqueEmails.length) {
    const { data: existing } = await admin.from("user_accounts").select("email").in("email", uniqueEmails);
    const existingEmails = new Set((existing ?? []).map((row) => row.email.toLowerCase()));
    rows.forEach((row, index) => {
      const email = clean(row.email).toLowerCase();
      if (existingEmails.has(email)) errors.push({ row: index + 2, field: "email", message: "Email already exists in Leadership Quest" });
    });

    // Avoid issuing a partial batch of invitations when an email is already registered in Supabase Auth.
    const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authUsersError) throw new Error("Unable to check existing auth users");
    const authEmails = new Set((authUsers.users ?? []).map((authUser) => authUser.email?.toLowerCase()).filter(Boolean));
    rows.forEach((row, index) => {
      const email = clean(row.email).toLowerCase();
      if (authEmails.has(email)) errors.push({ row: index + 2, field: "email", message: "Email already has an Auth account" });
    });
  }

  return { batch, program, errors, validRows };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  if (!url || !publishableKey || !secretKey) return json({ error: "Function environment is not configured" }, 500);

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: account } = await admin
    .from("user_accounts")
    .select("id, account_type, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!account || account.account_type !== "ADMIN" || account.status !== "ACTIVE") {
    return json({ error: "Admin access required" }, 403);
  }

  const payload = await req.json().catch(() => ({}));
  const action = clean(payload.action || "validate").toLowerCase();
  const batchCode = clean(payload.batch_code);
  const rows: RosterRow[] = Array.isArray(payload.rows) ? payload.rows : [];

  try {
    const { batch, program, errors, validRows } = await validateRoster(admin, batchCode, rows);
    if (action === "validate") {
      return json({
        valid: errors.length === 0,
        batch_code: batchCode,
        total_rows: rows.length,
        valid_rows: errors.length ? 0 : validRows.length,
        errors,
      });
    }
    if (action !== "commit") return json({ error: "Unsupported action" }, 400);
    if (errors.length) {
      return json({ valid: false, error: "Fix validation errors before confirming", errors }, 422);
    }

    const { data: importJob, error: importJobError } = await admin
      .from("import_jobs")
      .insert({
        import_type: "LEARNER_ROSTER",
        status: "CONFIRMED",
        client_organization_id: program.client_organization_id,
        program_id: program.id,
        batch_id: batch.id,
        source_filename: "browser-roster-import",
        template_version: "1.0",
        uploaded_by: user.id,
        total_rows: validRows.length,
        valid_rows: validRows.length,
        error_rows: 0,
      })
      .select("id")
      .single();
    if (importJobError || !importJob) throw new Error("Unable to create import audit record");

    try {
      for (const row of validRows) {
        const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(row.email, {
          redirectTo: appUrl,
          data: { display_name: row.display_name, account_type: "LEARNER" },
        });
        if (invitationError || !invitation.user) throw new Error(`Invitation failed for ${row.email}`);

        const learnerId = invitation.user.id;
        const { error: accountInsertError } = await admin.from("user_accounts").insert({
          id: learnerId,
          email: row.email,
          display_name: row.display_name,
          account_type: "LEARNER",
          status: "INVITED",
        });
        if (accountInsertError) throw new Error(`Account setup failed for ${row.email}`);

        const { error: profileError } = await admin.from("learner_profiles").insert({
          user_id: learnerId,
          employee_code: row.employee_code || null,
        });
        if (profileError) throw new Error(`Learner profile setup failed for ${row.email}`);

        const { error: enrollmentError } = await admin.from("batch_learners").insert({
          batch_id: batch.id,
          learner_id: learnerId,
          group_id: row.group_id,
          enrollment_status: "INVITED",
        });
        if (enrollmentError) throw new Error(`Enrollment setup failed for ${row.email}`);
      }

      await admin.from("import_jobs").update({ status: "COMMITTED", committed_at: new Date().toISOString() }).eq("id", importJob.id);
      await admin.from("audit_events").insert({
        actor_user_id: user.id,
        client_organization_id: program.client_organization_id,
        batch_id: batch.id,
        event_type: "LEARNER_ROSTER_IMPORTED",
        target_type: "IMPORT_JOB",
        target_id: importJob.id,
        after_json: { imported_count: validRows.length, batch_code: batchCode },
        reason: "Admin confirmed roster import",
      });
      return json({ committed: true, import_job_id: importJob.id, invited_count: validRows.length });
    } catch (commitError) {
      await admin.from("import_jobs").update({ status: "FAILED" }).eq("id", importJob.id);
      await admin.from("audit_events").insert({
        actor_user_id: user.id,
        client_organization_id: program.client_organization_id,
        batch_id: batch.id,
        event_type: "LEARNER_ROSTER_IMPORT_FAILED",
        target_type: "IMPORT_JOB",
        target_id: importJob.id,
        after_json: { error: String(commitError) },
        reason: "Roster import requires follow-up",
      });
      throw commitError;
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Roster import failed" }, 400);
  }
});
