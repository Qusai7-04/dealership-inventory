import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { VehicleCard } from '../features/vehicles/VehicleCard';
import { addVehicleToCart, purchaseVehicle, saveVehicle } from '../features/vehicles/actions';
import type { Vehicle, VehicleListResponse } from '../types/api';

export function HomePage() {
  const { api, user } = useAuth(); const [featured, setFeatured] = useState<Vehicle[]>([]);
  useEffect(() => { if (!user) { setFeatured([]); return; } api.get<VehicleListResponse>('/api/vehicles?page=1&limit=3&available=true&sort=createdAt&direction=desc').then((result) => setFeatured(result.vehicles)).catch(() => setFeatured([])); }, [api, user]);
  return <main className="home-page"><header className="public-header"><Link className="wordmark" to="/">CREASELINE</Link><nav>{user ? <Link to="/vehicles">The floor</Link> : <><Link to="/sign-in">Sign in</Link><Link className="button primary" to="/register">Create account</Link></>}</nav></header>
    <section className="hero paper-panel"><div><p className="eyebrow">Creaseline / catalogue 01</p><h1>Find the line<br /><em>that moves you.</em></h1><p className="hero-copy">A tactile, honest view of the vehicles actually available in your local inventory.</p><Link className="button primary" to={user ? '/vehicles' : '/sign-in'}>{user ? 'Browse vehicles' : 'Sign in to browse'}</Link></div><div className="hero-fold" aria-hidden="true"><span>LIVE STOCK</span></div></section>
    <section className="home-note"><p className="eyebrow">A catalogue, not a claim</p><h2>Only persisted prices, stock, categories, and matched imagery.</h2><p>Creaseline does not invent specifications, payments, reservations, delivery status, or vehicle condition.</p></section>
    {user && featured.length > 0 && <section className="featured-section"><div className="section-heading"><p className="eyebrow">Selected from live inventory</p><h2>On the pinboard</h2></div><div className="vehicle-grid">{featured.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} onAddToCart={(item) => addVehicleToCart(api, item)} onFavourite={(item) => saveVehicle(api, item)} onPurchase={(item) => purchaseVehicle(api, item)} />)}</div></section>}
  </main>;
}
