import pg, { type PoolConfig, type QueryResult } from 'pg';
import path from 'node:path';

const { Pool } = pg;

// Load .env automatically if available in runtime environment
if (typeof process.loadEnvFile === 'function') {
  try {
    const repositoryRoot = path.basename(process.cwd()) === 'backend'
      ? path.resolve(process.cwd(), '..')
      : process.cwd();
    process.loadEnvFile(path.join(repositoryRoot, '.env'));
  } catch {
    // Ignore when .env does not exist
  }
}

let pool: pg.Pool | null = null;

export function getPoolConfig(): PoolConfig {
  const connectionString = process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
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
