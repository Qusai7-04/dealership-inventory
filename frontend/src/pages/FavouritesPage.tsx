import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { Favourite } from '../types/api';

export function FavouritesPage() {
  const { api } = useAuth();
  const [items, setItems] = useState<Favourite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.get<{ favourites: Favourite[] }>('/api/favourites')
      .then((res) => setItems(res.favourites))
      .catch((reason) => setError(reason.message));
  }, [api]);

  useEffect(load, [load]);

  async function remove(id: string) {
    try {
      await api.delete(`/api/favourites/${id}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove favourite');
    }
  }

  async function preference(item: Favourite) {
    try {
      await api.patch(`/api/favourites/${item.vehicleId}/notification-preference`, {
        notifyOnRestock: !item.notifyOnRestock,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update notification preference');
    }
  }

  return (
    <main className="page min-h-screen bg-paper-base paper-grain py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <header className="page-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b-[1.5px] border-ink-solid">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-live-lime animate-pulse" />
              <p className="eyebrow text-ink-muted">PERSONAL WATCHLIST // RESTOCK PREFERENCES</p>
            </div>
            <h1 className="font-display-hero text-headline-xl sm:text-display-hero text-ink-solid font-bold uppercase tracking-tight leading-none">
              Favourites
            </h1>
          </div>
          <p className="font-body-md text-ink-muted max-w-md">
            Restock alerts are opt-in and persisted to your account. You will receive an inbox dispatch when inventory is added.
          </p>
        </header>

        <PageState loading={!items && !error} error={error} onRetry={load} />

        {items && (
          items.length === 0 ? (
            <div className="empty-state p-16 text-center bg-paper-surface border-[2px] border-dashed border-ink-solid rounded-2xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paper-recessed border-[1.5px] border-ink-solid flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-ink-muted">favorite_border</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-ink-solid font-bold">
                Nothing saved yet
              </h2>
              <p className="font-body-md text-ink-muted mt-2 max-w-md mx-auto">
                Explore the floor and pin vehicles to your private watchlist for quick tracking and restock alerts.
              </p>
              <Link
                to="/vehicles"
                className="mt-6 inline-flex px-6 py-2.5 bg-action-blue hover:bg-action-blue-deep text-on-primary font-label-nav text-body-sm font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] transition-all"
              >
                Browse The Floor
              </Link>
            </div>
          ) : (
            <section className="list-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <article
                  key={item.vehicleId}
                  className="paper-panel saved-card bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-5 shadow-[0_4px_0_#16150F] flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`font-stamp-badge text-[10px] px-2 py-0.5 rounded border border-ink-solid font-bold uppercase ${
                          item.deleted
                            ? 'bg-ink-muted text-white'
                            : item.available
                            ? 'bg-live-lime text-ink-solid'
                            : 'bg-alert-red text-white'
                        }`}
                      >
                        {item.deleted
                          ? 'No longer listed'
                          : item.available
                          ? `${item.stock} available`
                          : 'Out of stock'}
                      </span>
                      <span className="font-data-mono text-[10px] text-ink-subtle">
                        #{item.vehicleId.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    <Link to={`/vehicles/${item.vehicleId}`} className="hover:text-action-blue transition-colors">
                      <h2 className="font-headline-sm text-headline-sm text-ink-solid font-bold">
                        {item.make} <em className="font-editorial-accent italic font-normal">{item.model}</em>
                      </h2>
                    </Link>

                    <p className="price font-price-lg text-headline-sm text-ink-solid font-bold mt-2">
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t-[1.5px] border-dashed border-ink-solid/40">
                    <label className="toggle flex items-center gap-2 cursor-pointer font-data-mono text-xs text-ink-solid select-none">
                      <input
                        type="checkbox"
                        checked={item.notifyOnRestock}
                        onChange={() => preference(item)}
                        disabled={item.deleted}
                        className="w-4 h-4 rounded border-ink-solid text-action-blue focus:ring-action-blue"
                      />
                      <span>Notify me when back in stock</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/vehicles/${item.vehicleId}`}
                        className="flex-1 text-center py-2 bg-paper-base hover:bg-paper-recessed text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid transition-colors"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => remove(item.vehicleId)}
                        className="button outline px-3 py-2 bg-paper-base hover:bg-[#FFDAD6] hover:text-alert-red text-ink-muted font-label-nav text-xs font-bold rounded-lg border border-ink-solid transition-colors"
                      >
                        Remove favourite
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )
        )}
      </div>
    </main>
  );
}
