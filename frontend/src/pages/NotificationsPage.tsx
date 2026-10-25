import { useCallback, useEffect, useState } from 'react';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import type { Notification, Pagination } from '../types/api';

export function NotificationsPage() {
  const { api } = useAuth();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.get<{ notifications: Notification[]; unreadCount: number; pagination: Pagination }>(
      `/api/notifications?page=${page}&limit=12`
    )
      .then((result) => {
        setItems(result.notifications);
        setUnread(result.unreadCount);
        setPagination(result.pagination);
      })
      .catch((reason) => setError(reason.message));
  }, [api, page]);

  useEffect(load, [load]);

  async function read(item: Notification) {
    try {
      await api.patch(`/api/notifications/${item.id}/read`, {});
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not mark notification read');
    }
  }

  return (
    <main className="page min-h-screen bg-paper-base paper-grain py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <header className="page-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b-[1.5px] border-ink-solid">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-action-blue animate-pulse" />
              <p className="eyebrow text-ink-muted">
                <span>{unread} unread</span> • DISPATCH LOG
              </p>
            </div>
            <h1 className="font-display-hero text-headline-xl sm:text-display-hero text-ink-solid font-bold uppercase tracking-tight leading-none">
              Notifications
            </h1>
          </div>
          <p className="font-body-md text-ink-muted max-w-md">
            Inventory dispatch and restock events addressed to your account, newest first.
          </p>
        </header>

        <PageState loading={!items && !error} error={error} onRetry={load} />

        {items && (
          items.length === 0 ? (
            <div className="empty-state p-16 text-center bg-paper-surface border-[2px] border-dashed border-ink-solid rounded-2xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paper-recessed border-[1.5px] border-ink-solid flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-ink-muted">notifications_none</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-ink-solid font-bold">
                No notifications
              </h2>
              <p className="font-body-md text-ink-muted mt-2 max-w-md mx-auto">
                Your dispatch queue is empty. When saved chassis are restocked, alerts will be logged here.
              </p>
            </div>
          ) : (
            <section className="notification-list space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`notice-row bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_2px_0_#16150F] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    !item.read ? 'border-l-8 border-l-action-blue bg-paper-base' : 'opacity-80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-stamp-badge text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-paper-recessed border border-ink-solid">
                        {item.type.replaceAll('_', ' ')}
                      </span>
                      <time className="font-data-mono text-[10px] text-ink-subtle">
                        {new Date(item.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <h2 className="font-headline-sm text-body-lg text-ink-solid font-semibold">
                      {item.message}
                    </h2>
                  </div>

                  {!item.read && (
                    <button
                      onClick={() => read(item)}
                      className="button outline px-3 py-1.5 bg-paper-base hover:bg-paper-surface text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid shadow-[0_1px_0_#16150F] active:translate-y-0.5 transition-all self-start sm:self-center"
                    >
                      Mark read
                    </button>
                  )}
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
