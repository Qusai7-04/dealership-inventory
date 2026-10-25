import { describe, expect, it, afterAll } from 'vitest';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Integration test is executed against a real database when connection string is provided
describe.skipIf(!connectionString)('PostgreSQL Live Integration Tests', () => {
  const pool = new pg.Pool({ connectionString });

  afterAll(async () => {
    await pool.end();
  });

  it('connects to PostgreSQL and executes SELECT 1', async () => {
    const result = await pool.query('SELECT 1 as num;');
    expect(result.rows[0].num).toBe(1);
  });
});
