import { afterEach, describe, expect, it } from 'vitest';
import { requireTestDatabaseUrl } from './support/test-database.js';

const originalUrl = process.env.TEST_DATABASE_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.TEST_DATABASE_URL;
  else process.env.TEST_DATABASE_URL = originalUrl;
});

describe('integration database isolation', () => {
  it('requires an explicit test database URL', () => {
    delete process.env.TEST_DATABASE_URL;
    expect(() => requireTestDatabaseUrl()).toThrow('TEST_DATABASE_URL is required');
  });

  it('rejects a URL whose database name is not dedicated to tests', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/dealership_inventory';
    expect(() => requireTestDatabaseUrl()).toThrow('TEST_DATABASE_URL must name a database ending in _test');
  });

  it('returns a dedicated test database URL', () => {
    const url = 'postgresql://user:password@localhost:5432/dealership_inventory_test';
    process.env.TEST_DATABASE_URL = url;
    expect(requireTestDatabaseUrl()).toBe(url);
  });
});
