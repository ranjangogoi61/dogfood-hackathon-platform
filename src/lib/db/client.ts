import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let pool: Pool | null = null;
let database: NodePgDatabase | null = null;

function getPool() {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");

  pool = new Pool({
    connectionString: url,
    max: 10,
  });

  return pool;
}

function getDb(): NodePgDatabase {
  if (!database) database = drizzle(getPool());
  return database;
}

// Lazy: DATABASE_URL is only required on first real query, not at import
// time, so `next build` (no DB in the build stage) and unit tests still work.
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function pingDatabase() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
  }
