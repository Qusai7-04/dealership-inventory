import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { createAccessToken } from '../../src/auth.js';
import { runMigrations } from '../../src/migrate.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

const pool = new pg.Pool({ connectionString: requireTestDatabaseUrl() });
const prefix = `cart-${process.pid}-${Date.now()}`;
process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters-long';

describe('cart and purchase integration', () => {
  let users: string[];
  const bearer = (index: number) => ({ Authorization: `Bearer ${createAccessToken(users[index])}` });

  beforeAll(async () => {
    await runMigrations(pool);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES
       ('Cart One', $1, 'test-hash'), ('Cart Two', $2, 'test-hash') RETURNING id`,
      [`${prefix}-one@example.com`, `${prefix}-two@example.com`]
    );
    users = result.rows.map((row) => row.id);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ANY($1::uuid[]))', [users]);
    await pool.query('DELETE FROM carts WHERE user_id = ANY($1::uuid[])', [users]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
    await pool.end();
  });

  it('enforces one cart per user and keeps cart reads isolated', async () => {
    const first = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [users[0]]);
    await expect(pool.query('INSERT INTO carts (user_id) VALUES ($1)', [users[0]])).rejects.toMatchObject({ code: '23505' });
    const second = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [users[1]]);
    expect(first.rows[0].id).not.toBe(second.rows[0].id);
    expect((await request(app).get('/api/cart').set(bearer(0))).body.cart.id).toBe(first.rows[0].id);
    expect((await request(app).get('/api/cart').set(bearer(1))).body.cart.id).toBe(second.rows[0].id);
  });
});
