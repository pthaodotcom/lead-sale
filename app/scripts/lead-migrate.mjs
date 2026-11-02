import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { databaseClient } from "./lead-db.mjs";
const client = databaseClient();
try {
  await client.connect();
  await client.query("begin");
  await client.query(
    "select pg_advisory_xact_lock(179826222),pg_advisory_xact_lock(179826221)",
  );
  const moved = new Set([
    "leads",
    "lead_assignments",
    "lead_activities",
    "lead_appointments",
    "lead_closure_reviews",
    "lead_notifications",
    "lead_audit_logs",
    "lead_receptions",
    "lead_attachments",
    "lead_care_rounds",
  ]);
  const wasNormalized = Boolean(
    (await client.query("select to_regclass('private.compat_leads') present"))
      .rows[0].present,
  );
  const counts = async () => {
    const normalized = Boolean(
      (await client.query("select to_regclass('private.compat_leads') present"))
        .rows[0].present,
    );
    const schema = normalized ? "private" : "public";
    const prefix = normalized ? "compat_" : "";
    return (
      await client.query(
        `select (select count(*) from ${schema}.${prefix}leads)::int leads,(select count(*) from ${schema}.${prefix}lead_assignments)::int tickets,(select count(*) from ${schema}.${prefix}lead_activities)::int activities`,
      )
    ).rows[0];
  };
  const before = await counts();
  const tables = (
    await client.query(
      "select schemaname,tablename from pg_tables where (schemaname='public' and (tablename like 'lead_%' or tablename like 'leads_%' or tablename in ('leads','sales','groups','users','vehicles','cities','notifications','appointment_registration_history'))) or (schemaname='private' and tablename like 'compat_%') order by schemaname,tablename",
    )
  ).rows;
  await client.query(
    "lock table " +
      tables
        .map(
          (t) => pgIdentifier(t.schemaname) + "." + pgIdentifier(t.tablename),
        )
        .join(",") +
      " in share row exclusive mode",
  );
  const resources = async () => {
    const data = {};
    const normalized = Boolean(
      (await client.query("select to_regclass('private.compat_leads') present"))
        .rows[0].present,
    );
    for (const t of tables) {
      const relocated =
        !wasNormalized &&
        normalized &&
        t.schemaname === "public" &&
        moved.has(t.tablename);
      const location = relocated
        ? "private." + pgIdentifier("compat_" + t.tablename)
        : pgIdentifier(t.schemaname) + "." + pgIdentifier(t.tablename);
      data[t.schemaname + "." + t.tablename] = (
        await client.query(
          `select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') rows from ${location} x`,
        )
      ).rows[0].rows;
    }
    return data;
  };
  const backup = await resources();
  await mkdir(".playwright-mcp", { recursive: true });
  await writeFile(
    `.playwright-mcp/before-core-${Date.now()}.json`,
    JSON.stringify(backup, null, 2),
    { flag: "wx" },
  );
  for (const file of (await readdir("backend/supabase/migrations"))
    .filter((f) => /^\d{14}_/.test(f))
    .sort()) {
    const version = file.slice(0, 14),
      sql = await readFile("backend/supabase/migrations/" + file, "utf8");
    const hash = createHash("sha256")
      .update(sql.replaceAll("\r\n", "\n"))
      .digest("hex");
    const rawHash = createHash("sha256").update(sql).digest("hex");
    const windowsHash = createHash("sha256")
      .update(sql.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"))
      .digest("hex");
    const applied = (
      await client.query(
        "select hash from private.lead_schema_versions where version=$1",
        [version],
      )
    ).rows[0];
    if (applied) {
      if (![hash, rawHash, windowsHash].includes(applied.hash))
        throw new Error("Applied migration hash differs: " + file);
      continue;
    }
    if (version === "20261021000000")
      throw new Error("Run db:apply only for an empty database first.");
    await client.query(sql);
    await client.query(
      "insert into private.lead_schema_versions(version,hash) values($1,$2)",
      [version, hash],
    );
    process.stdout.write("Applied " + file + "\n");
  }
  const after = await counts();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("Preservation check failed.");
  if (JSON.stringify(backup) !== JSON.stringify(await resources()))
    throw new Error("Existing resource data changed during migration.");
  await client.query("notify pgrst,'reload schema'");
  await client.query("commit");
  process.stdout.write(JSON.stringify({ preserved: after }) + "\n");
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
function pgIdentifier(value) {
  return '"' + value.replaceAll('"', '""') + '"';
}
