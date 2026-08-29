import crypto from 'crypto';
import type { UserEntity, SafeUser, UserRole } from '../types/serverTypes.js';

const JWT_SECRET = process.env.JWT_SECRET || 'release_sentinel_secret_key_2026_secure_hash';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function toSafeUser(user: UserEntity): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

export function generateToken(user: SafeUser): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: Date.now() + TOKEN_EXPIRY_MS,
    }),
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): { sub: string; email: string; name: string; role: UserRole } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }

    return decoded;
  } catch (err) {
    return null;
  }
}

export function generateDefaultUsers(): UserEntity[] {
  const adminHash = hashPassword('admin123');
  const devHash = hashPassword('dev123');
  const leadHash = hashPassword('lead123');

  const now = new Date().toISOString();

  return [
    {
      id: 'usr_admin_default_01',
      name: 'System Administrator',
      email: 'admin@sentinel.ai',
      passwordHash: adminHash.hash,
      salt: adminHash.salt,
      role: 'admin',
      status: 'active',
      created_at: now,
      last_login_at: now,
    },
    {
      id: 'usr_lead_default_02',
      name: 'Release Lead Officer',
      email: 'lead@sentinel.ai',
      passwordHash: leadHash.hash,
      salt: leadHash.salt,
      role: 'lead',
      status: 'active',
      created_at: now,
      last_login_at: null,
    },
    {
      id: 'usr_dev_default_03',
      name: 'Platform Developer',
      email: 'developer@sentinel.ai',
      passwordHash: devHash.hash,
      salt: devHash.salt,
      role: 'user',
      status: 'active',
      created_at: now,
      last_login_at: null,
    },
  ];
}
