import crypto from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { createAccessToken } from '../../src/auth.js';
import { runMigrations } from '../../src/migrate.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters-long';
const pool = new pg.Pool({ connectionString: requireTestDatabaseUrl() });
const prefix = `reads-${process.pid}-${Date.now()}`;

describe('frontend read models', () => {
  let categoryId: number;
  let vehicleId: string;
  let userId: string;
  let adminId: string;
  let purchaseId: string;
  const auth = (id: string) => ({ Authorization: `Bearer ${createAccessToken(id)}` });

  beforeAll(async () => {
    await runMigrations(pool);
    categoryId = (await pool.query('INSERT INTO vehicle_categories (name) VALUES ($1) RETURNING id', [`${prefix}-category`])).rows[0].id;
    const users = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES
       ('Reader', $1, 'hash', 'user', true), ('Inventory Admin', $2, 'hash', 'admin', true) RETURNING id, role`,
      [`${prefix}-user@example.com`, `${prefix}-admin@example.com`],
    );
    userId = users.rows.find((row) => row.role === 'user').id;
    adminId = users.rows.find((row) => row.role === 'admin').id;
    vehicleId = (await pool.query(
      'INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold) VALUES ($1, $2, $3, 1250000, 2, 3) RETURNING id',
      [prefix, 'City', categoryId],
    )).rows[0].id;
    await pool.query(
      "INSERT INTO stock_receipts (vehicle_id, actor_id, kind, quantity_added, resulting_quantity) VALUES ($1, $2, 'opening', 3, 3)",
      [vehicleId, adminId],
    );
    purchaseId = (await pool.query(
      "INSERT INTO purchases (user_id, source, request_id, total_price) VALUES ($1, 'direct', $2, 1250000) RETURNING id",
      [userId, crypto.randomUUID()],
    )).rows[0].id;
    await pool.query(
      'INSERT INTO purchase_items (purchase_id, vehicle_id, vehicle_label, unit_price) VALUES ($1, $2, $3, 1250000)',
      [purchaseId, vehicleId, `${prefix} City`],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM purchase_items WHERE purchase_id = $1', [purchaseId]);
    await pool.query('DELETE FROM purchases WHERE id = $1', [purchaseId]);
    await pool.query('DELETE FROM stock_receipts WHERE vehicle_id = $1', [vehicleId]);
    await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userId, adminId]]);
    await pool.query('DELETE FROM vehicle_categories WHERE id = $1', [categoryId]);
    await pool.end();
  });

  it('lists authenticated categories in name order', async () => {
    await request(app).get('/api/vehicle-categories').expect(401);
    const response = await request(app).get('/api/vehicle-categories').set(auth(userId)).expect(200);
    expect(response.body.categories).toContainEqual({ id: categoryId, name: `${prefix}-category` });
  });

  it('lists only the signed-in user purchase snapshots', async () => {
    const response = await request(app).get('/api/purchases').set(auth(userId)).query({ page: 1, limit: 10 }).expect(200);
    expect(response.body).toMatchObject({
      purchases: [{ id: purchaseId, totalPrice: '1250000.00', items: [{ vehicleId, vehicleLabel: `${prefix} City`, unitPrice: '1250000.00' }] }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect((await request(app).get('/api/purchases').set(auth(adminId))).body.purchases).toEqual([]);
  });

  it('protects and returns the vehicle stock ledger to admins', async () => {
    await request(app).get(`/api/vehicles/${vehicleId}/stock-receipts`).set(auth(userId)).expect(403);
    const response = await request(app).get(`/api/vehicles/${vehicleId}/stock-receipts`).set(auth(adminId)).expect(200);
    expect(response.body.receipts).toMatchObject([{ kind: 'opening', quantityAdded: 3, resultingQuantity: 3 }]);
  });

  it('computes inventory summary from all active stock lines for admins', async () => {
    await request(app).get('/api/admin/inventory-summary').set(auth(userId)).expect(403);
    const response = await request(app).get('/api/admin/inventory-summary').set(auth(adminId)).expect(200);
    expect(response.body.summary).toEqual(expect.objectContaining({
      activeStockLines: expect.any(Number),
      inStockLines: expect.any(Number),
      lowStockLines: expect.any(Number),
      outOfStockLines: expect.any(Number),
      totalUnits: expect.any(Number),
    }));
    expect(response.body.summary.lowStockLines).toBeGreaterThanOrEqual(1);
  });

  it('lets authenticated shoppers read aggregate inventory counts without admin privileges', async () => {
    await request(app).get('/api/vehicles/summary').expect(401);

    const shopperSummary = await request(app)
      .get('/api/vehicles/summary')
      .set(auth(userId))
      .expect(200);
    const adminSummary = await request(app)
      .get('/api/admin/inventory-summary')
      .set(auth(adminId))
      .expect(200);

    expect(shopperSummary.body).toEqual(adminSummary.body);
    expect(shopperSummary.body.summary).toEqual(expect.objectContaining({
      activeStockLines: expect.any(Number),
      inStockLines: expect.any(Number),
      lowStockLines: expect.any(Number),
      outOfStockLines: expect.any(Number),
      totalUnits: expect.any(Number),
    }));
  });


});
