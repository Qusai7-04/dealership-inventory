import { query } from './db.js';
import { AppError } from './errors.js';
import { validateVehicleId } from './vehicle-service.js';

interface FavouriteRow {
  vehicle_id: string; make: string; model: string; price: string; quantity: number;
  deleted_at: Date | null; notify_on_restock: boolean; created_at: Date;
}

function favourite(row: FavouriteRow) {
  return { vehicleId: row.vehicle_id, make: row.make, model: row.model, price: row.price,
    stock: row.quantity, available: !row.deleted_at && row.quantity > 0,
    deleted: Boolean(row.deleted_at), notifyOnRestock: row.notify_on_restock, createdAt: row.created_at };
}

const selectFavourite = `SELECT f.vehicle_id, f.notify_on_restock, f.created_at,
  v.make, v.model, v.price, v.quantity, v.deleted_at
  FROM favourites f JOIN vehicles v ON v.id = f.vehicle_id`;

export async function listFavourites(userId: string) {
  const result = await query<FavouriteRow>(`${selectFavourite} WHERE f.user_id = $1 ORDER BY f.created_at DESC, f.vehicle_id`, [userId]);
  return { favourites: result.rows.map(favourite) };
}

async function selected(userId: string, vehicleId: string) {
  const result = await query<FavouriteRow>(`${selectFavourite} WHERE f.user_id = $1 AND f.vehicle_id = $2`, [userId, vehicleId]);
  if (!result.rows[0]) throw new AppError(404, 'Favourite not found');
  return favourite(result.rows[0]);
}

export async function saveFavourite(userId: string, vehicleId: string) {
  const id = validateVehicleId(vehicleId);
  const inserted = await query(
    `INSERT INTO favourites (user_id, vehicle_id)
     SELECT $1, id FROM vehicles WHERE id = $2 AND deleted_at IS NULL
     ON CONFLICT (user_id, vehicle_id) DO NOTHING`, [userId, id]
  );
  if (!inserted.rowCount) {
    const existing = await query('SELECT 1 FROM favourites WHERE user_id = $1 AND vehicle_id = $2', [userId, id]);
    if (!existing.rowCount) throw new AppError(404, 'Vehicle not found');
  }
  return { favourite: await selected(userId, id) };
}

export async function removeFavourite(userId: string, vehicleId: string) {
  const result = await query('DELETE FROM favourites WHERE user_id = $1 AND vehicle_id = $2', [userId, validateVehicleId(vehicleId)]);
  return { removed: result.rowCount === 1 };
}

export async function setRestockPreference(userId: string, vehicleId: string, input: unknown) {
  const id = validateVehicleId(vehicleId);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).length !== 1 || typeof (input as { notifyOnRestock?: unknown }).notifyOnRestock !== 'boolean') {
    throw new AppError(400, 'notifyOnRestock must be a boolean');
  }
  const result = await query(
    'UPDATE favourites SET notify_on_restock = $3 WHERE user_id = $1 AND vehicle_id = $2',
    [userId, id, (input as { notifyOnRestock: boolean }).notifyOnRestock]
  );
  if (!result.rowCount) throw new AppError(404, 'Favourite not found');
  return { favourite: await selected(userId, id) };
}
