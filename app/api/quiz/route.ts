import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { apiErrorPayload, fetchSupabase, getCachedAuthors } from '@/lib/supabase-server';
import { createHmacHash, safeEqual, signPayload, verifySignedPayload } from '@/lib/security';
import { verifyAdminToken } from '@/lib/admin-auth';

const MODES = new Set(['blitz', 'survival', 'practice']);
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_TTL_MS = SESSION_TTL_MS + 10 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuestionTokenPayload {
  id: string;
  qid: string;
  sid: string;
  mode: string;
  ansHash: string;
  elim: string[];
  exp: number;
}

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createAnswerHash(postId: string, authorId: string): string {
  return createHmacHash(`${postId}:${authorId}`);
}

function createQuestionToken(
  postId: string,
  correctAuthorId: string,
  elimIds: string[],
  qid: string,
  sessionId: string,
  mode: string
): string {
  return signPayload({
    id: postId,
    qid,
    sid: sessionId,
    mode,
    ansHash: createAnswerHash(postId, correctAuthorId),
    elim: elimIds,
    exp: Date.now() + TOKEN_TTL_MS,
  } satisfies QuestionTokenPayload);
}

function verifyQuestionToken(token: string): QuestionTokenPayload | null {
  const data = verifySignedPayload<QuestionTokenPayload>(token);
  if (!data || typeof data.id !== 'string' || typeof data.qid !== 'string' || typeof data.sid !== 'string') return null;
  if (!data.exp || Date.now() > data.exp) return null;
  return data;
}

function cleanId(value: any, max = 64): string {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function screenshotRef(post: any): string {
  const value = typeof post.screenshot === 'string' ? post.screenshot : '';
  if (/^https?:\/\//i.test(value)) return value;
  return `/api/screenshot/${encodeURIComponent(post.id)}`;
}

function buildAuthorInfo(author: any): any {
  if (!author) return null;
  return {
    id: author.id,
    name: author.name || author.id,
    handle: author.handle || `@${author.id}`,
    avatarColor: author.avatar_color || author.avatarColor,
    avatarText: author.avatar_text || author.avatarText,
    badge: author.badge,
    bio: author.bio,
    verified: Boolean(author.verified),
  };
}

async function getAuthorInfo(authorId: string | null): Promise<any> {
  if (!authorId) return null;
  try {
    const rows = await fetchSupabase<any[]>(`authors?id=eq.${encodeURIComponent(authorId)}&select=*`);
    if (Array.isArray(rows) && rows.length > 0) return buildAuthorInfo(rows[0]);
  } catch {}
  return { id: authorId, name: authorId, handle: `@${authorId}`, bio: 'Автор в соцсети ИТД' };
}

async function getCorrectAuthorId(postId: string): Promise<string | null> {
  try {
    const rows = await fetchSupabase<any[]>(`posts?id=eq.${encodeURIComponent(postId)}&select=correct_author_id`);
    if (Array.isArray(rows) && rows.length > 0) return rows[0].correct_author_id;
  } catch {}
  return null;
}

async function createSession(mode: string, playerId: string | null): Promise<any> {
  if (playerId) {
    await fetchSupabase(`game_sessions?player_id=eq.${encodeURIComponent(playerId)}&status=eq.active`, {
      method: 'PATCH',
      body: { status: 'abandoned' },
    }).catch(() => {});
  }
  const rows = await fetchSupabase<any[]>('game_sessions', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      mode,
      player_id: playerId || null,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    },
  });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Не удалось создать игровую сессию');
  }
  return rows[0];
}

