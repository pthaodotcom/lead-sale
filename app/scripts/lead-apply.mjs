import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { databaseClient } from "./lead-db.mjs";
const version = "20261021000000";
const sql = await readFile(
  `backend/supabase/migrations/${version}_lead_sale.sql`,
  "utf8",
);
const hash = createHash("sha256").update(sql).digest("hex");
const client = databaseClient();
try {
  await client.connect();
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(179826222)");
  const existing = (
    await client.query(
      "select to_regclass('private.lead_schema_versions') as history,to_regclass('public.leads') as leads",
    )
  ).rows[0];
  if (existing.history) {
    const applied = (
      await client.query(
        "select hash from private.lead_schema_versions where version=$1",
        [version],
      )
    ).rows[0];
    if (
      ![
        hash,
        createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"),
        createHash("sha256")
          .update(sql.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"))
          .digest("hex"),
      ].includes(applied?.hash)
    )
      throw new Error(
        "Schema version differs. Create a reviewed forward migration; do not rerun or overwrite the bootstrap.",
      );
    process.stdout.write("Lead Sale schema is already applied.\n");
  } else {
    if (existing.leads)
      throw new Error(
        "Lead Sale tables already exist without migration history. Verify the existing schema before adopting it; no changes were applied.",
      );
    await client.query(sql);
    await client.query(
      "create table private.lead_schema_versions(version text primary key,hash text not null,applied_at timestamptz not null default now())",
    );
    await client.query(
      "revoke all on private.lead_schema_versions from public,anon,authenticated",
    );
    await client.query(
      "insert into private.lead_schema_versions(version,hash) values($1,$2)",
      [version, hash],
    );
    process.stdout.write("Lead Sale schema applied.\n");
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
