import { query } from './db.js';
import { AppError } from './errors.js';
import { validateVehicleId } from './vehicle-service.js';

function pageValue(value: unknown, name: string, fallback: number, maximum = 2_147_483_647) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new AppError(400, `${name} is invalid`);
  }
  return Number(value);
}

function pagination(input: Record<string, unknown>) {
  if (Object.keys(input).some((key) => !['page', 'limit'].includes(key))) {
    throw new AppError(400, 'Unexpected query parameter');
  }
  return { page: pageValue(input.page, 'page', 1), limit: pageValue(input.limit, 'limit', 20, 100) };
}

export async function listCategories() {
  const result = await query<{ id: number; name: string }>(
    'SELECT id, name FROM vehicle_categories ORDER BY lower(name), id',
  );
  return { categories: result.rows };
}

export async function listPurchases(userId: string, input: Record<string, unknown>) {
  const { page, limit } = pagination(input);
  const total = Number((await query<{ total: string }>(
    'SELECT count(*) AS total FROM purchases WHERE user_id = $1', [userId],
  )).rows[0].total);
  const headers = (await query<{
    id: string; source: 'direct' | 'cart'; total_price: string; purchased_at: Date;
  }>(
    `SELECT id, source, total_price, purchased_at FROM purchases
     WHERE user_id = $1 ORDER BY purchased_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit],
  )).rows;
  const ids = headers.map((purchase) => purchase.id);
  const items = ids.length === 0 ? [] : (await query<{
    purchase_id: string; vehicle_id: string; vehicle_label: string; unit_price: string;
  }>(
    `SELECT purchase_id, vehicle_id, vehicle_label, unit_price FROM purchase_items
     WHERE purchase_id = ANY($1::uuid[]) ORDER BY purchase_id, vehicle_id`, [ids],
  )).rows;
  return {
    purchases: headers.map((purchase) => ({
      id: purchase.id,
      source: purchase.source,
      totalPrice: purchase.total_price,
      purchasedAt: purchase.purchased_at,
      items: items.filter((item) => item.purchase_id === purchase.id).map((item) => ({
        vehicleId: item.vehicle_id,
        vehicleLabel: item.vehicle_label,
        unitPrice: item.unit_price,
      })),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function listStockReceipts(vehicleId: string, input: Record<string, unknown>) {
  const id = validateVehicleId(vehicleId);
  const { page, limit } = pagination(input);
  const vehicle = await query('SELECT 1 FROM vehicles WHERE id = $1', [id]);
  if (!vehicle.rowCount) throw new AppError(404, 'Vehicle not found');
  const total = Number((await query<{ total: string }>(
    'SELECT count(*) AS total FROM stock_receipts WHERE vehicle_id = $1', [id],
  )).rows[0].total);
  const rows = await query<{
    id: string; actor_id: string; actor_name: string; kind: 'opening' | 'restock';
    quantity_added: number; resulting_quantity: number; request_id: string | null; created_at: Date;
  }>(
    `SELECT r.id, r.actor_id, u.full_name AS actor_name, r.kind, r.quantity_added,
       r.resulting_quantity, r.request_id, r.created_at
     FROM stock_receipts r JOIN users u ON u.id = r.actor_id
     WHERE r.vehicle_id = $1 ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
    [id, limit, (page - 1) * limit],
  );
  return {
    receipts: rows.rows.map((row) => ({
      id: row.id, actorId: row.actor_id, actorName: row.actor_name, kind: row.kind,
      quantityAdded: row.quantity_added, resultingQuantity: row.resulting_quantity,
      requestId: row.request_id, createdAt: row.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function inventorySummary() {
  const row = (await query<{
    active_stock_lines: number; in_stock_lines: number; low_stock_lines: number;
    out_of_stock_lines: number; total_units: number;
  }>(
    `SELECT count(*)::int AS active_stock_lines,
       count(*) FILTER (WHERE quantity > 0)::int AS in_stock_lines,
       count(*) FILTER (WHERE quantity > 0 AND quantity <= low_stock_threshold)::int AS low_stock_lines,
       count(*) FILTER (WHERE quantity = 0)::int AS out_of_stock_lines,
       COALESCE(sum(quantity), 0)::int AS total_units
     FROM vehicles WHERE deleted_at IS NULL`,
  )).rows[0];
  return { summary: {
    activeStockLines: row.active_stock_lines,
    inStockLines: row.in_stock_lines,
    lowStockLines: row.low_stock_lines,
    outOfStockLines: row.out_of_stock_lines,
    totalUnits: row.total_units,
  } };
}
