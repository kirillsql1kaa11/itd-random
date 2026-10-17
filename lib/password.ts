import crypto from 'crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch {
    return false;
  }
  const key = await new Promise<Buffer | null>((resolve) => {
    crypto.scrypt(password, salt, expected.length, { N: n, r, p }, (err, derived) => {
      if (err) resolve(null);
      else resolve(derived);
    });
  });
  if (!key || key.length !== expected.length) return false;
  return crypto.timingSafeEqual(key, expected);
}

export function isPasswordHash(value: string): boolean {
  return typeof value === 'string' && value.startsWith('scrypt$');
}
