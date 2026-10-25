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

  it('enforces favourite defaults and notification integrity in PostgreSQL', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userId = (await client.query("INSERT INTO users (full_name, email, password_hash) VALUES ('Schema User', $1, 'test-hash') RETURNING id", [`schema-${crypto.randomUUID()}@example.com`])).rows[0].id;
      const categoryId = (await client.query('INSERT INTO vehicle_categories (name) VALUES ($1) RETURNING id', [`schema-${crypto.randomUUID()}`])).rows[0].id;
      const vehicleId = (await client.query('INSERT INTO vehicles (make, model, category_id, price) VALUES ($1, $2, $3, 1) RETURNING id', [`schema-${crypto.randomUUID()}`, 'Model', categoryId])).rows[0].id;
      const favourite = await client.query('INSERT INTO favourites (user_id, vehicle_id) VALUES ($1, $2) RETURNING notify_on_restock', [userId, vehicleId]);
      expect(favourite.rows[0].notify_on_restock).toBe(false);
      const rejected = async (sql: string, values: unknown[], code: string) => {
        await client.query('SAVEPOINT invalid_row');
        await expect(client.query(sql, values)).rejects.toMatchObject({ code });
        await client.query('ROLLBACK TO SAVEPOINT invalid_row');
        await client.query('RELEASE SAVEPOINT invalid_row');
      };
      await rejected('INSERT INTO favourites (user_id, vehicle_id) VALUES ($1, $2)', [userId, vehicleId], '23505');
      await rejected('INSERT INTO favourites (user_id, vehicle_id) VALUES ($1, $2)', [crypto.randomUUID(), vehicleId], '23503');
      await rejected("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'unknown', 'event', 'Message')", [userId, vehicleId], '23514');
      await rejected("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'low_stock', ' ', 'Message')", [userId, vehicleId], '23514');
      await rejected("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'low_stock', 'event', ' ')", [userId, vehicleId], '23514');
      await rejected("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'low_stock', 'event', 'Message')", [crypto.randomUUID(), vehicleId], '23503');
      await rejected("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'low_stock', 'event', 'Message')", [userId, crypto.randomUUID()], '23503');
      await client.query("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'low_stock', 'event', 'Message')", [userId, vehicleId]);
      await rejected("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'low_stock', 'event', 'Message')", [userId, vehicleId], '23505');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('creates constrained vehicle_images table once with required uniqueness and ordering', async () => {
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'));
    expect(await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))).toEqual([]);

    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_images'");
    expect(tables.rows.map((row) => row.table_name)).toEqual(['vehicle_images']);

    const constraints = await pool.query("SELECT conname FROM pg_constraint WHERE conrelid = 'vehicle_images'::regclass");
    expect(constraints.rows.map((row) => row.conname)).toEqual(expect.arrayContaining([
      'vehicle_images_pkey',
      'vehicle_images_vehicle_id_display_order_key',
    ]));

    const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'vehicle_images'");
    expect(indexes.rows.map((row) => row.indexname)).toContain('idx_vehicle_images_vehicle_id');

    // Test constraints in a rolled-back transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const categoryId = (await client.query('INSERT INTO vehicle_categories (name) VALUES ($1) RETURNING id', [`schema-img-${crypto.randomUUID()}`])).rows[0].id;
      const vehicleId = (await client.query('INSERT INTO vehicles (make, model, category_id, price) VALUES ($1, $2, $3, 100) RETURNING id', [`make-${crypto.randomUUID()}`, 'model', categoryId])).rows[0].id;

      // Valid insert
      const img = await client.query(
        'INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order) VALUES ($1, $2, $3, $4) RETURNING id, display_order',
        [vehicleId, 'https://example.com/car.png', 'Test car alt text', 0]
      );
      expect(img.rows[0].display_order).toBe(0);

      const rejected = async (sql: string, values: unknown[], code: string) => {
        await client.query('SAVEPOINT invalid_img');
        await expect(client.query(sql, values)).rejects.toMatchObject({ code });
        await client.query('ROLLBACK TO SAVEPOINT invalid_img');
        await client.query('RELEASE SAVEPOINT invalid_img');
      };

      // Duplicate (vehicle_id, display_order) -> 23505
      await rejected(
        'INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order) VALUES ($1, $2, $3, $4)',
        [vehicleId, 'https://example.com/car2.png', 'Another car', 0],
        '23505'
      );

      // Negative display_order -> 23514
      await rejected(
        'INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order) VALUES ($1, $2, $3, $4)',
        [vehicleId, 'https://example.com/car2.png', 'Another car', -1],
        '23514'
      );

      // Blank url -> 23514
      await rejected(
        'INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order) VALUES ($1, $2, $3, $4)',
        [vehicleId, '   ', 'Another car', 1],
        '23514'
      );

      // Blank alt_text -> 23514
      await rejected(
        'INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order) VALUES ($1, $2, $3, $4)',
        [vehicleId, 'https://example.com/car.png', '   ', 1],
        '23514'
      );

      // Invalid vehicle_id -> 23503
      await rejected(
        'INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), 'https://example.com/car.png', 'Alt text', 1],
        '23503'
      );

      // Restrict delete on vehicles when referenced by vehicle_images -> 23503
      await rejected('DELETE FROM vehicles WHERE id = $1', [vehicleId], '23503');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

