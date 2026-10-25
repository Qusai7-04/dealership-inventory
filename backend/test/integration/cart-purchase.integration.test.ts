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
  let categoryId: number;
  const vehicle = async (name: string, quantity = 2, price = '10.25') => {
    const result = await pool.query('INSERT INTO vehicles (make, model, category_id, quantity, price) VALUES ($1, $2, $3, $4, $5) RETURNING id', [`${prefix}-${name}`, 'Model', categoryId, quantity, price]);
    return result.rows[0].id as string;
  };
  const bearer = (index: number) => ({ Authorization: `Bearer ${createAccessToken(users[index])}` });

  beforeAll(async () => {
    await runMigrations(pool);
    categoryId = (await pool.query('INSERT INTO vehicle_categories (name) VALUES ($1) RETURNING id', [`${prefix}-category`])).rows[0].id;
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES
       ('Cart One', $1, 'test-hash'), ('Cart Two', $2, 'test-hash') RETURNING id`,
      [`${prefix}-one@example.com`, `${prefix}-two@example.com`]
    );
    users = result.rows.map((row) => row.id);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE user_id = ANY($1::uuid[]))', [users]);
    await pool.query('DELETE FROM purchases WHERE user_id = ANY($1::uuid[])', [users]);
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ANY($1::uuid[]))', [users]);
    await pool.query('DELETE FROM carts WHERE user_id = ANY($1::uuid[])', [users]);
    await pool.query('DELETE FROM vehicles WHERE make LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM vehicle_categories WHERE id = $1', [categoryId]);
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

  it('reads an empty cart without creating one and adds one active stocked vehicle once', async () => {
    await pool.query('DELETE FROM carts WHERE user_id = $1', [users[0]]);
    expect((await request(app).get('/api/cart').set(bearer(0))).body).toMatchObject({ cart: null, items: [], itemCount: 0 });
    expect((await pool.query('SELECT id FROM carts WHERE user_id = $1', [users[0]])).rowCount).toBe(0);
    const id = await vehicle('add');
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    const cart = await request(app).get('/api/cart').set(bearer(0)).expect(200);
    expect(cart.body).toMatchObject({ itemCount: 1, subtotal: '10.25', items: [{ vehicleId: id, price: '10.25', stock: 2, available: true }] });
    expect((await request(app).get('/api/cart').set(bearer(1))).body.items).toEqual([]);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(2);
  });

  it('rejects invalid and unavailable additions but keeps later unavailable items readable', async () => {
    const id = await vehicle('unavailable', 1);
    await request(app).post('/api/cart/items').set(bearer(1)).send({ vehicleId: 'bad' }).expect(400);
    await request(app).post('/api/cart/items').set(bearer(1)).send({ vehicleId: crypto.randomUUID() }).expect(404);
    await request(app).post('/api/cart/items').set(bearer(1)).send({ vehicleId: id }).expect(200);
    await pool.query('UPDATE vehicles SET quantity = 0 WHERE id = $1', [id]);
    expect((await request(app).get('/api/cart').set(bearer(1))).body.items).toMatchObject([{ vehicleId: id, available: false, stock: 0 }]);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(409);
    await pool.query('UPDATE vehicles SET deleted_at = now() WHERE id = $1', [id]);
    expect((await request(app).get('/api/cart').set(bearer(1))).body.items[0].available).toBe(false);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(404);
  });

  it('removes only the owner item and clears without changing stock or deleting the cart', async () => {
    const id = await vehicle('remove', 3);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    await request(app).post('/api/cart/items').set(bearer(1)).send({ vehicleId: id }).expect(200);
    const cartId = (await request(app).get('/api/cart').set(bearer(0))).body.cart.id;
    await request(app).delete(`/api/cart/items/${id}`).set(bearer(0)).expect(200);
    await request(app).delete(`/api/cart/items/${id}`).set(bearer(0)).expect(200);
    expect((await request(app).get('/api/cart').set(bearer(1))).body.itemCount).toBeGreaterThan(0);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    await request(app).delete('/api/cart').set(bearer(0)).expect(200);
    await request(app).delete('/api/cart').set(bearer(0)).expect(200);
    expect((await request(app).get('/api/cart').set(bearer(0))).body).toMatchObject({ cart: { id: cartId }, itemCount: 0 });
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(3);
    await request(app).delete('/api/cart/items/bad').set(bearer(0)).expect(400);
  });
});
