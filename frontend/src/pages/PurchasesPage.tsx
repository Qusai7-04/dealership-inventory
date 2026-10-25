import { useEffect, useState } from 'react';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { Pagination, Purchase } from '../types/api';

export function PurchasesPage() {
  const { api } = useAuth(); const [items, setItems] = useState<Purchase[] | null>(null); const [pagination, setPagination] = useState<Pagination | null>(null); const [page, setPage] = useState(1); const [error, setError] = useState<string | null>(null);
  useEffect(() => { setItems(null); api.get<{ purchases: Purchase[]; pagination: Pagination }>(`/api/purchases?page=${page}&limit=10`).then((result) => { setItems(result.purchases); setPagination(result.pagination); }).catch((reason) => setError(reason.message)); }, [api, page]);
  return <main className="page"><header className="page-heading"><p className="eyebrow">Account ledger</p><h1>Purchase history</h1><p>Persisted purchase snapshots for your account—not payment records.</p></header><PageState loading={!items && !error} error={error} />{items && (items.length === 0 ? <div className="empty-state"><h2>No purchases recorded</h2></div> : <section className="purchase-list">{items.map((purchase) => <article className="paper-panel purchase-sheet" key={purchase.id}><div><p className="eyebrow">{purchase.source} purchase · {new Date(purchase.purchasedAt).toLocaleString()}</p><h2>{purchase.items.map((item) => item.vehicleLabel).join(', ')}</h2></div><p className="price">{formatPrice(purchase.totalPrice)}</p></article>)}</section>)}{pagination && <div className="pagination"><button className="button outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="button outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}</main>;
}
