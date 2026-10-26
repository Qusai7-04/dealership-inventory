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
    expect(applied).toContain('005_create_favourites_and_notifications.sql');
    expect(applied).toContain('006_create_vehicle_images.sql');
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
        { name: '005_create_favourites_and_notifications.sql' },
        { name: '006_create_vehicle_images.sql' },
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

  it('locates migrations directory when run from project root without explicit path', async () => {
    const { runMigrations } = await import('../src/migrate.js');

    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    mockClientQuery.mockResolvedValueOnce({
      rows: [
        { name: '001_create_users_categories_vehicles.sql' },
        { name: '002_create_stock_receipts.sql' },
        { name: '003_add_stock_receipt_result_quantity.sql' },
        { name: '004_create_carts_and_purchases.sql' },
        { name: '005_create_favourites_and_notifications.sql' },
        { name: '006_create_vehicle_images.sql' },
      ],
    });

    const origCwd = process.cwd();
    const projectRoot = path.resolve(origCwd, '..');
    const spy = vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    try {
      const applied = await runMigrations(mockPool);
      expect(applied).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('sanitizeDbTarget safely displays host and database without leaking passwords', async () => {
    const { sanitizeDbTarget } = await import('../src/migrate.js');
    const secretNeonUrl =
      'postgresql://neon_admin:mySuperSecretPass123!@ep-sparkling-base-98765.us-east-2.aws.neon.tech:5432/neondb?sslmode=require';

    const sanitized = sanitizeDbTarget(secretNeonUrl);
    expect(sanitized).toBe('host: ep-sparkling-base-98765.us-east-2.aws.neon.tech, port: 5432, database: neondb');
    expect(sanitized).not.toContain('mySuperSecretPass123!');
    expect(sanitized).not.toContain('neon_admin');
  });

  it('getMigrationPoolConfig prioritizes MIGRATION_DATABASE_URL and DIRECT_URL', async () => {
    const { getMigrationPoolConfig } = await import('../src/migrate.js');
    const origMigrateUrl = process.env.MIGRATION_DATABASE_URL;
    const origDirectUrl = process.env.DIRECT_URL;
    const origDbUrl = process.env.DATABASE_URL;

    try {
      process.env.DATABASE_URL = 'postgres://dealership_app:secret@localhost:5432/dealership_inventory';
      process.env.MIGRATION_DATABASE_URL =
        'postgresql://neon_admin:pass@ep-sparkling-base-98765.us-east-2.aws.neon.tech:5432/neondb?sslmode=require';

      const config = getMigrationPoolConfig();
      expect(config.connectionString).toBe(process.env.MIGRATION_DATABASE_URL);
      expect(config.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.max).toBe(1);
    } finally {
      if (origMigrateUrl === undefined) delete process.env.MIGRATION_DATABASE_URL; else process.env.MIGRATION_DATABASE_URL = origMigrateUrl;
      if (origDirectUrl === undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL = origDirectUrl;
      process.env.DATABASE_URL = origDbUrl;
    }
  });
});

