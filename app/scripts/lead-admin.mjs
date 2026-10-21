import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const {
  LEAD_DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  LEAD_ADMIN_EMAIL,
  LEAD_ADMIN_PASSWORD,
} = process.env;
if (
  !LEAD_DATABASE_URL ||
  !SUPABASE_URL ||
  !SUPABASE_SECRET_KEY ||
  !LEAD_ADMIN_EMAIL ||
  !LEAD_ADMIN_PASSWORD
)
  throw new Error(
    "Set LEAD_DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY, LEAD_ADMIN_EMAIL and LEAD_ADMIN_PASSWORD in this terminal session.",
  );
if (LEAD_ADMIN_PASSWORD.length < 10)
  throw new Error("Use a password of at least 10 characters.");
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = new pg.Client({
  connectionString: LEAD_DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.LEAD_DB_SSL_VERIFY !== "false" },
});
try {
  await client.connect();
  const existing = await client.query(
    "select 1 from public.sales where lower(email)=lower($1)",
    [LEAD_ADMIN_EMAIL],
  );
  if (existing.rowCount)
    throw new Error(
      "Account already exists. Its password and role were not changed.",
    );
  const { data, error } = await admin.auth.admin.createUser({
    email: LEAD_ADMIN_EMAIL,
    password: LEAD_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "Quản trị Lead Sale" },
  });
  if (error) throw error;
  await client.query("begin");
  const result = await client.query(
    "update public.sales set administrator=true,disabled=false where user_id=$1 returning id",
    [data.user.id],
  );
  if (!result.rowCount)
    throw new Error("Auth profile trigger did not create the account profile.");
  await client.query(
    "insert into public.lead_user_roles(sales_id,role_code,team_id) values($1,'admin','default')",
    [result.rows[0].id],
  );
  await client.query("commit");
  process.stdout.write(
    "Administrator provisioned. Sign in using the email and password supplied.\n",
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
