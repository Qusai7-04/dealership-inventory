import type pg from 'pg';
import { getPool } from './db.js';
import { AppError } from './errors.js';
import { validateVehicleId } from './vehicle-service.js';
import { recordStockNotifications } from './notification-service.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestIdFrom(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof (input as { requestId?: unknown }).requestId !== 'string' || !uuid.test((input as { requestId: string }).requestId)) {
    throw new AppError(400, 'Request ID must be a valid UUID');
  }
  return (input as { requestId: string }).requestId;
}

interface PurchaseRow { id: string; source: 'direct' | 'cart'; total_price: string; purchased_at: Date }
interface ItemRow { vehicle_id: string; vehicle_label: string; unit_price: string }

async function purchaseResult(client: pg.PoolClient, id: string) {
  const header = (await client.query<PurchaseRow>('SELECT id, source, total_price, purchased_at FROM purchases WHERE id = $1', [id])).rows[0];
  const items = (await client.query<ItemRow>('SELECT vehicle_id, vehicle_label, unit_price FROM purchase_items WHERE purchase_id = $1 ORDER BY vehicle_id', [id])).rows;
  return { id: header.id, source: header.source, totalPrice: header.total_price, purchasedAt: header.purchased_at,
    items: items.map((item) => ({ vehicleId: item.vehicle_id, vehicleLabel: item.vehicle_label, unitPrice: item.unit_price })) };
}

