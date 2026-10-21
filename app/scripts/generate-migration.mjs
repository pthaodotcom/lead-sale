import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
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
await writeFile(root + "/migrations/20261021000000_lead_sale.sql", sql);
process.stdout.write("Generated Lead Sale bootstrap migration.\n");
