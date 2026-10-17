import { getSupabaseServiceKey, getSupabaseUrl } from './config';

export interface SupabaseRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  prefer?: string;
}

export async function fetchSupabaseResponse(endpoint: string, options: SupabaseRequestOptions = {}): Promise<Response> {
  const url = `${getSupabaseUrl()}/rest/v1/${endpoint}`;
  const key = getSupabaseServiceKey();

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(options.prefer ? { Prefer: options.prefer } : {}),
    ...(options.headers || {}),
  };

  return fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    cache: 'no-store',
  });
}

export async function fetchSupabase<T = any>(endpoint: string, options: SupabaseRequestOptions = {}): Promise<T> {
  const res = await fetchSupabaseResponse(endpoint, options);

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

export async function fetchAllRows<T = any>(endpoint: string, pageSize = 1000, maxPages = 5): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const chunk = await fetchSupabase<T[]>(`${endpoint}${sep}limit=${pageSize}&offset=${page * pageSize}`);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

let serverAuthorsCache: { data: any[]; timestamp: number } | null = null;
const AUTHORS_CACHE_TTL = 15 * 60 * 1000;

export async function getCachedAuthors(forceRefresh: boolean = false): Promise<any[]> {
  const now = Date.now();
  if (!forceRefresh && serverAuthorsCache && now - serverAuthorsCache.timestamp < AUTHORS_CACHE_TTL) {
    return serverAuthorsCache.data;
  }
  const data = await fetchSupabase<any[]>('authors?select=*&order=name.asc');
  const authors = Array.isArray(data) ? data : [];
  serverAuthorsCache = { data: authors, timestamp: now };
  return authors;
}

export function invalidateAuthorsCache(): void {
  serverAuthorsCache = null;
}

export function apiErrorPayload(err: any, fallback: string): { error: string; details?: string } {
  const message = String(err?.message || '');
  const isConfigError = message.startsWith('SUPABASE_') || message.startsWith('API_SECRET');
  if (isConfigError || process.env.NODE_ENV !== 'production') {
    return { error: fallback, details: message.slice(0, 300) };
  }
  return { error: fallback };
}
