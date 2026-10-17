import crypto from 'crypto';
import { getSupabaseServiceKey, getSupabaseUrl } from './config';
import { optimizeImageBuffer } from './image-optimizer';

const BUCKET = 'screenshots';
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
const OBJECT_PREFIX = `/storage/v1/object/${BUCKET}/`;

function storageHeaders(contentType?: string): Record<string, string> {
  const key = getSupabaseServiceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

function extensionFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'bin';
}

export function screenshotPublicUrl(path: string): string {
  return `${getSupabaseUrl()}${PUBLIC_PREFIX}${path}`;
}

export function isStoredScreenshot(url: string | null | undefined): boolean {
  return Boolean(url && typeof url === 'string' && url.startsWith(`${getSupabaseUrl()}${PUBLIC_PREFIX}`));
}

export async function uploadScreenshotBuffer(buffer: Buffer, contentType: string, prefix = 'posts'): Promise<string> {
  const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const res = await fetch(`${getSupabaseUrl()}${OBJECT_PREFIX}${path}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(contentType),
      'x-upsert': 'true',
      'cache-control': 'max-age=31536000, immutable',
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`Storage upload failed ${res.status}: ${details.slice(0, 300)}`);
  }
  return screenshotPublicUrl(path);
}

export async function uploadDataUrlScreenshot(dataUrl: string, prefix = 'posts'): Promise<string> {
  const optimized = await optimizeImageBuffer(dataUrl);
  if (!optimized) throw new Error('Не удалось обработать изображение');
  return uploadScreenshotBuffer(optimized.buffer, optimized.contentType, prefix);
}

export async function ensureStoredScreenshot(value: string, prefix = 'posts'): Promise<string> {
  if (!value || typeof value !== 'string') return value;
  if (/^https?:\/\//i.test(value)) return value;
  return uploadDataUrlScreenshot(value, prefix);
}

export async function deleteStoredScreenshot(url: string | null | undefined): Promise<void> {
  try {
    if (!isStoredScreenshot(url)) return;
    const path = String(url).slice(`${getSupabaseUrl()}${PUBLIC_PREFIX}`.length);
    await fetch(`${getSupabaseUrl()}${OBJECT_PREFIX}${path}`, {
      method: 'DELETE',
      headers: storageHeaders(),
    }).catch(() => {});
  } catch {}
}

export async function downloadScreenshot(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: storageHeaders() });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/webp';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  } catch {
    return null;
  }
}
