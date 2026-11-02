import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { databaseClient } from "./lead-db.mjs";
const version = "20261026010000";
const moved = [
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
];
const normalized = [
  "groups",
  "users",
  "vehicles",
  "cities",
  "leads",
  "leads_profile_update",
  "leads_profile_update_note",
  "leads_profile_update_status",
  "leads_profile_update_detail",
  "notifications",
  "lead_assignment_tickets",
  "lead_assignment_ticket_calls",
  "lead_assignment_ticket_inbox",
  "appointment_registration_history",
  "lead_closed_ticket_reviews",
];
const sql = await readFile(
  `backend/supabase/migrations/${version}_relational_tables.sql`,
  "utf8",
);
const hash = createHash("sha256")
  .update(sql.replaceAll("\r\n", "\n"))
  .digest("hex");
const c = databaseClient();
const apply = process.argv.includes("--apply");
const qi = (x) => '"' + x.replaceAll('"', '""') + '"';
try {
  await c.connect();
  await c.query("begin");
  await c.query("set local statement_timeout=120000");
  await c.query(
    "select pg_advisory_xact_lock(179826222),pg_advisory_xact_lock(179826221)",
  );
  const existing = (
    await c.query(
      "select hash from private.lead_schema_versions where version=$1",
      [version],
    )
  ).rows[0];
  if (existing) {
    if (existing.hash !== hash)
      throw Error("Applied migration content differs");
    console.log("Relational migration already applied");
    await c.query("rollback");
    process.exitCode = 0;
  } else {
    const tables = (
      await c.query(
        "select tablename from pg_tables where schemaname='public' and (tablename like 'lead_%' or tablename in ('leads','sales')) order by tablename",
      )
    ).rows.map((x) => x.tablename);
    // Block concurrent business and account changes while backing up and verifying.
    await c.query(
      "lock table " +
        tables.map((x) => "public." + qi(x)).join(",") +
        " in share row exclusive mode",
    );
    const resources = async (after) => {
      const result = {};
      for (const n of tables) {
        const location =
          after && moved.includes(n)
            ? "private." + qi("compat_" + n)
            : "public." + qi(n);
        result[n] = (
          await c.query(
            `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data from ${location} t`,
          )
        ).rows[0].data;
      }
      return result;
    };
    const before = await resources(false);
    const actors = (
      await c.query(
        "select distinct on(r.role_code) r.role_code,s.user_id from public.sales s join public.lead_user_roles r on r.sales_id=s.id where not s.disabled and r.role_code in ('admin','intake','leader','telesale') order by r.role_code,s.id",
      )
    ).rows;
    const rpcSnapshots = async () => {
      const result = {};
      for (const actor of actors) {
        await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
          actor.user_id,
        ]);
        await c.query("set local role authenticated");
        result[actor.role_code] = (
          await c.query("select public.lead_snapshot() snapshot")
        ).rows[0].snapshot;
        await c.query("reset role");
      }
      await c.query("select set_config('request.jwt.claim.sub','',true)");
      return result;
    };
    const snapshotsBefore = await rpcSnapshots();
    const functions = (
      await c.query(
        "select pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'lead_%' and p.prokind='f'",
      )
    ).rows.map((x) => x.definition);
    const folder = ".vercel-deploy/relational-rollout";
    await mkdir(folder, { recursive: true });
    const stamp = Date.now();
    await writeFile(
      `${folder}/before-${stamp}.json`,
      JSON.stringify({ version, hash, resources: before, functions }, null, 2),
      { flag: "wx" },
    );
    // Structural rollback keeps compatibility payloads updated by all existing RPCs.
    const rollback =
      `begin;\nselect pg_advisory_xact_lock(179826222),pg_advisory_xact_lock(179826221);\ndo $ begin if exists(select 1 from public.leads_profile_update where legacy_audit_id is null) then raise exception 'New relational history exists; back it up and review rollback before proceeding'; end if; end $;\n` +
      [
        "lead_teams",
        "sales",
        "lead_user_roles",
        ...moved.filter(
          (x) =>
            ![
              "lead_audit_logs",
              "lead_receptions",
              "lead_attachments",
              "lead_care_rounds",
            ].includes(x),
        ),
      ]
        .map(
          (n) =>
            `drop trigger crm_normalize on ${moved.includes(n) ? "private." + qi("compat_" + n) : "public." + qi(n)};`,
        )
        .join("\n") +
      "\n" +
      normalized
        .slice()
        .reverse()
        .map((n) => `drop table public.${qi(n)} cascade;`)
        .join("\n") +
      "\n" +
      moved
        .map(
          (n) =>
            `alter table private.${qi("compat_" + n)} rename to ${qi(n)}; alter table private.${qi(n)} set schema public;`,
        )
        .join("\n") +
      "\n" +
      functions.join("\n") +
      `\ndelete from private.lead_schema_versions where version='${version}';\nnotify pgrst,'reload schema';\ncommit;\n`;
    await writeFile(`${folder}/rollback-${stamp}.sql`, rollback, {
      flag: "wx",
    });
    await c.query(sql);
    if (JSON.stringify(before) !== JSON.stringify(await resources(true)))
      throw Error("Compatibility data changed");
    if (
      JSON.stringify(snapshotsBefore) !== JSON.stringify(await rpcSnapshots())
    )
      throw Error("Role scoped RPC snapshot changed");
    for (const [old, newTable] of [
      ["leads", "leads"],
      ["lead_assignments", "lead_assignment_tickets"],
      ["lead_appointments", "appointment_registration_history"],
      ["lead_closure_reviews", "lead_closed_ticket_reviews"],
      ["lead_notifications", "notifications"],
    ]) {
      const rows = (
        await c.query(
          `select legacy_id from public.${qi(newTable)} order by legacy_id`,
        )
      ).rows
        .map((x) => x.legacy_id)
        .sort();
      const ids = before[old].map((x) => x.data.id).sort();
      if (JSON.stringify(ids) !== JSON.stringify(rows))
        throw Error("Mapping mismatch: " + old);
    }
    const activityIds = (
      await c.query(
        "select legacy_id from public.lead_assignment_ticket_calls union all select legacy_id from public.lead_assignment_ticket_inbox order by legacy_id",
      )
    ).rows
      .map((x) => x.legacy_id)
      .sort();
    if (
      JSON.stringify(before.lead_activities.map((x) => x.data.id).sort()) !==
      JSON.stringify(activityIds)
    )
      throw Error("Activity mapping mismatch");
    const invalid = (
      await c.query(
        "select conname from pg_constraint where connamespace='public'::regnamespace and not convalidated",
      )
    ).rows;
    if (invalid.length) throw Error("Unvalidated constraints");
    // Confirm each normalized scalar matches its preserved source, rather than counts alone.
    const mismatch = (
      await c.query(
        `select count(*)::int n from public.leads n join private.compat_leads o on o.id=n.legacy_id join public.vehicles v on v.vehicle_id=n.vehicle_id join public.cities c on c.city_id=n.city_id where n.name is distinct from o.data->>'name' or n.phone is distinct from o.phone or n.status::text is distinct from o.status or n.note is distinct from o.data->>'note' or v.type is distinct from o.data->>'vehicle' or c.name is distinct from o.data->>'city' or n.activated_at is distinct from (o.data->>'activatedAt')::timestamptz or n.onboarded_at is distinct from (o.data->>'onboardedAt')::timestamptz`,
      )
    ).rows[0].n;
    if (mismatch) throw Error("Normalized Lead scalar mismatch");
    const summary = {
      mode: apply ? "applied" : "rehearsal_rolled_back",
      tables: normalized.length,
      leads: before.leads.length,
      tickets: before.lead_assignments.length,
      activities: before.lead_activities.length,
      preserved: true,
    };
    if (apply) {
      await c.query(
        "insert into private.lead_schema_versions(version,hash) values($1,$2)",
        [version, hash],
      );
      await c.query("notify pgrst,'reload schema'");
      await c.query("commit");
    } else await c.query("rollback");
    await writeFile(
      `${folder}/result-${stamp}.json`,
      JSON.stringify(summary, null, 2),
    );
    console.log(JSON.stringify(summary));
  }
} catch (error) {
  await c.query("rollback").catch(() => {});
  throw error;
} finally {
  await c.end();
}
