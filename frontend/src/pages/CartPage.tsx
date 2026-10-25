import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { createCheckoutAttempt } from '../features/cart/checkout';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { CartResponse } from '../types/api';

export function CartPage() {
  const { api } = useAuth(); const [cart, setCart] = useState<CartResponse | null>(null); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null); const [pending, setPending] = useState(false); const attempt = useRef<ReturnType<typeof createCheckoutAttempt> | null>(null);
  const load = useCallback(() => { setError(null); api.get<CartResponse>('/api/cart').then(setCart).catch((reason) => setError(reason.message)); }, [api]);
  useEffect(load, [load]);
  async function remove(id: string) { setCart(await api.delete<CartResponse>(`/api/cart/items/${id}`)); attempt.current = null; }
  async function clear() { setCart(await api.delete<CartResponse>('/api/cart')); attempt.current = null; }
  async function checkout() {
    if (!cart?.items.length) return; setPending(true); setError(null); setSuccess(null);
    attempt.current ??= createCheckoutAttempt(cart.items.map(({ vehicleId, price }) => ({ vehicleId, price })));
    try { const result = await attempt.current.submit<{ purchase: { id: string } }>(api); setSuccess(`Purchase ${result.purchase.id} recorded successfully.`); attempt.current = null; await load(); }
    catch (reason) { if (reason instanceof ApiError && reason.status === 409) { setError(`${reason.message}. The cart has been refreshed; review it before retrying.`); attempt.current = null; await load(); } else { setError(reason instanceof Error ? `${reason.message}. Retry will use the same request ID.` : 'Checkout failed.'); } }
    finally { setPending(false); }
  }
  return <main className="page"><header className="page-heading"><p className="eyebrow">Tear sheet</p><h1>Your cart</h1><p>The server remains the source of truth for stock, prices, and the subtotal.</p></header><PageState loading={!cart && !error} error={!cart ? error : null} onRetry={load} />
    {cart && (cart.items.length === 0 ? <div className="empty-state"><h2>Your cart is empty</h2><p>Add an available vehicle from the floor.</p></div> : <div className="cart-layout"><section className="paper-panel cart-list">{cart.items.map((item) => <article className="cart-row" key={item.vehicleId}><div><h2>{item.label}</h2><p className="price">{formatPrice(item.price)}</p><span className={item.available ? 'live-text' : 'error-text'}>{item.available ? `${item.stock} in stock` : 'Unavailable'}</span></div><button className="button outline" onClick={() => remove(item.vehicleId)}>Remove</button></article>)}</section>
      <aside className="paper-panel checkout-sheet"><p className="eyebrow">Server subtotal</p><p className="price jumbo">{formatPrice(cart.subtotal)}</p><p>{cart.itemCount} unique stock {cart.itemCount === 1 ? 'line' : 'lines'}</p>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="success-note" role="status">{success}</p>}<button className="button primary" disabled={pending || cart.items.some((item) => !item.available)} onClick={checkout}>{pending ? 'Confirming…' : 'Confirm purchase'}</button><button className="button text-action" disabled={pending} onClick={clear}>Clear cart</button></aside></div>)}
  </main>;
}
