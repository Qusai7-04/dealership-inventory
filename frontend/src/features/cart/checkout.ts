import type { ApiClient } from '../../api/client';

interface CheckoutItem {
  vehicleId: string;
  price: string;
}

export function createCheckoutAttempt(items: CheckoutItem[], requestId = crypto.randomUUID()) {
  const body = {
    requestId,
    items: items.map((item) => ({ vehicleId: item.vehicleId, price: item.price })),
  };
  return {
    requestId,
    submit: <T>(api: Pick<ApiClient, 'post'>) => api.post<T>('/api/cart/checkout', body),
  };
}
