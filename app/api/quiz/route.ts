import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchSupabase } from '@/lib/supabase-server';
import { APP_CONFIG } from '@/lib/config';

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

function createQuestionToken(postId: string, correctAuthorId: string, elimIds: string[] = [], qid?: string): string {
  const payload = Buffer.from(JSON.stringify({
    id: postId,
    qid: qid || postId,
    ansHash: createAnswerHash(postId, correctAuthorId),
    elim: elimIds,
    exp: Date.now() + 60 * 60 * 1000
  })).toString('base64url');

  const sig = createHmacHash(payload);
  return `${payload}.${sig}`;
}

function verifyQuestionToken(token: string): { id: string; qid: string; ansHash: string; elim: string[]; exp: number } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = createHmacHash(payloadStr);

  if (!safeEqual(sig, expectedSig)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function createSessionToken(sessionData: any): string {
  const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const sig = createHmacHash(`session:${payload}`);
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): any | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = createHmacHash(`session:${payloadStr}`);

  if (!safeEqual(sig, expectedSig)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (Date.now() > (data.exp || 0)) return null;
    return data;
  } catch {
    return null;
  }
}

async function handleGetQuestions(mode: string = 'blitz') {
  const [idRows, authorsData] = await Promise.all([
    fetchSupabase<any[]>('posts?select=id'),
    fetchSupabase<any[]>('authors?select=*')
  ]);

  const allIds = (Array.isArray(idRows) ? idRows : []).map(r => r.id).filter(id => id !== null && id !== undefined);
  const authors = Array.isArray(authorsData) ? authorsData : [];

  if (allIds.length === 0) {
    return NextResponse.json({ questions: [], total: 0 });
  }

  const targetCount = mode === 'blitz' ? 10 : mode === 'survival' ? 50 : 100;
  let pickedIds: string[] = [];
  while (pickedIds.length < targetCount && allIds.length > 0) {
    const needed = targetCount - pickedIds.length;
    const chunk = shuffle(allIds);
    pickedIds.push(...chunk.slice(0, needed));
  }

  const uniqueIds = Array.from(new Set(pickedIds));
  const inList = uniqueIds.join(',');
  const postsData = await fetchSupabase<any[]>(`posts?id=in.(${inList})&select=*`);
  const postsById = new Map((Array.isArray(postsData) ? postsData : []).map(p => [p.id, p]));
  const selectedPosts = pickedIds.map(id => postsById.get(id)).filter(Boolean);

  if (selectedPosts.length === 0) {
    return NextResponse.json({ questions: [], total: 0 });
  }

  const questions = selectedPosts.map((post, index) => {
    const correctAuthorId = post.correct_author_id;
    const correctAuthor = authors.find(a => a.id === correctAuthorId) || {
      id: correctAuthorId,
      name: correctAuthorId,
      handle: '@' + correctAuthorId,
      avatar_color: 'linear-gradient(135deg, #0288d1, #26c6da)',
      avatar_text: '?'
    };

    const otherAuthors = authors.filter(a => a.id !== correctAuthorId);
    const shuffledOthers = [...otherAuthors].sort(() => Math.random() - 0.5);
    const distractors = shuffledOthers.slice(0, 3);

    while (distractors.length < 3) {
      distractors.push({
        id: `unknown_${distractors.length}`,
        name: `Автор ${distractors.length + 1}`,
        handle: `@author_${distractors.length + 1}`,
        avatar_color: 'linear-gradient(135deg, #7c3aed, #ec4899)',
        avatar_text: '?'
      });
    }

    const options = [correctAuthor, ...distractors]
      .sort(() => Math.random() - 0.5)
      .map(a => ({
        id: a.id,
        name: a.name,
        handle: a.handle,
        avatarColor: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #3b82f6, #06b6d4)',
        avatarText: a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?'),
        verified: Boolean(a.verified)
      }));

    const elimIds = distractors.slice(0, 2).map(d => d.id);
    const qid = `${post.id}_${index}`;
    const qToken = createQuestionToken(post.id, correctAuthorId, elimIds, qid);

    return {
      id: post.id,
      postText: post.post_text || '',
      screenshot: post.screenshot || '',
      hint: post.hint || '',
      difficulty: post.difficulty || 'normal',
      tags: post.tags || [],
      options,
      qToken
    };
  });

  const sessionId = 's_' + crypto.randomBytes(12).toString('hex');
  const sessionData = {
    sid: sessionId,
    mode,
    score: 0,
    streak: 0,
    maxStreak: 0,
    correctCount: 0,
    totalCount: 0,
    answered: [],
    exp: Date.now() + 120 * 60 * 1000
  };
  const sessionToken = createSessionToken(sessionData);

  return NextResponse.json({ questions, total: questions.length, sessionToken });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'blitz';
    return await handleGetQuestions(mode);
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || new URL(req.url).searchParams.get('action') || 'check_answer';

    if (action === 'get_questions') {
      const mode = body.mode || 'blitz';
      return await handleGetQuestions(mode);
    }

    if (action === 'check_answer') {
      const { qToken, selectedAuthorId, sessionToken, timeLeft, hintUsed } = body;

      if (!qToken || !selectedAuthorId) {
        return NextResponse.json({ error: 'qToken and selectedAuthorId are required' }, { status: 400 });
      }

      const tokenData = verifyQuestionToken(qToken);
      if (!tokenData) {
        return NextResponse.json({ error: 'Invalid or expired question token' }, { status: 400 });
      }

      const selectedId = String(selectedAuthorId).trim();
      const isCorrect = safeEqual(createAnswerHash(tokenData.id, selectedId), tokenData.ansHash);

      let updatedSessionToken: string | null = null;
      let serverScore: number | null = null;
      let serverStreak: number | null = null;
      let pointsEarned = 0;

      if (sessionToken) {
        const session = verifySessionToken(sessionToken);
        if (session && !session.submitted) {
          if (!Array.isArray(session.answered)) session.answered = [];
          const questionKey = tokenData.qid || tokenData.id;
          if (!session.answered.includes(questionKey)) {
            session.answered.push(questionKey);
            session.totalCount = (session.totalCount || 0) + 1;

            if (isCorrect) {
              session.correctCount = (session.correctCount || 0) + 1;
              session.streak = (session.streak || 0) + 1;
              if (session.streak > (session.maxStreak || 0)) {
                session.maxStreak = session.streak;
              }
              const safeTimeLeft = Math.max(0, Math.min(20, Number(timeLeft) || 0));
              const speedBonus = Math.round((safeTimeLeft / 20) * 50);
              const hintPen = Boolean(hintUsed) ? 30 : 0;
              let mult = 1.0;
              if (session.streak >= 8) mult = 3.0;
              else if (session.streak >= 5) mult = 2.0;
              else if (session.streak >= 3) mult = 1.5;
              pointsEarned = Math.max(20, Math.round((100 + speedBonus - hintPen) * mult));
              session.score = (session.score || 0) + pointsEarned;
            } else {
              session.streak = 0;
              pointsEarned = 0;
            }
          }
          updatedSessionToken = createSessionToken(session);
          serverScore = session.score;
          serverStreak = session.streak;
        }
      }

      let correctAuthorId: string | null = isCorrect ? selectedId : null;
      if (!isCorrect) {
        try {
          const rows = await fetchSupabase<any[]>(`posts?id=eq.${encodeURIComponent(tokenData.id)}&select=correct_author_id`);
          if (Array.isArray(rows) && rows.length > 0) {
            correctAuthorId = rows[0].correct_author_id;
          }
        } catch {}
      }

      let authorInfo: any = null;
      if (correctAuthorId) {
        try {
          const authors = await fetchSupabase<any[]>(`authors?id=eq.${encodeURIComponent(correctAuthorId)}&select=*`);
          if (Array.isArray(authors) && authors.length > 0) {
            const a = authors[0];
            authorInfo = {
              id: a.id,
              name: a.name,
              handle: a.handle,
              avatarColor: a.avatar_color,
              avatarText: a.avatar_text,
              badge: a.badge,
              bio: a.bio,
              verified: a.verified
            };
          }
        } catch {}

        if (!authorInfo) {
          authorInfo = {
            id: correctAuthorId,
            name: correctAuthorId,
            handle: '@' + correctAuthorId,
            bio: 'Автор ИТД'
          };
        }
      }

      return NextResponse.json({
        isCorrect,
        pointsEarned,
        correctAuthorId,
        correctAuthor: authorInfo,
        sessionToken: updatedSessionToken || sessionToken || null,
        serverScore,
        serverStreak
      });
    }

    if (action === 'submit_score') {
      const { sessionToken, nickname } = body;

      if (!sessionToken) {
        return NextResponse.json({ error: 'Session token is required' }, { status: 400 });
      }

      const session = verifySessionToken(sessionToken);
      if (!session) {
        return NextResponse.json({ error: 'Invalid or expired session' }, { status: 400 });
      }

      if (session.submitted) {
        return NextResponse.json({ error: 'Session already submitted' }, { status: 400 });
      }

      if (!session.totalCount || session.totalCount < 1) {
        return NextResponse.json({ error: 'No answers recorded in session' }, { status: 400 });
      }

      session.submitted = true;
      const percent = Math.round((session.correctCount / session.totalCount) * 100);
      const cleanNick = (String(nickname || 'Аноним').trim() || 'Аноним').slice(0, 32);

      const record = {
        nickname: cleanNick,
        score: Number(session.score) || 0,
        streak: Number(session.maxStreak) || 0,
        accuracy: percent,
        mode: session.mode || 'blitz'
      };

      await fetchSupabase('leaderboard', {
        method: 'POST',
        body: record
      });

      return NextResponse.json({
        ok: true,
        score: record.score,
        streak: record.streak,
        accuracy: percent,
        record
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
