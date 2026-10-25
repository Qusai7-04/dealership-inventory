import { describe, expect, it, afterAll } from 'vitest';
import pg from 'pg';
import request from 'supertest';
import app from '../../src/app.js';
import { checkDatabaseConnection, closePool } from '../../src/db.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore when .env does not exist
  }
}

const connectionString = requireTestDatabaseUrl();

describe('PostgreSQL Live Integration Tests', () => {
  const pool = new pg.Pool({ connectionString });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('connects to PostgreSQL and executes SELECT 1', async () => {
    const result = await pool.query('SELECT 1 as num;');
    expect(result.rows[0].num).toBe(1);
  });

  it('verifies that checkDatabaseConnection returns ok: true', async () => {
    const status = await checkDatabaseConnection();
    expect(status.ok).toBe(true);
  });

  it('verifies GET /health/db returns 200 connected against the live database', async () => {
    const response = await request(app).get('/health/db');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });
});
