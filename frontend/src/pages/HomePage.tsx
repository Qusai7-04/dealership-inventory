import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { VehicleCard, formatPrice } from '../features/vehicles/VehicleCard';
import { VehicleImage } from '../components/VehicleImage';
import { addVehicleToCart, purchaseVehicle, saveVehicle } from '../features/vehicles/actions';
import type { Category, Vehicle, VehicleListResponse } from '../types/api';

export function HomePage() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // A visitor sees public-facing hero actions without triggering unauthorized API requests
    if (!user) {
      setLoading(false);
      setFeatured([]);
      setCategories([]);
      return;
    }

    setLoading(true);

    Promise.all([
      api.get<VehicleListResponse>('/api/vehicles?page=1&limit=6&sort=createdAt&direction=desc'),
      api.get<{ categories: Category[] }>('/api/vehicle-categories').catch(() => ({ categories: [] })),
    ])
      .then(([res, catRes]) => {
        if (!active) return;
        setFeatured(res.vehicles ?? []);
        setTotalCount(res.pagination?.total ?? null);
        setCategories(catRes.categories ?? []);
      })
      .catch(() => {
        if (!active) return;
        setFeatured([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, user]);

  function handleRegisterSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const search = String(data.get('search') ?? '').trim();
    const categoryId = String(data.get('categoryId') ?? '').trim();
    const maxPrice = String(data.get('maxPrice') ?? '').trim();

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId);
    if (maxPrice) params.set('maxPrice', maxPrice);
    params.set('page', '1');

    navigate(`/vehicles?${params.toString()}`);
  }

  // Fallback specimen card data if API is loading
  const topSpecimen = featured[0];

  return (
    <main className="home-page min-h-screen bg-paper-base flex flex-col">
      {/* SECTION 1: EDITORIAL HERO & SEARCH MOTOR REGISTER */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-16 border-b-[1.5px] border-ink-solid bg-paper-base">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Editorial Headline & Register Form */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded border-[1.5px] border-ink-solid bg-paper-surface font-stamp-badge text-[10px] uppercase tracking-wider text-ink-solid font-bold shadow-[0_1px_0_#16150F]">
                FOLIO REGISTRY NO. 0101-0110
              </span>
              <span className="font-stamp-badge text-[10px] uppercase tracking-widest text-ink-muted">
                • LIVE WAREHOUSE DISPATCH
              </span>
            </div>

            <h1 className="font-display-hero text-headline-xl sm:text-display-hero text-ink-solid font-bold tracking-tight uppercase leading-none mb-6">
              Find a car.
              <br />
              <span className="font-editorial-accent italic font-normal text-action-blue lowercase">
                Buy it in one click.
              </span>
            </h1>

            <p className="font-body-lg text-body-lg text-ink-muted max-w-xl mb-8 leading-relaxed">
              Every vehicle on our floor is physically verified, catalogued, and ready for immediate single-click acquisition. Keep the printed receipt.
            </p>

            {/* Quick Search Motor Register Card */}
            <div className="p-6 bg-paper-surface border-[1.5px] border-ink-solid rounded-xl shadow-[0_4px_0_#16150F] max-w-2xl">
              <div className="flex items-center justify-between pb-3 mb-4 border-b-[1.5px] border-dashed border-ink-solid/40">
                <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-ink-solid font-bold">
                  Search Motor Register
                </span>
                <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-ink-subtle">
                  Sheet No. 01
                </span>
              </div>

              <form onSubmit={handleRegisterSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                <div className="md:col-span-5 flex flex-col">
                  <label
                    htmlFor="hero-search-make"
                    className="font-stamp-badge text-[10px] uppercase text-ink-solid font-bold mb-1"
                  >
                    Make or Model
                  </label>
                  <input
                    id="hero-search-make"
                    name="search"
                    type="text"
                    placeholder="e.g. Mercedes, Honda, Creta"
                    className="w-full bg-paper-base text-ink-solid font-data-mono text-body-sm px-3 py-2.5 border-[1.5px] border-ink-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
                  />
                </div>

                <div className="md:col-span-3 flex flex-col">
                  <label
                    htmlFor="hero-search-category"
                    className="font-stamp-badge text-[10px] uppercase text-ink-solid font-bold mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="hero-search-category"
                    name="categoryId"
                    className="w-full bg-paper-base text-ink-solid font-data-mono text-body-sm px-3 py-2.5 border-[1.5px] border-ink-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F] cursor-pointer"
                  >
                    <option value="all">All Classes</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4 flex flex-col">
                  <label
                    htmlFor="hero-search-price"
                    className="font-stamp-badge text-[10px] uppercase text-ink-solid font-bold mb-1"
                  >
                    Max Ceiling (INR)
                  </label>
                  <input
                    id="hero-search-price"
                    name="maxPrice"
                    type="number"
                    placeholder="e.g. 5000000"
                    className="w-full bg-paper-base text-ink-solid font-data-mono text-body-sm px-3 py-2.5 border-[1.5px] border-ink-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-action-blue shadow-[0_2px_0_#16150F]"
                  />
                </div>

                <div className="md:col-span-12 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 px-6 bg-action-blue hover:bg-action-blue-deep active:translate-y-0.5 text-on-primary font-headline-sm text-body-sm uppercase tracking-wider rounded-lg border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
                  >
                    <span>Search Floor</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Layered Specimen Sheet Display */}
          <div className="lg:col-span-5 relative flex items-center justify-center select-none pt-4">
            {topSpecimen ? (
              <div className="w-full max-w-md transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                <VehicleCard
                  vehicle={topSpecimen}
                  onAddToCart={(item) => addVehicleToCart(api, item)}
                  onFavourite={(item) => saveVehicle(api, item)}
                  onPurchase={(item) => purchaseVehicle(api, item)}
                />
              </div>
            ) : (
              <div className="w-full max-w-md bg-paper-surface border-[1.5px] border-ink-solid rounded-2xl p-6 shadow-[0_6px_0_#16150F] rotate-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-stamp-badge text-stamp-badge px-2.5 py-0.5 rounded-full bg-live-lime text-ink-solid border border-ink-solid font-bold">
                    ATELIER SPOTLIGHT
                  </span>
                  <span className="font-data-mono text-stamp-badge text-ink-muted">CHASSIS #0109</span>
                </div>
                <div className="w-full h-48 bg-paper-recessed rounded-xl border border-ink-solid flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-4xl text-ink-muted">garage</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-ink-solid mb-1">
                  Creaseline Motor Registry
                </h3>
                <p className="font-body-sm text-body-sm text-ink-muted">
                  Physical specification sheets catalogued daily on the showroom floor.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: THREE KEY METRIC COUNTERS (Printed Editorial Ledger) */}
      <section className="w-full bg-paper-surface border-b-[1.5px] border-ink-solid py-8 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 p-4 bg-paper-base border-[1.5px] border-ink-solid rounded-xl shadow-[0_3px_0_#16150F]">
            <div className="w-12 h-12 rounded-lg bg-live-lime border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-ink-solid text-[26px]">garage</span>
            </div>
            <div>
              <span className="font-stamp-badge text-stamp-badge text-ink-subtle uppercase">MODELS CATALOGUED</span>
              <div className="font-price-lg text-headline-md font-bold text-ink-solid">
                {totalCount !== null ? `${totalCount} ACTIVE` : '35 ACTIVE'}
              </div>
              <p className="font-data-mono text-[11px] text-ink-muted mt-0.5">100% physically inspected & dyno certified</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-paper-base border-[1.5px] border-ink-solid rounded-xl shadow-[0_3px_0_#16150F]">
            <div className="w-12 h-12 rounded-lg bg-action-blue border-[1.5px] border-ink-solid shadow-[0_2px_0_#1932D4] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[26px]">inventory_2</span>
            </div>
            <div>
              <span className="font-stamp-badge text-stamp-badge text-ink-subtle uppercase">PHYSICAL STOCK UNITS</span>
              <div className="font-price-lg text-headline-md font-bold text-action-blue">27 ON FLOOR</div>
              <p className="font-data-mono text-[11px] text-ink-muted mt-0.5">Floor ready for immediate courier dispatch</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-paper-base border-[1.5px] border-ink-solid rounded-xl shadow-[0_3px_0_#16150F]">
            <div className="w-12 h-12 rounded-lg bg-attention-orange border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-[26px]">warning</span>
            </div>
            <div>
              <span className="font-stamp-badge text-stamp-badge text-attention-orange uppercase">LOW STOCK THRESHOLD</span>
              <div className="font-price-lg text-headline-md font-bold text-attention-orange">03 CRITICAL</div>
              <p className="font-data-mono text-[11px] text-ink-muted mt-0.5">Allocation priority held for 15-minute escrow</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE PINBOARD CURATED SHOWCASE (fold_homepage_the_pinboard) */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-14 border-b-[1.5px] border-ink-solid bg-paper-base paper-grain">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b-[1.5px] border-dashed border-ink-solid/40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-live-lime animate-pulse" />
                <span className="font-stamp-badge text-stamp-badge uppercase tracking-widest text-ink-muted">
                  CURATED ACQUISITIONS
                </span>
              </div>
              <h2 className="font-headline-xl text-headline-xl text-ink-solid font-bold uppercase tracking-tight">
                The Pinboard <span className="font-editorial-accent italic text-ink-muted font-normal lowercase">· live floor</span>
              </h2>
            </div>
            <Link
              to="/vehicles"
              className="px-4 py-2 bg-paper-surface hover:bg-paper-recessed text-ink-solid font-label-nav text-body-sm font-semibold rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] active:translate-y-0.5 transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Explore All 35 Chassis</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {!user ? (
            <div className="p-10 text-center bg-paper-surface border-[1.5px] border-dashed border-ink-solid rounded-xl flex flex-col items-center justify-center space-y-4 shadow-[0_3px_0_#16150F]">
              <div className="w-12 h-12 rounded-full bg-live-lime border-[1.5px] border-ink-solid flex items-center justify-center shadow-[0_2px_0_#16150F]">
                <span className="material-symbols-outlined text-ink-solid text-2xl">badge</span>
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-headline-sm text-ink-solid font-bold">Authorized Terminal Required</h3>
                <p className="font-body-sm text-ink-muted mt-1 leading-relaxed">
                  Real-time showroom stock allocation, physical dyno certificates, and direct purchase require an authenticated collector pass.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  to="/sign-in"
                  className="px-5 py-2.5 bg-ink-solid text-paper-base font-label-nav text-body-sm font-semibold rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] hover:bg-ink-muted transition-colors"
                >
                  Sign In to Floor
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-paper-base text-ink-solid font-label-nav text-body-sm font-semibold rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] hover:bg-paper-recessed transition-colors"
                >
                  Register Account
                </Link>
              </div>
            </div>
          ) : loading ? (
            <div className="p-12 text-center bg-paper-surface border-[1.5px] border-dashed border-ink-solid rounded-xl font-data-mono text-ink-muted">
              LOADING SHOWROOM LEDGER...
            </div>
          ) : featured.length === 0 ? (
            <div className="p-12 text-center bg-paper-surface border-[1.5px] border-dashed border-ink-solid rounded-xl">
              <h3 className="font-headline-sm text-ink-solid font-bold">No active floor listings</h3>
              <p className="font-body-sm text-ink-muted mt-1">Please check back shortly or access the admin console.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {/* Atelier Bay-Window Showcase Carousel */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-ink-solid/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-action-blue" />
                    <span className="font-stamp-badge text-[11px] uppercase tracking-wider text-action-blue font-bold">
                      BAY-WINDOW EXPOSÉ // HOVER TO EXPAND SPECIMEN
                    </span>
                  </div>
                  <span className="font-data-mono text-xs text-ink-muted hidden sm:inline">
                    INTERACTIVE CHASSIS EXPANSION
                  </span>
                </div>

                <div className="bay-window-rail flex flex-col md:flex-row gap-3.5 h-auto md:h-96 w-full overflow-x-auto pb-2 snap-x snap-mandatory">
                  {featured.slice(0, 5).map((v, idx) => {
                    const cover = [...v.images].sort((a, b) => a.displayOrder - b.displayOrder)[0];
                    return (
                      <div
                        key={v.id}
                        className="bay-window-card relative flex-1 min-w-[280px] md:min-w-0 md:hover:flex-[2.6] transition-all duration-500 ease-out rounded-xl border-[1.5px] border-ink-solid overflow-hidden bg-paper-surface shadow-[0_4px_0_#16150F] hover:shadow-[0_8px_0_#16150F] group flex flex-col justify-end cursor-pointer snap-center"
                        onClick={() => navigate(`/vehicles/${v.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/vehicles/${v.id}`);
                        }}
                        aria-label={`Inspect ${v.make} ${v.model} chassis details`}
                      >
                        {/* Background Vehicle Image */}
                        <div className="absolute inset-0 bg-paper-recessed">
                          <VehicleImage
                            src={cover?.url}
                            alt={cover?.altText ?? `${v.make} ${v.model}`}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ink-solid/90 via-ink-solid/30 to-transparent pointer-events-none" />
                        </div>

                        {/* Top Stamp Tag */}
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-paper-base/95 backdrop-blur-xs border border-ink-solid font-data-mono text-[10px] text-ink-solid font-bold shadow-[0_1px_0_#16150F]">
                            CHASSIS #{idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-stamp-badge text-[9px] uppercase font-bold border border-ink-solid ${
                              v.quantity === 0 ? 'bg-alert-red text-white' : 'bg-live-lime text-ink-solid'
                            }`}
                          >
                            {v.quantity > 0 ? `${v.quantity} READY` : 'ARCHIVED'}
                          </span>
                        </div>

                        {/* Bottom Vehicle Info Card (Transitions on expand) */}
                        <div className="relative z-10 p-4 text-paper-base flex flex-col justify-end">
                          <span className="font-stamp-badge text-[10px] text-live-lime uppercase tracking-wider font-bold">
                            {v.category.name}
                          </span>
                          <h3 className="font-headline-sm text-headline-sm font-bold text-white tracking-tight leading-tight group-hover:text-live-lime transition-colors">
                            {v.make} {v.model}
                          </h3>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                            <span className="font-price-lg text-body-sm font-bold text-white">
                              {formatPrice(v.price)}
                            </span>
                            <span className="font-data-mono text-[10px] uppercase text-paper-base/80 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              <span>View Sheet</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pinboard Grid */}
              <div>
                <div className="pb-3 mb-4 border-b border-ink-solid/20 flex items-center justify-between">
                  <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-ink-solid font-bold">
                    SPECIFICATION SHEETS & ACQUISITION MATRIX
                  </span>
                  <span className="font-data-mono text-xs text-ink-muted">
                    SHOWING {featured.length} VERIFIED SPECIMENS
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featured.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      onAddToCart={(item) => addVehicleToCart(api, item)}
                      onFavourite={(item) => saveVehicle(api, item)}
                      onPurchase={(item) => purchaseVehicle(api, item)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 5: FLOOR VERIFICATION LEDGER TABLE */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-12 border-b-[1.5px] border-ink-solid bg-paper-surface">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-action-blue font-bold">
                AUDIT VERIFIED INVENTORY
              </span>
              <h3 className="font-headline-md text-headline-md text-ink-solid font-bold tracking-tight">
                Floor Verification Ledger
              </h3>
            </div>
            <span className="font-data-mono text-stamp-badge text-ink-muted">
              REV. 2026.4 // SECTION DL-09
            </span>
          </div>

          <div className="overflow-x-auto border-[1.5px] border-ink-solid rounded-xl shadow-[0_3px_0_#16150F] bg-paper-base">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-paper-surface border-b-[1.5px] border-ink-solid font-stamp-badge text-[10px] uppercase tracking-wider text-ink-muted">
                  <th className="py-2.5 px-4">Lot Serial</th>
                  <th className="py-2.5 px-4">Chassis Specification</th>
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-4">Dyno Telemetry</th>
                  <th className="py-2.5 px-4 text-right">Floor Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-solid/20 font-data-mono text-body-sm text-ink-solid">
                {featured.slice(0, 5).map((v) => (
                  <tr key={v.id} className="hover:bg-paper-surface/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-action-blue">
                      #{v.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold">
                      <Link to={`/vehicles/${v.id}`} className="hover:underline">
                        {v.make} {v.model}
                      </Link>
                    </td>
                    <td className="py-3 px-4 uppercase text-xs">{v.category.name}</td>
                    <td className="py-3 px-4 text-xs text-ink-muted">CERTIFIED 100% SPEC</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-stamp-badge text-[10px] px-2 py-0.5 rounded border border-ink-solid font-bold ${
                          v.quantity === 0
                            ? 'bg-alert-red text-white'
                            : v.quantity <= v.lowStockThreshold
                            ? 'bg-attention-orange text-white'
                            : 'bg-live-lime text-ink-solid'
                        }`}
                      >
                        {v.quantity > 0 ? `${v.quantity} IN STOCK` : 'SOLD OUT'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 6: MASTER REGISTER CALLOUT BANNER */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-12 bg-paper-base">
        <div className="max-w-7xl mx-auto p-6 bg-paper-surface rounded-xl border-[1.5px] border-ink-solid shadow-[0_4px_0_#16150F] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded bg-live-lime border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-ink-solid text-[26px]">inventory_2</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-body-lg font-bold text-ink-solid">
                Seeking a bespoke archival chassis?
              </h4>
              <p className="font-body-md text-body-sm text-ink-muted">
                Our off-floor subterranean ledger archives private consignments across Mumbai, Bengaluru, and Delhi.
              </p>
            </div>
          </div>
          <Link
            to="/vehicles"
            className="shrink-0 px-6 py-3 bg-action-blue hover:bg-action-blue-deep text-on-primary font-headline-sm text-label-nav rounded border-[1.5px] border-ink-solid shadow-[0_3px_0_#1932D4] active:translate-y-0.5 transition-all uppercase tracking-wider font-bold"
          >
            Open Master Register
          </Link>
        </div>
      </section>
    </main>
  );
}
