import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/sign-in', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg font-label-nav text-xs font-bold uppercase tracking-wider transition-all border-[1.5px] ${
      isActive
        ? 'bg-action-blue text-on-primary border-ink-solid shadow-[0_2px_0_#1932D4]'
        : 'text-ink-solid border-transparent hover:border-ink-solid hover:bg-paper-surface'
    }`;

  return (
    <div className="admin-shell min-h-screen bg-paper-base flex flex-col md:flex-row selection:bg-live-lime selection:text-ink-solid">
      {/* DESKTOP SIDEBAR */}
      <aside className="w-full md:w-64 bg-paper-surface border-b-[2px] md:border-b-0 md:border-r-[2px] border-ink-solid flex flex-col shrink-0">
        {/* Brand Banner */}
        <div className="p-5 border-b-[1.5px] border-ink-solid">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="font-display-hero text-headline-md tracking-tight uppercase text-ink-solid font-bold">
              CREASELINE
            </span>
            <span className="font-stamp-badge text-[10px] px-2 py-0.5 bg-action-blue text-on-primary border border-ink-solid rounded-full font-bold">
              ADMIN CONSOLE
            </span>
          </Link>
          <div className="mt-2 font-data-mono text-[10px] text-ink-subtle uppercase tracking-widest">
            OPERATOR TERMINAL • ED. 2026
          </div>
        </div>

        {/* Archivist Identity Block */}
        <div className="p-4 border-b-[1.5px] border-dashed border-ink-solid/40 bg-paper-base/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-ink-solid text-paper-base flex items-center justify-center font-display-hero text-sm font-bold border border-ink-solid">
              {user?.fullName?.charAt(0) ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-sans text-xs font-bold text-ink-solid truncate">
                {user?.fullName ?? 'Operator'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-live-lime animate-pulse" />
                <span className="font-stamp-badge text-[10px] uppercase font-bold text-action-blue">
                  Administrator
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-3 space-y-1.5 flex-1" aria-label="Admin console navigation">
          <NavLink to="/admin" end className={navClass}>
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Inventory Master</span>
          </NavLink>

          <Link
            to="/vehicles"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg font-label-nav text-xs font-bold uppercase tracking-wider text-ink-muted border-[1.5px] border-transparent hover:border-ink-solid hover:text-ink-solid hover:bg-paper-surface transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            <span>Public Storefront</span>
          </Link>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t-[1.5px] border-ink-solid bg-paper-base/40 space-y-2">
          <button
            onClick={handleSignOut}
            className="w-full py-2 bg-paper-recessed hover:bg-alert-red hover:text-white border-[1.5px] border-ink-solid rounded-lg font-label-nav text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT OPERATIONAL WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 bg-paper-surface border-b-[1.5px] border-ink-solid px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-data-mono text-[11px] text-ink-muted hidden sm:inline">
              STATION: MUMBAI-SOUTH // ARCHIVE 09
            </span>
            <span className="text-ink-subtle hidden sm:inline">•</span>
            <span className="font-stamp-badge text-[10px] px-2 py-0.5 rounded bg-live-lime border border-ink-solid text-ink-solid font-bold uppercase">
              Physical Stock Only
            </span>
          </div>

          <div className="flex items-center gap-3 font-data-mono text-xs">
            <Link
              to="/vehicles"
              className="text-action-blue font-bold hover:underline flex items-center gap-1"
            >
              <span>View Storefront</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </Link>
          </div>
        </header>

        {/* Main Workspace Body */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
