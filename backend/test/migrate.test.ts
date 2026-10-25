import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'node:path';

describe('Migration Runner', () => {
  const mockClientQuery = vi.fn();
  const mockClientRelease = vi.fn();
  const mockPoolConnect = vi.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
  });

  const mockPool = {
    connect: mockPoolConnect,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates tracking table and applies pending migrations in a transaction', async () => {
    const { runMigrations } = await import('../src/migrate.js');

    // 1st query: CREATE TABLE IF NOT EXISTS schema_migrations
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 2nd query: SELECT name FROM schema_migrations
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 3rd query: BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 4th query: migration SQL execution
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 5th query: INSERT INTO schema_migrations
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 6th query: COMMIT
    mockClientQuery.mockResolvedValueOnce({ rows: [] });

    const applied = await runMigrations(mockPool, path.resolve(process.cwd(), 'migrations'));

    expect(applied).toContain('001_create_users_categories_vehicles.sql');
    expect(applied).toContain('002_create_stock_receipts.sql');
    expect(applied).toContain('003_add_stock_receipt_result_quantity.sql');
    expect(applied).toContain('004_create_carts_and_purchases.sql');
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith(
      'INSERT INTO schema_migrations (name) VALUES ($1);',
      ['001_create_users_categories_vehicles.sql']
    );
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('skips already applied migrations idempotently', async () => {
    const { runMigrations } = await import('../src/migrate.js');

    // 1st query: CREATE TABLE IF NOT EXISTS schema_migrations
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 2nd query: SELECT name -> all migrations already applied
    mockClientQuery.mockResolvedValueOnce({
      rows: [
        { name: '001_create_users_categories_vehicles.sql' },
        { name: '002_create_stock_receipts.sql' },
        { name: '003_add_stock_receipt_result_quantity.sql' },
        { name: '004_create_carts_and_purchases.sql' },
      ],
    });

    const applied = await runMigrations(mockPool, path.resolve(process.cwd(), 'migrations'));

    expect(applied).toHaveLength(0);
    expect(mockClientQuery).not.toHaveBeenCalledWith('BEGIN');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('rolls back transaction on migration SQL error without marking it applied', async () => {
    const { runMigrations } = await import('../src/migrate.js');

    // 1st query: schema_migrations
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 2nd query: SELECT name
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 3rd query: BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // 4th query: migration SQL execution FAILS
    mockClientQuery.mockRejectedValueOnce(new Error('Syntax error in migration'));
    // 5th query: ROLLBACK
    mockClientQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      runMigrations(mockPool, path.resolve(process.cwd(), 'migrations'))
    ).rejects.toThrow('Syntax error in migration');

    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClientQuery).not.toHaveBeenCalledWith(
      'INSERT INTO schema_migrations (name) VALUES ($1);',
      expect.anything()
    );
    expect(mockClientRelease).toHaveBeenCalled();
  });
});
