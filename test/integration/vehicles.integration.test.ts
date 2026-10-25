import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { createAccessToken } from '../../src/auth.js';
import { runMigrations } from '../../src/migrate.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

const connectionString = requireTestDatabaseUrl();
const prefix = `inventory-${process.pid}-${Date.now()}`;
const secret = 'test-only-secret-at-least-32-characters-long';
process.env.JWT_SECRET = secret;

describe('Vehicle inventory integration', () => {
  const pool = new pg.Pool({ connectionString });
  let categoryId: number;
  let otherCategoryId: number;
  let adminToken: string;
  let userToken: string;

  const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
  const vehicleBody = (suffix: string, overrides = {}) => ({
    make: `${prefix}-${suffix}`,
    model: 'Roadster',
    categoryId,
    price: 25000,
    quantity: 0,
    lowStockThreshold: 3,
    ...overrides,
  });
  const insertVehicle = async (suffix: string, overrides: Record<string, unknown> = {}) => {
    const body = vehicleBody(suffix, overrides);
    const result = await pool.query(
      `INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [body.make, body.model, body.categoryId, body.price, body.quantity, body.lowStockThreshold]
    );
    return result.rows[0].id as string;
  };

  beforeAll(async () => {
    await runMigrations(pool);
    const categories = await pool.query(
      'INSERT INTO vehicle_categories (name) VALUES ($1), ($2) RETURNING id',
      [`${prefix}-SUV`, `${prefix}-Sedan`]
    );
    [categoryId, otherCategoryId] = categories.rows.map((row) => row.id);
    const hash = await bcrypt.hash('StrongPass123!', 12);
    const users = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin'), ($4, $5, $3, 'user') RETURNING id, role`,
      ['Inventory Admin', `${prefix}-admin@example.com`, hash, 'Inventory User', `${prefix}-user@example.com`]
    );
    adminToken = createAccessToken(users.rows.find((row) => row.role === 'admin').id);
    userToken = createAccessToken(users.rows.find((row) => row.role === 'user').id);
  });

  afterAll(async () => {
    const hasReceipts = await pool.query("SELECT to_regclass('public.stock_receipts') AS name");
    if (hasReceipts.rows[0].name) {
      await pool.query('DELETE FROM stock_receipts WHERE vehicle_id IN (SELECT id FROM vehicles WHERE make LIKE $1)', [`${prefix}%`]);
    }
    await pool.query('DELETE FROM vehicles WHERE make LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM vehicle_categories WHERE name LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${prefix}%`]);
    await pool.end();
  });

  it('requires an admin for every inventory mutation', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const operations = [
      ['post', '/api/vehicles', vehicleBody('auth')],
      ['put', `/api/vehicles/${id}`, { price: 1 }],
      ['delete', `/api/vehicles/${id}`, undefined],
      ['post', `/api/vehicles/${id}/restock`, { quantity: 1, requestId: crypto.randomUUID() }],
    ] as const;
    for (const [method, path, body] of operations) {
      const unauthenticated = request(app)[method](path);
      if (body) unauthenticated.send(body);
      expect((await unauthenticated).status).toBe(401);
      const normalUser = request(app)[method](path).set(auth(userToken));
      if (body) normalUser.send(body);
      expect((await normalUser).status).toBe(403);
    }
  });

  it('requires authentication for vehicle reads', async () => {
    const id = await insertVehicle('read-auth');
    for (const path of ['/api/vehicles', '/api/vehicles/search', `/api/vehicles/${id}`]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set(auth(userToken))).status).toBe(200);
    }
  });

  it('creates a stock line and records positive opening inventory', async () => {
    const response = await request(app).post('/api/vehicles').set(auth()).send(vehicleBody('create', { quantity: 4 }));
    expect(response.status).toBe(201);
    expect(response.body.vehicle).toMatchObject({ make: `${prefix}-create`, model: 'Roadster', quantity: 4 });
    expect(response.body.vehicle).not.toHaveProperty('deletedAt');
    const receipt = await pool.query('SELECT kind, quantity_added FROM stock_receipts WHERE vehicle_id = $1', [response.body.vehicle.id]);
    expect(receipt.rows).toEqual([{ kind: 'opening', quantity_added: 4 }]);
  });

  it.each([
    [{ model: 'Roadster', categoryId: 1, price: 1 }, 400],
    [vehicleBody('bad-category', { categoryId: 99999999 }), 400],
    [vehicleBody('negative-price', { price: -1 }), 400],
    [vehicleBody('negative-quantity', { quantity: -1 }), 400],
    [vehicleBody('wrong-type', { price: '25000' }), 400],
    [vehicleBody('unexpected', { deletedAt: null }), 400],
  ])('rejects invalid vehicle creation input', async (body, status) => {
    expect((await request(app).post('/api/vehicles').set(auth()).send(body)).status).toBe(status);
  });

  it('returns a conflict for duplicate active make and model', async () => {
    const body = vehicleBody('duplicate');
    expect((await request(app).post('/api/vehicles').set(auth()).send(body)).status).toBe(201);
    expect((await request(app).post('/api/vehicles').set(auth()).send(body)).status).toBe(409);
  });

  it('lists active vehicles with pagination, search, filters, availability and allowlisted sorting', async () => {
    await insertVehicle('list-alpha', { model: 'Alpha', price: 10000, quantity: 2 });
    await insertVehicle('list-beta', { model: 'Beta', price: 20000, quantity: 0, categoryId: otherCategoryId });
    await insertVehicle('list-gamma', { model: 'Gamma', price: 30000, quantity: 4 });
    const response = await request(app).get('/api/vehicles').set(auth(userToken)).query({
      search: 'list-', categoryId, minPrice: 9000, maxPrice: 31000,
      available: 'true', sort: 'price', direction: 'desc', page: 1, limit: 2,
    });
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, limit: 2, total: 2, totalPages: 1 });
    expect(response.body.vehicles.map((vehicle: { price: string }) => vehicle.price)).toEqual(['30000.00', '10000.00']);
    expect(response.body.vehicles[0].category).toMatchObject({ id: categoryId });
    expect(response.body.vehicles[0]).not.toHaveProperty('deletedAt');

    const searchRoute = await request(app).get('/api/vehicles/search').set(auth(userToken)).query({ search: 'Gamma' });
    expect(searchRoute.status).toBe(200);
    expect(searchRoute.body.vehicles.some((vehicle: { model: string }) => vehicle.model === 'Gamma')).toBe(true);
    const empty = await request(app).get('/api/vehicles').set(auth(userToken)).query({ search: `${prefix}-missing` });
    expect(empty.body).toMatchObject({ vehicles: [], pagination: { total: 0, totalPages: 0 } });
  });

  it.each([
    [{ page: 0 }], [{ limit: 101 }], [{ available: 'maybe' }],
    [{ sort: 'deleted_at' }], [{ direction: 'sideways' }], [{ minPrice: -1 }],
    [{ minPrice: 10, maxPrice: 5 }], [{ categoryId: 'x' }],
  ])('rejects invalid list query parameters', async (query) => {
    expect((await request(app).get('/api/vehicles').set(auth(userToken)).query(query)).status).toBe(400);
  });

  it('parameterizes hostile search input and leaves the schema intact', async () => {
    const response = await request(app).get('/api/vehicles').set(auth(userToken)).query({ search: "'; DROP TABLE vehicles; --" });
    expect(response.status).toBe(200);
    expect((await pool.query("SELECT to_regclass('public.vehicles') AS name")).rows[0].name).toBe('vehicles');
  });

  it('returns vehicle details and rejects malformed, missing, and deleted IDs', async () => {
    const id = await insertVehicle('detail');
    expect((await request(app).get(`/api/vehicles/${id}`).set(auth(userToken))).status).toBe(200);
    expect((await request(app).get('/api/vehicles/not-a-uuid').set(auth(userToken))).status).toBe(400);
    expect((await request(app).get('/api/vehicles/00000000-0000-4000-8000-000000000000').set(auth(userToken))).status).toBe(404);
    await pool.query('UPDATE vehicles SET deleted_at = now() WHERE id = $1', [id]);
    expect((await request(app).get(`/api/vehicles/${id}`).set(auth(userToken))).status).toBe(404);
  });

  it('updates only editable catalogue fields and keeps quantity unchanged', async () => {
    const id = await insertVehicle('update', { quantity: 5 });
    const response = await request(app).put(`/api/vehicles/${id}`).set(auth()).send({
      model: 'Updated', categoryId: otherCategoryId, price: 12345.67, lowStockThreshold: 2,
    });
    expect(response.status).toBe(200);
    expect(response.body.vehicle).toMatchObject({ model: 'Updated', price: '12345.67', quantity: 5, lowStockThreshold: 2 });
    expect((await request(app).put(`/api/vehicles/${id}`).set(auth()).send({ quantity: 99 })).status).toBe(400);
    expect((await request(app).put(`/api/vehicles/${id}`).set(auth()).send({ id })).status).toBe(400);
    expect((await request(app).put(`/api/vehicles/${id}`).set(auth()).send({ categoryId: 99999999 })).status).toBe(400);
    expect((await pool.query('SELECT category_id, quantity FROM vehicles WHERE id = $1', [id])).rows[0]).toEqual({ category_id: otherCategoryId, quantity: 5 });
  });

  it('atomically restocks, records receipts, is idempotent, and rejects invalid quantities', async () => {
    const id = await insertVehicle('restock', { quantity: 1 });
    const firstKey = crypto.randomUUID();
    const first = await request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity: 2, requestId: firstKey });
    expect(first.status).toBe(200);
    expect(first.body.vehicle.quantity).toBe(3);
    await request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity: 1, requestId: crypto.randomUUID() }).expect(200);
    const replay = await request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity: 2, requestId: firstKey });
    expect(replay.status).toBe(200);
    expect(replay.body.vehicle.quantity).toBe(3);
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(4);
    expect((await request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity: 3, requestId: firstKey })).status).toBe(409);
    const concurrentKey = crypto.randomUUID();
    const concurrentReplay = await Promise.all([1, 2].map(() =>
      request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity: 4, requestId: concurrentKey }).expect(200)
    ));
    expect(concurrentReplay.every((response) => response.body.vehicle.quantity === 8)).toBe(true);
    for (const quantity of [0, -1, 1.5]) {
      expect((await request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity, requestId: crypto.randomUUID() })).status).toBe(400);
    }
    await Promise.all([2, 3].map((quantity) => request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity, requestId: crypto.randomUUID() }).expect(200)));
    expect((await pool.query('SELECT quantity FROM vehicles WHERE id = $1', [id])).rows[0].quantity).toBe(13);
  });

  it('soft-deletes a vehicle and hides it from reads and further mutations', async () => {
    const id = await insertVehicle('delete');
    expect((await request(app).delete(`/api/vehicles/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/vehicles/${id}`).set(auth(userToken))).status).toBe(404);
    expect((await request(app).get('/api/vehicles').set(auth(userToken)).query({ search: `${prefix}-delete` })).body.vehicles).toEqual([]);
    expect((await request(app).put(`/api/vehicles/${id}`).set(auth()).send({ price: 1 })).status).toBe(404);
    expect((await request(app).post(`/api/vehicles/${id}/restock`).set(auth()).send({ quantity: 1, requestId: crypto.randomUUID() })).status).toBe(404);
  });
});
