import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { createAccessToken } from '../../src/auth.js';
import { runMigrations } from '../../src/migrate.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

const pool = new pg.Pool({ connectionString: requireTestDatabaseUrl() });
const prefix = `alerts-${process.pid}-${Date.now()}`;
process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters-long';

describe('favourites and targeted notifications', () => {
  let categoryId: number;
  let users: string[];
  const bearer = (index: number) => ({ Authorization: `Bearer ${createAccessToken(users[index])}` });
  const vehicle = async (name: string, quantity = 2, threshold = 3) => {
    const result = await pool.query(
      'INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold) VALUES ($1, $2, $3, 10.25, $4, $5) RETURNING id',
      [`${prefix}-${name}`, 'Model', categoryId, quantity, threshold]
    );
    return result.rows[0].id as string;
  };

  beforeAll(async () => {
    await runMigrations(pool);
    categoryId = (await pool.query('INSERT INTO vehicle_categories (name) VALUES ($1) RETURNING id', [`${prefix}-category`])).rows[0].id;
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES
       ('User One', $1, 'test-hash', 'user', true),
       ('User Two', $2, 'test-hash', 'user', true),
       ('Admin One', $3, 'test-hash', 'admin', true),
       ('Admin Two', $4, 'test-hash', 'admin', true),
       ('Inactive Admin', $5, 'test-hash', 'admin', false),
       ('Inactive User', $6, 'test-hash', 'user', false) RETURNING id`,
      Array.from({ length: 6 }, (_, index) => `${prefix}-${index}@example.com`)
    );
    users = result.rows.map((row) => row.id);
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM notifications WHERE recipient_id = ANY($1::uuid[])', [users]);
    await pool.query('DELETE FROM favourites WHERE user_id = ANY($1::uuid[])', [users]);
  });

  afterAll(async () => {
    if (users) {
      await pool.query('DELETE FROM notifications WHERE recipient_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM favourites WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE user_id = ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM purchases WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM stock_receipts WHERE actor_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM carts WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
    }
    if (categoryId) {
      await pool.query('DELETE FROM vehicles WHERE make LIKE $1', [`${prefix}%`]);
      await pool.query('DELETE FROM vehicle_categories WHERE id = $1', [categoryId]);
    }
    await pool.end();
  });

  it('saves only active stock lines for the owner, including zero-stock vehicles', async () => {
    const id = await vehicle('favourite', 0);
    await request(app).get('/api/favourites').expect(401);
    expect((await request(app).get('/api/favourites').set(bearer(0)).expect(200)).body.favourites).toEqual([]);
    await request(app).put(`/api/favourites/${id}`).set(bearer(0)).expect(200);
    await request(app).put(`/api/favourites/${id}`).set(bearer(0)).expect(200);
    const saved = await request(app).get('/api/favourites').set(bearer(0)).expect(200);
    expect(saved.body.favourites).toMatchObject([{ vehicleId: id, price: '10.25', stock: 0, available: false, notifyOnRestock: false }]);
    expect((await request(app).get('/api/favourites').set(bearer(1))).body.favourites).toEqual([]);
    expect((await pool.query('SELECT count(*)::int AS count FROM favourites WHERE user_id = $1 AND vehicle_id = $2', [users[0], id])).rows[0].count).toBe(1);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(0);
    await pool.query('UPDATE vehicles SET deleted_at = now() WHERE id = $1', [id]);
    expect((await request(app).get('/api/favourites').set(bearer(0))).body.favourites[0].available).toBe(false);
    await request(app).put(`/api/favourites/${id}`).set(bearer(1)).expect(404);
    await request(app).put('/api/favourites/bad').set(bearer(0)).expect(400);
    await request(app).put(`/api/favourites/${crypto.randomUUID()}`).set(bearer(0)).expect(404);
  });
});
