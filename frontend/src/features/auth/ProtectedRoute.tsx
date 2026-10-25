import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="status-page" aria-live="polite">Opening your Creaseline session…</main>;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/vehicles" replace />;
  return <Outlet />;
}
