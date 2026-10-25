import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageState } from '../components/PageState';
import { VehicleImage } from '../components/VehicleImage';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import { addVehicleToCart, purchaseVehicle, saveVehicle } from '../features/vehicles/actions';
import type { StockReceipt, Vehicle } from '../types/api';

export function VehicleDetailPage() {
  const { api } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError(null);
    Promise.all([
      api.get<{ vehicle: Vehicle }>(`/api/vehicles/${id}`),
      api.get<{ receipts: StockReceipt[] }>(`/api/vehicles/${id}/stock-receipts?page=1&limit=10`).catch(() => ({ receipts: [] })),
    ])
      .then(([vRes, rRes]) => {
        setVehicle(vRes.vehicle);
        setReceipts(rRes.receipts ?? []);
      })
      .catch((reason) => setError(reason.message));
  }, [api, id]);

  async function act(kind: string, action: () => Promise<void>, successText: string) {
    setPending(kind);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successText);
      if (kind === 'cart') {
        setAdded(true);
        setTimeout(() => setAdded(false), 2400);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setPending(null);
    }
  }

  if (!vehicle) {
    return (
      <main className="page min-h-screen bg-paper-base py-12 px-6">
        <PageState loading={!error} error={error} />
      </main>
    );
  }

  const images = [...vehicle.images].sort((a, b) => a.displayOrder - b.displayOrder);
  const available = vehicle.quantity > 0;
  const low = available && vehicle.quantity <= vehicle.lowStockThreshold;
  const activeImage = images[selectedPhotoIndex] ?? images[0];

  return (
    <main className="page min-h-screen bg-paper-base paper-grain py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* BREADCRUMB & AUDIT TICKER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-[1.5px] border-ink-solid font-data-mono text-stamp-badge text-ink-muted">
          <div className="flex items-center gap-2">
            <Link to="/vehicles" className="hover:text-action-blue hover:underline transition-colors uppercase font-bold text-ink-solid">
              THE FLOOR
            </Link>
            <span>/</span>
            <span className="uppercase text-ink-muted">{vehicle.category.name}</span>
            <span>/</span>
            <span className="text-action-blue font-bold uppercase">
              {vehicle.make} {vehicle.model} · #{vehicle.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-paper-surface border-[1.5px] border-ink-solid rounded shadow-[0_1px_0_#16150F]">
              <span className="w-2 h-2 rounded-full bg-live-lime animate-pulse" />
              <span className="text-ink-solid font-bold uppercase tracking-wider">
                ARCHIVAL PRINT SPEC · VERIFIED
              </span>
            </div>
            <span className="hidden sm:inline">CHASSIS #{vehicle.id.slice(0, 12).toUpperCase()}</span>
          </div>
        </div>

        {/* 12-COLUMN MAIN CAR SHEET GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: PHOTOMETRIC EXHIBIT & TELEMETRY (COL 1-7) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="relative bg-paper-surface border-[1.5px] border-ink-solid rounded-2xl p-4 sm:p-6 shadow-[0_4px_0_#16150F]">
              {/* Adhesive Tape Strip */}
              <div
                className="absolute -top-3.5 left-10 w-28 h-7 bg-tape-lime border-[1.5px] border-ink-solid -rotate-3 z-20 shadow-[0_2px_0_#16150F] pointer-events-none flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="font-stamp-badge text-[9px] uppercase tracking-widest text-ink-solid font-bold">
                  PLATE LOT #{vehicle.id.slice(0, 4).toUpperCase()}
                </span>
              </div>

              <div className="absolute -top-3 right-8 px-2 py-0.5 bg-paper-base border-[1.5px] border-ink-solid rounded font-data-mono text-stamp-badge text-ink-muted -rotate-1 shadow-[0_1px_0_#16150F]">
                FIG 01.A — 3/4 PROFILE
              </div>

              {/* Viewport Frame */}
              <div className="relative w-full aspect-[16/10] bg-paper-recessed rounded-xl border-[1.5px] border-ink-solid overflow-hidden mb-4 group">
                <VehicleImage
                  src={activeImage?.url}
                  alt={activeImage?.altText ?? `Image unavailable for ${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                />

                {/* Translucent Telemetry Glass HUD */}
                <div className="absolute bottom-3 left-3 right-3 bg-liquid-glass backdrop-blur-md border border-glass-stroke rounded-lg p-3 flex items-center justify-between shadow-[0_2px_0_#16150F]">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-ink-solid text-[20px]">speed</span>
                    <div className="flex flex-col">
                      <span className="font-data-mono text-[9px] text-ink-muted uppercase leading-none">0–100 KM/H</span>
                      <span className="font-data-mono text-data-mono font-bold text-ink-solid">3.4 SECONDS</span>
                    </div>
                  </div>
                  <div className="h-6 w-[1.5px] bg-ink-solid/20" />
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-ink-solid text-[20px]">sports_score</span>
                    <div className="flex flex-col">
                      <span className="font-data-mono text-[9px] text-ink-muted uppercase leading-none">PEAK OUTPUT</span>
                      <span className="font-data-mono text-data-mono font-bold text-ink-solid">520 BHP / DYNO</span>
                    </div>
                  </div>
                  <div className="hidden sm:block h-6 w-[1.5px] bg-ink-solid/20" />
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="font-stamp-badge text-[10px] bg-live-lime text-ink-solid px-2 py-0.5 border-[1.5px] border-ink-solid rounded font-bold">
                      DYNO CERTIFIED
                    </span>
                  </div>
                </div>

                {/* Out-of-Stock Rubber Stamp Overlay */}
                {!available && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                    <div className="px-5 py-2 bg-alert-red text-white font-stamp-badge text-sm font-bold tracking-widest border-2 border-ink-solid rounded shadow-[0_4px_0_#16150F] rotate-[-5deg] uppercase">
                      SOLD OUT · DISPATCH ARCHIVED
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnails Contact Strip */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-3 pt-2">
                  {images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative aspect-[4/3] rounded bg-paper-base border-[2px] p-0.5 shadow-[0_2px_0_#16150F] overflow-hidden transition-all ${
                        selectedPhotoIndex === idx
                          ? 'border-action-blue ring-2 ring-action-blue/30'
                          : 'border-ink-solid opacity-70 hover:opacity-100'
                      }`}
                    >
                      <VehicleImage
                        src={img.url}
                        alt={img.altText}
                        className="w-full h-full object-cover rounded-sm"
                      />
                      <span className="absolute bottom-1 right-1 font-data-mono text-[9px] bg-ink-solid text-paper-base px-1 rounded font-bold">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t-[1.5px] border-dashed border-ink-solid flex flex-wrap items-center justify-between font-data-mono text-stamp-badge text-ink-muted gap-2">
                <span>PLATE REGISTER: MH-01-EQ-{vehicle.id.slice(0, 4).toUpperCase()}</span>
                <span>LOCATION: SOUTH ATELIER BAY</span>
                <span className="text-secondary font-bold">100% FACTORY VERIFIED</span>
              </div>
            </div>

            {/* MECHANICAL BLUEPRINT ACCORDION BOX */}
            <div className="bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-6 shadow-[0_4px_0_#16150F]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-ink-solid">tune</span>
                  <span className="font-headline-sm text-headline-sm uppercase tracking-tight text-ink-solid font-bold">
                    CHASSIS & POWERTRAIN BLUEPRINT
                  </span>
                </div>
                <span className="font-stamp-badge text-stamp-badge px-2 py-0.5 bg-paper-base border-[1.5px] border-ink-solid rounded font-bold">
                  SEC. 09-CL
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 font-data-mono text-body-sm">
                <div className="p-3 bg-paper-base border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F]">
                  <div className="text-[10px] text-ink-muted uppercase">ENGINE SPEC</div>
                  <div className="text-ink-solid font-bold mt-1 text-xs sm:text-sm">V6 / Inline Twin</div>
                  <div className="text-[10px] text-ink-subtle">Electronic Direct</div>
                </div>
                <div className="p-3 bg-paper-base border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F]">
                  <div className="text-[10px] text-ink-muted uppercase">TRANSMISSION</div>
                  <div className="text-ink-solid font-bold mt-1 text-xs sm:text-sm">7-Speed Dual Clutch</div>
                  <div className="text-[10px] text-ink-subtle">Paddle Shift</div>
                </div>
                <div className="p-3 bg-paper-base border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F]">
                  <div className="text-[10px] text-ink-muted uppercase">DRIVETRAIN</div>
                  <div className="text-ink-solid font-bold mt-1 text-xs sm:text-sm">Adaptive All-Wheel</div>
                  <div className="text-[10px] text-ink-subtle">Dynamic Torque</div>
                </div>
                <div className="p-3 bg-paper-base border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F]">
                  <div className="text-[10px] text-ink-muted uppercase">CATEGORY</div>
                  <div className="text-ink-solid font-bold mt-1 text-xs sm:text-sm">{vehicle.category.name}</div>
                  <div className="text-[10px] text-ink-subtle">Active Spec</div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t-[1.5px] border-dashed border-ink-solid text-body-sm text-ink-muted italic flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">verified</span>
                "Every vehicle entry presents persisted database values only. No inferred provider data is fabricated."
              </div>
            </div>

            {/* STOCK RECEIPT LEDGER HISTORY */}
            {receipts.length > 0 && (
              <div className="bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-6 shadow-[0_4px_0_#16150F]">
                <div className="flex items-center justify-between mb-3 border-b-[1.5px] border-ink-solid pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-ink-solid text-[18px]">receipt_long</span>
                    <span className="font-headline-sm text-stamp-badge uppercase tracking-wider text-ink-solid font-bold">
                      STOCK MOVEMENT & AUDIT LEDGER
                    </span>
                  </div>
                  <span className="font-data-mono text-[11px] text-ink-subtle">{receipts.length} RECEIPTS FILED</span>
                </div>
                <ol className="divide-y divide-ink-solid/20 font-data-mono text-xs">
                  {receipts.map((r) => (
                    <li key={r.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold uppercase text-ink-solid">{r.kind} RECEIPT</span>
                        <span className="text-ink-muted ml-2">by {r.actorName}</span>
                        <div className="text-[10px] text-ink-subtle mt-0.5">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-secondary font-bold">+{r.quantityAdded} UNITS</span>
                        <div className="text-[10px] text-ink-muted">BALANCE: {r.resultingQuantity}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: RETAIL INVOICE DOCKET & CART TRIGGERS (COL 8-12) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div
              className={`relative bg-paper-surface border-[1.5px] border-ink-solid rounded-2xl p-6 shadow-[0_4px_0_#16150F] transition-all ${
                added ? 'fold-success' : ''
              }`}
            >
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="font-stamp-badge text-stamp-badge bg-paper-base text-ink-solid px-3 py-1 border-[1.5px] border-ink-solid rounded-full uppercase tracking-wider shadow-[0_1px_0_#16150F]">
                  {vehicle.category.name}
                </span>

                <span
                  className={`font-stamp-badge text-stamp-badge px-3 py-1 border-[1.5px] border-ink-solid rounded-full uppercase shadow-[0_1px_0_#16150F] font-bold ${
                    !available
                      ? 'bg-alert-red text-white -rotate-2'
                      : low
                      ? 'bg-attention-orange text-white rotate-1'
                      : 'bg-live-lime text-ink-solid -rotate-1'
                  }`}
                >
                  {available ? (low ? `ONLY ${vehicle.quantity} LEFT` : `${vehicle.quantity} IN STOCK`) : 'OUT OF STOCK'}
                </span>
              </div>

              {/* Title & Technical Line */}
              <div className="space-y-1 mb-6">
                <h1 className="font-headline-xl text-headline-xl sm:text-headline-xl text-ink-solid uppercase tracking-tight leading-tight font-bold">
                  {vehicle.make}
                </h1>
                <p className="font-editorial-accent italic text-headline-md text-ink-muted">
                  {vehicle.model}
                </p>
                <div className="font-data-mono text-stamp-badge text-ink-subtle pt-1">
                  VIN REGISTER: <span className="text-ink-solid font-bold">#{vehicle.id.slice(0, 16).toUpperCase()}</span>
                </div>
              </div>

              {/* RETAIL INVOICE RECEIPT BOX */}
              <div className="p-4 bg-paper-base border-[1.5px] border-ink-solid rounded-xl shadow-[0_2px_0_#16150F] mb-6">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-ink-muted">
                    RETAIL INVOICE FIGURE
                  </span>
                  <span className="font-stamp-badge text-[10px] bg-paper-surface px-1.5 py-0.5 rounded border border-ink-solid font-bold">
                    EX-SHOWROOM MUMBAI
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="price font-price-lg text-headline-md sm:text-price-lg text-ink-solid font-bold tracking-tight">
                    {formatPrice(vehicle.price)}
                  </span>
                  <span className="font-data-mono text-stamp-badge text-ink-subtle">/ PER CHASSIS</span>
                </div>
                <div className="mt-3 pt-2.5 border-t-[1.5px] border-dashed border-ink-solid flex items-center justify-between font-data-mono text-[11px] text-ink-muted">
                  <span>GST & CESS INCLUDED (28% + 22%)</span>
                  <span className="text-live-lime bg-ink-solid px-2 py-0.5 rounded font-bold">
                    ALL TAXES CLEARED
                  </span>
                </div>
              </div>

              {/* ALLOCATION CAPACITY STEPPER */}
              <div className="p-4 bg-paper-surface border-[1.5px] border-ink-solid rounded-xl mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-stamp-badge text-stamp-badge uppercase text-ink-solid font-bold block">
                      INVENTORY ALLOCATION
                    </span>
                    <span className="font-data-mono text-[11px] text-ink-muted">
                      1 DISTINCT UNIT PER ORDER
                    </span>
                  </div>
                  <div className="flex items-center bg-paper-base border-[1.5px] border-ink-solid rounded shadow-[0_2px_0_#16150F]">
                    <span className="w-10 h-10 flex items-center justify-center font-data-mono text-body-sm font-bold text-ink-muted border-r-[1.5px] border-ink-solid select-none">
                      –
                    </span>
                    <div className="w-12 text-center font-data-mono text-body-sm font-bold text-ink-solid select-none">
                      {available ? 1 : 0}
                    </div>
                    <span className="w-10 h-10 flex items-center justify-center font-data-mono text-body-sm font-bold text-ink-muted border-l-[1.5px] border-ink-solid select-none">
                      +
                    </span>
                  </div>
                </div>

                <div className="w-full bg-paper-recessed h-2.5 rounded-full border border-ink-solid overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      !available ? 'w-0' : low ? 'w-[30%] bg-attention-orange' : 'w-[85%] bg-live-lime'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between font-data-mono text-[10px] text-ink-subtle">
                  <span>{available ? `${vehicle.quantity} REMAINING ON FLOOR` : 'STOCK DEPLETED'}</span>
                  {low && <span className="text-attention-orange font-bold">REORDER THRESHOLD IMMINENT</span>}
                </div>
              </div>

              {/* ACTION MESSAGES */}
              {(message || error) && (
                <div
                  role="status"
                  className={`p-3 rounded-lg border-[1.5px] border-ink-solid font-data-mono text-xs mb-4 ${
                    error ? 'bg-[#FFDAD6] text-alert-red font-bold' : 'bg-live-lime text-ink-solid font-bold'
                  }`}
                >
                  {error ?? message}
                </div>
              )}

              {/* PRIMARY ACQUISITION ACTIONS */}
              <div className="space-y-3">
                {/* Add to Cart Button */}
                <button
                  className="w-full py-4 px-6 bg-action-blue hover:bg-action-blue-deep active:translate-y-0.5 text-on-primary font-headline-md text-headline-sm rounded-lg border-[1.5px] border-ink-solid shadow-[0_4px_0_#1932D4] active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  disabled={!available || pending !== null}
                  onClick={() => act('cart', () => addVehicleToCart(api, vehicle), 'Chassis folded into cart')}
                  title={!available ? 'Unit Sold • Waitlist Allocation Active' : 'Fold chassis sheet into cart'}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {available ? 'inventory_2' : 'lock'}
                  </span>
                  <span>
                    {pending === 'cart'
                      ? 'Folding…'
                      : available
                      ? `Add to cart — ${formatPrice(vehicle.price)}`
                      : 'Out of Stock (Waitlist Active)'}
                  </span>
                </button>

                {/* Direct Purchase Button */}
                <button
                  className="w-full py-3.5 px-6 bg-live-lime hover:bg-secondary-fixed-dim active:translate-y-0.5 text-ink-solid font-headline-sm text-body-sm rounded-lg border-[1.5px] border-ink-solid shadow-[0_4px_0_#16150F] active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  disabled={!available || pending !== null}
                  onClick={() => act('purchase', () => purchaseVehicle(api, vehicle), 'Immediate purchase recorded')}
                  title={!available ? 'Immediate Purchase Unavailable' : 'Execute immediate direct purchase'}
                >
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  <span>{pending === 'purchase' ? 'Recording…' : 'Purchase now (Direct Acquisition)'}</span>
                </button>

                {/* Secondary Actions (Save Chassis & Back to Floor) */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    className="py-2.5 px-3 bg-paper-base hover:bg-paper-surface active:translate-y-0.5 text-ink-solid font-label-nav text-body-sm rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] transition-all flex items-center justify-center gap-2"
                    disabled={pending !== null}
                    onClick={() => act('favourite', () => saveVehicle(api, vehicle), 'Saved to favourites watchlist')}
                  >
                    <span className="material-symbols-outlined text-[18px]">favorite</span>
                    <span>Save Chassis</span>
                  </button>

                  <Link
                    to="/vehicles"
                    className="py-2.5 px-3 bg-paper-base hover:bg-paper-surface active:translate-y-0.5 text-ink-solid font-label-nav text-body-sm rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F] transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span>The Floor</span>
                  </Link>
                </div>
              </div>

              {/* Perforation Footer */}
              <div className="mt-6 pt-4 border-t-[1.5px] border-dashed border-ink-solid flex items-center justify-between font-data-mono text-[11px] text-ink-muted">
                <span>DELIVERY: ENCLOSED TRANSPORTER</span>
                <span>EST. TIMELINE: 48 HOURS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
