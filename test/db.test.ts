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
});
