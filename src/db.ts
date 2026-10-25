import pg, { type PoolConfig, type QueryResult } from 'pg';

const { Pool } = pg;

// Load .env automatically if available in runtime environment
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore when .env does not exist
  }
}

let pool: pg.Pool | null = null;

export function getPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
    };
  }

  return {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'dealership_app',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE ?? 'dealership_inventory',
  };
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
}

export async function query<R extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  const currentPool = getPool();
  if (params !== undefined) {
    return currentPool.query<R>(text, params);
  }
  return currentPool.query<R>(text);
}

export async function checkDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await query('SELECT 1;');
    return { ok: true };
  } catch (error) {
    // Sanitize error: never leak credentials or internal connection strings
    return { ok: false, error: 'Database connection check failed' };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
