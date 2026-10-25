import { afterEach, describe, expect, it } from 'vitest';
import { assertAuthConfig } from '../src/auth.js';

const originalSecret = process.env.JWT_SECRET;
const originalExpiry = process.env.JWT_EXPIRES_IN_SECONDS;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  if (originalExpiry === undefined) delete process.env.JWT_EXPIRES_IN_SECONDS;
  else process.env.JWT_EXPIRES_IN_SECONDS = originalExpiry;
});

describe('authentication configuration', () => {
  it('rejects a missing or short token secret', () => {
    delete process.env.JWT_SECRET;
    expect(() => assertAuthConfig()).toThrow('JWT_SECRET must be set to at least 32 characters');
    process.env.JWT_SECRET = 'too-short';
    expect(() => assertAuthConfig()).toThrow('JWT_SECRET must be set to at least 32 characters');
  });

  it('rejects an invalid token lifetime', () => {
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters-long';
    process.env.JWT_EXPIRES_IN_SECONDS = 'never';
    expect(() => assertAuthConfig()).toThrow('JWT_EXPIRES_IN_SECONDS must be a positive integer');
  });
});