function buildQuestion(post: any, authors: any[], index: number, sessionId: string, mode: string) {
  const correctAuthorId = post.correct_author_id;
  const correctAuthor = authors.find((a) => a.id === correctAuthorId) || {
    id: correctAuthorId,
    name: correctAuthorId,
    handle: `@${correctAuthorId}`,
    avatar_color: 'linear-gradient(135deg, #0288d1, #26c6da)',
    avatar_text: '?',
  };

  const distractors = shuffle(authors.filter((a) => a.id !== correctAuthorId)).slice(0, 3);
  while (distractors.length < 3) {
    distractors.push({
      id: `unknown_${distractors.length}`,
      name: `Автор ${distractors.length + 1}`,
      handle: `@author_${distractors.length + 1}`,
      avatar_color: 'linear-gradient(135deg, #7c3aed, #ec4899)',
      avatar_text: '?',
    });
  }

  const options = shuffle([correctAuthor, ...distractors]).map((a: any) => ({
    id: a.id,
    name: a.name,
    handle: a.handle,
    avatarColor: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    avatarText: a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?'),
    verified: Boolean(a.verified),
  }));

  const elimIds = distractors.slice(0, 2).map((d: any) => d.id);
  const qid = `${post.id}_${index}`;
  const qToken = createQuestionToken(post.id, correctAuthorId, elimIds, qid, sessionId, mode);

  return {
    id: post.id,
    postText: post.post_text || '',
    screenshot: screenshotRef(post),
    hint: post.hint || '',
    difficulty: post.difficulty || 'normal',
    tags: post.tags || [],
    options,
    qToken,
  };
}

async function handleGetQuestions(mode: string, playerId: string | null) {
  const safeMode = MODES.has(mode) ? mode : 'blitz';
  const [idRows, authorsData] = await Promise.all([
    fetchSupabase<any[]>('posts?select=id'),
    getCachedAuthors(),
  ]);

  const allIds = (Array.isArray(idRows) ? idRows : []).map((r) => r.id).filter((id) => id !== null && id !== undefined);
  const authors = Array.isArray(authorsData) ? authorsData : [];

  if (allIds.length === 0) {
    return NextResponse.json({ questions: [], total: 0, sessionId: null });
  }

  const targetCount = safeMode === 'blitz' ? 10 : safeMode === 'survival' ? 50 : 100;
  const pickedIds = shuffle(allIds).slice(0, targetCount);
  const postsData = await fetchSupabase<any[]>(`posts?id=in.(${pickedIds.join(',')})&select=*`);
  const postsById = new Map((Array.isArray(postsData) ? postsData : []).map((p) => [p.id, p]));
  const selectedPosts = pickedIds.map((id) => postsById.get(id)).filter(Boolean);

  if (selectedPosts.length === 0) {
    return NextResponse.json({ questions: [], total: 0, sessionId: null });
  }

  const session = await createSession(safeMode, playerId);
  const questions = selectedPosts.map((post, index) => buildQuestion(post, authors, index, session.id, safeMode));

  return NextResponse.json({ questions, total: questions.length, sessionId: session.id });
}

async function handleTestQuestion(postId: string) {
  const rows = await fetchSupabase<any[]>(`posts?id=eq.${encodeURIComponent(postId)}&select=*`);
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Пост не найден' }, { status: 404 });
  }
  const authors = await getCachedAuthors();
  const session = await createSession('test', null);
  const question = buildQuestion(rows[0], authors, 0, session.id, 'test');
  return NextResponse.json({ questions: [question], total: 1, sessionId: session.id });
}

