import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { databaseClient } from "./lead-db.mjs";
const client = databaseClient();
const version = "20261026000000";
const sql = await readFile(
  `backend/supabase/migrations/${version}_close_success.sql`,
  "utf8",
);
const hash = createHash("sha256")
  .update(sql.replaceAll("\r\n", "\n"))
  .digest("hex");
try {
  await client.connect();
  await client.query("begin");
  await client.query(
    "select pg_advisory_xact_lock(179826222),pg_advisory_xact_lock(179826221)",
  );
  const existing = (
    await client.query(
      "select hash from private.lead_schema_versions where version=$1",
      [version],
    )
  ).rows[0];
  if (existing) {
    if (existing.hash !== hash)
      throw new Error("Applied migration hash differs");
    await client.query("commit");
    console.log("Closure migration already applied");
  } else {
    const tables = (
      await client.query(
        "select tablename from pg_tables where schemaname='public' and (tablename like 'lead_%' or tablename in ('leads','sales')) order by tablename",
      )
    ).rows;
    async function resources() {
      const result = {};
      for (const { tablename } of tables) {
        const identifier = '"' + tablename.replaceAll('"', '""') + '"';
        result[tablename] = (
          await client.query(
            `select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') rows from public.${identifier} x`,
          )
        ).rows[0].rows;
      }
      return result;
    }
    const before = await resources();
    const functions = (
      await client.query(
        "select n.nspname schema,p.proname name,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname='lead_command') or (n.nspname='private' and p.proname='lead_command_pre_admin')",
      )
    ).rows;
    await mkdir(".vercel-deploy/close-success-rollout", { recursive: true });
    await writeFile(
      `.vercel-deploy/close-success-rollout/before-${Date.now()}.json`,
      JSON.stringify({ resources: before, functions }, null, 2),
      { flag: "wx" },
    );
    await client.query(sql);
    await client.query(
      "insert into private.lead_schema_versions(version,hash) values($1,$2)",
      [version, hash],
    );
    if (JSON.stringify(before) !== JSON.stringify(await resources()))
      throw new Error("Migration changed existing data");
    await client.query("notify pgrst,'reload schema'");
    await client.query("commit");
    console.log("Applied closure migration; existing data preserved");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
