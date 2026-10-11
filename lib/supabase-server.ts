import { APP_CONFIG } from './config';

export async function fetchSupabase<T = any>(endpoint: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  prefer?: string;
} = {}): Promise<T> {
  const url = `${APP_CONFIG.supabaseUrl}/rest/v1/${endpoint}`;
  const key = APP_CONFIG.serviceRoleKey || APP_CONFIG.supabaseKey;

  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(options.prefer ? { 'Prefer': options.prefer } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    cache: 'no-store'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase error ${res.status}: ${errorText}`);
  }

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  try {
    return text ? JSON.parse(text) : (null as T);
  } catch {
    return text as unknown as T;
  }
}
