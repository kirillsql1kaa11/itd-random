import crypto from 'crypto';
import { getApiSecret } from './config';

export function createHmacHash(text: string): string {
  return crypto.createHmac('sha256', getApiSecret()).update(text).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function safeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function encodePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodePayload<T = any>(payload: string): T | null {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

export function signPayload(payload: unknown): string {
  const encoded = encodePayload(payload);
  return `${encoded}.${createHmacHash(encoded)}`;
}

export function verifySignedPayload<T = any>(token: string, prefix = ''): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  if (!safeEqual(sig, createHmacHash(`${prefix}${payloadStr}`))) return null;
  return decodePayload<T>(payloadStr);
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
