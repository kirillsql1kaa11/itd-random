import { NextRequest, NextResponse } from 'next/server';
import { apiErrorPayload, fetchAllRows, fetchSupabase, getCachedAuthors, invalidateAuthorsCache } from '@/lib/supabase-server';
import { changeAdminPassword, loginAdmin, verifyAdminToken } from '@/lib/admin-auth';
import { deleteStoredScreenshot, ensureStoredScreenshot, uploadDataUrlScreenshot, uploadScreenshotBuffer } from '@/lib/storage';
import { optimizeImageBuffer } from '@/lib/image-optimizer';

const MAX_FAILED_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const memoryAttempts = new Map<string, number[]>();

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

function screenshotRef(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const value = typeof row.screenshot === 'string' ? row.screenshot : '';
  if (value && !/^https?:\/\//i.test(value) && !value.startsWith('/api/screenshot/')) {
    return { ...row, screenshot: `/api/screenshot/${encodeURIComponent(row.id)}` };
  }
  return row;
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
      Accept: 'application/json',
      Authorization: `Bearer ${cleanToken}`,
      'User-Agent': 'Mozilla/5.0 (itd-random admin import)',
    },
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

  const rawText = await res.text();
  if (rawText.length > ITD_MAX_JSON) {
    return { status: 413, body: { error: 'Ответ ИТД слишком большой' } };
  }
  let json: any = null;
  try { json = JSON.parse(rawText); } catch { json = null; }

  const root = (json && (json.data || json.post)) || json || {};
  const author = root.author || root.user || root.owner || {};
  const result: any = {
    id: parsed.id,
    authorHandle: '@' + String(author.username || author.handle || author.login || parsed.handle).replace(/^@/, ''),
    authorName: author.displayName || author.display_name || author.name || author.nickname || author.username || parsed.handle,
    text: String(root.content || root.text || root.body || root.caption || '').slice(0, 2000),
    mediaUrl: null,
    screenshot: null,
  };

  const mediaUrl = pickMediaUrl(root);
  if (mediaUrl) {
    try {
      const fullMediaUrl = new URL(mediaUrl, `https://${ITD_HOST}`).toString();
      result.mediaUrl = fullMediaUrl;
      const imgRes = await fetch(fullMediaUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (itd-random admin import)' } });
      if (imgRes.ok) {
        const declaredLength = Number(imgRes.headers.get('content-length') || 0);
        if (declaredLength > ITD_MAX_IMAGE) {
          throw new Error('картинка больше 3 МБ');
        }
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        if (buffer.length > ITD_MAX_IMAGE) {
          throw new Error('картинка больше 3 МБ');
        }
        const ctype = imgRes.headers.get('content-type') || 'image/jpeg';
        const optimized = await optimizeImageBuffer(`data:${ctype};base64,${buffer.toString('base64')}`);
        if (optimized) {
          result.screenshot = await uploadScreenshotBuffer(optimized.buffer, optimized.contentType, 'imports');
        }
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

function dayKey(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

async function getAdminStats() {
  const now = Date.now();
  const since30 = new Date(now - 30 * 864e5).toISOString();
  const dayAgo = now - 864e5;
  const weekAgo = now - 7 * 864e5;

  const [lb, posts, authors, suggPosts, suggAuthors, sessions, hardQuestions] = await Promise.all([
    fetchAllRows<any>('leaderboard?select=nickname,score,accuracy,mode,player_id,created_at&order=created_at.desc').catch(() => []),
    fetchSupabase<any[]>('posts?select=id').catch(() => []),
    fetchSupabase<any[]>('authors?select=id').catch(() => []),
    fetchSupabase<any[]>('suggestions_posts?select=id,status').catch(() => []),
    fetchSupabase<any[]>('suggestions_authors?select=id,status').catch(() => []),
    fetchAllRows<any>(`game_sessions?select=player_id,status,total_count,started_at&gte.started_at=${encodeURIComponent(since30)}&order=started_at.desc`).catch(() => []),
    fetchSupabase<any[]>('question_stats?select=*&order=error_rate.desc,attempts.desc&limit=8').catch(() => []),
  ]);

  const leaderboardRows = Array.isArray(lb) ? lb : [];
  let highest = 0;
  let leader = '—';
  let scoreSum = 0;
  let accuracySum = 0;
  const uniquePlayers = new Set<string>();

  leaderboardRows.forEach((r) => {
    const identity = (r.player_id || '').trim() || (r.nickname || '').trim();
    if (identity) uniquePlayers.add(identity);
    const score = Number(r.score) || 0;
    scoreSum += score;
    accuracySum += Number(r.accuracy) || 0;
    if (score > highest) {
      highest = score;
      leader = (r.nickname || '').trim() || '—';
    }
  });

  const sessionRows = Array.isArray(sessions) ? sessions : [];
  const dau = new Set<string>();
  const wau = new Set<string>();
  const perPlayer = new Map<string, number>();
  let gamesToday = 0;
  let games7d = 0;
  let started = 0;
  let played = 0;
  let submitted = 0;
  const daily = new Map<string, { sessions: number; players: Set<string> }>();

  for (let i = 13; i >= 0; i--) {
    const key = dayKey(now - i * 864e5);
    if (key) daily.set(key, { sessions: 0, players: new Set() });
  }

  sessionRows.forEach((s) => {
    const startedAt = new Date(s.started_at).getTime();
    if (!Number.isFinite(startedAt)) return;
    const identity = (s.player_id || '').trim();
    if (identity) {
      perPlayer.set(identity, (perPlayer.get(identity) || 0) + 1);
      if (startedAt >= dayAgo) dau.add(identity);
      if (startedAt >= weekAgo) wau.add(identity);
    }
    if (startedAt >= dayAgo) gamesToday += 1;
    if (startedAt >= weekAgo) games7d += 1;
    started += 1;
    if ((Number(s.total_count) || 0) > 0) played += 1;
    if (s.status === 'submitted') submitted += 1;
    const bucket = daily.get(dayKey(startedAt));
    if (bucket) {
      bucket.sessions += 1;
      if (identity) bucket.players.add(identity);
    }
  });

  const allSuggestions = [...(Array.isArray(suggPosts) ? suggPosts : []), ...(Array.isArray(suggAuthors) ? suggAuthors : [])];
  const approvedSuggestions = allSuggestions.filter((s) => s.status === 'approved').length;
  const returnsCount = [...perPlayer.values()].filter((count) => count > 1).length;

  return {
    totalGames: leaderboardRows.length,
    uniquePlayers: uniquePlayers.size,
    topScore: highest,
    topPlayer: leader,
    totalPosts: Array.isArray(posts) ? posts.length : 0,
    totalAuthors: Array.isArray(authors) ? authors.length : 0,
    pendingPosts: Array.isArray(suggPosts) ? suggPosts.filter((p) => !p.status || p.status === 'pending').length : 0,
    pendingAuthors: Array.isArray(suggAuthors) ? suggAuthors.filter((a) => !a.status || a.status === 'pending').length : 0,
    dau: dau.size,
    wau: wau.size,
    gamesToday,
    games7d,
    completionRate: started > 0 ? Math.round((submitted / started) * 100) : 0,
    returnRate: perPlayer.size > 0 ? Math.round((returnsCount / perPlayer.size) * 100) : 0,
    avgScore: leaderboardRows.length > 0 ? Math.round(scoreSum / leaderboardRows.length) : 0,
    avgAccuracy: leaderboardRows.length > 0 ? Math.round(accuracySum / leaderboardRows.length) : 0,
    suggestionConversion: allSuggestions.length > 0 ? Math.round((approvedSuggestions / allSuggestions.length) * 100) : 0,
    daily: [...daily.entries()].map(([date, value]) => ({ date, sessions: value.sessions, players: value.players.size })),
    funnel: { started, played, submitted },
    hardQuestions: (Array.isArray(hardQuestions) ? hardQuestions : [])
      .filter((q) => Number(q.attempts) >= 3)
      .slice(0, 5)
      .map((q) => ({
        post_id: q.post_id,
        author_name: q.author_name,
        attempts: Number(q.attempts) || 0,
        correct: Number(q.correct) || 0,
        error_rate: Number(q.error_rate) || 0,
      })),
  };
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
      const attempts = (memoryAttempts.get(ip) || []).filter((t) => Date.now() - t < RATE_WINDOW_MS);
      if (attempts.length >= MAX_FAILED_ATTEMPTS) {
        const retryAfter = Math.ceil((attempts[0] + RATE_WINDOW_MS - Date.now()) / 1000);
        return NextResponse.json({ error: 'Слишком много попыток входа. Попробуйте позже.', retryAfter }, { status: 429 });
      }

      const result = await loginAdmin(String(password));
      if ('error' in result) {
        if (result.status === 401) {
          attempts.push(Date.now());
          memoryAttempts.set(ip, attempts);
          await new Promise((r) => setTimeout(r, 600));
        }
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      memoryAttempts.delete(ip);
      return NextResponse.json({
        ok: true,
        token: result.token,
        message: 'Авторизация успешна',
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
      const stats = await getAdminStats();
      return NextResponse.json({ ok: true, stats });
    }

    if (action === 'get_posts') {
      const posts = await fetchSupabase<any[]>('posts?select=*&order=id.desc');
      const safePosts = (Array.isArray(posts) ? posts : []).map(screenshotRef);
      return NextResponse.json({ ok: true, posts: safePosts });
    }

    if (action === 'get_authors') {
      const authors = await getCachedAuthors();
      return NextResponse.json({ ok: true, authors: authors || [] });
    }

    if (action === 'get_suggestions') {
      const [suggestions, authorSuggestions] = await Promise.all([
        fetchSupabase<any[]>('suggestions_posts?select=*&order=id.desc').catch(() => []),
        fetchSupabase<any[]>('suggestions_authors?select=*&order=id.desc').catch(() => []),
      ]);

      const pendingPosts = (Array.isArray(suggestions) ? suggestions : []).filter((s) => !s.status || s.status === 'pending');
      const pendingAuthors = (Array.isArray(authorSuggestions) ? authorSuggestions : []).filter((s) => !s.status || s.status === 'pending');

      return NextResponse.json({
        ok: true,
        suggestions: pendingPosts,
        authorSuggestions: pendingAuthors,
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
        fetchSupabase<any[]>('authors?select=*&order=name.asc').catch(() => []),
      ]);
      return NextResponse.json({
        ok: true,
        backup: {
          app: 'ITD_Author_Guesser',
          version: 1,
          exportedAt: new Date().toISOString(),
          posts: posts || [],
          authors: authors || [],
        },
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
              verified: Boolean(author.verified),
            },
          }).catch(() => {});
        }
        invalidateAuthorsCache();
      }

      if (Array.isArray(backup.posts) && backup.posts.length > 0) {
        for (const p of backup.posts) {
          let screenshot = p.screenshot;
          if (typeof screenshot === 'string' && screenshot && !/^https?:\/\//i.test(screenshot)) {
            screenshot = await ensureStoredScreenshot(screenshot, 'posts').catch(() => p.screenshot);
          }
          await fetchSupabase('posts', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: {
              id: p.id,
              correct_author_id: p.correct_author_id || p.correctAuthorId,
              post_text: p.post_text || p.postText || '',
              screenshot,
              hint: p.hint || '',
              difficulty: p.difficulty || 'normal',
              tags: p.tags || ['#итд'],
            },
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

      const recordId = post.id || ('post_' + Date.now());
      const previous = await fetchSupabase<any[]>(`posts?id=eq.${encodeURIComponent(recordId)}&select=screenshot`).catch(() => []);
      const previousScreenshot = Array.isArray(previous) && previous.length > 0 ? previous[0].screenshot : null;

      let screenshotUrl: string;
      if (/^https?:\/\//i.test(post.screenshot)) {
        screenshotUrl = post.screenshot;
      } else {
        screenshotUrl = await uploadDataUrlScreenshot(post.screenshot, 'posts');
      }

      const record = {
        id: recordId,
        correct_author_id: post.correctAuthorId,
        post_text: post.postText || '',
        screenshot: screenshotUrl,
        hint: post.hint || '',
        difficulty: post.difficulty || 'normal',
        tags: post.tags || [],
        likes: post.likes || 0,
      };

      await fetchSupabase('posts', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: record,
      });

      if (previousScreenshot && previousScreenshot !== screenshotUrl) {
        await deleteStoredScreenshot(previousScreenshot);
      }

      return NextResponse.json({ ok: true, post: record });
    }

    if (action === 'delete_post') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Post ID required' }, { status: 400 });

      const rows = await fetchSupabase<any[]>(`posts?id=eq.${encodeURIComponent(id)}&select=screenshot`).catch(() => []);
      const screenshot = Array.isArray(rows) && rows.length > 0 ? rows[0].screenshot : null;

      await fetchSupabase(`posts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await deleteStoredScreenshot(screenshot);

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
        verified: Boolean(author.verified),
      };

      await fetchSupabase('authors', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: record,
      });

      invalidateAuthorsCache();

      return NextResponse.json({ ok: true, author: record });
    }

    if (action === 'delete_author') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Author ID required' }, { status: 400 });

      await fetchSupabase(`authors?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      invalidateAuthorsCache();

      return NextResponse.json({ ok: true });
    }

    if (action === 'change_password') {
      const { newPassword } = body;
      if (!newPassword || String(newPassword).trim().length < 8) {
        return NextResponse.json({ error: 'Пароль должен быть не короче 8 символов' }, { status: 400 });
      }

      const { token: newToken } = await changeAdminPassword(String(newPassword).trim());
      return NextResponse.json({ ok: true, token: newToken, message: 'Пароль администратора обновлен' });
    }

    if (action === 'moderate_post') {
      const { id, status, postRecord } = body;
      if (!id) return NextResponse.json({ error: 'Suggestion ID required' }, { status: 400 });

      if (status === 'approved' && postRecord) {
        let screenshot = postRecord.screenshot;
        if (typeof screenshot === 'string' && screenshot && !/^https?:\/\//i.test(screenshot)) {
          screenshot = await ensureStoredScreenshot(screenshot, 'posts');
        }
        await fetchSupabase('posts', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: {
            id: postRecord.id || ('post_' + Date.now()),
            correct_author_id: postRecord.correctAuthorId,
            post_text: postRecord.postText || '',
            screenshot,
            hint: postRecord.hint || '',
            difficulty: 'normal',
            tags: ['#итд'],
          },
        });
      }

      try {
        await fetchSupabase(`suggestions_posts?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status },
        });
      } catch {
        await fetchSupabase(`suggestions_posts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
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
          verified: authorRecord.verified !== undefined ? Boolean(authorRecord.verified) : true,
        };

        await fetchSupabase('authors', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: record,
        });
        invalidateAuthorsCache();
      }

      try {
        await fetchSupabase(`suggestions_authors?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status },
        });
      } catch {
        await fetchSupabase(`suggestions_authors?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown admin action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(apiErrorPayload(err, 'Внутренняя ошибка сервера'), { status: 500 });
  }
}