async function handleCheckAnswer(body: any, timedOut: boolean) {
  const tokenData = verifyQuestionToken(String(body.qToken || ''));
  if (!tokenData) {
    return NextResponse.json({ error: 'Вопрос недействителен или устарел' }, { status: 400 });
  }

  const sessionId = String(body.sessionId || '').trim();
  if (!UUID_RE.test(sessionId) || tokenData.sid !== sessionId) {
    return NextResponse.json({ error: 'Игровая сессия не найдена' }, { status: 400 });
  }

  const selectedId = timedOut ? null : cleanId(body.selectedAuthorId, 128);
  if (!timedOut && !selectedId) {
    return NextResponse.json({ error: 'Не выбран вариант ответа' }, { status: 400 });
  }

  const isCorrect = timedOut ? false : safeEqual(createAnswerHash(tokenData.id, selectedId as string), tokenData.ansHash);
  const timeLeft = Math.max(0, Math.min(20, Number(body.timeLeft) || 0));
  const speedBonus = timedOut ? 0 : Math.round((timeLeft / 20) * 50);
  const hintUsed = timedOut ? false : Boolean(body.hintUsed);
  const maxTime = tokenData.mode === 'practice' ? 0 : 15;
  const elapsedMs = timedOut ? maxTime * 1000 : Math.round(Math.max(0, Math.min(maxTime, maxTime - timeLeft)) * 1000);

  const rpc = await fetchSupabase<any>('rpc/record_answer', {
    method: 'POST',
    body: {
      p_session_id: sessionId,
      p_qid: tokenData.qid,
      p_post_id: tokenData.id,
      p_selected_author_id: selectedId,
      p_is_correct: isCorrect,
      p_speed_bonus: speedBonus,
      p_hint_used: hintUsed,
      p_elapsed_ms: elapsedMs,
    },
  }).catch(() => null);

  if (!rpc) {
    return NextResponse.json({ error: 'Не удалось сохранить ответ' }, { status: 502 });
  }
  if (rpc.error) {
    const status = rpc.error === 'session_not_found' ? 404 : rpc.error === 'session_expired' ? 410 : 409;
    return NextResponse.json({ error: rpc.error }, { status });
  }

  const correctAuthorId = isCorrect ? selectedId : await getCorrectAuthorId(tokenData.id);
  const correctAuthor = await getAuthorInfo(correctAuthorId);

  return NextResponse.json({
    isCorrect,
    timedOut,
    pointsEarned: Number(rpc.points) || 0,
    correctAuthorId,
    correctAuthor,
    alreadyAnswered: Boolean(rpc.already_answered),
    sessionScore: Number(rpc.score) || 0,
    sessionStreak: Number(rpc.streak) || 0,
    sessionMaxStreak: Number(rpc.max_streak) || 0,
    sessionCorrectCount: Number(rpc.correct_count) || 0,
    sessionTotalCount: Number(rpc.total_count) || 0,
  });
}

async function handleSubmitGame(body: any) {
  const sessionId = String(body.sessionId || '').trim();
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Игровая сессия не найдена' }, { status: 400 });
  }

  const nickname = String(body.nickname || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 32) || 'Аноним';
  const playerId = cleanId(body.playerId, 64);

  const rpc = await fetchSupabase<any>('rpc/submit_game', {
    method: 'POST',
    body: { p_session_id: sessionId, p_nickname: nickname, p_player_id: playerId || null },
  }).catch(() => null);

  if (!rpc) {
    return NextResponse.json({ error: 'Не удалось сохранить результат' }, { status: 502 });
  }
  if (rpc.error) {
    const status = rpc.error === 'no_answers' ? 400 : rpc.error === 'test_session' ? 403 : 404;
    return NextResponse.json({ error: rpc.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    alreadySubmitted: Boolean(rpc.already_submitted),
    record: rpc.record,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'blitz';
    const playerId = cleanId(searchParams.get('playerId'), 64) || null;
    return await handleGetQuestions(mode, playerId);
  } catch (err: any) {
    return NextResponse.json(apiErrorPayload(err, 'Не удалось загрузить вопросы'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || new URL(req.url).searchParams.get('action') || 'check_answer';

    if (action === 'get_questions') {
      const mode = body.mode || 'blitz';
      const playerId = cleanId(body.playerId, 64) || null;
      return await handleGetQuestions(mode, playerId);
    }

    if (action === 'check_answer') {
      return await handleCheckAnswer(body, false);
    }

    if (action === 'timeout') {
      return await handleCheckAnswer(body, true);
    }

    if (action === 'submit_game') {
      return await handleSubmitGame(body);
    }

    if (action === 'test_question') {
      const authorized = await verifyAdminToken(body.adminToken);
      if (!authorized) {
        return NextResponse.json({ error: 'Требуется авторизация администратора' }, { status: 401 });
      }
      return await handleTestQuestion(String(body.postId || ''));
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(apiErrorPayload(err, 'Внутренняя ошибка сервера'), { status: 500 });
  }
}
