import { useEffect, useState } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import type { VehicleListResponse } from '../types/api';

export function CataloguePage() {
  const { api } = useAuth();
  const [result, setResult] = useState<VehicleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<VehicleListResponse>('/api/vehicles?page=1&limit=12')
      .then((data) => { if (active) setResult(data); })
      .catch(() => { if (active) setError('Inventory could not be loaded.'); });
    return () => { active = false; };
  }, [api]);

  return <main className="page"><header className="page-heading">
    <p className="eyebrow">Live Creaseline catalogue</p><h1>The floor</h1>
    <p>Search the current stock lines. Availability and prices come directly from the inventory service.</p>
  </header>
    {!result && !error && <p aria-live="polite">Loading vehicles…</p>}
    {error && <div className="empty-state" role="alert">{error}</div>}
    {result?.vehicles.length === 0 && <div className="empty-state"><h2>No vehicles match</h2><p>Try a different search or clear the filters.</p></div>}
  </main>;
}
