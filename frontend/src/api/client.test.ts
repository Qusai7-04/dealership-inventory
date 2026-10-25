import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

describe('API client', () => {
  it('adds the token and parses a successful JSON response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getToken: () => 'session-token',
      fetcher,
    });

    await expect(client.get<{ ok: boolean }>('/api/vehicles')).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/vehicles',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
      }),
    );
  });

  it('preserves conflict details and clears an expired session on 401', async () => {
    const expired = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Price changed' }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }));
    const client = createApiClient({ baseUrl: '', getToken: () => 'token', onUnauthorized: expired, fetcher });

    await expect(client.post('/api/cart/checkout', {})).rejects.toMatchObject({
      status: 409,
      message: 'Price changed',
    });
    await expect(client.get('/api/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });
});
