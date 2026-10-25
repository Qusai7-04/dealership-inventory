import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { Pagination, Purchase } from '../types/api';

export function PurchasesPage() {
  const { api } = useAuth();
  const [items, setItems] = useState<Purchase[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    api.get<{ purchases: Purchase[]; pagination: Pagination }>(`/api/purchases?page=${page}&limit=10`)
      .then((res) => {
        setItems(res.purchases);
        setPagination(res.pagination);
      })
      .catch((reason) => setError(reason.message));
  }, [api, page]);

  return (
    <main className="page min-h-screen bg-paper-base paper-grain py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <header className="page-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b-[1.5px] border-ink-solid">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-live-lime animate-pulse" />
              <p className="eyebrow text-ink-muted">ACCOUNT LEDGER // PURCHASE SNAPSHOTS</p>
            </div>
            <h1 className="font-display-hero text-headline-xl sm:text-display-hero text-ink-solid font-bold uppercase tracking-tight leading-none">
              Purchase history
            </h1>
          </div>
          <p className="font-body-md text-ink-muted max-w-md">
            Persisted purchase snapshots for your account—indelible transaction receipts registered directly to PostgreSQL.
          </p>
        </header>

        <PageState loading={!items && !error} error={error} />

        {items && (
          items.length === 0 ? (
            <div className="empty-state p-16 text-center bg-paper-surface border-[2px] border-dashed border-ink-solid rounded-2xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paper-recessed border-[1.5px] border-ink-solid flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-ink-muted">receipt_long</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-ink-solid font-bold">
                No purchases recorded
              </h2>
              <p className="font-body-md text-ink-muted mt-2 max-w-md mx-auto">
                No motor chassis acquisitions have been confirmed for your account yet.
              </p>
              <Link
                to="/vehicles"
                className="mt-6 inline-flex px-6 py-2.5 bg-action-blue hover:bg-action-blue-deep text-on-primary font-label-nav text-body-sm font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] transition-all"
              >
                Browse The Floor
              </Link>
            </div>
          ) : (
            <section className="purchase-list space-y-4">
              {items.map((purchase) => (
                <article
                  key={purchase.id}
                  className="paper-panel purchase-sheet bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-5 shadow-[0_3px_0_#16150F] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-data-mono text-stamp-badge text-ink-subtle">
                      <span className="uppercase text-ink-solid font-bold">
                        {purchase.source} purchase
                      </span>
                      <span>•</span>
                      <span>{new Date(purchase.purchasedAt).toLocaleString()}</span>
                      <span>•</span>
                      <span className="text-secondary font-bold">
                        RECEIPT #{purchase.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    <h2 className="font-headline-sm text-body-lg text-ink-solid font-bold">
                      {purchase.items.map((item) => item.vehicleLabel).join(', ')}
                    </h2>
                  </div>

                  <div className="text-right sm:self-center">
                    <span className="font-stamp-badge text-[10px] text-ink-subtle uppercase block">
                      TOTAL SETTLED
                    </span>
                    <p className="price font-price-lg text-headline-sm text-ink-solid font-bold">
                      {formatPrice(purchase.totalPrice)}
                    </p>
                  </div>
                </article>
              ))}
            </section>
          )
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="pagination flex items-center justify-between pt-6 border-t-[1.5px] border-dashed border-ink-solid/40">
            <button
              className="button outline px-4 py-2 bg-paper-surface text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span className="font-data-mono text-xs text-ink-muted">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              className="button outline px-4 py-2 bg-paper-surface text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid disabled:opacity-40"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
