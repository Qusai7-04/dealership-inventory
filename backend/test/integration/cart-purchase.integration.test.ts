import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

  beforeEach(async () => {
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ANY($1::uuid[]))', [users]);
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
    await request(app).post('/api/cart/items').set(bearer(1)).send({ vehicleId: id }).expect(200);
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

  it('buys one unit directly and stores immutable server-side snapshots', async () => {
    const id = await vehicle('direct', 1, '12.35');
    const requestId = crypto.randomUUID();
    await request(app).post(`/api/vehicles/${id}/purchase`).send({ requestId }).expect(401);
    await request(app).post('/api/vehicles/bad/purchase').set(bearer(0)).send({ requestId }).expect(400);
    await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(0)).send({ requestId: 'bad' }).expect(400);
    await request(app).post(`/api/vehicles/${crypto.randomUUID()}/purchase`).set(bearer(0)).send({ requestId }).expect(404);
    const bought = await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(0)).send({ requestId }).expect(200);
    expect(bought.body.purchase).toMatchObject({ source: 'direct', totalPrice: '12.35', items: [{ vehicleId: id, unitPrice: '12.35' }] });
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(0);
    await pool.query("UPDATE vehicles SET make = make || '-new', price = 99 WHERE id = $1", [id]);
    expect((await pool.query('SELECT vehicle_label, unit_price FROM purchase_items WHERE purchase_id = $1', [bought.body.purchase.id])).rows[0]).toMatchObject({ unit_price: '12.35' });
    await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(1)).send({ requestId: crypto.randomUUID() }).expect(409);
  });

  it('checks out distinct items atomically at confirmed prices and keeps the reusable cart', async () => {
    const a = await vehicle('checkout-a', 2, '0.10');
    const b = await vehicle('checkout-b', 2, '0.20');
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: a }).expect(200);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: b }).expect(200);
    const cartId = (await request(app).get('/api/cart').set(bearer(0))).body.cart.id;
    const body = { requestId: crypto.randomUUID(), items: [{ vehicleId: a, price: '0.10' }, { vehicleId: b, price: '0.20' }] };
    const result = await request(app).post('/api/cart/checkout').set(bearer(0)).send(body).expect(200);
    expect(result.body.purchase).toMatchObject({ source: 'cart', totalPrice: '0.30' });
    expect(result.body.purchase.items).toHaveLength(2);
    expect((await request(app).get('/api/cart').set(bearer(0))).body).toMatchObject({ cart: { id: cartId }, items: [] });
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = ANY($1::uuid[]) ORDER BY id', [[a, b]])).rows.map((row) => row.quantity)).toEqual([1, 1]);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send({ requestId: crypto.randomUUID(), items: [] }).expect(409);
  });

  it('rejects stale prices and unavailable later items without changing stock or cart', async () => {
    const a = await vehicle('stale-a', 2, '1.00');
    const b = await vehicle('stale-b', 1, '2.00');
    for (const id of [a, b]) await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    const body = { requestId: crypto.randomUUID(), items: [{ vehicleId: a, price: '1.00' }, { vehicleId: b, price: '2.00' }] };
    await pool.query('UPDATE vehicles SET price = 3 WHERE id = $1', [b]);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send(body).expect(409);
    await pool.query('UPDATE vehicles SET price = 2, quantity = 0 WHERE id = $1', [b]);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send(body).expect(409);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [a])).rows[0].quantity).toBe(2);
    expect((await request(app).get('/api/cart').set(bearer(0))).body.itemCount).toBe(2);
    expect((await pool.query('SELECT count(*)::int AS count FROM purchases WHERE request_id = $1', [body.requestId])).rows[0].count).toBe(0);
  });

  it('rolls back earlier checkout work if a later purchase item insert fails', async () => {
    const [a, b] = [await vehicle('rollback-a', 2), await vehicle('rollback-b', 2)].sort();
    for (const id of [a, b]) await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    const functionName = `fail_purchase_${process.pid}`;
    await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.vehicle_id = '${b}' THEN RAISE EXCEPTION 'forced test failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER ${functionName} BEFORE INSERT ON purchase_items FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    const requestId = crypto.randomUUID();
    try {
      await request(app).post('/api/cart/checkout').set(bearer(0)).send({ requestId, items: [{ vehicleId: a, price: '10.25' }, { vehicleId: b, price: '10.25' }] }).expect(500);
      expect((await pool.query('SELECT quantity FROM vehicles WHERE id = ANY($1::uuid[])', [[a, b]])).rows.map((row) => row.quantity)).toEqual([2, 2]);
      expect((await pool.query('SELECT count(*)::int AS count FROM purchases WHERE request_id = $1', [requestId])).rows[0].count).toBe(0);
      expect((await request(app).get('/api/cart').set(bearer(0))).body.itemCount).toBe(2);
    } finally {
      await pool.query(`DROP TRIGGER ${functionName} ON purchase_items`);
      await pool.query(`DROP FUNCTION ${functionName}()`);
    }
  });

  it('returns original results on exact retries and conflicts on request key reuse', async () => {
    const a = await vehicle('retry-direct', 2);
    const directKey = crypto.randomUUID();
    const direct = await request(app).post(`/api/vehicles/${a}/purchase`).set(bearer(0)).send({ requestId: directKey }).expect(200);
    const repeated = await Promise.all([1, 2].map(() => request(app).post(`/api/vehicles/${a}/purchase`).set(bearer(0)).send({ requestId: directKey }).expect(200)));
    expect(repeated.map((result) => result.body.purchase.id)).toEqual([direct.body.purchase.id, direct.body.purchase.id]);
    const b = await vehicle('retry-cart', 2);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: b }).expect(200);
    const checkoutBody = { requestId: crypto.randomUUID(), items: [{ vehicleId: b, price: '10.25' }] };
    const first = await request(app).post('/api/cart/checkout').set(bearer(0)).send(checkoutBody).expect(200);
    const again = await Promise.all([1, 2].map(() => request(app).post('/api/cart/checkout').set(bearer(0)).send(checkoutBody).expect(200)));
    expect(again.map((result) => result.body.purchase.id)).toEqual([first.body.purchase.id, first.body.purchase.id]);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send({ ...checkoutBody, requestId: directKey }).expect(409);
    await request(app).post(`/api/vehicles/${a}/purchase`).set(bearer(0)).send({ requestId: checkoutBody.requestId }).expect(409);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send({ ...checkoutBody, items: [{ vehicleId: a, price: '10.25' }] }).expect(409);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send({ ...checkoutBody, items: [{ vehicleId: b, price: '10.26' }] }).expect(409);
    await request(app).post(`/api/vehicles/${b}/purchase`).set(bearer(0)).send({ requestId: directKey }).expect(409);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [a])).rows[0].quantity).toBe(1);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [b])).rows[0].quantity).toBe(1);
  });

  it('serializes simultaneous first attempts with the same request ID', async () => {
    const directId = await vehicle('same-key-direct', 1);
    const directKey = crypto.randomUUID();
    const direct = await Promise.all([1, 2].map(() => request(app).post(`/api/vehicles/${directId}/purchase`).set(bearer(0)).send({ requestId: directKey }).expect(200)));
    expect(direct[0].body.purchase.id).toBe(direct[1].body.purchase.id);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [directId])).rows[0].quantity).toBe(0);
    const cartId = await vehicle('same-key-cart', 1);
    await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: cartId }).expect(200);
    const body = { requestId: crypto.randomUUID(), items: [{ vehicleId: cartId, price: '10.25' }] };
    const cart = await Promise.all([1, 2].map(() => request(app).post('/api/cart/checkout').set(bearer(0)).send(body).expect(200)));
    expect(cart[0].body.purchase.id).toBe(cart[1].body.purchase.id);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [cartId])).rows[0].quantity).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM purchase_items WHERE vehicle_id = ANY($1::uuid[])', [[directId, cartId]])).rows[0].count).toBe(2);
  });

  it('lets only one competing buyer take the last unit', async () => {
    const id = await vehicle('last-unit', 1);
    const results = await Promise.all([0, 1].map((index) => request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(index)).send({ requestId: crypto.randomUUID() })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM purchase_items WHERE vehicle_id = $1', [id])).rows[0].count).toBe(1);
  });

  it('lets only one competing checkout take the last shared unit', async () => {
    const id = await vehicle('checkout-last', 1);
    for (const index of [0, 1]) await request(app).post('/api/cart/items').set(bearer(index)).send({ vehicleId: id }).expect(200);
    const results = await Promise.all([0, 1].map((index) => request(app).post('/api/cart/checkout').set(bearer(index)).send({ requestId: crypto.randomUUID(), items: [{ vehicleId: id, price: '10.25' }] })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM purchase_items WHERE vehicle_id = $1', [id])).rows[0].count).toBe(1);
    const loser = results.findIndex((result) => result.status === 409);
    expect((await request(app).get('/api/cart').set(bearer(loser))).body.itemCount).toBe(1);
  });

  it('rejects deleted stock lines and malformed purchase input', async () => {
    const id = await vehicle('deleted-direct', 1);
    await pool.query('UPDATE vehicles SET deleted_at = now() WHERE id = $1', [id]);
    await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(0)).send({ requestId: crypto.randomUUID() }).expect(404);
    await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(0)).send({ requestId: crypto.randomUUID(), totalPrice: 0 }).expect(400);
    await request(app).post('/api/cart/checkout').send({ requestId: crypto.randomUUID(), items: [] }).expect(401);
  });
});
