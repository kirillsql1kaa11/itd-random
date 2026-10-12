import { Author } from '@/types';

const CACHE_KEY = 'itd_cached_authors';
const CACHE_TIME_KEY = 'itd_cached_authors_time';
const CLIENT_CACHE_TTL = 15 * 60 * 1000;

export async function getAuthorsClient(forceRefresh: boolean = false): Promise<Author[]> {
  if (typeof window === 'undefined') return [];

  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      const cachedTime = Number(sessionStorage.getItem(CACHE_TIME_KEY)) || 0;
      if (cached && Date.now() - cachedTime < CLIENT_CACHE_TTL) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/authors${forceRefresh ? '?refresh=true' : ''}`);
    const data = await res.json();
    const authors: Author[] = Array.isArray(data?.authors) ? data.authors : [];
    if (authors.length > 0) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(authors));
        sessionStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
      } catch {}
    }
    return authors;
  } catch {
    return [];
  }
}

export function invalidateClientAuthorsCache(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_TIME_KEY);
  } catch {}
}
