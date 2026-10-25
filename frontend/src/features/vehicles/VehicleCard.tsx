import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from '../../api/urls';
import type { Vehicle } from '../../types/api';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2,
});

export function formatPrice(price: string) {
  return currency.format(Number(price));
}

export function VehicleCard({ vehicle, onAddToCart, onFavourite, onPurchase }: {
  vehicle: Vehicle;
  onAddToCart(vehicle: Vehicle): Promise<void>;
  onFavourite(vehicle: Vehicle): Promise<void>;
  onPurchase?(vehicle: Vehicle): Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cover = [...vehicle.images].sort((a, b) => a.displayOrder - b.displayOrder)[0];
  const available = vehicle.quantity > 0;
  const low = available && vehicle.quantity <= vehicle.lowStockThreshold;

  async function perform(kind: string, action: () => Promise<void>) {
    setPending(kind); setError(null);
    try {
      await action();
      if (kind === 'cart') setAdded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally { setPending(null); }
  }

  return <article className={`vehicle-card ${added ? 'fold-success' : ''}`}>
    <div className="vehicle-image-wrap">
      <img
        className="vehicle-image"
        src={cover ? assetUrl(cover.url) : '/images/vehicle-placeholder.svg'}
        alt={cover?.altText ?? `Image unavailable for ${vehicle.make} ${vehicle.model}`}
        onError={(event) => { event.currentTarget.src = '/images/vehicle-placeholder.svg'; }}
      />
      <span className={`stock-tag ${available ? low ? 'low' : 'live' : 'empty'}`}>
        {available ? low ? `Low stock · ${vehicle.quantity} available` : `${vehicle.quantity} available` : 'Out of stock'}
      </span>
    </div>
    <div className="vehicle-card-body">
      <p className="eyebrow">{vehicle.category.name}</p>
      <h2>{vehicle.make} <em>{vehicle.model}</em></h2>
      <p className="price">{formatPrice(vehicle.price)}</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {added && <p className="success-note" aria-live="polite">Added to cart</p>}
      <div className="card-actions">
        <Link className="button outline" to={`/vehicles/${vehicle.id}`}>View details</Link>
        <button className="button icon" aria-label={`Save ${vehicle.make} ${vehicle.model} to favourites`} disabled={pending !== null} onClick={() => perform('favourite', () => onFavourite(vehicle))}>♡</button>
        <button className="button primary" disabled={!available || pending !== null} onClick={() => perform('cart', () => onAddToCart(vehicle))}>{pending === 'cart' ? 'Adding…' : 'Add to cart'}</button>
        <button className="button text-action" disabled={!available || pending !== null || !onPurchase} onClick={() => onPurchase && perform('purchase', () => onPurchase(vehicle))}>Purchase now</button>
      </div>
    </div>
  </article>;
}
