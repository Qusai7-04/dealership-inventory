import { getPool, query } from './db.js';
import { AppError } from './errors.js';
import { validateVehicleId } from './vehicle-service.js';

interface CartItemRow {
  vehicle_id: string; label: string; price: string; quantity: number; deleted_at: Date | null;
}

export async function getCart(userId: string) {
  const cart = await query<{ id: string }>('SELECT id FROM carts WHERE user_id = $1', [userId]);
  if (!cart.rows[0]) return { cart: null, items: [], itemCount: 0, subtotal: '0.00' };
  const result = await query<CartItemRow>(
    `SELECT v.id AS vehicle_id, v.make || ' ' || v.model AS label, v.price, v.quantity, v.deleted_at
     FROM cart_items ci JOIN vehicles v ON v.id = ci.vehicle_id
     WHERE ci.cart_id = $1 ORDER BY v.id`, [cart.rows[0].id]
  );
  const items = result.rows.map((row) => ({ vehicleId: row.vehicle_id, label: row.label, price: row.price, stock: row.quantity, available: row.deleted_at === null && row.quantity > 0 }));
  const subtotal = (await query<{ total: string }>(
    `SELECT COALESCE(sum(v.price), 0)::numeric(12,2) AS total FROM cart_items ci
     JOIN vehicles v ON v.id = ci.vehicle_id WHERE ci.cart_id = $1`, [cart.rows[0].id]
  )).rows[0].total;
  return { cart: cart.rows[0], items, itemCount: items.length, subtotal };
}

export async function addCartItem(userId: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'vehicleId')) throw new AppError(400, 'Expected vehicleId');
  const id = validateVehicleId((input as { vehicleId: string }).vehicleId);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const cart = await client.query<{ id: string }>(
      'INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING id', [userId]
    );
    const existing = await client.query('SELECT 1 FROM cart_items WHERE cart_id = $1 AND vehicle_id = $2', [cart.rows[0].id, id]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      return getCart(userId);
    }
    const vehicle = await client.query<{ quantity: number; deleted_at: Date | null }>('SELECT quantity, deleted_at FROM vehicles WHERE id = $1 FOR UPDATE', [id]);
    if (!vehicle.rows[0] || vehicle.rows[0].deleted_at) throw new AppError(404, 'Vehicle not found');
    if (vehicle.rows[0].quantity <= 0) throw new AppError(409, 'Vehicle is out of stock');
    await client.query('INSERT INTO cart_items (cart_id, vehicle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cart.rows[0].id, id]);
    await client.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.rows[0].id]);
    await client.query('COMMIT');
    return getCart(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function removeCartItem(userId: string, vehicleId: string) {
  await query(
    'DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1) AND vehicle_id = $2',
    [userId, validateVehicleId(vehicleId)]
  );
  await query('UPDATE carts SET updated_at = now() WHERE user_id = $1', [userId]);
  return getCart(userId);
}

export async function clearCart(userId: string) {
  await query('DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)', [userId]);
  await query('UPDATE carts SET updated_at = now() WHERE user_id = $1', [userId]);
  return getCart(userId);
}
