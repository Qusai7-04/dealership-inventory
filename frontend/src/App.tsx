import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AdminShell } from './components/AdminShell';
import { AuthProvider } from './features/auth/AuthProvider';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { SignInPage, RegisterPage } from './pages/AuthPages';
import { CataloguePage } from './pages/CataloguePage';
import { HomePage } from './pages/HomePage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';
import { CartPage } from './pages/CartPage';
import { FavouritesPage } from './pages/FavouritesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Customer routes wrapped by AppShell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/vehicles" element={<CataloguePage />} />
            <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/favourites" element={<FavouritesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
          </Route>
        </Route>

        {/* Dedicated Admin Shell for Administrator */}
        <Route element={<ProtectedRoute admin />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
