import { describe, expect, it, vi } from 'vitest';
import { createCheckoutAttempt } from './checkout';

describe('checkout retry', () => {
  it('reuses the same request ID and confirmed prices for a genuine retry', async () => {
    const post = vi.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce({ purchase: { id: 'purchase-1' } });
    const attempt = createCheckoutAttempt([
      { vehicleId: 'vehicle-1', price: '1250000.00' },
      { vehicleId: 'vehicle-2', price: '800000.00' },
    ], '123e4567-e89b-42d3-a456-426614174000');

    await expect(attempt.submit({ post } as never)).rejects.toThrow('network failed');
    await expect(attempt.submit({ post } as never)).resolves.toMatchObject({ purchase: { id: 'purchase-1' } });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
  });
});
