import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
const root = "backend/supabase";
const files = (await readdir(root + "/schemas"))
  .filter((f) => /^1[0-5]_.*\.sql$/.test(f))
  .sort();
const sql =
  "-- Generated from backend/supabase/schemas by npm run db:generate.\n" +
  (
    await Promise.all(
      files.map((f) => readFile(root + "/schemas/" + f, "utf8")),
    )
  ).join("\n");
await mkdir(root + "/migrations", { recursive: true });
const bootstrap = root + "/migrations/20261021000000_lead_sale.sql";
try {
  await access(bootstrap);
} catch {
  await writeFile(bootstrap, sql, { flag: "wx" });
}
const extensions = (await readdir(root + "/schemas"))
  .filter((f) => /^1[6-9]_.*\.sql$/.test(f))
  .sort();
const forward = (
  await Promise.all(
    extensions.map((f) => readFile(root + "/schemas/" + f, "utf8")),
  )
).join("\n");
const target = root + "/migrations/20261021010000_core_workflow.sql";
let existing;
try {
  existing = await readFile(target, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (
  existing !== undefined &&
  existing.replaceAll("\r\n", "\n") !== forward.replaceAll("\r\n", "\n")
)
  throw new Error(
    "Forward migration already exists. Create a new version instead of overwriting an applied migration.",
  );
if (existing === undefined) await writeFile(target, forward, { flag: "wx" });
process.stdout.write(
  "Generated forward migration. Applied files must never be regenerated after deployment.\n",
);
const report = await readFile(
  root + "/schemas/20_lead_sale_provenance.sql",
  "utf8",
);
const reportTarget = root + "/migrations/20261021020000_result_provenance.sql";
let oldReport;
try {
  oldReport = await readFile(reportTarget, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (
  oldReport !== undefined &&
  oldReport.replaceAll("\r\n", "\n") !== report.replaceAll("\r\n", "\n")
)
  throw new Error("Report migration exists; create a new version.");
if (oldReport === undefined)
  await writeFile(reportTarget, report, { flag: "wx" });
const intake = await readFile(
  root + "/schemas/21_lead_sale_public_intake.sql",
  "utf8",
);
const intakeTarget = root + "/migrations/20261022010000_public_intake.sql";
let oldIntake;
try {
  oldIntake = await readFile(intakeTarget, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (
  oldIntake !== undefined &&
  oldIntake.replaceAll("\r\n", "\n") !== intake.replaceAll("\r\n", "\n")
)
  throw new Error("Public intake migration exists; create a new version.");
if (oldIntake === undefined)
  await writeFile(intakeTarget, intake, { flag: "wx" });
for (const [schema, version] of [
  ["22_lead_sale_inbox.sql", "20261022020000_inbox.sql"],
  ["23_lead_sale_voice.sql", "20261022030000_voice.sql"],
  ["24_lead_sale_review.sql", "20261024000000_note_review.sql"],
  ["25_lead_sale_review_reports.sql", "20261024010000_note_reports.sql"],
  [
    "26_lead_sale_reports_all_roles.sql",
    "20261025000000_reports_all_roles.sql",
  ],
  [
    "26_lead_sale_telesale_workflow.sql",
    "20261025014000_ac07_leadnote_permission.sql",
  ],
  ["27_lead_sale_admin.sql", "20261025020000_admin_accounts.sql"],
  ["28_lead_sale_close_success.sql", "20261026000000_close_success.sql"],
  ["29_lead_sale_relational.sql", "20261026010000_relational_tables.sql"],
]) {
  const next = await readFile(root + "/schemas/" + schema, "utf8");
  const file = root + "/migrations/" + version;
  let saved;
  try {
    saved = await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    saved !== undefined &&
    saved.replaceAll("\r\n", "\n") !== next.replaceAll("\r\n", "\n")
  )
    throw new Error("Applied migration content drift: " + version);
  if (saved === undefined) await writeFile(file, next, { flag: "wx" });
}
