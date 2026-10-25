import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function AppShell() {
  const { user, logout } = useAuth();
  return <div className="app-shell">
    <header className="topbar"><NavLink className="wordmark" to="/">CREASELINE</NavLink>
      <nav aria-label="Primary"><NavLink to="/vehicles">Vehicles</NavLink><NavLink to="/cart">Cart</NavLink><NavLink to="/favourites">Favourites</NavLink><NavLink to="/notifications">Notifications</NavLink><NavLink to="/purchases">Purchases</NavLink>{user?.role === 'admin' && <NavLink to="/admin">Inventory</NavLink>}</nav>
      <button className="text-button" onClick={logout}>Sign out</button>
    </header>
    <Outlet />
    <nav className="mobile-nav" aria-label="Mobile"><NavLink to="/vehicles">Floor</NavLink><NavLink to="/cart">Cart</NavLink><NavLink to="/favourites">Saved</NavLink><NavLink to="/notifications">Alerts</NavLink></nav>
  </div>;
}
