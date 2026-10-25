import { useCallback, useEffect, useState } from 'react';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { Favourite } from '../types/api';

export function FavouritesPage() {
  const { api } = useAuth(); const [items, setItems] = useState<Favourite[] | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { api.get<{ favourites: Favourite[] }>('/api/favourites').then((result) => setItems(result.favourites)).catch((reason) => setError(reason.message)); }, [api]); useEffect(load, [load]);
  async function remove(id: string) { await api.delete(`/api/favourites/${id}`); await load(); }
  async function preference(item: Favourite) { await api.patch(`/api/favourites/${item.vehicleId}/notification-preference`, { notifyOnRestock: !item.notifyOnRestock }); await load(); }
  return <main className="page"><header className="page-heading"><p className="eyebrow">Saved lines</p><h1>Favourites</h1><p>Restock alerts are opt-in and persisted to your account.</p></header><PageState loading={!items && !error} error={error} onRetry={load} />{items && (items.length === 0 ? <div className="empty-state"><h2>Nothing saved yet</h2></div> : <section className="list-grid">{items.map((item) => <article className="paper-panel saved-card" key={item.vehicleId}><p className="eyebrow">{item.deleted ? 'No longer listed' : item.available ? `${item.stock} available` : 'Out of stock'}</p><h2>{item.make} <em>{item.model}</em></h2><p className="price">{formatPrice(item.price)}</p><label className="toggle"><input type="checkbox" checked={item.notifyOnRestock} onChange={() => preference(item)} disabled={item.deleted} /> Notify me when back in stock</label><button className="button outline" onClick={() => remove(item.vehicleId)}>Remove favourite</button></article>)}</section>)}</main>;
}
