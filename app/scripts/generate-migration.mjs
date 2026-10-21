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
