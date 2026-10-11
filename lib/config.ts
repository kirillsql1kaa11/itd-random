export const APP_CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vwglpnluozdgnztasrrp.supabase.co',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ffnMzR_piobvuDkt1VPzyw_dNQDLzdE',
  apiSecret: process.env.API_SECRET || 'a8f5e3d2c1b0987654321fedcba0123456789abcdef0123456789abcdef01234',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ffnMzR_piobvuDkt1VPzyw_dNQDLzdE',
  adminPassword: process.env.ADMIN_PASSWORD || null,
};
