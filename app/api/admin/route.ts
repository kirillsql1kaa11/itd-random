import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchSupabase, getCachedAuthors, invalidateAuthorsCache } from '@/lib/supabase-server';
import { optimizeScreenshot } from '@/lib/image-optimizer';
import { APP_CONFIG } from '@/lib/config';

const MAX_FAILED_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const memoryAttempts = new Map<string, number[]>();

function createHmacHash(text: string): string {
  return crypto.createHmac('sha256', APP_CONFIG.apiSecret).update(text).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (Buffer.byteLength(bufA) !== Buffer.byteLength(bufB)) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function passwordFingerprint(storedPassword: string): string {
  return createHmacHash(`pwf:${storedPassword}`).slice(0, 32);
}

function createAdminToken(storedPassword: string): string {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    iat: Date.now(),
    pwf: passwordFingerprint(storedPassword),
    exp: Date.now() + 24 * 60 * 60 * 1000
  })).toString('base64url');

  const sig = createHmacHash(payload);
  return `${payload}.${sig}`;
}

async function getStoredAdminPassword(): Promise<string | null> {
  try {
    const data = await fetchSupabase<any[]>('admin_settings?key=eq.admin_password&select=value');
    if (Array.isArray(data) && data.length > 0 && data[0].value) {
      return String(data[0].value).trim();
    }
  } catch {}
  return APP_CONFIG.adminPassword || 'admin123';
}

async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 2) return false;
  const [payloadStr, sig] = parts;
  const expectedSig = createHmacHash(payloadStr);

  if (!safeEqual(sig, expectedSig)) {
    return false;
  }

  let data: any;
  try {
    data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
  } catch {
    return false;
  }

  if (!data || Date.now() > data.exp || data.role !== 'admin' || !data.pwf) return false;

  const stored = await getStoredAdminPassword();
  if (!stored) return false;
  return safeEqual(data.pwf, passwordFingerprint(stored));
}

const ITD_HOST = 'xn--d1ah4a.com';
const ITD_MAX_JSON = 1024 * 1024;
const ITD_MAX_IMAGE = 3 * 1024 * 1024;

function isItdHost(hostname: string): boolean {
  const h = String(hostname || '').toLowerCase();
  return h === ITD_HOST || h.endsWith('.' + ITD_HOST);
}

function parseItdPostUrl(raw: string) {
  let u: URL;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || !isItdHost(u.hostname)) return null;
  const m = u.pathname.match(/^\/@([^/]+)\/post\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (!m) return null;
  return { handle: decodeURIComponent(m[1]), id: m[2].toLowerCase() };
}

function pickMediaUrl(root: any): string | null {
  const pools = [root.attachments, root.media, root.images, root.photos, root.files, root.image, root.attachment];
  for (const pool of pools) {
    const list = Array.isArray(pool) ? pool : (pool ? [pool] : []);
    for (const entry of list) {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const type = String(entry.type || entry.mimeType || entry.mime || '').toLowerCase();
        if (type && !type.includes('image') && !type.includes('photo')) continue;
        const url = entry.url || entry.src || entry.href || entry.link || entry.path;
        if (typeof url === 'string') return url;
      }
    }
  }
  return null;
}

