import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import { createAccessToken } from '../../src/auth.js';
import { runMigrations } from '../../src/migrate.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

const connectionString = requireTestDatabaseUrl();
const prefix = `img-gen-${process.pid}-${Date.now()}`;
const secret = 'test-only-secret-at-least-32-characters-long';
process.env.JWT_SECRET = secret;

describe('Admin vehicle live image generation route', () => {
  const pool = new pg.Pool({ connectionString });
  let categoryId: number;
  let adminToken: string;
  let userToken: string;
  let vehicleWithoutImageId: string;
  let vehicleWithImageId: string;

  const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await runMigrations(pool);
    const cat = await pool.query('INSERT INTO vehicle_categories (name) VALUES ($1) RETURNING id', [`${prefix}-Cat`]);
    categoryId = cat.rows[0].id;

    const hash = await bcrypt.hash('StrongPass123!', 12);
    const users = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin'), ($4, $5, $3, 'user') RETURNING id, role`,
      ['Image Admin', `${prefix}-admin@example.com`, hash, 'Image User', `${prefix}-user@example.com`]
    );
    adminToken = createAccessToken(users.rows.find((r) => r.role === 'admin').id);
    userToken = createAccessToken(users.rows.find((r) => r.role === 'user').id);

    const v1 = await pool.query(
      `INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold)
       VALUES ($1, $2, $3, 20000, 5, 2) RETURNING id`,
      [`${prefix}-Honda`, 'City', categoryId]
    );
    vehicleWithoutImageId = v1.rows[0].id;

    const v2 = await pool.query(
      `INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold)
       VALUES ($1, $2, $3, 30000, 3, 2) RETURNING id`,
      [`${prefix}-Toyota`, 'Camry', categoryId]
    );
    vehicleWithImageId = v2.rows[0].id;

    await pool.query(
      `INSERT INTO vehicle_images (vehicle_id, url, alt_text, display_order)
       VALUES ($1, '/images/vehicles/existing_toyota.webp', 'Existing Toyota', 0)`,
      [vehicleWithImageId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM vehicle_images WHERE vehicle_id IN ($1, $2)', [vehicleWithoutImageId, vehicleWithImageId]);
    await pool.query('DELETE FROM vehicles WHERE category_id = $1', [categoryId]);
    await pool.query('DELETE FROM vehicle_categories WHERE id = $1', [categoryId]);
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${prefix}-%`]);
    await pool.end();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post(`/api/vehicles/${vehicleWithoutImageId}/generate-image`);
    expect(res.status).toBe(401);
  });

  it('rejects normal user requests with 403', async () => {
    const res = await request(app)
      .post(`/api/vehicles/${vehicleWithoutImageId}/generate-image`)
      .set(auth(userToken));
    expect(res.status).toBe(403);
  });

  it('returns 404 when vehicle ID does not exist', async () => {
    const res = await request(app)
      .post('/api/vehicles/00000000-0000-4000-8000-000000000000/generate-image')
      .set(auth(adminToken));
    expect(res.status).toBe(404);
  });

  it('returns existing image with 200 if vehicle already has an image (reusing valid cache)', async () => {
    const res = await request(app)
      .post(`/api/vehicles/${vehicleWithImageId}/generate-image`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.image.url).toBe('/images/vehicles/existing_toyota.webp');
  });
});
