import { describe, expect, it, afterAll } from 'vitest';
import pg from 'pg';
import path from 'node:path';
import { runMigrations } from '../../src/migrate.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

const connectionString = requireTestDatabaseUrl();

describe('Migration Live Integration Tests', () => {
  const pool = new pg.Pool({ connectionString });

  afterAll(async () => {
    await pool.end();
  });

  it('runs initial migrations and verifies tables exist', async () => {
    const applied = await runMigrations(pool, path.resolve(process.cwd(), 'migrations'));
    expect(Array.isArray(applied)).toBe(true);

    // Verify schema_migrations table exists and has rows
    const { rows: migrationRows } = await pool.query(
      'SELECT name FROM schema_migrations WHERE name = ANY($1::text[]);',
      [['001_create_users_categories_vehicles.sql', '002_create_stock_receipts.sql', '003_add_stock_receipt_result_quantity.sql']]
    );
    expect(migrationRows.length).toBe(3);

    // Verify inventory and authentication tables exist in information_schema
    const { rows: tableRows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'vehicle_categories', 'vehicles', 'stock_receipts');
    `);
    const tableNames = tableRows.map((r: { table_name: string }) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('vehicle_categories');
    expect(tableNames).toContain('vehicles');
    expect(tableNames).toContain('stock_receipts');
  });

  it('applies cart and purchase schema once with required uniqueness', async () => {
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'));
    expect(await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))).toEqual([]);
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])", [['carts', 'cart_items', 'purchases', 'purchase_items']]);
    expect(tables.rows.map((row) => row.table_name).sort()).toEqual(['cart_items', 'carts', 'purchase_items', 'purchases']);
    const constraints = await pool.query("SELECT conname FROM pg_constraint WHERE conrelid IN ('carts'::regclass, 'cart_items'::regclass, 'purchases'::regclass, 'purchase_items'::regclass)");
    const names = constraints.rows.map((row) => row.conname);
    expect(names).toEqual(expect.arrayContaining(['carts_user_id_key', 'cart_items_pkey', 'purchases_user_id_request_id_key', 'purchase_items_purchase_id_vehicle_id_key']));
  });

  it('creates constrained favourites and targeted notification tables once', async () => {
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'));
    expect(await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))).toEqual([]);
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])", [['favourites', 'notifications']]);
    expect(tables.rows.map((row) => row.table_name).sort()).toEqual(['favourites', 'notifications']);
    const constraints = await pool.query("SELECT conname FROM pg_constraint WHERE conrelid IN ('favourites'::regclass, 'notifications'::regclass)");
    expect(constraints.rows.map((row) => row.conname)).toEqual(expect.arrayContaining([
      'favourites_pkey', 'notifications_recipient_id_type_event_key_key', 'notifications_type_check',
    ]));
    const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = ANY($1::text[])", [['favourites', 'notifications']]);
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining(['idx_favourites_restock_subscribers', 'idx_notifications_inbox']));
  });
});
