import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../features/auth/AuthProvider';

function AuthFrame({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="auth-page min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 paper-grain bg-paper-base">
      <div className="auth-panel w-full max-w-md bg-paper-surface border-[2px] border-ink-solid rounded-2xl p-6 sm:p-10 shadow-[0_8px_0_#16150F]">
        {/* Top Folio Tag */}
        <div className="flex items-center justify-between pb-3 mb-6 border-b-[1.5px] border-dashed border-ink-solid/40">
          <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-action-blue font-bold">
            FOLIO TERMINAL ACCESS
          </span>
          <span className="font-data-mono text-[11px] text-ink-subtle">REV. 2026</span>
        </div>

        <h1 className="font-display-hero text-headline-xl text-ink-solid font-bold uppercase tracking-tight mb-2">
          {title}
        </h1>
        <p className="font-body-sm text-body-sm text-ink-muted mb-6 leading-relaxed">
          {intro}
        </p>

        {children}
      </div>
    </div>
  );
}

export function SignInPage() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'customer' | 'admin'>('customer');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
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

  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(data.get('email')), String(data.get('password')), 'admin');
      navigate('/admin', { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to authenticate as admin');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title={mode === 'customer' ? 'Sign in' : 'Admin Terminal Access'}
      intro={
        mode === 'customer'
          ? 'Sign in to browse live inventory and manage your Creaseline account.'
          : 'Restricted access for Creaseline inventory directors and stock operators.'
      }
    >
      {/* Mode Selector Tabs */}
      <div className="flex gap-2 p-1 mb-6 bg-paper-base border-[1.5px] border-ink-solid rounded-xl">
        <button
          type="button"
          onClick={() => { setMode('customer'); setError(null); }}
          className={`flex-1 py-2 text-xs font-bold uppercase font-data-mono tracking-wider rounded-lg transition-all ${
            mode === 'customer'
              ? 'bg-ink-solid text-paper-surface shadow-sm'
              : 'text-ink-muted hover:text-ink-solid'
          }`}
        >
          Customer Portal
        </button>
        <button
          type="button"
          onClick={() => { setMode('admin'); setError(null); }}
          className={`flex-1 py-2 text-xs font-bold uppercase font-data-mono tracking-wider rounded-lg transition-all ${
            mode === 'admin'
              ? 'bg-action-blue text-on-primary shadow-sm'
              : 'text-ink-muted hover:text-ink-solid'
          }`}
        >
          Admin Console
        </button>
      </div>

      {(notice || error) && (
        <div
          role="alert"
          className="p-3 mb-4 bg-[#FFDAD6] border border-ink-solid rounded-lg font-data-mono text-xs text-alert-red font-bold"
        >
          {error ?? notice}
        </div>
      )}

      {mode === 'customer' ? (
        <form onSubmit={submitCustomer} className="auth-form space-y-4">
          <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="buyer@creaseline.com"
              required
              className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
            />
          </label>

          <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3.5 bg-action-blue hover:bg-action-blue-deep active:translate-y-0.5 text-on-primary font-headline-sm text-body-sm font-bold uppercase tracking-wider rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] active:shadow-none transition-all disabled:opacity-40"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="pt-4 border-t-[1.5px] border-dashed border-ink-solid/40 text-center font-data-mono text-xs text-ink-muted">
            New collector?{' '}
            <Link to="/register" className="text-action-blue font-bold hover:underline">
              Create account
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={submitAdmin} className="auth-form space-y-4 bg-ink-solid/5 p-4 rounded-xl border border-ink-solid/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
            <span className="font-data-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
              Staff Privileges Verification
            </span>
          </div>

          <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
            Admin Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="admin@creaseline.com"
              required
              className="w-full mt-1 bg-paper-surface border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
            />
          </label>

          <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
            Passcode
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="w-full mt-1 bg-paper-surface border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3.5 bg-ink-solid hover:bg-neutral-800 active:translate-y-0.5 text-accent-lime font-headline-sm text-body-sm font-bold uppercase tracking-wider rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#000] active:shadow-none transition-all disabled:opacity-40"
          >
            {pending ? 'Verifying Credentials…' : 'Authenticate as Admin'}
          </button>

          <p className="font-data-mono text-[11px] text-ink-muted text-center pt-2">
            Non-admin accounts will be rejected by server validation.
          </p>
        </form>
      )}
    </AuthFrame>
  );
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
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await register(String(data.get('fullName')), String(data.get('email')), password);
      navigate('/sign-in', { replace: true, state: { registered: true } });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to create account');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title="Create account"
      intro="Create a standard user account. Administrative access is assigned only by the server."
    >
      <form onSubmit={submit} className="auth-form space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 bg-[#FFDAD6] border border-ink-solid rounded-lg font-data-mono text-xs text-alert-red font-bold"
          >
            {error}
          </div>
        )}

        <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
          Full name
          <input
            name="fullName"
            type="text"
            placeholder="Asha Rao"
            required
            className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
          />
        </label>

        <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="asha@example.com"
            required
            className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
          />
        </label>

        <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3.5 py-2.5 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3.5 bg-action-blue hover:bg-action-blue-deep active:translate-y-0.5 text-on-primary font-headline-sm text-body-sm font-bold uppercase tracking-wider rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] active:shadow-none transition-all disabled:opacity-40"
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>

        <div className="pt-4 border-t-[1.5px] border-dashed border-ink-solid/40 text-center font-data-mono text-xs text-ink-muted">
          Already registered?{' '}
          <Link to="/sign-in" className="text-action-blue font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}