async function importItdPost(rawUrl: string, itdToken: string) {
  const parsed = parseItdPostUrl(rawUrl);
  if (!parsed) {
    return { status: 400, body: { error: 'Ссылка должна вести на пост ИТД: https://итд.com/@автор/post/<id>' } };
  }
  if (!itdToken || typeof itdToken !== 'string') {
    return { status: 400, body: { error: 'Укажите токен авторизации ИТД' } };
  }

  const cleanToken = itdToken.replace(/^Bearer\s+/i, '').trim();
  const res = await fetch(`https://${ITD_HOST}/api/posts/${parsed.id}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${cleanToken}`,
      'User-Agent': 'Mozilla/5.0 (itd-random admin import)'
    }
  });

  if (res.status === 401 || res.status === 403) {
    return { status: 422, body: { error: 'ИТД отклонил токен (401/403). Обновите токен.' } };
  }
  if (res.status === 404) {
    return { status: 404, body: { error: 'Пост не найден в ИТД' } };
  }
  if (!res.ok) {
    return { status: 502, body: { error: `ИТД вернул ошибку ${res.status}` } };
  }

  const json = await res.json().catch(() => null);
  const root = (json && (json.data || json.post)) || json || {};
  const author = root.author || root.user || root.owner || {};
  const result: any = {
    id: parsed.id,
    authorHandle: '@' + String(author.username || author.handle || author.login || parsed.handle).replace(/^@/, ''),
    authorName: author.displayName || author.display_name || author.name || author.nickname || author.username || parsed.handle,
    text: String(root.content || root.text || root.body || root.caption || '').slice(0, 2000),
    mediaUrl: null,
    screenshot: null
  };

  const mediaUrl = pickMediaUrl(root);
  if (mediaUrl) {
    try {
      const fullMediaUrl = new URL(mediaUrl, `https://${ITD_HOST}`).toString();
      result.mediaUrl = fullMediaUrl;
      const imgRes = await fetch(fullMediaUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (itd-random admin import)' }
      });
      if (imgRes.ok) {
        const ctype = imgRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();
        const rawScreenshot = `data:${ctype};base64,${Buffer.from(buffer).toString('base64')}`;
        result.screenshot = await optimizeScreenshot(rawScreenshot);
      }
    } catch (e: any) {
      result.mediaWarning = 'Не удалось скачать картинку: ' + e.message;
    }
  }

  return { status: 200, body: { ok: true, post: result } };
}

