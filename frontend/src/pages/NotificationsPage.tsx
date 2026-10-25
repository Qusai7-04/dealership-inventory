import { useCallback, useEffect, useState } from 'react';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import type { Notification, Pagination } from '../types/api';

export function NotificationsPage() {
  const { api } = useAuth(); const [items, setItems] = useState<Notification[] | null>(null); const [pagination, setPagination] = useState<Pagination | null>(null); const [unread, setUnread] = useState(0); const [page, setPage] = useState(1); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setError(null); api.get<{ notifications: Notification[]; unreadCount: number; pagination: Pagination }>(`/api/notifications?page=${page}&limit=12`).then((result) => { setItems(result.notifications); setUnread(result.unreadCount); setPagination(result.pagination); }).catch((reason) => setError(reason.message)); }, [api, page]); useEffect(load, [load]);
  async function read(item: Notification) { await api.patch(`/api/notifications/${item.id}/read`, {}); await load(); }
  return <main className="page"><header className="page-heading"><p className="eyebrow">{unread} unread</p><h1>Notifications</h1><p>Inventory events addressed to your account, newest first.</p></header><PageState loading={!items && !error} error={error} onRetry={load} />{items && (items.length === 0 ? <div className="empty-state"><h2>No notifications</h2></div> : <section className="notification-list">{items.map((item) => <article className={`notice-row ${item.read ? 'read' : ''}`} key={item.id}><div><p className="eyebrow">{item.type.replaceAll('_', ' ')}</p><h2>{item.message}</h2><time>{new Date(item.createdAt).toLocaleString()}</time></div>{!item.read && <button className="button outline" onClick={() => read(item)}>Mark read</button>}</article>)}</section>)}{pagination && <div className="pagination"><button className="button outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="button outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}</main>;
}
