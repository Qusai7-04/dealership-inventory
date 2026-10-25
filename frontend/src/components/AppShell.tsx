import { useEffect, useState, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { CartResponse, CartItem } from '../types/api';

export function AppShell() {
  const { user, logout, api } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartSubtotal, setCartSubtotal] = useState<string>('0.00');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const footerRef = useRef<HTMLElement | null>(null);

  // Sync cart count & contents
  useEffect(() => {
    if (!user) {
      setCartCount(0);
      setCartItems([]);
      setCartSubtotal('0.00');
      return;
    }
    let active = true;
    api
      .get<CartResponse>('/api/cart')
      .then((res) => {
        if (!active) return;
        setCartCount(res.itemCount ?? res.items?.length ?? 0);
        setCartItems(res.items ?? []);
        setCartSubtotal(res.subtotal ?? '0.00');
      })
      .catch(() => {
        if (!active) return;
        setCartCount(0);
        setCartItems([]);
      });
    return () => {
      active = false;
    };
  }, [api, user, location.pathname]);

  // Scroll state & footer progress listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);

      if (footerRef.current) {
        const rect = footerRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        // Fraction of footer exposed in viewport
        const fraction = Math.min(Math.max((vh - rect.top) / (rect.height || 1), 0), 1);
        setScrollProgress(fraction);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard Escape listener for cart drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  async function handleRemoveCartItem(vehicleId: string) {
    try {
      const updated = await api.delete<CartResponse>(`/api/cart/items/${vehicleId}`);
      setCartCount(updated.itemCount ?? updated.items?.length ?? 0);
      setCartItems(updated.items ?? []);
      setCartSubtotal(updated.subtotal ?? '0.00');
    } catch {
      // ignore
    }
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `font-label-nav text-body-sm uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border-[1.5px] ${
      isActive
        ? 'bg-action-blue text-on-primary border-ink-solid shadow-[0_2px_0_#1932D4]'
        : 'text-ink-solid border-transparent hover:border-ink-solid hover:bg-paper-surface'
    }`;

  return (
    <div className="app-shell min-h-screen bg-paper-base flex flex-col selection:bg-live-lime selection:text-ink-solid">
      {/* TOP LIVE TELEMETRY TICKER */}
      <div className="w-full bg-paper-surface border-b-[1.5px] border-ink-solid py-1 px-4 sm:px-8 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-ink-muted font-stamp-badge text-[10px] uppercase tracking-widest gap-2">
          <div className="flex items-center gap-2.5">
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
              <div className="flex items-center gap-2">
                <span className="text-action-blue font-bold">
                  USER #{user.fullName.toUpperCase()}
                </span>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="font-stamp-badge text-[9px] px-1.5 py-0.2 bg-action-blue text-on-primary rounded border border-ink-solid hover:bg-action-blue-deep font-bold"
                  >
                    Console ↗
                  </Link>
                )}
              </div>
            ) : (
              <span className="text-ink-muted">GUEST SHOWROOM MODE</span>
            )}
          </div>
        </div>
      </div>

      {/* COMPACT & ELEGANT HEADER (60-64px desktop, 54-58px mobile) */}
      <header
        className={`sticky top-0 z-40 w-full border-b-[1.5px] border-ink-solid transition-all duration-200 ${
          scrolled
            ? 'h-14 sm:h-[60px] bg-paper-base/95 backdrop-blur-md shadow-[0_2px_0_#16150F]'
            : 'h-14 sm:h-16 bg-paper-base shadow-[0_3px_0_#16150F]'
        }`}
      >
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link to="/" className="flex items-baseline gap-2 group">
              <span className="font-display-hero text-headline-md tracking-tight uppercase text-ink-solid group-hover:text-action-blue transition-colors font-bold">
                CREASELINE
              </span>
              <span className="font-stamp-badge text-[10px] bg-live-lime text-ink-solid px-2 py-0.5 border-[1.5px] border-ink-solid rounded-full -rotate-2 hidden sm:inline-block font-bold">
                EDITION 01
              </span>
            </Link>

            {/* Shopper Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              <NavLink to="/vehicles" className={navClass}>
                The Floor
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
            </nav>
          </div>

          {/* Right Header Utility Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Watchlist Shortcut */}
            <Link
              to="/favourites"
              className="w-8 h-8 hidden sm:flex items-center justify-center bg-paper-surface border-[1.5px] border-ink-solid rounded-lg shadow-[0_2px_0_#16150F] hover:bg-paper-recessed active:translate-y-0.5 transition-all text-ink-solid"
              title="Watchlist"
            >
              <span className="material-symbols-outlined text-[17px]">favorite</span>
            </Link>

            {/* Slide-Over Cart Drawer Trigger */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="h-8 sm:h-9 px-3 flex items-center gap-2 bg-live-lime border-[1.5px] border-ink-solid rounded-full shadow-[0_2px_0_#16150F] hover:bg-secondary-fixed-dim active:translate-y-0.5 transition-all text-ink-solid cursor-pointer"
              aria-label="View Cart Docket"
              title="View Cart Docket"
            >
              <span className="material-symbols-outlined text-[17px]">shopping_bag</span>
              <span className="font-data-mono text-xs font-bold">({cartCount})</span>
            </button>

            {/* User Desk / Sign-in */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l-[1.5px] border-ink-solid/20">
                <span className="font-label-nav text-xs text-ink-solid font-semibold hidden md:inline">
                  {user.fullName.split(' ')[0]}
                </span>
                <button
                  type="button"
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

      {/* SLIDE-OVER SIDE CART DRAWER */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 bg-ink-solid/50 backdrop-blur-xs z-50 transition-opacity"
          aria-hidden="true"
        />
      )}
      <aside
        role="complementary"
        aria-label="Cart drawer"
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-paper-surface border-l-[2px] border-ink-solid p-6 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div>
          {/* Drawer Top Row */}
          <div className="flex items-center justify-between pb-4 border-b-[1.5px] border-ink-solid">
            <div>
              <span className="font-stamp-badge text-[10px] uppercase tracking-wider text-action-blue font-bold">
                REQUISITION SLIP
              </span>
              <h2 className="font-headline-md text-headline-md font-bold text-ink-solid">
                Your Cart
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close cart drawer"
              className="w-8 h-8 rounded-full bg-paper-base border-[1.5px] border-ink-solid flex items-center justify-center font-bold text-ink-solid hover:bg-paper-recessed shadow-[0_1px_0_#16150F]"
            >
              ✕
            </button>
          </div>

          {/* Cart Item Stack */}
          <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-ink-muted font-body-sm">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">shopping_bag</span>
                Your cart docket is empty. Browse the floor to fold cars into your cart.
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.vehicleId}
                  className="p-3.5 bg-paper-base border-[1.5px] border-ink-solid rounded-xl shadow-[0_2px_0_#16150F] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-sans text-xs font-bold text-ink-solid truncate">
                      {item.label}
                    </h3>
                    <div className="font-price-lg text-xs font-bold text-action-blue mt-0.5">
                      {formatPrice(item.price)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCartItem(item.vehicleId)}
                    className="p-1 rounded bg-paper-surface hover:bg-[#FFDAD6] text-ink-muted hover:text-alert-red border border-ink-solid text-[10px] font-bold"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Drawer Footer & Checkout */}
        <div className="pt-4 border-t-[1.5px] border-dashed border-ink-solid space-y-3">
          <div className="flex items-baseline justify-between font-data-mono">
            <span className="text-xs uppercase text-ink-muted">Server Subtotal</span>
            <span className="font-price-lg text-headline-sm text-ink-solid font-bold">
              {formatPrice(cartSubtotal)}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                navigate('/cart');
              }}
              className="w-full py-2.5 bg-action-blue hover:bg-action-blue-deep text-on-primary font-label-nav text-xs font-bold uppercase tracking-wider rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#1932D4] active:translate-y-0.5 transition-all text-center"
            >
              Review Docket &amp; Checkout
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-full py-2 bg-paper-base hover:bg-paper-recessed text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT BODY */}
      <div className="flex-1 w-full pb-24 lg:pb-12">
        <Outlet />
      </div>

      {/* MOBILE FLOATING BOTTOM NAVIGATION CAPSULE */}
      <aside className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none lg:hidden">
        <nav
          className="pointer-events-auto bg-paper-surface/95 backdrop-blur-md rounded-full shadow-[0_4px_0_#16150F] border-[1.5px] border-ink-solid px-2 py-1.5 flex items-center gap-1.5 transition-all max-w-[380px]"
          aria-label="Mobile bottom navigation"
        >
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
            <span className="material-symbols-outlined text-[19px]">home</span>
            <span className="font-label-nav text-xs whitespace-nowrap">Home</span>
          </NavLink>

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
            <span className="material-symbols-outlined text-[19px]">view_agenda</span>
            <span className="font-label-nav text-xs whitespace-nowrap">Floor</span>
          </NavLink>

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
            <span className="material-symbols-outlined text-[19px]">favorite</span>
            <span className="font-label-nav text-xs whitespace-nowrap">Saved</span>
          </NavLink>

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
              <span className="material-symbols-outlined text-[19px]">shopping_bag</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-live-lime text-ink-solid font-data-mono text-[9px] font-bold px-1 rounded-full leading-tight border border-ink-solid">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="font-label-nav text-xs whitespace-nowrap">Cart</span>
          </NavLink>

          <NavLink
            to={user ? '/purchases' : '/sign-in'}
            className={({ isActive }) =>
              `group relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all select-none ${
                isActive
                  ? 'bg-action-blue text-on-primary shadow-sm font-bold'
                  : 'text-ink-solid hover:bg-paper-recessed'
              }`
            }
            title={user ? 'Desk' : 'Sign in'}
          >
            <span className="material-symbols-outlined text-[19px]">person</span>
            <span className="font-label-nav text-xs whitespace-nowrap">
              {user ? 'Desk' : 'Sign in'}
            </span>
          </NavLink>
        </nav>
      </aside>

      {/* EDITORIAL MOTOR FOOTER (Inspired by footer.design/sites/dirt and prototypes) */}
      <footer
        ref={footerRef}
        className="w-full bg-ink-solid text-paper-base border-t-[1.5px] border-ink-solid relative overflow-hidden mt-auto"
      >
        {/* Running Marquee Ticker */}
        <div className="w-full bg-live-lime text-ink-solid border-b-[1.5px] border-ink-solid py-2 overflow-hidden select-none">
          <div className="animate-marquee whitespace-nowrap">
            <span className="font-stamp-badge text-stamp-badge tracking-widest uppercase mr-8">
              BUY THE CAR ✻ KEEP THE RECEIPT ✻ 35 ACTIVE ON THE FLOOR ✻ PURCHASES UPDATE SHARED STOCK ✻ PHYSICAL ARCHIVAL SPECIFICATIONS ✻
            </span>
            <span className="font-stamp-badge text-stamp-badge tracking-widest uppercase mr-8">
              BUY THE CAR ✻ KEEP THE RECEIPT ✻ 35 ACTIVE ON THE FLOOR ✻ PURCHASES UPDATE SHARED STOCK ✻ PHYSICAL ARCHIVAL SPECIFICATIONS ✻
            </span>
          </div>
        </div>

        {/* Dynamic CTA Banner */}
        <div className="border-b-[1.5px] border-ink-muted/30 bg-ink-solid/50 px-6 py-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-live-lime font-bold">
                IMMEDIATE ACQUISITION ESCROW
              </span>
              <h2 className="font-headline-lg text-headline-lg text-paper-base font-bold uppercase mt-1">
                Explore The Physical Floor
              </h2>
              <p className="font-body-sm text-paper-recessed max-w-xl mt-1">
                Every vehicle on the floor is dyno-certified, photographed front three-quarter, and ready for single-click dispatch.
              </p>
            </div>
            <Link
              to="/vehicles"
              className="px-6 py-3.5 bg-live-lime hover:bg-secondary-fixed-dim text-ink-solid font-headline-sm text-body-sm font-bold uppercase tracking-wider rounded-xl border-[1.5px] border-paper-base shadow-[0_3px_0_#FEF9F0] active:translate-y-0.5 transition-all shrink-0"
            >
              Browse The Live Floor →
            </Link>
          </div>
        </div>

        {/* Blueprint Line Vehicle Silhouette SVG */}
        <div className="max-w-7xl mx-auto px-6 pt-10 flex items-center justify-center opacity-30 select-none pointer-events-none" aria-hidden="true">
          <svg className="w-full max-w-2xl h-24" viewBox="0 0 600 120" fill="none" stroke="currentColor">
            <path d="M40 90 L120 90 L160 50 L280 40 L420 40 L470 65 L560 75 L570 90 L40 90" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="150" cy="90" r="22" strokeWidth="1.5" />
            <circle cx="470" cy="90" r="22" strokeWidth="1.5" />
            <line x1="10" y1="90" x2="590" y2="90" strokeWidth="1" />
          </svg>
        </div>

        {/* Directory Links Matrix */}
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-12">
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
                  <Link to="/vehicles?categoryId=1">SUV &amp; 4x4 Series</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/vehicles?available=true">Available Inventory</Link>
                </li>
              </ul>
            </div>

            {/* Col 3 */}
            <div>
              <div className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-live-lime mb-4">
                Dealership &amp; Trade
              </div>
              <ul className="space-y-2.5 font-label-nav text-body-sm text-paper-recessed">
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/cart">Tear-Sheet Checkout</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/purchases">Archival Purchase Receipts</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/favourites">Watchlist &amp; Restock Alerts</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/notifications">Inventory Dispatch Inbox</Link>
                </li>
              </ul>
            </div>

            {/* Col 4 */}
            <div>
              <div className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-live-lime mb-4">
                Account &amp; Operations
              </div>
              <ul className="space-y-2.5 font-label-nav text-body-sm text-paper-recessed">
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/sign-in">Account Sign In</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <Link to="/register">Register Buyer Account</Link>
                </li>
                <li className="hover:text-live-lime transition-colors">
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="text-live-lime hover:underline flex items-center gap-1 font-bold pt-2 cursor-pointer"
                  >
                    <span>↑ Back to top</span>
                  </button>
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

          {/* Interactive Oversized Wordmark with Scroll-Progress Fill */}
          <div className="mt-8 select-none overflow-hidden" aria-hidden="true">
            <div
              className="font-display-hero text-[100px] sm:text-[160px] lg:text-[210px] leading-none font-bold tracking-tighter uppercase text-center transition-all duration-75"
              style={{
                color: 'transparent',
                WebkitTextStroke: '1.5px rgba(242, 237, 228, 0.4)',
                backgroundImage: `linear-gradient(90deg, #C6F24E ${scrollProgress * 100}%, transparent ${scrollProgress * 100}%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              CREASELINE
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
