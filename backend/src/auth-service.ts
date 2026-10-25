import bcrypt from 'bcryptjs';
import { query } from './db.js';
import { AppError } from './errors.js';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  isActive: boolean;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  is_verified: boolean;
  is_active: boolean;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, `${field} is required`);
  }
  return value.trim();
}

function normalizeEmail(value: unknown): string {
  const email = requiredString(value, 'Email').toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'Email must be valid');
  }
  return email;
}

function requiredPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'Password is required');
  }
  return value;
}

function publicUser(row: UserRow): User {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isVerified: row.is_verified,
    isActive: row.is_active,
  };
}

export async function register(input: unknown): Promise<User> {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const fullName = requiredString(body.fullName, 'Full name');
  const email = normalizeEmail(body.email);
  const password = requiredPassword(body.password);

  if (fullName.length < 2 || fullName.length > 100) {
    throw new AppError(400, 'Full name must be between 2 and 100 characters');
  }
  if (password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new AppError(400, 'Password must be at most 72 bytes');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const result = await query<UserRow>(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, full_name, email, password_hash, role, is_verified, is_active`,
      [fullName, email, passwordHash]
    );
    return publicUser(result.rows[0]);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new AppError(409, 'An account with that email already exists');
    }
    throw error;
  }
}

export async function login(input: unknown): Promise<User | null> {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const email = normalizeEmail(body.email);
  const password = requiredPassword(body.password);
  if (Buffer.byteLength(password, 'utf8') > 72) return null;
  const result = await query<UserRow>(
    `SELECT id, full_name, email, password_hash, role, is_verified, is_active
     FROM users WHERE lower(email) = $1`,
    [email]
  );
  const row = result.rows[0];
  if (!row) {
    await bcrypt.hash(password, 12);
    return null;
  }
  const passwordMatches = await bcrypt.compare(password, row.password_hash);

  if (!passwordMatches || !row.is_active) return null;
  return publicUser(row);
}

export async function findActiveUser(id: string): Promise<User | null> {
  const result = await query<UserRow>(
    `SELECT id, full_name, email, password_hash, role, is_verified, is_active
     FROM users WHERE id = $1 AND is_active = true`,
    [id]
  );
  return result.rows[0] ? publicUser(result.rows[0]) : null;
}
