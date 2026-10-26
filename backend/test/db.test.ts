import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockEnd = vi.fn();

vi.mock('pg', () => {
  class MockPool {
    query = mockQuery;
    end = mockEnd;
  }
  return {
    default: {
      Pool: MockPool,
    },
    Pool: MockPool,
  };
});

describe('Database Connection Module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { closePool } = await import('../src/db.js');
    await closePool();
  });

  it('executes parameterized queries via the pool', async () => {
    const { query } = await import('../src/db.js');
    mockQuery.mockResolvedValueOnce({ rows: [{ num: 1 }] });

    const result = await query('SELECT $1::int as num', [1]);
    expect(mockQuery).toHaveBeenCalledWith('SELECT $1::int as num', [1]);
    expect(result.rows).toEqual([{ num: 1 }]);
  });

  it('checks database connection successfully when SELECT 1 passes', async () => {
    const { checkDatabaseConnection } = await import('../src/db.js');
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const status = await checkDatabaseConnection();
    expect(status.ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1;');
  });

  it('handles and sanitizes database connection failures', async () => {
    const { checkDatabaseConnection } = await import('../src/db.js');
    mockQuery.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    const status = await checkDatabaseConnection();
    expect(status.ok).toBe(false);
    expect(status.error).toBe('Database connection check failed');
  });

  it('gracefully shuts down the connection pool', async () => {
    const { query, closePool } = await import('../src/db.js');
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Initialize pool by querying
    await query('SELECT 1');

    mockEnd.mockResolvedValueOnce(undefined);
    await expect(closePool()).resolves.not.toThrow();
    expect(mockEnd).toHaveBeenCalled();
  });

  it('configures SSL and serverless pool sizing for Neon databases', async () => {
    const { getPoolConfig } = await import('../src/db.js');
    const origEnv = process.env.DATABASE_URL;
    const origNodeEnv = process.env.NODE_ENV;
    const origVercel = process.env.VERCEL;

    try {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@ep-cool-fog-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
      process.env.VERCEL = '1';

      const config = getPoolConfig();
      expect(config.connectionString).toBe(process.env.DATABASE_URL);
      expect(config.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.max).toBe(3);
      expect(config.idleTimeoutMillis).toBe(30000);
      expect(config.connectionTimeoutMillis).toBe(5000);
    } finally {
      process.env.DATABASE_URL = origEnv;
      process.env.NODE_ENV = origNodeEnv;
      if (origVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = origVercel;
    }
  });

  it('keeps ssl undefined for standard local postgres connection strings', async () => {
    const { getPoolConfig } = await import('../src/db.js');
    const origEnv = process.env.DATABASE_URL;
    const origNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://dealership_app:secret@localhost:5432/dealership_inventory';

      const config = getPoolConfig();
      expect(config.ssl).toBeUndefined();
      expect(config.max).toBe(10);
    } finally {
      process.env.DATABASE_URL = origEnv;
      process.env.NODE_ENV = origNodeEnv;
    }
  });
});

