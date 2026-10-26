import { describe, expect, it, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('CORS and Preflight Handling', () => {
  const origCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (origCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = origCorsOrigin;
    }
  });

  it('handles OPTIONS preflight requests with 204 and CORS headers', async () => {
    delete process.env.CORS_ORIGIN;
    const response = await request(app)
      .options('/api/vehicles')
      .set('Origin', 'https://creaseline.onrender.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('attaches CORS headers to normal GET responses', async () => {
    delete process.env.CORS_ORIGIN;
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://creaseline.onrender.com');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('restricts Access-Control-Allow-Origin when CORS_ORIGIN is explicitly configured', async () => {
    process.env.CORS_ORIGIN = 'https://creaseline.onrender.com, https://admin.creaseline.com';

    const allowedResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://creaseline.onrender.com');

    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.headers['access-control-allow-origin']).toBe('https://creaseline.onrender.com');
    expect(allowedResponse.headers['vary']).toContain('Origin');

    const deniedResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-site.com');

    expect(deniedResponse.status).toBe(200);
    expect(deniedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('supports wildcard pattern matching for Vercel preview domains in CORS_ORIGIN', async () => {
    process.env.CORS_ORIGIN = 'https://*.vercel.app, https://creaseline.example.com';

    const previewResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://dealership-inventory-git-preview-qusai.vercel.app');

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers['access-control-allow-origin']).toBe(
      'https://dealership-inventory-git-preview-qusai.vercel.app'
    );
    expect(previewResponse.headers['vary']).toContain('Origin');

    const deniedResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-vercel.app.attacker.com');

    expect(deniedResponse.status).toBe(200);
    expect(deniedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });
});

