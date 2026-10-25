import { describe, expect, it, afterAll } from 'vitest';
import pg from 'pg';
import path from 'node:path';
import { runMigrations } from '../../src/migrate.js';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe.skipIf(!connectionString)('Migration Live Integration Tests', () => {
  const pool = new pg.Pool({ connectionString });

  afterAll(async () => {
    await pool.end();
  });

  it('runs initial migrations and verifies tables exist', async () => {
    const applied = await runMigrations(pool, path.resolve(process.cwd(), 'migrations'));
    expect(Array.isArray(applied)).toBe(true);

    // Verify schema_migrations table exists and has rows
    const { rows: migrationRows } = await pool.query(
      'SELECT name FROM schema_migrations WHERE name = $1;',
      ['001_create_users_categories_vehicles.sql']
    );
    expect(migrationRows.length).toBe(1);

    // Verify users, vehicle_categories, vehicles tables exist in information_schema
    const { rows: tableRows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'vehicle_categories', 'vehicles');
    `);
    const tableNames = tableRows.map((r: { table_name: string }) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('vehicle_categories');
    expect(tableNames).toContain('vehicles');
  });
});
