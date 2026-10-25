import bcrypt from 'bcryptjs';
import { getPool, closePool } from '../db.js';

export async function createAdminUser(
  email = process.argv[2] || process.env.ADMIN_EMAIL,
  password = process.argv[3] || process.env.ADMIN_PASSWORD,
  fullName = process.argv[4] || process.env.ADMIN_NAME || 'Admin User'
) {
  if (!email || !password) {
    throw new Error('Usage: tsx src/scripts/create-admin.ts <email> <password> [fullName]');
  }

  const pool = getPool();
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, is_verified, is_active)
     VALUES ($1, $2, $3, 'admin', true, true)
     ON CONFLICT (lower(email)) DO UPDATE
     SET full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_verified = true,
         is_active = true,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id, full_name, email, role, is_verified, is_active`,
    [fullName, email.trim().toLowerCase(), hash]
  );

  return result.rows[0];
}

async function main() {
  try {
    const user = await createAdminUser();
    console.log(`Admin account provisioned successfully: [${user.email}] (${user.role})`);
  } catch (err: any) {
    console.error('Failed to provision admin:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('create-admin.ts') || process.argv[1].endsWith('create-admin.js'))) {
  main();
}
