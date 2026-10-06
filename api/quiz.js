const https = require('https');
const crypto = require('crypto');

const SECRET = process.env.API_SECRET || 'a8f5e3d2c1b0987654321fedcba0123456789abcdef0123456789abcdef01234';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vwglpnluozdgnztasrrp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ffnMzR_piobvuDkt1VPzyw_dNQDLzdE';

function fetchSupabase(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const req = https.request(url, {
            method: options.method || 'GET',
            headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(data ? JSON.parse(data) : null);
                    } catch {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Supabase error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

function createHmacHash(text) {
    return crypto.createHmac('sha256', SECRET).update(text).digest('hex');
}

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (Buffer.byteLength(bufA) !== Buffer.byteLength(bufB)) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function createAnswerHash(postId, authorId) {
    return createHmacHash(`${postId}:${authorId}`);
}

function createQuestionToken(postId, correctAuthorId) {
    const payload = Buffer.from(JSON.stringify({
        id: postId,
        ansHash: createAnswerHash(postId, correctAuthorId),
        exp: Date.now() + 15 * 60 * 1000
    })).toString('base64url');

    const sig = createHmacHash(payload);
    return `${payload}.${sig}`;
}

function verifyQuestionToken(token) {
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

function createSessionToken(sessionData) {
    const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
    const sig = createHmacHash(`session:${payload}`);
    return `${payload}.${sig}`;
}

function verifySessionToken(token) {
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const action = req.query.action || (req.body && req.body.action) || 'get_questions';

    try {
        if (action === 'get_questions' || req.method === 'GET') {
            const mode = req.query.mode || 'blitz';
            
            const [idRows, authorsData] = await Promise.all([
                fetchSupabase('posts?select=id'),
                fetchSupabase('authors?select=*')
            ]);

            const allIds = (Array.isArray(idRows) ? idRows : []).map(r => r.id).filter(id => id !== null && id !== undefined);
            const authors = Array.isArray(authorsData) ? authorsData : [];

            if (allIds.length === 0) {
                return res.status(200).json({ questions: [], total: 0 });
            }

            const shuffledIds = shuffle(allIds);
            const pickedIds = mode === 'blitz' ? shuffledIds.slice(0, 10) : shuffledIds.slice(0, 25);

            const inList = pickedIds.join(',');
            const postsData = await fetchSupabase(`posts?id=in.(${inList})&select=*`);
            const postsById = new Map((Array.isArray(postsData) ? postsData : []).map(p => [p.id, p]));
            const selectedPosts = pickedIds.map(id => postsById.get(id)).filter(Boolean);

            if (selectedPosts.length === 0) {
                return res.status(200).json({ questions: [], total: 0 });
            }

            const questions = selectedPosts.map(post => {
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
                        avatarColor: a.avatar_color || a.avatarColor,
                        avatarText: a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?'),
                        verified: Boolean(a.verified)
                    }));

                const qToken = createQuestionToken(post.id, correctAuthorId);

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
                exp: Date.now() + 30 * 60 * 1000
            };
            const sessionToken = createSessionToken(sessionData);

            return res.status(200).json({ questions, total: questions.length, sessionToken });
        }

        if (action === 'check_answer' || req.method === 'POST') {
            const body = req.body || {};
            const { qToken, selectedAuthorId, sessionToken, timeLeft, hintUsed } = body;

            if (!qToken || !selectedAuthorId) {
                return res.status(400).json({ error: 'qToken and selectedAuthorId are required' });
            }

            const tokenData = verifyQuestionToken(qToken);
            if (!tokenData) {
                return res.status(400).json({ error: 'Invalid or expired question token' });
            }

            const selectedId = String(selectedAuthorId).trim();
            const isCorrect = safeEqual(createAnswerHash(tokenData.id, selectedId), tokenData.ansHash);

            let updatedSessionToken = null;
            let serverScore = null;
            let serverStreak = null;
            let pointsEarned = 0;

            if (sessionToken) {
                const session = verifySessionToken(sessionToken);
                if (session && !session.submitted) {
                    if (!Array.isArray(session.answered)) session.answered = [];
                    if (!session.answered.includes(tokenData.id)) {
                        session.answered.push(tokenData.id);
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

            let correctAuthorId = isCorrect ? selectedId : null;
            if (!isCorrect) {
                try {
                    const rows = await fetchSupabase(`posts?id=eq.${encodeURIComponent(tokenData.id)}&select=correct_author_id`);
                    if (Array.isArray(rows) && rows.length > 0) {
                        correctAuthorId = rows[0].correct_author_id;
                    }
                } catch (err) {
                    console.warn(err);
                }
            }

            let authorInfo = null;
            if (correctAuthorId) {
                try {
                    const authors = await fetchSupabase(`authors?id=eq.${encodeURIComponent(correctAuthorId)}&select=*`);
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
                } catch (err) {
                    console.warn(err);
                }

                if (!authorInfo) {
                    authorInfo = {
                        id: correctAuthorId,
                        name: correctAuthorId,
                        handle: '@' + correctAuthorId,
                        bio: 'Популярный автор в ИТД'
                    };
                }
            }

            return res.status(200).json({
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
            const body = req.body || {};
            const { sessionToken, nickname } = body;

            if (!sessionToken) {
                return res.status(400).json({ error: 'Session token is required' });
            }

            const session = verifySessionToken(sessionToken);
            if (!session) {
                return res.status(400).json({ error: 'Invalid or expired session' });
            }

            if (session.submitted) {
                return res.status(400).json({ error: 'Session already submitted' });
            }

            if (!session.totalCount || session.totalCount < 1) {
                return res.status(400).json({ error: 'No answers recorded in session' });
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

            return res.status(200).json({
                ok: true,
                score: record.score,
                streak: record.streak,
                accuracy: percent,
                record
            });
        }

        res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
};
