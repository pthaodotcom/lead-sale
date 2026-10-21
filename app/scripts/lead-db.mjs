import { readFileSync, existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";
if (existsSync(".env.server.local")) loadEnvFile(".env.server.local");
export function databaseOptions() {
  if (!process.env.LEAD_DATABASE_URL)
    throw new Error("Set server-only LEAD_DATABASE_URL.");
  return {
    connectionString: process.env.LEAD_DATABASE_URL,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.LEAD_DB_CA_FILE
        ? { ca: readFileSync(process.env.LEAD_DB_CA_FILE) }
        : {}),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  };
}
export const databaseClient = () => new pg.Client(databaseOptions());
