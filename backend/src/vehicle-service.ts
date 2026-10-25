import type pg from 'pg';
import { getPool, query } from './db.js';
import { AppError } from './errors.js';
import { recordStockNotifications } from './notification-service.js';

const maxInteger = 2_147_483_647;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface VehicleRow {
  id: string; make: string; model: string; category_id: number; category_name: string;
  price: string; quantity: number; low_stock_threshold: number; created_at: Date; updated_at: Date;
}

export interface VehicleInput {
  make: string; model: string; categoryId: number; price: number; quantity: number; lowStockThreshold: number;
}

function objectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'Request body must be an object');
  return input as Record<string, unknown>;
}

function rejectUnexpected(body: Record<string, unknown>, allowed: string[]): void {
  const unexpected = Object.keys(body).find((key) => !allowed.includes(key));
  if (unexpected) throw new AppError(400, `Unexpected field: ${unexpected}`);
}

function textField(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new AppError(400, `${name} is required`);
  const text = value.trim();
  if (text.length > 100) throw new AppError(400, `${name} must be at most 100 characters`);
  return text;
}

function integerField(value: unknown, name: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maxInteger) {
    throw new AppError(400, `${name} must be an integer between ${minimum} and ${maxInteger}`);
  }
  return value;
}

function priceField(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9_999_999_999.99 || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
    throw new AppError(400, 'Price must be a non-negative number with at most two decimal places');
  }
  return value;
}

export function validateVehicleId(value: string): string {
  if (!uuidPattern.test(value)) throw new AppError(400, 'Vehicle ID must be a valid UUID');
  return value;
}

export function validateCreate(input: unknown): VehicleInput {
  const body = objectBody(input);
  rejectUnexpected(body, ['make', 'model', 'categoryId', 'price', 'quantity', 'lowStockThreshold']);
  return {
    make: textField(body.make, 'Make'),
    model: textField(body.model, 'Model'),
    categoryId: integerField(body.categoryId, 'Category ID', 1),
    price: priceField(body.price),
    quantity: body.quantity === undefined ? 0 : integerField(body.quantity, 'Quantity'),
    lowStockThreshold: body.lowStockThreshold === undefined ? 3 : integerField(body.lowStockThreshold, 'Low stock threshold'),
  };
}

export function validateUpdate(input: unknown): Partial<Omit<VehicleInput, 'quantity'>> {
  const body = objectBody(input);
  const allowed = ['make', 'model', 'categoryId', 'price', 'lowStockThreshold'];
  rejectUnexpected(body, allowed);
  if (Object.keys(body).length === 0) throw new AppError(400, 'At least one editable field is required');
  return {
    ...(body.make !== undefined && { make: textField(body.make, 'Make') }),
    ...(body.model !== undefined && { model: textField(body.model, 'Model') }),
    ...(body.categoryId !== undefined && { categoryId: integerField(body.categoryId, 'Category ID', 1) }),
    ...(body.price !== undefined && { price: priceField(body.price) }),
    ...(body.lowStockThreshold !== undefined && { lowStockThreshold: integerField(body.lowStockThreshold, 'Low stock threshold') }),
  };
}

function vehicle(row: VehicleRow) {
  return {
    id: row.id, make: row.make, model: row.model,
    category: { id: row.category_id, name: row.category_name },
    price: row.price, quantity: row.quantity, lowStockThreshold: row.low_stock_threshold,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const selectVehicle = `SELECT v.id, v.make, v.model, v.category_id, c.name AS category_name,
  v.price, v.quantity, v.low_stock_threshold, v.created_at, v.updated_at
  FROM vehicles v JOIN vehicle_categories c ON c.id = v.category_id`;

function queryString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new AppError(400, `${name} must be a single value`);
  return value;
}

function positiveQueryInteger(value: unknown, name: string, fallback: number, maximum = maxInteger): number {
  if (value === undefined) return fallback;
  const text = queryString(value, name)!;
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > maximum) throw new AppError(400, `${name} is invalid`);
  return Number(text);
}

