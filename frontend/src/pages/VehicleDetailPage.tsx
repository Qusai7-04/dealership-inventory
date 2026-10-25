import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { assetUrl } from '../api/urls';
import { PageState } from '../components/PageState';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import { addVehicleToCart, purchaseVehicle, saveVehicle } from '../features/vehicles/actions';
import type { Vehicle } from '../types/api';

export function VehicleDetailPage() {
  const { api } = useAuth(); const { id } = useParams(); const [vehicle, setVehicle] = useState<Vehicle | null>(null); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { api.get<{ vehicle: Vehicle }>(`/api/vehicles/${id}`).then((result) => setVehicle(result.vehicle)).catch((reason) => setError(reason.message)); }, [api, id]);
  async function act(action: () => Promise<void>, success: string) { setError(null); try { await action(); setMessage(success); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action failed'); } }
  if (!vehicle) return <main className="page"><PageState loading={!error} error={error} /></main>;
  const images = [...vehicle.images].sort((a, b) => a.displayOrder - b.displayOrder); const available = vehicle.quantity > 0;
  return <main className="page detail-layout"><section className="detail-gallery">{images.length ? images.map((image) => <img key={image.id} src={assetUrl(image.url)} alt={image.altText} />) : <img src="/images/vehicle-placeholder.svg" alt={`Image unavailable for ${vehicle.make} ${vehicle.model}`} />}</section>
    <section className="detail-sheet paper-panel"><p className="eyebrow">{vehicle.category.name}</p><h1>{vehicle.make}<br /><em>{vehicle.model}</em></h1><p className="price jumbo">{formatPrice(vehicle.price)}</p><p className={`stock-line ${available ? 'live' : 'empty'}`}>{available ? `${vehicle.quantity} available` : 'Out of stock'}</p>
      <p>This page shows only persisted catalogue facts. No inferred specifications or provider lookup year are presented.</p>{(message || error) && <p role="status" className={error ? 'form-error' : 'success-note'}>{error ?? message}</p>}
      <div className="stack-actions"><button className="button primary" disabled={!available} onClick={() => act(() => addVehicleToCart(api, vehicle), 'Added to cart')}>Add to cart</button><button className="button outline" disabled={!available} onClick={() => act(() => purchaseVehicle(api, vehicle), 'Purchase recorded')}>Purchase now</button><button className="button outline" onClick={() => act(() => saveVehicle(api, vehicle), 'Saved to favourites')}>Add to favourites</button></div>
    </section></main>;
}
