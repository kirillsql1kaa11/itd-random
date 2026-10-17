export function getSupabaseUrl(): string {
  const value = process.env.SUPABASE_URL;
  if (!value) throw new Error('SUPABASE_URL is not set');
  return value.replace(/\/+$/, '');
}

export function getSupabaseServiceKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Use the Secret key from Supabase Dashboard, not the publishable key.');
  }
  if (value.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY looks like a publishable key. Use the Secret key from Supabase Dashboard.');
  }
  if (value.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf-8'));
      if (payload && payload.role && payload.role !== 'service_role') {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a service_role key.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SUPABASE_SERVICE_ROLE_KEY')) throw err;
    }
  }
  return value;
}

export function getApiSecret(): string {
  const value = process.env.API_SECRET;
  if (!value || value.length < 32) {
    throw new Error('API_SECRET is not set or shorter than 32 characters');
  }
  return value;
}

export function getAdminBootstrapPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.trim() ? value.trim() : null;
}