function queryPrice(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const text = queryString(value, name)!;
  if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) > 9_999_999_999.99) throw new AppError(400, `${name} is invalid`);
  return Number(text);
}

export async function listVehicles(input: Record<string, unknown>) {
  const allowed = ['page', 'limit', 'search', 'categoryId', 'minPrice', 'maxPrice', 'available', 'sort', 'direction'];
  const unexpected = Object.keys(input).find((key) => !allowed.includes(key));
  if (unexpected) throw new AppError(400, `Unexpected query parameter: ${unexpected}`);
  const page = positiveQueryInteger(input.page, 'page', 1);
  const limit = positiveQueryInteger(input.limit, 'limit', 20, 100);
  const search = queryString(input.search, 'search')?.trim();
  if (search && search.length > 100) throw new AppError(400, 'search must be at most 100 characters');
  const categoryId = input.categoryId === undefined ? undefined : positiveQueryInteger(input.categoryId, 'categoryId', 1);
  const minPrice = queryPrice(input.minPrice, 'minPrice');
  const maxPrice = queryPrice(input.maxPrice, 'maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw new AppError(400, 'minPrice cannot exceed maxPrice');
  const available = queryString(input.available, 'available');
  if (available !== undefined && available !== 'true' && available !== 'false') throw new AppError(400, 'available must be true or false');
  const sorts: Record<string, string> = { make: 'v.make', model: 'v.model', price: 'v.price', quantity: 'v.quantity', createdAt: 'v.created_at' };
  const sort = queryString(input.sort, 'sort') ?? 'createdAt';
  if (!sorts[sort]) throw new AppError(400, 'sort is invalid');
  const direction = (queryString(input.direction, 'direction') ?? 'desc').toLowerCase();
  if (direction !== 'asc' && direction !== 'desc') throw new AppError(400, 'direction is invalid');

  const conditions = ['v.deleted_at IS NULL'];
  const values: unknown[] = [];
  const add = (condition: string, value: unknown) => { values.push(value); conditions.push(condition.replace('?', `$${values.length}`)); };
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    values.push(pattern, pattern);
    conditions.push(`(v.make ILIKE $${values.length - 1} ESCAPE '\\' OR v.model ILIKE $${values.length} ESCAPE '\\')`);
  }
  if (categoryId !== undefined) add('v.category_id = ?', categoryId);
  if (minPrice !== undefined) add('v.price >= ?', minPrice);
  if (maxPrice !== undefined) add('v.price <= ?', maxPrice);
  if (available !== undefined) conditions.push(available === 'true' ? 'v.quantity > 0' : 'v.quantity = 0');
  const where = conditions.join(' AND ');
  const count = await query<{ total: string }>(`SELECT count(*) AS total FROM vehicles v WHERE ${where}`, values);
  const dataValues = [...values, limit, (page - 1) * limit];
  const rows = await query<VehicleRow>(`${selectVehicle} WHERE ${where} ORDER BY ${sorts[sort]} ${direction.toUpperCase()}, v.id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, dataValues);
  const total = Number(count.rows[0].total);
  return { vehicles: rows.rows.map(vehicle), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getVehicle(id: string) {
  const result = await query<VehicleRow>(`${selectVehicle} WHERE v.id = $1 AND v.deleted_at IS NULL`, [validateVehicleId(id)]);
  if (!result.rows[0]) throw new AppError(404, 'Vehicle not found');
  return vehicle(result.rows[0]);
}

function databaseError(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23503') throw new AppError(400, 'Category does not exist');
    if (error.code === '23505') throw new AppError(409, 'An active vehicle with that make and model already exists');
  }
  throw error;
}

async function selected(client: pg.PoolClient, id: string) {
  const result = await client.query<VehicleRow>(`${selectVehicle} WHERE v.id = $1 AND v.deleted_at IS NULL`, [id]);
  if (!result.rows[0]) throw new AppError(404, 'Vehicle not found');
  return vehicle(result.rows[0]);
}

export async function createVehicle(input: unknown, actorId: string) {
  const data = validateCreate(input);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold)
       VALUES ($1, $2, $3, $4, 0, $5) RETURNING id`,
      [data.make, data.model, data.categoryId, data.price, data.lowStockThreshold]
    );
    const id = inserted.rows[0].id;
    if (data.quantity > 0) {
      await client.query("INSERT INTO stock_receipts (vehicle_id, actor_id, kind, quantity_added, resulting_quantity) VALUES ($1, $2, 'opening', $3, $3)", [id, actorId, data.quantity]);
      await client.query('UPDATE vehicles SET quantity = $1, updated_at = now() WHERE id = $2', [data.quantity, id]);
    }
    const result = await selected(client, id);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    databaseError(error);
  } finally {
    client.release();
  }
}