export async function directPurchase(userId: string, vehicleId: string, input: unknown) {
  const id = validateVehicleId(vehicleId);
  const requestId = requestIdFrom(input);
  if (Object.keys(input as object).some((key) => key !== 'requestId')) throw new AppError(400, 'Unexpected purchase field');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`purchase:${userId}:${requestId}`]);
    const prior = (await client.query<{ id: string; source: string; vehicle_id: string }>(
      `SELECT p.id, p.source, pi.vehicle_id FROM purchases p
       JOIN purchase_items pi ON pi.purchase_id = p.id WHERE p.user_id = $1 AND p.request_id = $2`, [userId, requestId]
    )).rows;
    if (prior.length) {
      if (prior[0].source !== 'direct' || prior.length !== 1 || prior[0].vehicle_id !== id) throw new AppError(409, 'Request ID was already used for a different purchase');
      const result = await purchaseResult(client, prior[0].id);
      await client.query('COMMIT');
      return result;
    }
    const vehicle = (await client.query<{ make: string; model: string; price: string; quantity: number; low_stock_threshold: number; deleted_at: Date | null }>(
      'SELECT make, model, price, quantity, low_stock_threshold, deleted_at FROM vehicles WHERE id = $1 FOR UPDATE', [id]
    )).rows[0];
    if (!vehicle || vehicle.deleted_at) throw new AppError(404, 'Vehicle not found');
    if (vehicle.quantity < 1) throw new AppError(409, 'Vehicle is out of stock');
    const updated = await client.query('UPDATE vehicles SET quantity = quantity - 1, updated_at = now() WHERE id = $1 AND quantity > 0 AND deleted_at IS NULL', [id]);
    if (updated.rowCount !== 1) throw new AppError(409, 'Vehicle is out of stock');
    const purchase = (await client.query<{ id: string }>(
      "INSERT INTO purchases (user_id, source, request_id, total_price) VALUES ($1, 'direct', $2, $3) RETURNING id", [userId, requestId, vehicle.price]
    )).rows[0];
    await client.query('INSERT INTO purchase_items (purchase_id, vehicle_id, vehicle_label, unit_price) VALUES ($1, $2, $3, $4)',
      [purchase.id, id, `${vehicle.make} ${vehicle.model}`, vehicle.price]);
    await recordStockNotifications(client, id, `${vehicle.make} ${vehicle.model}`,
      vehicle.quantity, vehicle.quantity - 1, vehicle.low_stock_threshold, `purchase:${purchase.id}:${id}`);
    const result = await purchaseResult(client, purchase.id);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function checkout(userId: string, input: unknown) {
  const requestId = requestIdFrom(input);
  const body = input as { requestId: string; items?: unknown };
  if (Object.keys(body).some((key) => !['requestId', 'items'].includes(key)) || !Array.isArray(body.items) || body.items.some((item) =>
    !item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).sort().join(',') !== 'price,vehicleId' ||
    typeof item.vehicleId !== 'string' || !uuid.test(item.vehicleId) || typeof item.price !== 'string' || !/^\d+(\.\d{2})$/.test(item.price)
  )) throw new AppError(400, 'Items must contain vehicleId and confirmed price');
  const requested = (body.items as { vehicleId: string; price: string }[]).sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));
  if (new Set(requested.map((item) => item.vehicleId)).size !== requested.length) throw new AppError(400, 'Duplicate vehicle ID');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`purchase:${userId}:${requestId}`]);
    const prior = (await client.query<{ id: string; source: string; vehicle_id: string; unit_price: string }>(
      `SELECT p.id, p.source, pi.vehicle_id, pi.unit_price FROM purchases p
       JOIN purchase_items pi ON pi.purchase_id = p.id WHERE p.user_id = $1 AND p.request_id = $2 ORDER BY pi.vehicle_id`, [userId, requestId]
    )).rows;
    if (prior.length) {
      if (prior[0].source !== 'cart' || prior.length !== requested.length || prior.some((item, index) => item.vehicle_id !== requested[index].vehicleId || item.unit_price !== requested[index].price)) {
        throw new AppError(409, 'Request ID was already used for a different purchase');
      }
      const result = await purchaseResult(client, prior[0].id);
      await client.query('COMMIT');
      return result;
    }
    const cart = (await client.query<{ id: string }>('SELECT id FROM carts WHERE user_id = $1 FOR UPDATE', [userId])).rows[0];
    if (!cart) throw new AppError(409, 'Cart is empty');
    const selected = (await client.query<{ vehicle_id: string }>('SELECT vehicle_id FROM cart_items WHERE cart_id = $1 ORDER BY vehicle_id FOR UPDATE', [cart.id])).rows;
    if (!selected.length) throw new AppError(409, 'Cart is empty');
    if (selected.length !== requested.length || selected.some((item, index) => item.vehicle_id !== requested[index].vehicleId)) throw new AppError(409, 'Cart contents have changed');
    const vehicles = [] as { id: string; make: string; model: string; price: string; quantity: number; deleted_at: Date | null }[];
    for (const item of requested) {
      const vehicle = (await client.query<(typeof vehicles)[number]>('SELECT id, make, model, price, quantity, deleted_at FROM vehicles WHERE id = $1 FOR UPDATE', [item.vehicleId])).rows[0];
      if (!vehicle || vehicle.deleted_at || vehicle.quantity < 1) throw new AppError(409, `Vehicle ${item.vehicleId} is unavailable`);
      if (vehicle.price !== item.price) throw new AppError(409, `Price changed for vehicle ${item.vehicleId}`);
      vehicles.push(vehicle);
    }
    const purchase = (await client.query<{ id: string }>(
      `INSERT INTO purchases (user_id, source, request_id, total_price)
       SELECT $1, 'cart', $2, sum(price) FROM vehicles WHERE id = ANY($3::uuid[]) RETURNING id`,
      [userId, requestId, requested.map((item) => item.vehicleId)]
    )).rows[0];
    for (const vehicle of vehicles) {
      const updated = await client.query('UPDATE vehicles SET quantity = quantity - 1, updated_at = now() WHERE id = $1 AND quantity > 0 AND deleted_at IS NULL', [vehicle.id]);
      if (updated.rowCount !== 1) throw new AppError(409, `Vehicle ${vehicle.id} is unavailable`);
      await client.query('INSERT INTO purchase_items (purchase_id, vehicle_id, vehicle_label, unit_price) VALUES ($1, $2, $3, $4)',
        [purchase.id, vehicle.id, `${vehicle.make} ${vehicle.model}`, vehicle.price]);
    }
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
    await client.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.id]);
    const result = await purchaseResult(client, purchase.id);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
