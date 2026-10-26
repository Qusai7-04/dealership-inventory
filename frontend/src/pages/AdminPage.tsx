import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { PageState } from '../components/PageState';
import { VehicleImage } from '../components/VehicleImage';
import { useAuth } from '../features/auth/AuthProvider';
import { formatPrice } from '../features/vehicles/VehicleCard';
import type { Category, InventorySummary, StockReceipt, Vehicle, VehicleListResponse } from '../types/api';

export function AdminPage() {
  const { api, user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [restock, setRestock] = useState<Vehicle | null>(null);
  const [remove, setRemove] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<{ vehicle: Vehicle; receipts: StockReceipt[] } | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api.get<VehicleListResponse>('/api/vehicles?page=1&limit=100&sort=make&direction=asc'),
      api.get<{ categories: Category[] }>('/api/vehicle-categories'),
      api.get<{ summary: InventorySummary }>('/api/admin/inventory-summary'),
    ])
      .then(([stock, cats, totals]) => {
        setVehicles(stock.vehicles);
        setCategories(cats.categories);
        setSummary(totals.summary);
      })
      .catch((reason) => setError(reason.message));
  }, [api]);

  useEffect(load, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      make: String(data.get('make')).trim(),
      model: String(data.get('model')).trim(),
      categoryId: Number(data.get('categoryId')),
      price: Number(data.get('price')),
      lowStockThreshold: Number(data.get('lowStockThreshold')),
      ...(!edit && { quantity: Number(data.get('quantity')) }),
    };

    try {
      if (edit) {
        await api.put(`/api/vehicles/${edit.id}`, body);
        setMessage(`Chassis ${edit.make} ${edit.model} updated.`);
      } else {
        await api.post('/api/vehicles', body);
        setMessage('New chassis intake registered to PostgreSQL master ledger.');
      }
      setEdit(null);
      setShowIntakeModal(false);
      (event.target as HTMLFormElement).reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed');
    }
  }

  async function confirmRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restock) return;
    const quantity = Number(new FormData(event.currentTarget).get('quantity'));
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Restock quantity must be a positive integer.');
      return;
    }
    try {
      await api.post(`/api/vehicles/${restock.id}/restock`, {
        quantity,
        requestId: crypto.randomUUID(),
      });
      setRestock(null);
      setMessage(`Stock receipt recorded: +${quantity} units added.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Restock failed');
    }
  }

  async function confirmDelete() {
    if (!remove) return;
    try {
      await api.delete(`/api/vehicles/${remove.id}`);
      setRemove(null);
      setMessage(`Vehicle ${remove.make} ${remove.model} archived from active listings.`);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Delete failed');
    }
  }

  async function showHistory(vehicle: Vehicle) {
    try {
      const result = await api.get<{ receipts: StockReceipt[] }>(
        `/api/vehicles/${vehicle.id}/stock-receipts?page=1&limit=50`
      );
      setHistory({ vehicle, receipts: result.receipts });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'History failed');
    }
  }

  async function handleGenerateImage(vehicle: Vehicle) {
    setGeneratingId(vehicle.id);
    setError(null);
    setMessage(null);
    try {
      const res = await api.post<{ status: string; vehicleId: string; image: any }>(
        `/api/vehicles/${vehicle.id}/generate-image`,
        {}
      );
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, images: [res.image] } : v))
      );
      setMessage('Chassis image generated successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image generation failed');
    } finally {
      setGeneratingId(null);
    }
  }

  // Filter vehicles on client for search, class & stock status
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      !search ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || String(v.category.id) === categoryFilter;
    const matchesStock =
      stockFilter === 'all'
        ? true
        : stockFilter === 'in_stock'
        ? v.quantity > 0
        : stockFilter === 'low_stock'
        ? v.quantity > 0 && v.quantity <= v.lowStockThreshold
        : v.quantity === 0;
    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <main className="page admin-page min-h-screen bg-paper-base paper-grain py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOP TERMINAL OPERATIONAL STRIP (fold_admin_inventory_console) */}
        <div className="w-full bg-paper-surface border-[1.5px] border-ink-solid rounded-xl px-4 sm:px-6 py-3 shadow-[0_2px_0_#16150F]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-ink-solid text-paper-base font-stamp-badge text-[11px] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-live-lime animate-pulse" />
                CONSOLE TERMINAL #AUTH-9904
              </span>
              <span className="font-data-mono text-stamp-badge text-ink-muted hidden md:inline-block">
                STATION: MUMBAI-SOUTH // ARCHIVIST: {user?.fullName.toUpperCase() ?? 'ADMIN'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEdit(null);
                  setShowIntakeModal(true);
                }}
                className="px-3.5 py-1.5 bg-action-blue hover:bg-action-blue-deep border-[1.5px] border-ink-solid rounded-lg shadow-[0_2px_0_#1932D4] text-on-primary font-label-nav text-xs font-bold hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>+ New Chassis Intake</span>
              </button>
            </div>
          </div>
        </div>

        {/* SCREEN TITLE & SUBTITLE */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-[1.5px] border-ink-solid pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 font-data-mono text-stamp-badge">
              <span className="uppercase tracking-widest text-ink-subtle">INTERNAL LOGBOOK • SECTION 09</span>
              <span className="h-1 w-1 rounded-full bg-ink-solid" />
              <span className="text-attention-orange font-bold">DISPATCH DISCIPLINE</span>
            </div>
            <h1 className="font-display-hero text-headline-xl sm:text-display-hero text-ink-solid tracking-tight uppercase font-bold leading-none">
              DEALERSHIP LEDGER{' '}
              <span className="font-editorial-accent italic text-headline-lg font-normal lowercase text-ink-muted">
                master console
              </span>
            </h1>
            <p className="font-body-sm text-body-sm text-ink-muted max-w-2xl">
              Physical inventory balance and dynamic vehicle allotment registry. All ledger modifications write indelibly to PostgreSQL.
            </p>
          </div>
        </div>

        <PageState loading={!summary && !error} error={error} onRetry={load} />

        {/* NOTIFICATION MESSAGES */}
        {message && (
          <div
            role="status"
            className="success-banner p-3.5 bg-live-lime border-[1.5px] border-ink-solid rounded-xl font-data-mono text-xs font-bold text-ink-solid shadow-[0_2px_0_#16150F] flex items-center justify-between"
          >
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* 5 KEY METRIC SUMMARY COUNTERS (fold_admin_inventory_console) */}
        {summary && (
          <section className="summary-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. Active Listings */}
            <div className="summary-card bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_3px_0_#16150F]">
              <div className="font-stamp-badge text-[10px] uppercase tracking-wider text-ink-subtle mb-1 flex items-center justify-between">
                <span>Active Listings</span>
                <span className="material-symbols-outlined text-[16px] text-ink-muted">garage</span>
              </div>
              <div className="font-price-lg text-headline-md font-bold text-ink-solid">
                {summary.activeStockLines}
              </div>
              <div className="mt-2 text-stamp-badge font-data-mono text-ink-muted flex items-center gap-1">
                {summary.activeStockLines > 0 ? <span className="text-secondary font-bold">● Active catalogue</span> : <span className="text-ink-muted font-bold">● Catalogue empty</span>}
              </div>
            </div>

            {/* 2. Stock Available */}
            <div className="summary-card bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_3px_0_#16150F]">
              <div className="font-stamp-badge text-[10px] uppercase tracking-wider text-ink-subtle mb-1 flex items-center justify-between">
                <span>In Stock Lines</span>
                <span className="material-symbols-outlined text-[16px] text-live-lime">check_circle</span>
              </div>
              <div className="font-price-lg text-headline-md font-bold text-action-blue">
                {summary.inStockLines}
              </div>
              <div className="mt-2 text-stamp-badge font-data-mono text-ink-muted flex items-center gap-1">
                <span className="px-1.5 py-0.2 bg-live-lime border border-ink-solid rounded text-ink-solid font-bold">
                  Floor Ready
                </span>
              </div>
            </div>

            {/* 3. Low Threshold <= 3 */}
            <div className="summary-card bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_3px_0_#16150F]">
              <div className="font-stamp-badge text-[10px] uppercase tracking-wider text-attention-orange mb-1 flex items-center justify-between">
                <span>Low Threshold ≤3</span>
                <span className="material-symbols-outlined text-[16px] text-attention-orange">warning</span>
              </div>
              <div className="font-price-lg text-headline-md font-bold text-attention-orange">
                {(summary.lowStockLines ?? 0).toString().padStart(2, '0')}
              </div>
              <div className="mt-2 text-stamp-badge font-data-mono text-ink-muted">
                Restock trigger urgent
              </div>
            </div>

            {/* 4. Sold Out / Zero Stock */}
            <div className="summary-card bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_3px_0_#16150F]">
              <div className="font-stamp-badge text-[10px] uppercase tracking-wider text-ink-subtle mb-1 flex items-center justify-between">
                <span>Sold Out</span>
                <span className="material-symbols-outlined text-[16px] text-alert-red">block</span>
              </div>
              <div className="font-price-lg text-headline-md font-bold text-ink-subtle">
                {(summary.outOfStockLines ?? 0).toString().padStart(2, '0')}
              </div>
              <div className="mt-2 text-stamp-badge font-data-mono text-ink-muted">
                Tear-sheets filed
              </div>
            </div>

            {/* 5. Total Units Registered */}
            <div className="summary-card col-span-2 md:col-span-1 bg-ink-solid text-paper-base border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_4px_0_#1932D4]">
              <div className="font-stamp-badge text-[10px] uppercase tracking-wider text-live-lime mb-1 flex items-center justify-between">
                <span>Total Units</span>
                <span className="material-symbols-outlined text-[16px] text-live-lime">inventory</span>
              </div>
              <div className="font-price-lg text-headline-md font-bold text-paper-base">
                {summary.totalUnits} Units
              </div>
              <div className="mt-2 text-stamp-badge font-data-mono text-paper-recessed">
                Physical floor balance
              </div>
            </div>
          </section>
        )}

        {/* SEARCH & FILTER BAR */}
        <div className="bg-paper-surface border-[1.5px] border-ink-solid rounded-xl p-4 shadow-[0_2px_0_#16150F] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 font-data-mono text-body-sm">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-ink-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter chassis serial, make, model..."
              className="w-full bg-paper-base border-[1.5px] border-ink-solid rounded-lg pl-9 pr-3 py-2 text-ink-solid placeholder:text-ink-subtle focus:border-action-blue outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-label-nav text-xs text-ink-solid"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-label-nav text-xs text-ink-solid"
            >
              <option value="all">All Stock Levels</option>
              <option value="in_stock">In Stock (&gt;0)</option>
              <option value="low_stock">Low Stock (≤ Threshold)</option>
              <option value="out_of_stock">Out of Stock (0 Units)</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setStockFilter('all');
              }}
              className="px-3 py-2 bg-paper-recessed text-ink-solid rounded-lg border-[1.5px] border-ink-solid font-label-nav text-xs"
            >
              Reset
            </button>
          </div>
        </div>

        {/* INVENTORY TABLE & SIDE PANEL */}
        <section className="space-y-4">
          <div className="inventory-table-wrap overflow-x-auto border-[1.5px] border-ink-solid rounded-xl shadow-[0_4px_0_#16150F] bg-paper-surface">
            <table className="inventory-table w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-ink-solid text-paper-base font-stamp-badge text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Specimen</th>
                  <th className="py-3 px-4">Chassis Specimen</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Showroom Price</th>
                  <th className="py-3 px-4">Floor Stock</th>
                  <th className="py-3 px-4">Image Asset</th>
                  <th className="py-3 px-4 text-right">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-solid/20 font-data-mono text-body-sm bg-paper-base">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center font-sans text-sm text-ink-muted">
                      {vehicles.length === 0
                        ? 'No vehicles are registered in this database yet. Seed the showroom catalogue or use “+ New Chassis Intake” to add a listing.'
                        : 'No vehicles match these filters. Adjust the search or select Reset.'}
                    </td>
                  </tr>
                ) : filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-paper-surface/60 transition-colors">
                    <td className="py-3 px-4 w-28">
                      <div className="w-24 h-14 rounded overflow-hidden border border-ink-solid bg-paper-surface">
                        <VehicleImage
                          src={vehicle.images?.[0]?.url}
                          alt={`${vehicle.make} ${vehicle.model}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-sans font-bold text-ink-solid text-sm">
                        {vehicle.make}{' '}
                        <span className="font-editorial-accent italic text-base font-normal">
                          {vehicle.model}
                        </span>
                      </div>
                      <div className="font-data-mono text-[10px] text-ink-muted">
                        LOT #{vehicle.id.slice(0, 8).toUpperCase()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-paper-surface border border-ink-solid text-[11px] font-bold uppercase">
                        {vehicle.category.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 price font-bold text-ink-solid">
                      {formatPrice(vehicle.price)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-stamp-badge text-[10px] px-2.5 py-1 rounded border border-ink-solid font-bold ${
                          vehicle.quantity === 0
                            ? 'bg-alert-red text-white'
                            : vehicle.quantity <= vehicle.lowStockThreshold
                            ? 'bg-attention-orange text-white'
                            : 'bg-live-lime text-ink-solid'
                        }`}
                      >
                        {vehicle.quantity === 0
                          ? '0 UNITS (DEPLETED)'
                          : `${vehicle.quantity} UNITS`}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-data-mono text-xs">
                      {vehicle.images && vehicle.images.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-live-lime/40 text-ink-solid border border-ink-solid text-[10px] font-bold">
                          <span className="material-symbols-outlined text-[12px] text-action-blue">check</span>
                          <span>Cached WebP</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-paper-recessed text-ink-muted border border-dashed border-ink-solid text-[10px]">
                            Missing
                          </span>
                          <button
                            type="button"
                            disabled={generatingId === vehicle.id}
                            onClick={() => handleGenerateImage(vehicle)}
                            className="px-2 py-1 bg-action-blue hover:bg-action-blue-deep text-on-primary rounded font-label-nav text-[10px] font-bold uppercase transition-all shadow-[0_1px_0_#1932D4] disabled:opacity-50"
                          >
                            {generatingId === vehicle.id ? 'Generating…' : 'Generate Image'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="table-actions py-3 px-4 text-right space-x-2 font-label-nav text-xs font-bold">
                      <button
                        onClick={() => {
                          setEdit(vehicle);
                          setShowIntakeModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-paper-surface hover:bg-paper-recessed border border-ink-solid transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setRestock(vehicle)}
                        className="px-2.5 py-1 rounded bg-live-lime hover:bg-secondary-fixed-dim text-ink-solid border border-ink-solid transition-colors"
                      >
                        Restock
                      </button>
                      <button
                        onClick={() => showHistory(vehicle)}
                        className="px-2.5 py-1 rounded bg-paper-surface hover:bg-paper-recessed border border-ink-solid transition-colors"
                      >
                        History
                      </button>
                      <button
                        onClick={() => setRemove(vehicle)}
                        className="danger px-2.5 py-1 rounded bg-[#FFDAD6] hover:bg-alert-red text-alert-red hover:text-white border border-ink-solid transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* MODAL: NEW INTAKE / EDIT CHASSIS (fold_admin_inventory_console) */}
        {showIntakeModal && (
          <div className="dialog-backdrop fixed inset-0 bg-ink-solid/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="intake-title"
              className="paper-panel dialog w-full max-w-lg bg-paper-surface border-[2px] border-ink-solid rounded-2xl p-6 sm:p-8 shadow-[0_8px_0_#16150F] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b-[1.5px] border-ink-solid">
                <div>
                  <span className="font-stamp-badge text-stamp-badge uppercase tracking-wider text-action-blue font-bold">
                    {edit ? 'CHASSIS MODIFICATION' : 'NEW CHASSIS INTAKE'}
                  </span>
                  <h2 id="intake-title" className="font-headline-md text-headline-md font-bold text-ink-solid">
                    {edit ? `Edit ${edit.make} ${edit.model}` : 'Register New Chassis'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowIntakeModal(false);
                    setEdit(null);
                  }}
                  className="w-8 h-8 rounded-full bg-paper-base border border-ink-solid flex items-center justify-center font-bold text-ink-solid hover:bg-paper-recessed"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={save} className="admin-form space-y-4">
                <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                  Make
                  <input
                    name="make"
                    defaultValue={edit?.make ?? ''}
                    placeholder="e.g. Porsche, Audi, Honda"
                    className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue"
                    required
                  />
                </label>

                <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                  Model
                  <input
                    name="model"
                    defaultValue={edit?.model ?? ''}
                    placeholder="e.g. 911 GT3 RS, City"
                    className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue"
                    required
                  />
                </label>

                <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                  Category
                  <select
                    name="categoryId"
                    defaultValue={edit?.category.id ?? ''}
                    className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue"
                    required
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                  Price in INR
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={edit?.price ?? ''}
                    placeholder="e.g. 24200000"
                    className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue"
                    required
                  />
                </label>

                <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                  Low-Stock Threshold
                  <input
                    name="lowStockThreshold"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={edit?.lowStockThreshold ?? 3}
                    className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue"
                    required
                  />
                </label>

                {!edit && (
                  <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                    Opening Physical Quantity
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue="1"
                      className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid outline-none focus:ring-2 focus:ring-action-blue"
                      required
                    />
                  </label>
                )}

                <div className="pt-4 flex items-center justify-end gap-3 border-t-[1.5px] border-dashed border-ink-solid">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIntakeModal(false);
                      setEdit(null);
                    }}
                    className="px-4 py-2 bg-paper-recessed text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-action-blue hover:bg-action-blue-deep text-on-primary font-label-nav text-xs font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#1932D4]"
                  >
                    {edit ? 'Save Changes' : 'Register Chassis'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD RESTOCK */}
        {restock && (
          <div className="dialog-backdrop fixed inset-0 bg-ink-solid/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="restock-title"
              className="paper-panel dialog w-full max-w-md bg-paper-surface border-[2px] border-ink-solid rounded-2xl p-6 shadow-[0_8px_0_#16150F]"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b-[1.5px] border-ink-solid">
                <h2 id="restock-title" className="font-headline-sm text-headline-sm font-bold text-ink-solid">
                  Restock {restock.make} {restock.model}
                </h2>
                <button onClick={() => setRestock(null)} className="font-bold">✕</button>
              </div>

              <form onSubmit={confirmRestock} className="space-y-4">
                <p className="font-data-mono text-xs text-ink-muted">
                  Current Floor Balance: <strong>{restock.quantity} units</strong>. A verifiable stock receipt will be generated.
                </p>

                <label className="block text-xs font-bold uppercase font-data-mono text-ink-solid">
                  Quantity to Add
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue="1"
                    autoFocus
                    required
                    className="w-full mt-1 bg-paper-base border-[1.5px] border-ink-solid rounded-lg px-3 py-2 font-data-mono text-body-sm text-ink-solid"
                  />
                </label>

                <div className="pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRestock(null)}
                    className="px-4 py-2 bg-paper-recessed text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-live-lime hover:bg-secondary-fixed-dim text-ink-solid font-label-nav text-xs font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F]"
                  >
                    Record Restock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SOFT-DELETE CONFIRMATION */}
        {remove && (
          <div className="dialog-backdrop fixed inset-0 bg-ink-solid/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-title"
              className="paper-panel dialog w-full max-w-md bg-paper-surface border-[2px] border-ink-solid rounded-2xl p-6 shadow-[0_8px_0_#16150F]"
            >
              <h2 id="delete-title" className="font-headline-sm text-headline-sm font-bold text-alert-red mb-2">
                Archive Listing?
              </h2>
              <p className="font-body-sm text-body-sm text-ink-muted mb-4">
                <strong>{remove.make} {remove.model}</strong> will be soft-deleted and removed from the active showroom floor. Existing purchase records and receipts will remain strictly intact in PostgreSQL.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRemove(null)}
                  className="px-4 py-2 bg-paper-base text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-alert-red text-white font-label-nav text-xs font-bold rounded-lg border-[1.5px] border-ink-solid shadow-[0_2px_0_#16150F]"
                >
                  Confirm Archival
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: STOCK RECEIPTS HISTORY */}
        {history && (
          <div className="dialog-backdrop fixed inset-0 bg-ink-solid/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-title"
              className="paper-panel dialog wide w-full max-w-2xl bg-paper-surface border-[2px] border-ink-solid rounded-2xl p-6 shadow-[0_8px_0_#16150F] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b-[1.5px] border-ink-solid">
                <h2 id="history-title" className="font-headline-sm text-headline-sm font-bold text-ink-solid">
                  Stock History · {history.vehicle.make} {history.vehicle.model}
                </h2>
                <button onClick={() => setHistory(null)} className="font-bold">✕</button>
              </div>

              {history.receipts.length === 0 ? (
                <p className="font-data-mono text-sm text-ink-muted py-6 text-center">
                  No stock receipts recorded for this chassis.
                </p>
              ) : (
                <ol className="receipt-list divide-y divide-ink-solid/20 font-data-mono text-xs">
                  {history.receipts.map((receipt) => (
                    <li key={receipt.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <strong className="uppercase text-ink-solid">{receipt.kind}</strong>
                        <span className="text-ink-muted ml-2">by {receipt.actorName}</span>
                        <div className="text-[10px] text-ink-subtle">
                          {new Date(receipt.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-secondary font-bold">
                          +{receipt.quantityAdded} → {receipt.resultingQuantity} units
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-6 pt-4 border-t-[1.5px] border-dashed border-ink-solid flex justify-end">
                <button
                  type="button"
                  onClick={() => setHistory(null)}
                  className="px-4 py-2 bg-paper-base text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid"
                >
                  Close History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
