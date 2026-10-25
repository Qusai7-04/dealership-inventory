import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { createCheckoutAttempt } from '../features/cart/checkout';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { CartResponse } from '../types/api';

export function CartPage() {
  const { api } = useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const attempt = useRef<ReturnType<typeof createCheckoutAttempt> | null>(null);

  const load = useCallback(
    async (preserveError = false) => {
      if (!preserveError) setError(null);
      try {
        const res = await api.get<CartResponse>('/api/cart');
        setCart(res);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not load the cart.');
      }
    },
    [api]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    setError(null);
    try {
      const res = await api.delete<CartResponse>(`/api/cart/items/${id}`);
      setCart(res);
      attempt.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to remove item');
    }
  }

  async function clear() {
    setError(null);
    try {
      const res = await api.delete<CartResponse>('/api/cart');
      setCart(res);
      attempt.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to clear cart');
    }
  }

  async function checkout() {
    if (!cart?.items.length) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    attempt.current ??= createCheckoutAttempt(
      cart.items.map(({ vehicleId, price }) => ({ vehicleId, price }))
    );

    try {
      const result = await attempt.current.submit<{ purchase: { id: string } }>(api);
      setSuccess(`Purchase ${result.purchase.id} recorded successfully.`);
      attempt.current = null;
      await load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setError(`${reason.message}. The cart has been refreshed; review it before retrying.`);
        attempt.current = null;
        await load(true);
      } else {
        setError(
          reason instanceof Error
            ? `${reason.message}. Retry will use the same request ID.`
            : 'Checkout failed.'
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page min-h-screen bg-paper-base paper-grain py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* SUB-HEADER / LEDGER MANIFEST STRIP */}
        <div className="w-full bg-paper-surface px-4 py-2.5 rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] flex flex-wrap items-center justify-between gap-4 font-data-mono text-stamp-badge">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-live-lime text-ink-solid font-bold uppercase tracking-wider -rotate-1 inline-block border border-ink-solid">
              TERMINAL 04 // ACTIVE MANIFEST
            </span>
            <span className="text-ink-subtle">/</span>
            <span className="text-ink-muted">DISPATCH QUEUE:</span>
            <span className="text-ink-solid font-bold">
              {cart?.itemCount ?? 0} MOTOR CHASSIS RESERVED
            </span>
          </div>
          <div className="flex items-center gap-4 text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-live-lime animate-pulse" />
              STOCK ESCROW SYNC ACTIVE
            </span>
          </div>
        </div>

        {/* SCREEN MASTHEAD */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b-[1.5px] border-dashed border-ink-solid/40">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 font-stamp-badge text-stamp-badge text-ink-muted uppercase tracking-widest">
              <span>ARCHIVAL REQUISITION ORDER</span>
              <span>•</span>
              <span className="text-action-blue font-bold">SLIP NO. #FD-8942-IN</span>
            </div>
            <h1 className="font-display-hero text-headline-xl sm:text-display-hero uppercase tracking-tight text-ink-solid leading-none font-bold">
              Cart &amp;{' '}
              <span className="font-editorial-accent italic lowercase text-action-blue font-normal">
                Tear-Sheet
              </span>{' '}
              Checkout
            </h1>
            <p className="font-body-md text-body-md text-ink-muted max-w-2xl leading-relaxed">
              Physical reservation docket. Units are held in escrow. Confirming purchase commits the master press stamp and prints the indelible delivery voucher.
            </p>
          </div>

          {/* Quick Stats Paper Chip Matrix */}
          {cart && cart.items.length > 0 && (
            <div className="flex items-stretch gap-3 font-data-mono">
              <div className="bg-paper-surface border-[1.5px] border-ink-solid rounded-lg p-3 shadow-[0_2px_0_#16150F] flex flex-col justify-between min-w-[110px]">
                <span className="text-[10px] text-ink-subtle uppercase">Allocated</span>
                <span className="font-headline-md text-headline-sm text-ink-solid font-bold">
                  {cart.itemCount} Units
                </span>
              </div>
              <div className="bg-paper-surface border-[1.5px] border-ink-solid rounded-lg p-3 shadow-[0_2px_0_#16150F] flex flex-col justify-between min-w-[140px]">
                <span className="text-[10px] text-ink-subtle uppercase">Reserve Net</span>
                <span className="font-headline-md text-headline-sm text-action-blue font-bold">
                  {Number(cart.subtotal) >= 10000000
                    ? `₹${(Number(cart.subtotal) / 10000000).toFixed(2)} Cr`
                    : `₹${(Number(cart.subtotal) / 100000).toFixed(2)} L`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        <PageState loading={!cart && !error} error={!cart ? error : null} onRetry={load} />

        {/* STOCK CONFLICT WARNING / ALERT BANNER */}
        {error && (
          <div
            role="alert"
            className="bg-[#FFDAD6] border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_3px_0_#16150F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ink-solid"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-attention-orange flex-shrink-0 flex items-center justify-center border-[1.5px] border-ink-solid text-white font-bold">
                !
              </div>
              <div>
                <div className="font-headline-sm text-body-sm font-bold flex items-center gap-2">
                  <span>LIVE LEDGER NOTICE: HIGH CONCURRENCY ALLOCATION</span>
                  <span className="bg-attention-orange text-white px-2 py-0.2 font-stamp-badge text-[9px] rounded uppercase font-bold tracking-wider">
                    CHASSIS REFRESH
                  </span>
                </div>
                <p className="font-data-mono text-xs text-alert-red font-semibold mt-0.5">
                  {error}
                </p>
              </div>
            </div>
            <div className="font-data-mono text-stamp-badge text-ink-solid flex items-center gap-2 self-end sm:self-center">
              <span className="w-2.5 h-2.5 bg-live-lime rounded-full border border-ink-solid" />
              INVENTORY RESTORED
            </div>
          </div>
        )}

        {/* SUCCESS CONFIRMATION NOTE */}
        {success && (
          <div
            role="status"
            className="bg-live-lime border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_3px_0_#16150F] flex items-center gap-3 font-data-mono text-body-sm font-bold text-ink-solid"
          >
            <span className="material-symbols-outlined text-[24px]">verified</span>
            <span>{success}</span>
          </div>
        )}

        {/* EMPTY CART STATE */}
        {cart && cart.items.length === 0 && (
          <div className="empty-state p-16 text-center bg-paper-surface border-[2px] border-dashed border-ink-solid rounded-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paper-recessed border-[1.5px] border-ink-solid flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-ink-muted">shopping_bag</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-ink-solid font-bold">
              Your cart is empty
            </h2>
            <p className="font-body-md text-ink-muted mt-2 max-w-md mx-auto">
              No chassis requisition sheets are currently folded into your order slip.
            </p>
            <Link
              to="/vehicles"
              className="mt-6 inline-flex px-6 py-2.5 bg-action-blue hover:bg-action-blue-deep text-on-primary font-label-nav text-body-sm font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] transition-all"
            >
              Browse The Floor
            </Link>
          </div>
        )}

        {/* MASTER GRID: REQUISITION DOCKET (LEFT) + TEAR-OFF RECEIPT (RIGHT) */}
        {cart && cart.items.length > 0 && (
          <div className="cart-layout grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Physical Stacked Cards (7 Cols) */}
            <section className="cart-list lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between pb-2 border-b-[1.5px] border-ink-solid font-data-mono text-stamp-badge">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-action-blue rounded-none border border-ink-solid rotate-45 inline-block" />
                  <h2 className="font-headline-md text-headline-sm text-ink-solid uppercase tracking-tight font-bold">
                    Active Floor Units ({cart.itemCount.toString().padStart(2, '0')})
                  </h2>
                </div>
                <span className="text-secondary font-bold">STATUS: ESCROW RESERVED</span>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {cart.items.map((item, index) => (
                  <article
                    key={item.vehicleId}
                    className="cart-row relative bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-5 shadow-[0_4px_0_#16150F] hover:shadow-[0_6px_0_#16150F] transition-all flex flex-col sm:flex-row gap-5 items-start justify-between"
                  >
                    {/* Tape tag */}
                    <div
                      className="absolute -top-3 left-8 px-2.5 py-0.5 bg-tape-lime border-[1.5px] border-ink-solid font-stamp-badge text-[9px] uppercase font-bold tracking-wider rounded -rotate-2 select-none"
                      aria-hidden="true"
                    >
                      REGISTERED LOT #{index + 1}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-stamp-badge text-[10px] text-ink-subtle uppercase tracking-wider block">
                            CHASSIS SPECIMEN
                          </span>
                          <h3 className="font-headline-md text-headline-sm text-ink-solid font-bold leading-tight">
                            {item.label}
                          </h3>
                        </div>

                        {/* Tear / Remove Action */}
                        <button
                          onClick={() => remove(item.vehicleId)}
                          className="px-2.5 py-1.5 bg-paper-base hover:bg-paper-recessed text-ink-subtle hover:text-alert-red rounded-lg border-[1.5px] border-ink-solid shadow-[0_1px_0_#16150F] active:translate-y-0.5 transition-all text-xs font-data-mono flex items-center gap-1 font-bold"
                          title="Tear out from requisition order"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">content_cut</span>
                          <span className="font-stamp-badge uppercase">TEAR</span>
                        </button>
                      </div>

                      {/* Item Price & Availability Line */}
                      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2 border-t-[1.5px] border-dashed border-ink-solid/30">
                        <span className="price font-price-lg text-headline-sm text-ink-solid font-bold">
                          {formatPrice(item.price)}
                        </span>
                        <span
                          className={`font-stamp-badge text-[10px] px-2 py-0.5 rounded border border-ink-solid font-bold ${
                            item.available ? 'bg-live-lime text-ink-solid' : 'bg-alert-red text-white'
                          }`}
                        >
                          {item.available ? `${item.stock} in stock` : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Clear Cart Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={clear}
                  disabled={pending}
                  className="px-4 py-2 bg-paper-recessed hover:bg-paper-surface text-ink-muted hover:text-alert-red font-label-nav text-xs font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_1px_0_#16150F] transition-all flex items-center gap-1.5"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  <span>Clear Entire Order Docket</span>
                </button>
              </div>
            </section>

            {/* RIGHT COLUMN: Official Motor Voucher Checkout Sheet (5 Cols) */}
            <aside className="checkout-sheet lg:col-span-5 bg-paper-surface border-[1.5px] border-ink-solid rounded-2xl p-6 shadow-[0_4px_0_#16150F] space-y-6 sticky top-28">
              <div className="flex items-center justify-between pb-3 border-b-[1.5px] border-ink-solid font-data-mono text-stamp-badge">
                <span className="text-ink-solid font-bold uppercase tracking-wider">
                  OFFICIAL MOTOR VOUCHER
                </span>
                <span className="bg-paper-base px-2 py-0.5 rounded border border-ink-solid">
                  FORM CL-2026
                </span>
              </div>

              {/* Calculation Summary Box */}
              <div className="space-y-3 font-data-mono text-body-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Chassis Units:</span>
                  <span className="font-bold text-ink-solid">
                    {cart.itemCount} unique stock {cart.itemCount === 1 ? 'line' : 'lines'}
                  </span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Documentation & Prep:</span>
                  <span className="text-secondary font-bold">COMPLIMENTARY</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Transporter Allocation:</span>
                  <span className="text-secondary font-bold">INCLUDED</span>
                </div>

                <div className="pt-3 border-t-[1.5px] border-dashed border-ink-solid">
                  <span className="eyebrow block text-ink-subtle mb-1">Server subtotal</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-stamp-badge text-[10px] text-ink-subtle uppercase">TOTAL INR</span>
                    <span className="price font-price-lg text-headline-md sm:text-price-lg text-ink-solid font-bold">
                      {formatPrice(cart.subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirm Purchase Trigger Button */}
              <button
                type="button"
                className="w-full py-4 px-6 bg-action-blue hover:bg-action-blue-deep active:translate-y-0.5 text-on-primary font-headline-md text-headline-sm rounded-lg border-[1.5px] border-ink-solid shadow-[0_4px_0_#1932D4] active:shadow-none transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                disabled={pending || cart.items.some((item) => !item.available)}
                onClick={checkout}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">verified</span>
                <span>{pending ? 'Confirming…' : 'Confirm purchase'}</span>
              </button>

              <div className="pt-2 border-t-[1.5px] border-dashed border-ink-solid/40 font-data-mono text-[11px] text-ink-muted text-center space-y-1">
                <div>AUTHORITATIVE SERVER COMPUTATION</div>
                <div className="text-[10px] text-ink-subtle">
                  Transaction is idempotent and commits directly to PostgreSQL.
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
