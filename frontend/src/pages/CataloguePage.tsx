import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { VehicleCard } from '../features/vehicles/VehicleCard';
import { addVehicleToCart, purchaseVehicle, saveVehicle } from '../features/vehicles/actions';
import type { Category, VehicleListResponse } from '../types/api';

export function CataloguePage() {
  const { api } = useAuth();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<VehicleListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const page = Number(params.get('page') ?? 1);
  const load = useCallback(() => {
    setError(null); setResult(null);
    const query = new URLSearchParams(params); query.set('page', String(page)); query.set('limit', '12');
    Promise.all([api.get<VehicleListResponse>(`/api/vehicles?${query}`), api.get<{ categories: Category[] }>('/api/vehicle-categories')])
      .then(([vehicles, categoryResult]) => { setResult(vehicles); setCategories(categoryResult.categories); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Inventory could not be loaded.'));
  }, [api, page, params, version]);
  useEffect(load, [load]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams();
    for (const key of ['search', 'categoryId', 'minPrice', 'maxPrice', 'available', 'sort', 'direction']) { const value = String(data.get(key) ?? '').trim(); if (value) next.set(key, value); }
    next.set('page', '1'); setParams(next);
  }
  const changePage = (nextPage: number) => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next); };
  return <main className="page"><header className="page-heading"><p className="eyebrow">Live Creaseline catalogue</p><h1>The floor</h1><p>Search current stock lines. Availability and prices come directly from the inventory service.</p></header>
    <form className="filter-panel" onSubmit={submit} aria-label="Vehicle filters">
      <label className="search-field">Search<input name="search" defaultValue={params.get('search') ?? ''} placeholder="Make or model" /></label>
      <label>Category<select name="categoryId" defaultValue={params.get('categoryId') ?? ''}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Min price<input name="minPrice" type="number" min="0" defaultValue={params.get('minPrice') ?? ''} /></label>
      <label>Max price<input name="maxPrice" type="number" min="0" defaultValue={params.get('maxPrice') ?? ''} /></label>
      <label>Availability<select name="available" defaultValue={params.get('available') ?? ''}><option value="">Any stock</option><option value="true">Available</option><option value="false">Out of stock</option></select></label>
      <label>Sort<select name="sort" defaultValue={params.get('sort') ?? 'createdAt'}><option value="createdAt">Recently added</option><option value="make">Make</option><option value="price">Price</option><option value="quantity">Stock</option></select></label>
      <input type="hidden" name="direction" value={params.get('direction') ?? 'asc'} /><button className="button primary">Apply filters</button><button className="button outline" type="button" onClick={() => setParams({ page: '1' })}>Clear filters</button>
    </form>
    <PageState loading={!result && !error} error={error} onRetry={() => setVersion((value) => value + 1)} />
    {result && <><div className="result-bar"><strong>{result.pagination.total} stock lines</strong><span>Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}</span></div>
      {result.vehicles.length === 0 ? <div className="empty-state"><h2>No vehicles match</h2><p>Try a different search or clear the filters.</p></div> : <section className="vehicle-grid" aria-label="Vehicles">{result.vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} onAddToCart={(item) => addVehicleToCart(api, item)} onFavourite={(item) => saveVehicle(api, item)} onPurchase={(item) => purchaseVehicle(api, item)} />)}</section>}
      <div className="pagination"><button className="button outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button><button className="button outline" disabled={page >= result.pagination.totalPages} onClick={() => changePage(page + 1)}>Next</button></div></>}
  </main>;
}
