import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { getPool, closePool } from './db.js';

export async function runMigrations(
  targetPool: pg.Pool = getPool(),
  migrationsDir: string = path.resolve(process.cwd(), 'migrations')
): Promise<string[]> {
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
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    const sqlFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort();

    // 4. Apply each pending migration in its own transaction
    for (const file of sqlFiles) {
      if (existing.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
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
  runMigrations()
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
    .finally(() => {
      closePool();
    });
}
