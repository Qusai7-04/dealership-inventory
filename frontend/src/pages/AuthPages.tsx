import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../features/auth/AuthProvider';

export function SignInPage() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(data.get('email')), String(data.get('password')));
      const target = (location.state as { from?: string } | null)?.from ?? '/vehicles';
      navigate(target, { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to sign in');
    } finally {
      setPending(false);
    }
  }

  return <AuthFrame title="Sign in" intro="Sign in to browse live inventory and manage your Creaseline account.">
    <form onSubmit={submit} className="auth-form">
      {(notice || error) && <p className="form-error" role="alert">{error ?? notice}</p>}
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="button primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <p>New here? <Link to="/register">Create account</Link></p>
    </form>
  </AuthFrame>;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setPending(true); setError(null);
    try {
      await register(String(data.get('fullName')), String(data.get('email')), password);
      navigate('/sign-in', { replace: true, state: { registered: true } });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to create account');
    } finally { setPending(false); }
  }
  return <AuthFrame title="Create account" intro="Create a standard user account. Administrative access is assigned only by the server.">
    <form onSubmit={submit} className="auth-form">
      {error && <p className="form-error" role="alert">{error}</p>}
      <label>Full name<input name="fullName" autoComplete="name" required minLength={2} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required /></label>
      <button className="button primary" disabled={pending}>{pending ? 'Creating…' : 'Create account'}</button>
      <p>Already registered? <Link to="/sign-in">Sign in</Link></p>
    </form>
  </AuthFrame>;
}

function AuthFrame({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <main className="auth-page"><section className="paper-panel auth-panel">
    <Link className="wordmark" to="/">CREASELINE</Link>
    <p className="eyebrow">Your inventory, clearly folded</p>
    <h1>{title}</h1><p>{intro}</p>{children}
  </section></main>;
}
