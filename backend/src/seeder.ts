import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { getPool } from './db.js';

export interface SeedVehicleItem {
  make: string;
  model: string;
  category: string;
  price: number;
  year?: number;
  opening_quantity?: number;
  low_stock_threshold?: number;
}

export interface SeedResult {
  vehiclesInserted: number;
  vehiclesSkipped: number;
  receiptsCreated: number;
}

const CANONICAL_CATEGORIES = [
  'SUV',
  'Sedan',
  'Hatchback',
  'Coupe',
  'Convertible',
  'MPV',
  'Truck',
  'Other',
];

async function ensureSystemUser(client: pg.PoolClient | pg.Pool): Promise<string> {
  const adminCheck = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`
  );
  if (adminCheck.rows.length > 0) {
    return adminCheck.rows[0].id;
  }

  const anyUser = await client.query<{ id: string }>(
    `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`
  );
  if (anyUser.rows.length > 0) {
    return anyUser.rows[0].id;
  }

  // Insert deterministic system seeder user if no user exists
  const dummyHash = '$2a$10$wT0sJ05YcK9g1p7.y1i3QeXyZuvQJ6yK1uV6lC7n8r5x8kF5nZ3e2';
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO users (full_name, email, password_hash, role, is_verified, is_active)
     VALUES ($1, $2, $3, $4, true, true)
     ON CONFLICT (lower(email)) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    ['System Seeder', 'system.seeder@dealership.local', dummyHash, 'admin']
  );
  return inserted.rows[0].id;
}

export async function seedVehicles(
  targetPoolOrClient?: pg.Pool | pg.PoolClient,
  seedDataPath?: string
): Promise<SeedResult> {
  const pool = targetPoolOrClient ?? getPool();
  // Determine if we need to release the client or if one was passed
  const isPool = 'connect' in pool && typeof (pool as pg.Pool).connect === 'function';
  const client: pg.PoolClient | pg.Pool = isPool ? await (pool as pg.Pool).connect() : pool;

  try {
    // 1. Resolve seed file path
    let resolvedPath = seedDataPath;
    if (!resolvedPath) {
      const candidates = [
        path.resolve(__dirname, '../data/vehicles.seed.json'),
        path.resolve(process.cwd(), 'data/vehicles.seed.json'),
        path.resolve(process.cwd(), 'backend/data/vehicles.seed.json'),
      ];
      for (const cand of candidates) {
        try {
          await fs.access(cand);
          resolvedPath = cand;
          break;
        } catch {
          // try next
        }
      }
    }

    if (!resolvedPath) {
      throw new Error('Seed file vehicles.seed.json could not be resolved.');
    }

    const rawData = await fs.readFile(resolvedPath, 'utf8');
    const items: SeedVehicleItem[] = JSON.parse(rawData);

    await client.query('BEGIN');
    try {
      // 2. Ensure canonical categories exist
      for (const cat of CANONICAL_CATEGORIES) {
        await client.query(
          `INSERT INTO vehicle_categories (name)
           VALUES ($1)
           ON CONFLICT (lower(name)) DO NOTHING`,
          [cat]
        );
      }

      // Load category lookup map
      const catRows = await client.query<{ id: number; name: string }>(
        'SELECT id, name FROM vehicle_categories'
      );
      const categoryMap = new Map<string, number>();
      for (const row of catRows.rows) {
        categoryMap.set(row.name.toLowerCase(), row.id);
      }

      // 3. Ensure system actor exists for opening receipts
      const actorId = await ensureSystemUser(client);

      // 4. Seed vehicles inside the same transaction
      let vehiclesInserted = 0;
      let vehiclesSkipped = 0;
      let receiptsCreated = 0;

      for (const item of items) {
        const makeTrim = item.make.trim();
        const modelTrim = item.model.trim();

        // Check if vehicle already exists (active)
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM vehicles
           WHERE lower(make) = lower($1) AND lower(model) = lower($2) AND deleted_at IS NULL`,
          [makeTrim, modelTrim]
        );

        if (existing.rows.length > 0) {
          vehiclesSkipped++;
          continue;
        }

        // Resolve category
        const catNameLower = (item.category || 'Other').toLowerCase();
        let categoryId = categoryMap.get(catNameLower);
        if (!categoryId) {
          // Insert missing category dynamically if needed
          const catInsert = await client.query<{ id: number }>(
            `INSERT INTO vehicle_categories (name) VALUES ($1)
             ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [item.category.trim() || 'Other']
          );
          categoryId = catInsert.rows[0].id;
          categoryMap.set(catNameLower, categoryId);
        }

        const openingQty = Math.max(0, Number(item.opening_quantity) || 0);
        const lowStock = item.low_stock_threshold ?? 3;

        // Insert vehicle with quantity 0
        const vehInsert = await client.query<{ id: string }>(
          `INSERT INTO vehicles (make, model, category_id, price, quantity, low_stock_threshold)
           VALUES ($1, $2, $3, $4, 0, $5)
           RETURNING id`,
          [makeTrim, modelTrim, categoryId, item.price, lowStock]
        );
        const vehicleId = vehInsert.rows[0].id;
        vehiclesInserted++;

        // If opening_quantity > 0, insert opening stock receipt and update vehicle quantity
        if (openingQty > 0) {
          await client.query(
            `INSERT INTO stock_receipts (vehicle_id, actor_id, kind, quantity_added, resulting_quantity)
             VALUES ($1, $2, 'opening', $3, $3)`,
            [vehicleId, actorId, openingQty]
          );
          await client.query(
            `UPDATE vehicles SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [openingQty, vehicleId]
          );
          receiptsCreated++;
        }
      }

      await client.query('COMMIT');

      return {
        vehiclesInserted,
        vehiclesSkipped,
        receiptsCreated,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    if (isPool) {
      (client as pg.PoolClient).release();
    }
  }
}
