import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { seedVehicles } from '../src/seeder.js';

describe('seedVehicles transaction boundary', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles) {
      fs.rmSync(file, { force: true });
    }
  });

  it('starts the transaction before any seed mutation', async () => {
    const seedFile = path.join(os.tmpdir(), `vehicles-seed-${Date.now()}.json`);
    tempFiles.push(seedFile);
    fs.writeFileSync(seedFile, JSON.stringify([
      {
        make: 'Honda',
        model: 'City',
        category: 'Sedan',
        price: 1_200_000,
        opening_quantity: 0,
      },
    ]));

    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql.trim());
        if (sql.includes('SELECT id, name FROM vehicle_categories')) {
          return { rows: [{ id: 1, name: 'Sedan' }] };
        }
        if (sql.includes("SELECT id FROM users WHERE role = 'admin'")) {
          return { rows: [{ id: 'actor-id' }] };
        }
        if (sql.includes('SELECT id FROM vehicles')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO vehicles')) {
          return { rows: [{ id: 'vehicle-id' }] };
        }
        return { rows: [] };
      },
    };

    await seedVehicles(client as never, seedFile);

    const beginIndex = statements.indexOf('BEGIN');
    const firstMutationIndex = statements.findIndex((sql) =>
      /^(INSERT|UPDATE|DELETE)/.test(sql)
    );
    expect(beginIndex).toBeGreaterThanOrEqual(0);
    expect(beginIndex).toBeLessThan(firstMutationIndex);
  });
});
