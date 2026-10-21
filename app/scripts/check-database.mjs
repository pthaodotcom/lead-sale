import pg from "pg";
if (!process.env.LEAD_DATABASE_URL)
  throw new Error("Set LEAD_DATABASE_URL for the database to inspect.");
const client = new pg.Client({
  connectionString: process.env.LEAD_DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.LEAD_DB_SSL_VERIFY !== "false" },
});
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
