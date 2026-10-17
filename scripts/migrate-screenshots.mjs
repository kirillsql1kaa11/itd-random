import crypto from 'crypto';
import sharp from 'sharp';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

if (!SUPABASE_URL || !KEY) {
  console.error('Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (запустите с --env-file=.env.local)');
  process.exit(1);
}
if (KEY.startsWith('sb_publishable_')) {
  console.error('Нужен Secret key из Supabase Dashboard, а не publishable key');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      ...headers,
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${details.slice(0, 200)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fetchAllRows(table) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const chunk = await rest(`${table}?select=id,screenshot&limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

async function uploadWebp(buffer) {
  const objectPath = `migrated/${Date.now()}-${crypto.randomUUID()}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/screenshots/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
      'cache-control': 'max-age=31536000, immutable',
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    if (details.includes('Bucket not found')) {
      throw new Error('Bucket screenshots не найден. Сначала примените supabase/migrations/202610170004_storage.sql');
    }
    throw new Error(`Storage ${res.status}: ${details.slice(0, 200)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/screenshots/${objectPath}`;
}

async function migrateTable(table) {
  let rows;
  try {
    rows = await fetchAllRows(table);
  } catch (err) {
    console.log(`${table}: пропущено (${err.message})`);
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const value = row.screenshot;
    if (!value || /^https?:\/\//i.test(value)) {
      skipped += 1;
      continue;
    }
    const buffer = parseDataUrl(value);
    if (!buffer) {
      failed += 1;
      continue;
    }
    try {
      const webp = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
      const url = await uploadWebp(webp);
      await rest(`${table}?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { screenshot: url },
      });
      migrated += 1;
    } catch (err) {
      failed += 1;
      console.error(`${table} id=${row.id}: ${err.message}`);
    }
  }

  console.log(`${table}: перенесено ${migrated}, пропущено ${skipped}, ошибок ${failed}`);
}

await migrateTable('posts');
await migrateTable('suggestions_posts');
console.log('Готово');
