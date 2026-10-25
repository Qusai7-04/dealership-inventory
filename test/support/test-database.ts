export function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required for integration tests');

  let databaseName: string;
  try {
    databaseName = new URL(value).pathname.slice(1);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must name a database ending in _test');
  }
  return value;
}
