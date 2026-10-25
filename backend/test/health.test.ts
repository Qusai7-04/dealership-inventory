import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import * as db from '../src/db.js';

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('reports that the API is running without requiring database', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/db', () => {
    it('returns 200 connected when database check succeeds', async () => {
      const checkSpy = vi.spyOn(db, 'checkDatabaseConnection').mockResolvedValueOnce({ ok: true });
      const response = await request(app).get('/health/db');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', database: 'connected' });
      checkSpy.mockRestore();
    });

    it('returns 503 degraded when database check fails without leaking internal errors', async () => {
      const checkSpy = vi.spyOn(db, 'checkDatabaseConnection').mockResolvedValueOnce({
        ok: false,
        error: 'Database connection check failed',
      });
      const response = await request(app).get('/health/db');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'degraded', database: 'disconnected' });
      checkSpy.mockRestore();
    });
  });
});
