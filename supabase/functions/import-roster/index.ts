import { createClient } from "npm:@supabase/supabase-js@2";

type RosterRow = {
  email?: string;
  display_name?: string;
  employee_code?: string;
  group_code?: string;
};

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
  const batchCode = clean(payload.batch_code);
  const rows: RosterRow[] = Array.isArray(payload.rows) ? payload.rows : [];
  if (!batchCode || rows.length === 0) return json({ error: "batch_code and rows are required" }, 400);
  if (rows.length > 500) return json({ error: "Maximum 500 learners per import" }, 400);

  const { data: batch } = await admin
    .from("batches")
    .select("id, status")
    .eq("external_code", batchCode)
    .is("deleted_at", null)
    .maybeSingle();
  if (!batch) return json({ error: "Batch not found" }, 404);

  const { data: groups } = await admin
    .from("groups")
    .select("id, external_code")
    .eq("batch_id", batch.id)
    .is("deleted_at", null);
  const groupCodes = new Set((groups ?? []).map((group) => group.external_code.toUpperCase()));

  const emails = new Set<string>();
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const validRows: Array<{ email: string; display_name: string; employee_code: string; group_code: string }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = clean(row.email).toLowerCase();
    const displayName = clean(row.display_name);
    const employeeCode = clean(row.employee_code);
    const groupCode = clean(row.group_code).toUpperCase();

    if (!validEmail(email)) errors.push({ row: rowNumber, field: "email", message: "Invalid email" });
    else if (emails.has(email)) errors.push({ row: rowNumber, field: "email", message: "Duplicate email in file" });
    else emails.add(email);
    if (!displayName) errors.push({ row: rowNumber, field: "display_name", message: "Display name is required" });
    if (!groupCodes.has(groupCode)) errors.push({ row: rowNumber, field: "group_code", message: "Unknown group code" });
    validRows.push({ email, display_name: displayName, employee_code: employeeCode, group_code: groupCode });
  });

  const { data: existing } = await admin.from("user_accounts").select("email").in("email", validRows.map((row) => row.email));
  const existingEmails = new Set((existing ?? []).map((row) => row.email.toLowerCase()));
  validRows.forEach((row, index) => {
    if (existingEmails.has(row.email)) errors.push({ row: index + 2, field: "email", message: "Email already exists" });
  });

  return json({
    valid: errors.length === 0,
    batch_code: batchCode,
    total_rows: rows.length,
    valid_rows: errors.length ? 0 : validRows.length,
    errors,
    rows: errors.length ? [] : validRows,
  });
});
