import crypto from 'crypto';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const password = process.argv[2];

if (!SUPABASE_URL || !KEY) {
  console.error('Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (запустите с --env-file=.env.local)');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Использование: node --env-file=.env.local scripts/set-admin-password.mjs "новый-пароль"');
  console.error('Пароль должен быть не короче 8 символов');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const hash = `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;

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
}

await rest('admin_settings?on_conflict=key', {
  method: 'POST',
  prefer: 'resolution=merge-duplicates',
  body: {
    key: 'admin_password_hash',
    value: hash,
    updated_at: new Date().toISOString(),
  },
});

await rest('admin_settings?key=eq.admin_password', { method: 'DELETE' });

console.log('Пароль администратора обновлен. Старые токены админки больше не действуют.');
