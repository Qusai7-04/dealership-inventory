import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runMigrations } from '../../src/migrate.js';
import { seedVehicles } from '../../src/seeder.js';
import { requireTestDatabaseUrl } from '../support/test-database.js';

const connectionString = requireTestDatabaseUrl();
const prefix = `seed-test-${Date.now()}`;

describe('Vehicle seeder integration', () => {
  const pool = new pg.Pool({ connectionString });
  let tempSeedFile: string;

  const mockSeedData = [
    {
      make: `${prefix}-Honda`,
      model: 'City',
      category: 'Sedan',
      price: 1200000,
      year: 2024,
      opening_quantity: 5,
    },
    {
      make: `${prefix}-Hyundai`,
      model: 'Creta',
      category: 'SUV',
      price: 1500000,
      year: 2024,
      opening_quantity: 0,
    },
    {
      make: `${prefix}-Kia`,
      model: 'EV6',
      category: 'Coupe',
      price: 6000000,
      year: 2023,
      opening_quantity: 3,
    },
  ];

  beforeAll(async () => {
    await runMigrations(pool);
    tempSeedFile = path.join(os.tmpdir(), `vehicles_seed_${Date.now()}.json`);
    fs.writeFileSync(tempSeedFile, JSON.stringify(mockSeedData), 'utf8');
  });

  afterAll(async () => {
    if (fs.existsSync(tempSeedFile)) {
      fs.unlinkSync(tempSeedFile);
    }
    // Clean up created vehicles, receipts, users
    await pool.query(
      'DELETE FROM stock_receipts WHERE vehicle_id IN (SELECT id FROM vehicles WHERE make LIKE $1)',
      [`${prefix}%`]
    );
    await pool.query('DELETE FROM vehicles WHERE make LIKE $1', [`${prefix}%`]);
    await pool.end();
  });

  it('seeds categories, vehicles and reconciles opening stock receipts', async () => {
    const result = await seedVehicles(pool, tempSeedFile);

    expect(result.vehiclesInserted).toBe(3);
    expect(result.vehiclesSkipped).toBe(0);
    expect(result.receiptsCreated).toBe(2); // Honda (5) and Kia (3), Hyundai (0)

    // Verify vehicles in database
    const rows = await pool.query<{ make: string; model: string; quantity: number; category_name: string }>(
      `SELECT v.make, v.model, v.quantity, c.name AS category_name
       FROM vehicles v JOIN vehicle_categories c ON c.id = v.category_id
       WHERE v.make LIKE $1
       ORDER BY v.model ASC`,
      [`${prefix}%`]
    );
    expect(rows.rows).toHaveLength(3);

    const city = rows.rows.find((r) => r.model === 'City');
    expect(city?.quantity).toBe(5);
    expect(city?.category_name).toBe('Sedan');

    const creta = rows.rows.find((r) => r.model === 'Creta');
    expect(creta?.quantity).toBe(0);
    expect(creta?.category_name).toBe('SUV');

    // Verify receipts
    const receipts = await pool.query<{ kind: string; quantity_added: number; resulting_quantity: number }>(
      `SELECT r.kind, r.quantity_added, r.resulting_quantity
       FROM stock_receipts r JOIN vehicles v ON v.id = r.vehicle_id
       WHERE v.make LIKE $1
       ORDER BY r.quantity_added DESC`,
      [`${prefix}%`]
    );
    expect(receipts.rows).toHaveLength(2);
    expect(receipts.rows[0]).toEqual({ kind: 'opening', quantity_added: 5, resulting_quantity: 5 });
    expect(receipts.rows[1]).toEqual({ kind: 'opening', quantity_added: 3, resulting_quantity: 3 });
  });

  it('is idempotent on rerun and does not duplicate or reset stock', async () => {
    // Modify city stock to 10
    await pool.query('UPDATE vehicles SET quantity = 10 WHERE make = $1 AND model = $2', [`${prefix}-Honda`, 'City']);

    // Run seeder again
    const rerun = await seedVehicles(pool, tempSeedFile);

    expect(rerun.vehiclesInserted).toBe(0);
    expect(rerun.vehiclesSkipped).toBe(3);
    expect(rerun.receiptsCreated).toBe(0);

    // Stock for City must still be 10, not reset back to 5
    const city = await pool.query<{ quantity: number }>('SELECT quantity FROM vehicles WHERE make = $1 AND model = $2', [`${prefix}-Honda`, 'City']);
    expect(city.rows[0].quantity).toBe(10);
  });
});
