import crypto from 'crypto';
import { fetchSupabase } from './supabase-server';
import { createHmacHash, decodePayload, safeEqual, safeEqualString, signPayload } from './security';
import { hashPassword, isPasswordHash, verifyPassword } from './password';
import { getAdminBootstrapPassword } from './config';

const ADMIN_TOKEN_TTL = 24 * 60 * 60 * 1000;

function passwordFingerprint(passwordHash: string): string {
  return createHmacHash(`pwf:${passwordHash}`).slice(0, 32);
}

export async function getStoredAdminHash(): Promise<string | null> {
  try {
    const data = await fetchSupabase<any[]>('admin_settings?key=eq.admin_password_hash&select=value');
    if (Array.isArray(data) && data.length > 0 && data[0].value) {
      const value = String(data[0].value).trim();
      if (isPasswordHash(value)) return value;
    }
  } catch {}
  return null;
}

export async function getLegacyAdminPassword(): Promise<string | null> {
  try {
    const data = await fetchSupabase<any[]>('admin_settings?key=eq.admin_password&select=value');
    if (Array.isArray(data) && data.length > 0 && data[0].value) {
      return String(data[0].value).trim();
    }
  } catch {}
  return null;
}

export async function storeAdminHash(passwordHash: string): Promise<void> {
  await fetchSupabase('admin_settings?on_conflict=key', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: { key: 'admin_password_hash', value: passwordHash, updated_at: new Date().toISOString() },
  });
}

export async function deleteLegacyAdminPassword(): Promise<void> {
  await fetchSupabase('admin_settings?key=eq.admin_password', { method: 'DELETE' }).catch(() => {});
}

export function createAdminToken(passwordHash: string): string {
  return signPayload({
    role: 'admin',
    iat: Date.now(),
    pwf: passwordFingerprint(passwordHash),
    exp: Date.now() + ADMIN_TOKEN_TTL,
  });
}

export async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const data = decodePayload<{ role?: string; exp?: number; pwf?: string }>(cleanToken.split('.')[0] || '');
  const payloadStr = cleanToken.split('.')[0];
  if (!payloadStr || !data) return false;
  if (!safeEqual(cleanToken.split('.')[1] || '', createHmacHash(payloadStr))) return false;
  if (data.role !== 'admin' || !data.pwf || !data.exp || Date.now() > data.exp) return false;
  const storedHash = await getStoredAdminHash();
  if (!storedHash) return false;
  return safeEqual(data.pwf, passwordFingerprint(storedHash));
}

export type AdminLoginResult =
  | { ok: true; token: string; upgraded: boolean }
  | { ok: false; status: number; error: string };

export async function loginAdmin(candidate: string): Promise<AdminLoginResult> {
  const password = String(candidate || '').trim();
  if (!password) return { ok: false, status: 400, error: 'Password is required' };

  const storedHash = await getStoredAdminHash();
  if (storedHash) {
    const valid = await verifyPassword(password, storedHash);
    if (valid) return { ok: true, token: createAdminToken(storedHash), upgraded: false };
    return { ok: false, status: 401, error: 'Неверный пароль' };
  }

  const legacy = await getLegacyAdminPassword();
  if (legacy) {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    const valid = safeEqualString(password, legacy) || legacyHash === legacy;
    if (!valid) return { ok: false, status: 401, error: 'Неверный пароль' };
    const newHash = await hashPassword(password);
    await storeAdminHash(newHash);
    await deleteLegacyAdminPassword();
    return { ok: true, token: createAdminToken(newHash), upgraded: true };
  }

  const bootstrap = getAdminBootstrapPassword();
  if (!bootstrap) {
    return { ok: false, status: 503, error: 'Пароль администратора не настроен. Задайте ADMIN_PASSWORD или выполните scripts/set-admin-password.mjs' };
  }
  if (!safeEqualString(password, bootstrap)) {
    return { ok: false, status: 401, error: 'Неверный пароль' };
  }
  const newHash = await hashPassword(password);
  await storeAdminHash(newHash);
  return { ok: true, token: createAdminToken(newHash), upgraded: true };
}

export async function changeAdminPassword(newPassword: string): Promise<{ hash: string; token: string }> {
  const hash = await hashPassword(newPassword);
  await storeAdminHash(hash);
  await deleteLegacyAdminPassword();
  return { hash, token: createAdminToken(hash) };
}
