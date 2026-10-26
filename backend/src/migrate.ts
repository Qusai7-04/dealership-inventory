import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import pg, { type PoolConfig } from 'pg';
import { getPool, getPoolConfig, closePool } from './db.js';

const { Pool } = pg;

export function sanitizeDbTarget(connectionString?: string): string {
  if (!connectionString) {
    return `host: ${process.env.PGHOST ?? 'localhost'}, port: ${process.env.PGPORT ?? 5432}, database: ${process.env.PGDATABASE ?? 'dealership_inventory'}`;
  }
  try {
    const parsed = new URL(connectionString);
    const port = parsed.port || '5432';
    const db = parsed.pathname.replace(/^\//, '') || 'default';
    return `host: ${parsed.hostname}, port: ${port}, database: ${db}`;
  } catch {
    return 'custom connection target';
  }
}

export function getMigrationPoolConfig(): PoolConfig {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DIRECT_URL ||
    (process.env.NODE_ENV === 'test'
      ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
      : process.env.DATABASE_URL);

  if (connectionString) {
    const isNeonOrCloud =
      connectionString.includes('sslmode=require') ||
      connectionString.includes('neon.tech') ||
      process.env.PGSSLMODE === 'require';

    const poolConfig: PoolConfig = {
      connectionString,
      max: 1,
      connectionTimeoutMillis: 10000,
    };

    if (isNeonOrCloud) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    return poolConfig;
  }

  return getPoolConfig();
}

export function resolveMigrationsDir(explicitDir?: string): string {
  if (explicitDir) return explicitDir;
  const candidates = [
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'backend/migrations'),
    path.resolve(__dirname, '../migrations'),
    path.resolve(__dirname, '../../migrations'),
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(process.cwd(), 'migrations');
}

export async function runMigrations(
  targetPool: pg.Pool = getPool(),
  migrationsDir?: string
): Promise<string[]> {
  const dir = resolveMigrationsDir(migrationsDir);
  const client = await targetPool.connect();
  const appliedMigrations: string[] = [];

  try {
    // 1. Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already applied migration names
    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY id ASC;'
    );
    const existing = new Set(rows.map((r) => r.name));

    // 3. Read migration directory
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sqlFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort();

    // 4. Apply each pending migration in its own transaction
    for (const file of sqlFiles) {
      if (existing.has(file)) {
        continue;
      }

      const filePath = path.join(dir, file);
      const sqlContent = await fs.readFile(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1);',
          [file]
        );
        await client.query('COMMIT');
        appliedMigrations.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return appliedMigrations;
  } finally {
    client.release();
  }
}

// CLI entry point
const isDirectExecution =
  Boolean(process.argv[1]) &&
  (path.resolve(process.argv[1]).toLowerCase().endsWith('migrate.ts') ||
    path.resolve(process.argv[1]).toLowerCase().endsWith('migrate.js'));

if (isDirectExecution) {
  const config = getMigrationPoolConfig();
  console.log(`Target database for migrations: ${sanitizeDbTarget(config.connectionString)}`);
  const migrationPool = new Pool(config);

  runMigrations(migrationPool)
    .then((applied) => {
      if (applied.length === 0) {
        console.log('Database schema is already up to date. No migrations to apply.');
      } else {
        console.log(`Successfully applied ${applied.length} migration(s):`);
        for (const file of applied) {
          console.log(`  - ${file}`);
        }
      }
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await migrationPool.end();
      await closePool();
    });
}
