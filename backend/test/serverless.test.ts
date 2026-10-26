import { describe, expect, it } from 'vitest';
import request from 'supertest';
import handler from '../api/index.js';

describe('Vercel Serverless Function Handler', () => {
  it('exports a valid Express request handler that responds to /health', async () => {
    const res = await request(handler).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('handles CORS preflight on the serverless handler', async () => {
    const res = await request(handler)
      .options('/api/vehicles')
      .set('Origin', 'https://dealership-preview.vercel.app')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });
});
