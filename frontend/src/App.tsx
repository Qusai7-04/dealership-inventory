import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthProvider } from './features/auth/AuthProvider';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { SignInPage, RegisterPage } from './pages/AuthPages';
import { CataloguePage } from './pages/CataloguePage';
import { HomePage } from './pages/HomePage';

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/sign-in" element={<SignInPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="/vehicles" element={<CataloguePage />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider>;
}