export async function updateVehicle(id: string, input: unknown) {
  validateVehicleId(id);
  const data = validateUpdate(input);
  const columns: Record<string, string> = { make: 'make', model: 'model', categoryId: 'category_id', price: 'price', lowStockThreshold: 'low_stock_threshold' };
  const entries = Object.entries(data);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${columns[key]} = $${index + 1}`);
  values.push(id);
  try {
    const updated = await query(`UPDATE vehicles SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`, values);
    if (!updated.rows[0]) throw new AppError(404, 'Vehicle not found');
    return getVehicle(id);
  } catch (error) {
    databaseError(error);
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  const result = await query('UPDATE vehicles SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [validateVehicleId(id)]);
  if (!result.rows[0]) throw new AppError(404, 'Vehicle not found');
}

export async function restockVehicle(id: string, input: unknown, actorId: string) {
  validateVehicleId(id);
  const body = objectBody(input);
  rejectUnexpected(body, ['quantity', 'requestId']);
  const quantity = integerField(body.quantity, 'Quantity', 1);
  if (typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)) throw new AppError(400, 'Request ID must be a valid UUID');
  const requestId = body.requestId;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${actorId}:${requestId}`]);
    const prior = await client.query<{ vehicle_id: string; quantity_added: number; resulting_quantity: number }>("SELECT vehicle_id, quantity_added, resulting_quantity FROM stock_receipts WHERE actor_id = $1 AND request_id = $2 AND kind = 'restock'", [actorId, requestId]);
    if (prior.rows[0]) {
      if (prior.rows[0].vehicle_id !== id || prior.rows[0].quantity_added !== quantity) throw new AppError(409, 'Request ID was already used for a different restock');
      const result = await selected(client, id);
      await client.query('COMMIT');
      return { ...result, quantity: prior.rows[0].resulting_quantity };
    }
    const updated = await client.query<{ id: string; quantity: number }>(
      'UPDATE vehicles SET quantity = quantity + $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL AND quantity <= $3 RETURNING id, quantity',
      [quantity, id, maxInteger - quantity]
    );
    if (!updated.rows[0]) {
      const exists = await client.query('SELECT quantity FROM vehicles WHERE id = $1 AND deleted_at IS NULL', [id]);
      if (!exists.rows[0]) throw new AppError(404, 'Vehicle not found');
      throw new AppError(409, 'Restock would exceed the maximum quantity');
    }
    const receipt = await client.query<{ id: string }>("INSERT INTO stock_receipts (vehicle_id, actor_id, kind, quantity_added, request_id, resulting_quantity) VALUES ($1, $2, 'restock', $3, $4, $5) RETURNING id", [id, actorId, quantity, requestId, updated.rows[0].quantity]);
    const result = await selected(client, id);
    await recordStockNotifications(client, id, `${result.make} ${result.model}`,
      updated.rows[0].quantity - quantity, updated.rows[0].quantity, result.lowStockThreshold, `restock:${receipt.rows[0].id}:${id}`);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