function getClientIp(req: NextRequest): string {
  const h = req.headers;
  const raw = h.get('x-real-ip') || h.get('x-vercel-forwarded-for') || h.get('x-forwarded-for') || 'unknown';
  return String(raw).split(',')[0].trim() || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = searchParams.get('action') || body.action;
    const authHeader = req.headers.get('authorization') || '';

    if (action === 'login') {
      const { password } = body;
      if (!password) {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 });
      }

      const ip = getClientIp(req);
      const attempts = (memoryAttempts.get(ip) || []).filter(t => Date.now() - t < RATE_WINDOW_MS);
      if (attempts.length >= MAX_FAILED_ATTEMPTS) {
        const retryAfter = Math.ceil((attempts[0] + RATE_WINDOW_MS - Date.now()) / 1000);
        return NextResponse.json({ error: 'Слишком много попыток входа. Попробуйте позже.', retryAfter }, { status: 429 });
      }

      const candidate = String(password).trim();
      const stored = await getStoredAdminPassword();

      if (!stored) {
        return NextResponse.json({ error: 'Password not configured' }, { status: 500 });
      }

      const candidateHash = crypto.createHash('sha256').update(candidate).digest('hex');
      const isMatch = (candidate === stored) || (candidateHash === stored);

      if (!isMatch) {
        attempts.push(Date.now());
        memoryAttempts.set(ip, attempts);
        await new Promise(r => setTimeout(r, 600));
        return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
      }

      memoryAttempts.delete(ip);
      const token = createAdminToken(stored);
      return NextResponse.json({
        ok: true,
        token,
        message: 'Авторизация успешна'
      });
    }

    if (action === 'verify') {
      const token = body.token || authHeader;
      const valid = await verifyAdminToken(token);
      return NextResponse.json({ valid });
    }

    const token = body.adminToken || authHeader;
    const isValidAdmin = await verifyAdminToken(token);
    if (!isValidAdmin) {
      return NextResponse.json({ error: 'Требуется авторизация администратора' }, { status: 401 });
    }

    if (action === 'fetch_itd_post') {
      const { url, itdToken } = body;
      const out = await importItdPost(url, itdToken);
      return NextResponse.json(out.body, { status: out.status });
    }

    if (action === 'get_admin_stats') {
      const [lb, posts, authors, suggPosts, suggAuthors] = await Promise.all([
        fetchSupabase<any[]>('leaderboard?select=nickname,score,accuracy').catch(() => []),
        fetchSupabase<any[]>('posts?select=id').catch(() => []),
        fetchSupabase<any[]>('authors?select=id').catch(() => []),
        fetchSupabase<any[]>('suggestions_posts?select=id,status').catch(() => []),
        fetchSupabase<any[]>('suggestions_authors?select=id,status').catch(() => [])
      ]);

      const leaderboardRows = Array.isArray(lb) ? lb : [];
      let highest = 0;
      let leader = '—';
      const uniqueNicks = new Set<string>();

      leaderboardRows.forEach((r) => {
        const nick = (r.nickname || '').trim();
        if (nick) uniqueNicks.add(nick);
        const s = Number(r.score) || 0;
        if (s > highest) {
          highest = s;
          leader = nick;
        }
      });

      const pendingPostsCount = Array.isArray(suggPosts) ? suggPosts.filter((p) => !p.status || p.status === 'pending').length : 0;
      const pendingAuthorsCount = Array.isArray(suggAuthors) ? suggAuthors.filter((a) => !a.status || a.status === 'pending').length : 0;

      return NextResponse.json({
        ok: true,
        stats: {
          totalGames: leaderboardRows.length,
          uniquePlayers: uniqueNicks.size,
          topScore: highest,
          topPlayer: leader,
          totalPosts: Array.isArray(posts) ? posts.length : 0,
          totalAuthors: Array.isArray(authors) ? authors.length : 0,
          pendingPosts: pendingPostsCount,
          pendingAuthors: pendingAuthorsCount
        }
      });
    }

    if (action === 'get_posts') {
      const posts = await fetchSupabase<any[]>('posts?select=*&order=id.desc');
      return NextResponse.json({ ok: true, posts: posts || [] });
    }

    if (action === 'get_authors') {
      const authors = await getCachedAuthors();
      return NextResponse.json({ ok: true, authors: authors || [] });
    }

    if (action === 'get_suggestions') {
      const [suggestions, authorSuggestions] = await Promise.all([
        fetchSupabase<any[]>('suggestions_posts?select=*&order=id.desc').catch(() => []),
        fetchSupabase<any[]>('suggestions_authors?select=*&order=id.desc').catch(() => [])
      ]);

      const pendingPosts = (Array.isArray(suggestions) ? suggestions : []).filter((s) => !s.status || s.status === 'pending');
      const pendingAuthors = (Array.isArray(authorSuggestions) ? authorSuggestions : []).filter((s) => !s.status || s.status === 'pending');

      return NextResponse.json({
        ok: true,
        suggestions: pendingPosts,
        authorSuggestions: pendingAuthors
      });
    }

    if (action === 'get_author_suggestions') {
      const authorSuggestions = await fetchSupabase<any[]>('suggestions_authors?select=*&order=id.desc').catch(() => []);
      const pendingAuthors = (Array.isArray(authorSuggestions) ? authorSuggestions : []).filter((s) => !s.status || s.status === 'pending');
      return NextResponse.json({ ok: true, authors: pendingAuthors });
    }

    if (action === 'export_backup') {
      const [posts, authors] = await Promise.all([
        fetchSupabase<any[]>('posts?select=*&order=id.desc').catch(() => []),
        fetchSupabase<any[]>('authors?select=*&order=name.asc').catch(() => [])
      ]);
      return NextResponse.json({
        ok: true,
        backup: {
          app: 'ITD_Author_Guesser',
          version: 1,
          exportedAt: new Date().toISOString(),
          posts: posts || [],
          authors: authors || []
        }
      });
    }

    if (action === 'import_backup') {
      const { backup } = body;
      if (!backup || (!Array.isArray(backup.posts) && !Array.isArray(backup.authors))) {
        return NextResponse.json({ error: 'Некорректный файл бэкапа' }, { status: 400 });
      }

      if (Array.isArray(backup.authors) && backup.authors.length > 0) {
        for (const author of backup.authors) {
          await fetchSupabase('authors', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: {
              id: author.id,
              name: author.name,
              handle: author.handle,
              avatar_color: author.avatar_color || author.avatarColor,
              avatar_text: author.avatar_text || author.avatarText,
              badge: author.badge,
              bio: author.bio,
              verified: Boolean(author.verified)
            }
          }).catch(() => {});
        }
        invalidateAuthorsCache();
      }

      if (Array.isArray(backup.posts) && backup.posts.length > 0) {
        for (const p of backup.posts) {
          await fetchSupabase('posts', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: {
              id: p.id,
              correct_author_id: p.correct_author_id || p.correctAuthorId,
              post_text: p.post_text || p.postText || '',
              screenshot: p.screenshot,
              hint: p.hint || '',
              difficulty: p.difficulty || 'normal',
              tags: p.tags || ['#итд']
            }
          }).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'reset_presets') {
      return NextResponse.json({ ok: true });
    }

    if (action === 'save_post') {
      const { post } = body;
      if (!post || !post.screenshot || !post.correctAuthorId) {
        return NextResponse.json({ error: 'Invalid post data' }, { status: 400 });
      }

      const compressedScreenshot = await optimizeScreenshot(post.screenshot);

      const record = {
        id: post.id || ('post_' + Date.now()),
        correct_author_id: post.correctAuthorId,
        post_text: post.postText || '',
        screenshot: compressedScreenshot,
        hint: post.hint || '',
        difficulty: post.difficulty || 'normal',
        tags: post.tags || [],
        likes: post.likes || 0
      };

      await fetchSupabase('posts', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: record
      });

      return NextResponse.json({ ok: true, post: record });
    }

    if (action === 'delete_post') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Post ID required' }, { status: 400 });

      await fetchSupabase(`posts?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      return NextResponse.json({ ok: true });
    }

    if (action === 'save_author') {
      const { author } = body;
      if (!author || !author.name) {
        return NextResponse.json({ error: 'Invalid author data' }, { status: 400 });
      }

      const record = {
        id: author.id || ('author_' + Date.now()),
        name: author.name,
        handle: author.handle,
        avatar_color: author.avatarColor || author.avatar_color || 'linear-gradient(135deg, #3b82f6, #06b6d4)',
        avatar_text: author.avatarText || author.avatar_text || (author.name ? author.name[0] : '?'),
        badge: author.badge || null,
        bio: author.bio || null,
        verified: Boolean(author.verified)
      };

      await fetchSupabase('authors', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: record
      });

      invalidateAuthorsCache();

      return NextResponse.json({ ok: true, author: record });
    }

    if (action === 'delete_author') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Author ID required' }, { status: 400 });

      await fetchSupabase(`authors?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      invalidateAuthorsCache();

      return NextResponse.json({ ok: true });
    }

    if (action === 'change_password') {
      const { newPassword } = body;
      if (!newPassword || newPassword.trim().length < 3) {
        return NextResponse.json({ error: 'Password too short' }, { status: 400 });
      }

      const val = newPassword.trim();
      await fetchSupabase('admin_settings?on_conflict=key', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          key: 'admin_password',
          value: val,
          updated_at: new Date().toISOString()
        }
      });

      return NextResponse.json({ ok: true, token: createAdminToken(val), message: 'Пароль администратора обновлен' });
    }

    if (action === 'moderate_post') {
      const { id, status, postRecord } = body;
      if (!id) return NextResponse.json({ error: 'Suggestion ID required' }, { status: 400 });

      if (status === 'approved' && postRecord) {
        const compressedScreenshot = await optimizeScreenshot(postRecord.screenshot);
        await fetchSupabase('posts', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: {
            id: postRecord.id || ('post_' + Date.now()),
            correct_author_id: postRecord.correctAuthorId,
            post_text: postRecord.postText || '',
            screenshot: compressedScreenshot,
            hint: postRecord.hint || '',
            difficulty: 'normal',
            tags: ['#итд']
          }
        });
      }

      try {
        await fetchSupabase(`suggestions_posts?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status }
        });
      } catch {
        await fetchSupabase(`suggestions_posts?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'moderate_author') {
      const { id, status, authorRecord } = body;
      if (!id) return NextResponse.json({ error: 'Suggestion ID required' }, { status: 400 });

      if (status === 'approved' && authorRecord) {
        const idVal = authorRecord.id || ('author_' + Date.now());
        const record = {
          id: idVal,
          name: authorRecord.name,
          handle: authorRecord.handle,
          avatar_color: authorRecord.avatarColor || authorRecord.avatar_color || 'linear-gradient(135deg, #0288d1, #26c6da)',
          avatar_text: authorRecord.avatarText || authorRecord.avatar_text || (authorRecord.name ? authorRecord.name[0] : '?'),
          badge: authorRecord.badge || 'Автор ИТД',
          bio: authorRecord.bio || 'Популярный автор в ИТД',
          verified: authorRecord.verified !== undefined ? Boolean(authorRecord.verified) : true
        };

        await fetchSupabase('authors', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: record
        });
        invalidateAuthorsCache();
      }

      try {
        await fetchSupabase(`suggestions_authors?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status }
        });
      } catch {
        await fetchSupabase(`suggestions_authors?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown admin action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
