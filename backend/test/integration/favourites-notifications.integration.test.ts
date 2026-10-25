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
      await pool.query('DELETE FROM notifications WHERE vehicle_id IN (SELECT id FROM vehicles WHERE make LIKE $1)', [`${prefix}%`]);
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

  it('changes only the owner preference and removes a favourite without erasing alerts', async () => {
    const id = await vehicle('preference', 0);
    await request(app).put(`/api/favourites/${id}`).set(bearer(0)).expect(200);
    await request(app).put(`/api/favourites/${id}`).set(bearer(1)).expect(200);
    await request(app).patch(`/api/favourites/${id}/notification-preference`).set(bearer(0)).send({ notifyOnRestock: true }).expect(200);
    expect((await request(app).put(`/api/favourites/${id}`).set(bearer(0)).expect(200)).body.favourite.notifyOnRestock).toBe(true);
    expect((await request(app).get('/api/favourites').set(bearer(1))).body.favourites[0].notifyOnRestock).toBe(false);
    await request(app).patch(`/api/favourites/${id}/notification-preference`).set(bearer(0)).send({ notifyOnRestock: 'false' }).expect(400);
    await request(app).patch(`/api/favourites/${id}/notification-preference`).set(bearer(0)).send({ notifyOnRestock: false }).expect(200);
    await request(app).patch(`/api/favourites/${id}/notification-preference`).set(bearer(0)).send({ notifyOnRestock: true }).expect(200);
    await pool.query("INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'back_in_stock', $3, 'Stock returned')", [users[0], id, crypto.randomUUID()]);
    await request(app).delete(`/api/favourites/${id}`).set(bearer(0)).expect(200);
    await request(app).delete(`/api/favourites/${id}`).set(bearer(0)).expect(200);
    expect((await request(app).get('/api/favourites').set(bearer(0))).body.favourites).toEqual([]);
    expect((await request(app).get('/api/favourites').set(bearer(1))).body.favourites).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int AS count FROM notifications WHERE recipient_id = $1', [users[0]])).rows[0].count).toBe(1);
    await request(app).patch(`/api/favourites/${id}/notification-preference`).set(bearer(0)).send({ notifyOnRestock: true }).expect(404);
    await request(app).delete('/api/favourites/bad').set(bearer(0)).expect(400);
  });

  it('lists only the recipient inbox newest first and marks only its own rows read', async () => {
    const id = await vehicle('inbox');
    await request(app).get('/api/notifications').expect(401);
    expect((await request(app).get('/api/notifications').set(bearer(0)).expect(200)).body).toMatchObject({ notifications: [], unreadCount: 0 });
    const older = (await pool.query(
      "INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message, created_at) VALUES ($1, $2, 'low_stock', $3, 'Low', now() - interval '1 hour') RETURNING id",
      [users[0], id, crypto.randomUUID()]
    )).rows[0].id;
    const newer = (await pool.query(
      "INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'out_of_stock', $3, 'Empty') RETURNING id",
      [users[0], id, crypto.randomUUID()]
    )).rows[0].id;
    const other = (await pool.query(
      "INSERT INTO notifications (recipient_id, vehicle_id, type, event_key, message) VALUES ($1, $2, 'back_in_stock', $3, 'Returned') RETURNING id",
      [users[1], id, crypto.randomUUID()]
    )).rows[0].id;
    const page = await request(app).get('/api/notifications').set(bearer(0)).query({ page: 1, limit: 1 }).expect(200);
    expect(page.body).toMatchObject({ notifications: [{ id: newer, vehicleId: id, read: false, readAt: null }], unreadCount: 2, pagination: { page: 1, limit: 1, total: 2, totalPages: 2 } });
    expect((await request(app).get('/api/notifications').set(bearer(0)).query({ page: 2, limit: 1 })).body.notifications[0].id).toBe(older);
    await request(app).patch(`/api/notifications/${other}/read`).set(bearer(0)).expect(404);
    await request(app).patch('/api/notifications/bad/read').set(bearer(0)).expect(400);
    await request(app).patch(`/api/notifications/${crypto.randomUUID()}/read`).set(bearer(0)).expect(404);
    const read = await request(app).patch(`/api/notifications/${newer}/read`).set(bearer(0)).expect(200);
    expect(read.body.notification).toMatchObject({ id: newer, read: true });
    const repeated = await request(app).patch(`/api/notifications/${newer}/read`).set(bearer(0)).expect(200);
    expect(repeated.body.notification.readAt).toBe(read.body.notification.readAt);
    expect((await request(app).get('/api/notifications').set(bearer(0))).body.unreadCount).toBe(1);
    expect((await request(app).get('/api/notifications').set(bearer(1))).body.notifications).toMatchObject([{ id: other, read: false }]);
    await request(app).get('/api/notifications').set(bearer(0)).query({ page: 0 }).expect(400);
    await request(app).get('/api/notifications').set(bearer(0)).query({ limit: 101 }).expect(400);
  });

  it('notifies active admins only when a direct purchase crosses into positive low stock', async () => {
    const id = await vehicle('low-direct', 4, 3);
    await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(0)).send({ requestId: crypto.randomUUID() }).expect(200);
    const alerts = await pool.query("SELECT recipient_id, type, event_key FROM notifications WHERE vehicle_id = $1 AND recipient_id = ANY($2::uuid[]) ORDER BY recipient_id", [id, users]);
    expect(alerts.rows.map((row) => row.recipient_id).sort()).toEqual([users[2], users[3]].sort());
    expect(alerts.rows.map((row) => row.type)).toEqual(['low_stock', 'low_stock']);
    expect(new Set(alerts.rows.map((row) => row.event_key)).size).toBe(1);
    await request(app).post(`/api/vehicles/${id}/purchase`).set(bearer(0)).send({ requestId: crypto.randomUUID() }).expect(200);
    expect((await pool.query('SELECT count(*)::int AS count FROM notifications WHERE vehicle_id = $1 AND recipient_id = ANY($2::uuid[])', [id, users])).rows[0].count).toBe(2);
    const zeroThreshold = await vehicle('threshold-zero', 2, 0);
    await request(app).post(`/api/vehicles/${zeroThreshold}/purchase`).set(bearer(0)).send({ requestId: crypto.randomUUID() }).expect(200);
    expect((await pool.query('SELECT count(*)::int AS count FROM notifications WHERE vehicle_id = $1 AND recipient_id = ANY($2::uuid[])', [zeroThreshold, users])).rows[0].count).toBe(0);
  });

  it('creates distinct out-of-stock and low-stock alerts for direct and cart sales', async () => {
    const directId = await vehicle('out-direct', 1, 3);
    const directKey = crypto.randomUUID();
    await request(app).post(`/api/vehicles/${directId}/purchase`).set(bearer(0)).send({ requestId: directKey }).expect(200);
    await request(app).post(`/api/vehicles/${directId}/purchase`).set(bearer(0)).send({ requestId: directKey }).expect(200);
    expect((await pool.query('SELECT type, count(*)::int AS count FROM notifications WHERE vehicle_id = $1 AND recipient_id = ANY($2::uuid[]) GROUP BY type', [directId, users])).rows).toEqual([{ type: 'out_of_stock', count: 2 }]);

    const lowId = await vehicle('low-cart', 4, 3);
    const outId = await vehicle('out-cart', 1, 3);
    for (const id of [lowId, outId]) await request(app).post('/api/cart/items').set(bearer(0)).send({ vehicleId: id }).expect(200);
    const checkoutBody = { requestId: crypto.randomUUID(), items: [lowId, outId].map((vehicleId) => ({ vehicleId, price: '10.25' })) };
    await request(app).post('/api/cart/checkout').set(bearer(0)).send(checkoutBody).expect(200);
    await request(app).post('/api/cart/checkout').set(bearer(0)).send(checkoutBody).expect(200);
    expect((await pool.query('SELECT type, count(*)::int AS count FROM notifications WHERE vehicle_id = $1 AND recipient_id = ANY($2::uuid[]) GROUP BY type', [lowId, users])).rows).toEqual([{ type: 'low_stock', count: 2 }]);
    expect((await pool.query('SELECT type, count(*)::int AS count FROM notifications WHERE vehicle_id = $1 AND recipient_id = ANY($2::uuid[]) GROUP BY type', [outId, users])).rows).toEqual([{ type: 'out_of_stock', count: 2 }]);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [lowId])).rows[0].quantity).toBe(3);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [outId])).rows[0].quantity).toBe(0);
  });

  it('targets back-in-stock restock alerts only to active opted-in favourites', async () => {
    const id = await vehicle('back-in-stock', 0);
    for (const user of [0, 1, 2, 5]) {
      await pool.query('INSERT INTO favourites (user_id, vehicle_id, notify_on_restock) VALUES ($1, $2, $3)', [users[user], id, user !== 2]);
    }
    const requestId = crypto.randomUUID();
    await request(app).post(`/api/vehicles/${id}/restock`).set(bearer(2)).send({ quantity: 3, requestId }).expect(200);
    await request(app).post(`/api/vehicles/${id}/restock`).set(bearer(2)).send({ quantity: 3, requestId }).expect(200);
    const alerts = await pool.query("SELECT recipient_id, type, event_key FROM notifications WHERE vehicle_id = $1 ORDER BY recipient_id", [id]);
    expect(alerts.rows.map((row) => row.recipient_id).sort()).toEqual([users[0], users[1]].sort());
    expect(alerts.rows.map((row) => row.type)).toEqual(['back_in_stock', 'back_in_stock']);
    expect(new Set(alerts.rows.map((row) => row.event_key)).size).toBe(1);
    await request(app).post(`/api/vehicles/${id}/restock`).set(bearer(2)).send({ quantity: 1, requestId: crypto.randomUUID() }).expect(200);
    expect((await pool.query('SELECT count(*)::int AS count FROM notifications WHERE vehicle_id = $1', [id])).rows[0].count).toBe(2);
    await request(app).post(`/api/vehicles/${id}/restock`).set(bearer(2)).send({ quantity: 4, requestId }).expect(409);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(4);
  });
});
