import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import type { CartResponse } from '../types/api';

export function AppShell() {
  const { user, logout, api } = useAuth();
  const location = useLocation();
  const [cartCount, setCartCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }
    let active = true;
    api.get<CartResponse>('/api/cart')
      .then((res) => {
        if (active) setCartCount(res.itemCount ?? res.items?.length ?? 0);
      })
      .catch(() => {
        if (active) setCartCount(0);
      });
    return () => { active = false; };
  }, [api, user, location.pathname]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `font-label-nav text-body-sm uppercase tracking-wider px-3.5 py-1.5 rounded transition-all flex items-center gap-1.5 border-[1.5px] ${
      isActive
        ? 'bg-action-blue text-on-primary border-ink-solid shadow-[0_2px_0_#1932D4]'
        : 'text-ink-solid border-transparent hover:border-ink-solid hover:bg-paper-surface'
    }`;

  return (
    <div className="app-shell min-h-screen bg-paper-base flex flex-col selection:bg-live-lime selection:text-ink-solid">
      {/* TOP LIVE TELEMETRY TICKER */}
      <div className="w-full bg-paper-surface border-b-[1.5px] border-ink-solid py-1.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-ink-muted font-stamp-badge text-[11px] uppercase tracking-widest gap-2">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-live-lime animate-pulse" />
            <span className="text-ink-solid font-bold">RECORD LEDGER: 2026-Q1</span>
            <span className="text-ink-subtle hidden sm:inline">•</span>
            <span className="hidden sm:inline">TERMINAL: MUMBAI-SOUTH // ARCHIVE 09</span>
            <span className="text-ink-subtle hidden sm:inline">•</span>
            <span className="text-secondary font-bold hidden md:inline">PHYSICAL STOCK ONLY</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-ink-subtle">INDEX ACTIVE (0.12s)</span>
            {user ? (
              <span className="text-action-blue font-bold">
                USER #{user.fullName.toUpperCase()} ({user.role})
              </span>
            ) : (
              <span className="text-ink-muted">GUEST SHOWROOM MODE</span>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP & PRIMARY HEADER */}
      <header className="sticky top-0 z-40 w-full bg-paper-base border-b-[1.5px] border-ink-solid shadow-[0_4px_0_#16150F]">
        <div className="h-20 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link to="/" className="flex items-baseline gap-2 group">
              <span className="font-display-hero text-headline-lg tracking-tight uppercase text-ink-solid group-hover:text-action-blue transition-colors font-bold">
                CREASELINE
              </span>
              <span className="font-stamp-badge text-stamp-badge bg-live-lime text-ink-solid px-2 py-0.5 border-[1.5px] border-ink-solid rounded-full -rotate-2 hidden sm:inline-block font-bold">
                EDITION 01
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1.5" aria-label="Primary">
              <NavLink to="/vehicles" className={navClass}>
                The Floor
              </NavLink>
              <NavLink to="/cart" className={navClass}>
                <span>Cart</span>
                {cartCount > 0 && (
                  <span className="font-data-mono text-[10px] px-1.5 py-0.2 bg-live-lime text-ink-solid border border-ink-solid rounded-full font-bold ml-1">
                    {cartCount}
                  </span>
                )}
              </NavLink>
              <NavLink to="/favourites" className={navClass}>
                Favourites
              </NavLink>
              <NavLink to="/notifications" className={navClass}>
                Notifications
              </NavLink>
              <NavLink to="/purchases" className={navClass}>
                Purchases
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={navClass}>
                  Console
                </NavLink>
              )}
            </nav>
          </div>

          {/* Right Header Utility Block */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Watchlist Shortcut */}
            <Link
              to="/favourites"
              className="w-9 h-9 hidden sm:flex items-center justify-center bg-paper-surface border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F] hover:bg-paper-recessed active:translate-y-0.5 transition-all text-ink-solid"
              title="Watchlist"
            >
              <span className="material-symbols-outlined text-[19px]">favorite</span>
            </Link>

            {/* Shopping Bag Cart Action */}
            <Link
              to="/cart"
              className="h-9 px-3 flex items-center gap-2 bg-live-lime border-[1.5px] border-ink-solid rounded-full shadow-[0_2px_0_#16150F] hover:bg-secondary-fixed-dim active:translate-y-0.5 transition-all text-ink-solid"
              title="View Cart Docket"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
              <span className="font-data-mono text-data-mono font-bold">({cartCount})</span>
            </Link>

            {/* User Desk / Auth State */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l-[1.5px] border-ink-solid/20">
                <span className="font-label-nav text-body-sm text-ink-solid font-semibold hidden md:inline">
                  {user.fullName.split(' ')[0]}
                </span>
                <button
                  onClick={logout}
                  className="px-2.5 py-1 bg-paper-recessed hover:bg-paper-surface text-ink-solid border-[1.5px] border-ink-solid rounded shadow-[0_1px_0_#16150F] font-label-nav text-xs font-semibold uppercase tracking-wider transition-all"
                  title="Sign out of Creaseline"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l-[1.5px] border-ink-solid/20">
                <Link
                  to="/sign-in"
                  className="px-3 py-1 bg-paper-base hover:bg-paper-surface text-ink-solid border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F] font-label-nav text-xs font-semibold uppercase tracking-wider"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1 bg-action-blue hover:bg-action-blue-deep text-on-primary border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#1932D4] font-label-nav text-xs font-semibold uppercase tracking-wider hidden sm:inline-block"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT BODY */}
      <div className="flex-1 w-full pb-24 lg:pb-12">
        <Outlet />
      </div>

      {/* MOBILE FLOATING BOTTOM NAVIGATION CAPSULE (fold_mobile_showroom_bottom_nav) */}
      <aside className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none lg:hidden">
        <nav
          className="pointer-events-auto bg-paper-surface/95 backdrop-blur-md rounded-full shadow-[0_4px_0_#16150F] border-[1.5px] border-ink-solid px-2 py-1.5 flex items-center gap-1.5 transition-all max-w-[380px]"
          aria-label="Mobile"
        >
          {/* Home */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `group relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all select-none ${
                isActive
                  ? 'bg-action-blue text-on-primary shadow-sm font-bold'
                  : 'text-ink-solid hover:bg-paper-recessed'
              }`
            }
            title="Home"
          >
            <span className="material-symbols-outlined text-[20px]">home</span>
            <span className="font-label-nav text-xs whitespace-nowrap">Home</span>
          </NavLink>

          {/* The Floor */}
          <NavLink
            to="/vehicles"
            className={({ isActive }) =>
              `group relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all select-none ${
                isActive
                  ? 'bg-action-blue text-on-primary shadow-sm font-bold'
                  : 'text-ink-solid hover:bg-paper-recessed'
              }`
            }
            title="The Floor"
          >
            <span className="material-symbols-outlined text-[20px]">view_agenda</span>
            <span className="font-label-nav text-xs whitespace-nowrap">Floor</span>
          </NavLink>

          {/* Favourites */}
          <NavLink
            to="/favourites"
            className={({ isActive }) =>
              `group relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all select-none ${
                isActive
                  ? 'bg-action-blue text-on-primary shadow-sm font-bold'
                  : 'text-ink-solid hover:bg-paper-recessed'
              }`
            }
            title="Saved"
          >
            <span className="material-symbols-outlined text-[20px]">favorite</span>
            <span className="font-label-nav text-xs whitespace-nowrap">Saved</span>
          </NavLink>

          {/* Cart */}
          <NavLink
            to="/cart"
            className={({ isActive }) =>
              `group relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all select-none ${
                isActive
                  ? 'bg-action-blue text-on-primary shadow-sm font-bold'
                  : 'text-ink-solid hover:bg-paper-recessed'
              }`
            }
            title="Cart"
          >
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-live-lime text-ink-solid font-data-mono text-[9px] font-bold px-1 rounded-full leading-tight border border-ink-solid">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="font-label-nav text-xs whitespace-nowrap">Cart</span>
          </NavLink>

          {/* Account / Desk */}
          <NavLink
            to={user?.role === 'admin' ? '/admin' : user ? '/purchases' : '/sign-in'}
            className={({ isActive }) =>
              `group relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all select-none ${
                isActive
                  ? 'bg-action-blue text-on-primary shadow-sm font-bold'
                  : 'text-ink-solid hover:bg-paper-recessed'
              }`
            }
            title={user ? 'Desk' : 'Sign in'}
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
            <span className="font-label-nav text-xs whitespace-nowrap">
              {user?.role === 'admin' ? 'Console' : user ? 'Desk' : 'Sign in'}
            </span>
          </NavLink>
        </nav>
      </aside>

      {/* EDITORIAL MOTOR FOOTER */}
      <footer className="w-full bg-ink-solid text-paper-base border-t-[1.5px] border-ink-solid relative overflow-hidden mt-auto">
        {/* Running Marquee Ticker */}
        <div className="w-full bg-live-lime text-ink-solid border-b-[1.5px] border-ink-solid py-2 overflow-hidden select-none">
          <div className="animate-marquee whitespace-nowrap">
            <span className="font-stamp-badge text-stamp-badge tracking-widest uppercase mr-8">
              BUY THE CAR ✻ KEEP THE RECEIPT ✻ 27 ACTIVE ON THE FLOOR ✻ PURCHASES UPDATE SHARED STOCK ✻ PHYSICAL ARCHIVAL SPECIFICATIONS ✻
            </span>
            <span className="font-stamp-badge text-stamp-badge tracking-widest uppercase mr-8">
              BUY THE CAR ✻ KEEP THE RECEIPT ✻ 27 ACTIVE ON THE FLOOR ✻ PURCHASES UPDATE SHARED STOCK ✻ PHYSICAL ARCHIVAL SPECIFICATIONS ✻
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b-[1.5px] border-dashed border-paper-recessed/30">
            {/* Col 1 */}
            <div className="space-y-4">
              <div className="font-headline-md text-headline-sm tracking-tight text-paper-base uppercase font-bold">
                CREASELINE CATALOGUE
              </div>
              <p className="font-body-sm text-body-sm text-paper-recessed leading-relaxed">
                The tactile automotive showroom rendered digitally. Heavy paper stocks, indelible receipt tracking, and mechanical inventory precision.
              </p>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-ink-muted/40 border-[1.5px] border-paper-recessed/30 font-data-mono text-stamp-badge text-live-lime">
                <span className="w-2 h-2 rounded-full bg-live-lime animate-pulse" />
                SHOWROOM LIVE • DISPATCH READY
              </div>
            </div>

            {/* Col 2 */}
            <div>
              <div className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-live-lime mb-4">
                Showroom Floor
              </div>
              <ul className="space-y-2.5 font-label-nav text-body-sm text-paper-recessed">
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/vehicles">The Active Floor</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/vehicles?categoryId=2">Executive Sedans</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/vehicles?categoryId=1">SUV & 4x4 Series</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/vehicles?available=true">Available Inventory</Link>
                </li>
              </ul>
            </div>

            {/* Col 3 */}
            <div>
              <div className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-live-lime mb-4">
                Dealership & Trade
              </div>
              <ul className="space-y-2.5 font-label-nav text-body-sm text-paper-recessed">
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/cart">Tear-Sheet Checkout</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/purchases">Archival Purchase Receipts</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/favourites">Watchlist & Restock Alerts</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/notifications">Inventory Dispatch Inbox</Link>
                </li>
              </ul>
            </div>

            {/* Col 4 */}
            <div>
              <div className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-live-lime mb-4">
                Console & Terminal
              </div>
              <ul className="space-y-2.5 font-label-nav text-body-sm text-paper-recessed">
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/admin">Inventory Control Ledger</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/sign-in">Terminal Authorization</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/register">Open Buyer Account</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-data-mono text-stamp-badge text-paper-recessed/70">
            <div>CREASELINE MOTORWORKS ARCHIVE © 2026. ALL SPECIFICATION SHEETS BOUND IN INK.</div>
            <div className="flex items-center gap-6">
              <span>PRINT-PRESS ENGINE V4.2</span>
              <span>100% UNBLEACHED DIGITAL CARD</span>
            </div>
          </div>

          <div className="mt-8 select-none pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="font-display-hero text-[100px] sm:text-[160px] lg:text-[210px] leading-none font-bold tracking-tighter stroke-wordmark uppercase text-center opacity-70">
              CREASELINE
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
