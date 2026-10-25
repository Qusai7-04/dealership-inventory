import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, ApiError, type ApiClient } from '../../api/client';
import type { User } from '../../types/api';

const storageKey = 'creaseline.session';

interface AuthContextValue {
  api: ApiClient;
  user: User | null;
  loading: boolean;
  notice: string | null;
  login(email: string, password: string, requiredRole?: 'admin' | 'user'): Promise<User>;
  register(fullName: string, email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(storageKey));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [notice, setNotice] = useState<string | null>(null);

  const clearSession = (expired = false) => {
    sessionStorage.removeItem(storageKey);
    setToken(null);
    setUser(null);
    setLoading(false);
    if (expired) setNotice('Your session expired. Please sign in again.');
  };

  const api = useMemo(() => createApiClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    getToken: () => token,
    onUnauthorized: () => clearSession(true),
  }), [token]);

  useEffect(() => {
    // Bootstrap only the token that existed when the application opened.
    // A successful login already returns the complete user and must not trigger a second /me request.
    if (!token) return;
    let active = true;
    setLoading(true);
    api.get<{ user: User }>('/api/auth/me')
      .then((result) => { if (active) setUser(result.user); })
      .catch(() => { if (active) clearSession(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string, requiredRole?: 'admin' | 'user'): Promise<User> {
    setNotice(null);
    const result = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
    if (requiredRole === 'admin' && result.user.role !== 'admin') {
      clearSession(false);
      throw new ApiError(403, 'This account does not have administrator access');
    }
    sessionStorage.setItem(storageKey, result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }

  async function register(fullName: string, email: string, password: string) {
    await api.post('/api/auth/register', { fullName, email, password });
  }

  const value = { api, user, loading, notice, login, register, logout: () => clearSession(false) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
