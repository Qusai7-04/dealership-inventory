import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { authenticate, createAccessToken, requireRole } from '../../src/auth.js';
import { runMigrations } from '../../src/migrate.js';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const testSecret = 'test-only-secret-at-least-32-characters-long';
const emailPrefix = `auth-${process.pid}-${Date.now()}`;
const email = `${emailPrefix}@example.com`;
const password = 'StrongPass123!';

process.env.JWT_SECRET = testSecret;
process.env.JWT_EXPIRES_IN_SECONDS = '3600';

describe.skipIf(!connectionString)('Authentication integration', () => {
  const pool = new pg.Pool({ connectionString });
  let token = '';
  let userId = '';

  beforeAll(async () => {
    await runMigrations(pool);
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Test User', email, passwordHash]
    );
    userId = result.rows[0].id;
    token = createAccessToken(userId);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${emailPrefix}%`]);
    await pool.end();
  });

  it('registers a normal user with a normalized email and a hashed password', async () => {
    const registrationEmail = `${emailPrefix}-register@example.com`;
    const response = await request(app).post('/api/auth/register').send({
      fullName: '  Test User  ',
      email: `  ${registrationEmail.toUpperCase()}  `,
      password,
      role: 'admin',
      isAdmin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      fullName: 'Test User',
      email: registrationEmail,
      role: 'user',
      isActive: true,
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const result = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [registrationEmail]
    );
    expect(result.rows[0].email).toBe(registrationEmail);
    expect(result.rows[0].password_hash).not.toBe(password);
    expect(result.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(result.rows[0].role).toBe('user');
  });

  it('rejects the same email with different casing and whitespace', async () => {
    const duplicateEmail = `${emailPrefix}-duplicate@example.com`;
    await request(app).post('/api/auth/register').send({
      fullName: 'First User',
      email: duplicateEmail,
      password,
    });
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Another User',
      email: ` ${duplicateEmail.toUpperCase()} `,
      password,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'An account with that email already exists' });
  });

  it.each([
    [{ email, password }, 'Full name is required'],
    [{ fullName: 'Test User', password }, 'Email is required'],
    [{ fullName: 'Test User', email }, 'Password is required'],
    [{ fullName: 'T', email: `${emailPrefix}-short@example.com`, password }, 'Full name must be between 2 and 100 characters'],
    [{ fullName: 'Test User', email: 'not-an-email', password }, 'Email must be valid'],
    [{ fullName: 'Test User', email: `${emailPrefix}-weak@example.com`, password: 'short' }, 'Password must be at least 8 characters'],
  ])('rejects malformed registration input', async (body, error) => {
    const response = await request(app).post('/api/auth/register').send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
  });

  it('logs in with normalized email and returns safe user details and a token', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: ` ${email.toUpperCase()} `,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: userId, email, role: 'user' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.token).toEqual(expect.any(String));

    const claims = jwt.verify(response.body.token, testSecret, {
      algorithms: ['HS256'],
      issuer: 'dealership-inventory',
      audience: 'dealership-api',
    });
    expect(claims).toMatchObject({ sub: userId });
  });

  it.each([
    ['missing@example.com', password],
    [email, 'WrongPassword123!'],
  ])('uses one response for an unknown email or wrong password', async (loginEmail, loginPassword) => {
    const response = await request(app).post('/api/auth/login').send({
      email: loginEmail,
      password: loginPassword,
    });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid email or password' });
  });

  it.each([
    [undefined],
    ['Token abc'],
    ['Bearer malformed-token'],
    [`Bearer ${jwt.sign({ sub: userId }, 'different-secret-at-least-32-characters')}`],
    [`Bearer ${jwt.sign({ sub: userId }, testSecret, {
      algorithm: 'HS256',
      issuer: 'dealership-inventory',
      audience: 'dealership-api',
      expiresIn: -1,
    })}`],
  ])('rejects missing, malformed, invalid, and expired bearer tokens', async (authorization) => {
    const pending = request(app).get('/api/auth/me');
    if (authorization) pending.set('Authorization', authorization);
    const response = await pending;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
  });

  it('returns the current database-backed user for a valid token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: userId, role: 'user' });
  });

  it('denies a normal user, trusts a changed database role, and rejects a deactivated user', async () => {
    const roleEmail = `${emailPrefix}-role@example.com`;
    const created = await request(app).post('/api/auth/register').send({
      fullName: 'Role User',
      email: roleEmail,
      password,
    });
    const roleUserId = created.body.user.id;
    const roleToken = createAccessToken(roleUserId);
    const protectedApp = express();
    protectedApp.get('/admin', authenticate, requireRole('admin'), (_request, response) => {
      response.json({ status: 'ok' });
    });

    const denied = await request(protectedApp)
      .get('/admin')
      .set('Authorization', `Bearer ${roleToken}`);
    expect(denied.status).toBe(403);

    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [roleUserId]);
    const allowed = await request(protectedApp)
      .get('/admin')
      .set('Authorization', `Bearer ${roleToken}`);
    expect(allowed.status).toBe(200);

    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [roleUserId]);
    const inactive = await request(protectedApp)
      .get('/admin')
      .set('Authorization', `Bearer ${roleToken}`);
    expect(inactive.status).toBe(401);

    const inactiveLogin = await request(app).post('/api/auth/login').send({ email: roleEmail, password });
    expect(inactiveLogin.status).toBe(401);
    expect(inactiveLogin.body).toEqual({ error: 'Invalid email or password' });
  });
});
