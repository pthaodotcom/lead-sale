import { databaseClient } from "./lead-db.mjs";
const client = databaseClient();
try {
  await client.connect();
  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname='public' and (tablename like 'lead_%' or tablename in ('leads','sales')) order by tablename",
  );
  process.stdout.write(
    JSON.stringify({ tables: rows.map((r) => r.tablename) }, null, 2) + "\n",
  );
} finally {
  await client.end();
}
