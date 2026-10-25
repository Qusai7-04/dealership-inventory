import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from '../../api/urls';
import type { Vehicle } from '../../types/api';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatPrice(price: string) {
  return currency.format(Number(price));
}

// Deterministic telemetry spec generator based on category and vehicle name
function getMechanicalTelemetry(vehicle: Vehicle) {
  const cat = vehicle.category.name.toLowerCase();
  if (cat.includes('suv') || cat.includes('pickup')) {
    return { power: '204 BHP', time: '8.4 SEC', drive: 'AWD / 4X4' };
  }
  if (cat.includes('coupe') || cat.includes('sport')) {
    return { power: '518 BHP', time: '3.4 SEC', drive: 'RWD TRACK' };
  }
  if (cat.includes('electric') || cat.includes('ev')) {
    return { power: '320 BHP', time: '4.8 SEC', drive: 'DUAL MOTOR' };
  }
  if (cat.includes('hatchback')) {
    return { power: '118 BHP', time: '9.8 SEC', drive: 'FWD AGILE' };
  }
  return { power: '150 BHP', time: '7.9 SEC', drive: 'SEDAN RWD' };
}

export function VehicleCard({
  vehicle,
  onAddToCart,
  onFavourite,
  onPurchase,
  isFavourited = false,
}: {
  vehicle: Vehicle;
  onAddToCart(vehicle: Vehicle): Promise<void>;
  onFavourite(vehicle: Vehicle): Promise<void>;
  onPurchase?(vehicle: Vehicle): Promise<void>;
  isFavourited?: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cover = [...vehicle.images].sort((a, b) => a.displayOrder - b.displayOrder)[0];
  const available = vehicle.quantity > 0;
  const low = available && vehicle.quantity <= vehicle.lowStockThreshold;
  const telemetry = getMechanicalTelemetry(vehicle);

  async function perform(kind: string, action: () => Promise<void>) {
    setPending(kind);
    setError(null);
    try {
      await action();
      if (kind === 'cart') {
        setAdded(true);
        setTimeout(() => setAdded(false), 2400);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setPending(null);
    }
  }

  const stockBadgeText = available
    ? low
      ? `Low stock · ${vehicle.quantity} available`
      : `${vehicle.quantity} available`
    : 'Out of stock';

  return (
    <article
      className={`vehicle-card group relative bg-paper-surface rounded-2xl p-4 flex flex-col justify-between border-[1.5px] border-ink-solid shadow-[0_4px_0_#16150F] hover:-translate-y-1 hover:shadow-[0_8px_0_#16150F] transition-all duration-300 ${
        added ? 'fold-success' : ''
      }`}
      data-vehicle-id={vehicle.id}
    >
      {/* Decorative Adhesive Lime Tape Strip */}
      <div
        className="absolute -top-3 left-8 w-16 h-5 bg-tape-lime -rotate-3 z-10 pointer-events-none rounded-sm border border-ink-solid/40 shadow-[0_1px_0_#16150F]"
        aria-hidden="true"
      />

      <div>
        {/* Top Header Badge Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`font-stamp-badge text-stamp-badge px-2.5 py-0.5 rounded-full border-[1.5px] border-ink-solid font-bold shadow-[0_1px_0_#16150F] ${
                !available
                  ? 'bg-alert-red text-white -rotate-2'
                  : low
                  ? 'bg-attention-orange text-white rotate-1'
                  : 'bg-live-lime text-ink-solid -rotate-1'
              }`}
            >
              {stockBadgeText}
            </span>
            <span className="font-stamp-badge text-stamp-badge uppercase text-ink-muted">
              {vehicle.category.name}
            </span>
          </div>

          {/* Favourite Heart Key */}
          <button
            className={`fav-btn w-8 h-8 rounded-full bg-paper-base border-[1.5px] border-ink-solid flex items-center justify-center transition-all shadow-[0_1px_0_#16150F] active:translate-y-0.5 ${
              isFavourited
                ? 'text-alert-red bg-paper-surface'
                : 'text-ink-muted hover:text-alert-red hover:bg-paper-surface'
            }`}
            aria-label={`Save ${vehicle.make} ${vehicle.model} to favourites`}
            disabled={pending !== null}
            onClick={() => perform('favourite', () => onFavourite(vehicle))}
            title="Watchlist Chassis"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isFavourited ? 'favorite' : 'favorite_border'}
            </span>
          </button>
        </div>

        {/* Vehicle Image Container — ALWAYS FULL COLOR AND READABLE */}
        <div className="vehicle-image-wrap relative w-full h-48 rounded-xl overflow-hidden mb-3 bg-paper-recessed border-[1.5px] border-ink-solid group-hover:scale-[1.01] transition-transform">
          <img
            className={`vehicle-image w-full h-full object-cover transition-opacity duration-300 ${
              !available ? 'opacity-90 saturate-[0.85]' : ''
            }`}
            src={cover ? assetUrl(cover.url) : '/images/vehicle-placeholder.svg'}
            alt={cover?.altText ?? `Image unavailable for ${vehicle.make} ${vehicle.model}`}
            onError={(event) => {
              event.currentTarget.src = '/images/vehicle-placeholder.svg';
            }}
          />

          {/* Lot / Stock Identifier Tag */}
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-ink-solid text-paper-base font-data-mono text-stamp-badge shadow-[0_1px_0_#16150F]">
            LOT #{vehicle.id.slice(0, 8).toUpperCase()}
          </div>

          {/* Out of Stock Rubber Stamp */}
          {!available && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3">
              <div className="px-4 py-1.5 bg-alert-red text-white font-stamp-badge text-[13px] font-bold tracking-widest border-2 border-ink-solid rounded shadow-[0_3px_0_#16150F] rotate-[-6deg] uppercase">
                SOLD OUT · ARCHIVED
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Titles */}
        <div className="space-y-0.5 mb-3">
          <Link
            to={`/vehicles/${vehicle.id}`}
            className="block group-hover:text-action-blue transition-colors"
          >
            <h2 className="font-headline-sm text-headline-sm text-ink-solid tracking-tight font-bold leading-snug">
              {vehicle.make} <em className="font-editorial-accent italic font-normal">{vehicle.model}</em>
            </h2>
          </Link>
          <p className="font-data-mono text-[11px] text-ink-muted">
            CLASS: {vehicle.category.name.toUpperCase()} • SPEC REGISTRY
          </p>
        </div>

        {/* Mechanical Telemetry Ledger Strip */}
        <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2.5 rounded-lg bg-paper-base border-[1.5px] border-ink-solid text-ink-solid font-data-mono text-[11px] mb-3 shadow-[0_1px_0_#16150F]">
          <div>
            <span className="block text-ink-subtle uppercase text-[9px]">POWER</span>
            <span className="font-bold">{telemetry.power}</span>
          </div>
          <div>
            <span className="block text-ink-subtle uppercase text-[9px]">0–100</span>
            <span className="font-bold">{telemetry.time}</span>
          </div>
          <div>
            <span className="block text-ink-subtle uppercase text-[9px]">DRIVE</span>
            <span className="font-bold">{telemetry.drive}</span>
          </div>
        </div>
      </div>

      {/* Pricing & Acquisition Actions Footer */}
      <div className="pt-2.5 border-t-[1.5px] border-dashed border-ink-solid/30 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-stamp-badge text-[10px] text-ink-subtle uppercase tracking-wider">
            SHOWROOM LEDGER
          </span>
          <span className="price font-price-lg text-headline-sm text-ink-solid font-bold">
            {formatPrice(vehicle.price)}
          </span>
        </div>

        {error && (
          <p className="inline-error font-data-mono text-xs text-alert-red font-semibold" role="alert">
            {error}
          </p>
        )}
        {added && (
          <p className="success-note font-stamp-badge text-xs text-secondary font-bold" aria-live="polite">
            Added to cart
          </p>
        )}

        {/* Action Buttons Matrix */}
        <div className="grid grid-cols-2 gap-2">
          {/* Fold into Cart */}
          <button
            className="fold-card-btn px-3 py-2 rounded-lg bg-paper-base hover:bg-paper-recessed text-ink-solid font-label-nav text-body-sm font-semibold transition-all border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!available || pending !== null}
            onClick={() => perform('cart', () => onAddToCart(vehicle))}
            title={!available ? 'Unit Sold • Waitlist Allocation Active' : 'Fold chassis sheet to cart'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {available ? 'flip_to_back' : 'lock'}
            </span>
            <span>{pending === 'cart' ? 'Folding…' : 'Add to cart'}</span>
          </button>

          {/* Direct Buy / Purchase Now */}
          <button
            className="purchase-btn px-3 py-2 rounded-lg bg-action-blue hover:bg-action-blue-deep text-on-primary font-label-nav text-body-sm font-semibold transition-all border-[1.5px] border-ink-solid shadow-[0_2px_0_#1932D4] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!available || pending !== null || !onPurchase}
            onClick={() => onPurchase && perform('purchase', () => onPurchase(vehicle))}
            title={!available ? 'Unit Sold • Immediate Purchase Unavailable' : 'Execute direct acquisition'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {available ? 'bolt' : 'block'}
            </span>
            <span>{pending === 'purchase' ? 'Purchasing…' : 'Purchase now'}</span>
          </button>
        </div>

        {/* View Details Link */}
        <Link
          to={`/vehicles/${vehicle.id}`}
          className="w-full text-center py-1 font-label-nav text-xs text-ink-muted hover:text-action-blue uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-1"
        >
          <span>Inspect Spec Sheet</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    </article>
  );
}
