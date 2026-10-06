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
            
            const [postsData, authorsData] = await Promise.all([
                fetchSupabase('posts?select=*&order=created_at.desc'),
                fetchSupabase('authors?select=*')
            ]);

            const posts = Array.isArray(postsData) ? postsData : [];
            const authors = Array.isArray(authorsData) ? authorsData : [];

            if (posts.length === 0) {
                return res.status(200).json({ questions: [], total: 0 });
            }

            const shuffledPosts = [...posts].sort(() => Math.random() - 0.5);
            const selectedPosts = mode === 'blitz' ? shuffledPosts.slice(0, 10) : shuffledPosts;

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

            return res.status(200).json({ questions, total: questions.length });
        }

        if (action === 'check_answer' || req.method === 'POST') {
            const body = req.body || {};
            const { qToken, selectedAuthorId } = body;

            if (!qToken || !selectedAuthorId) {
                return res.status(400).json({ error: 'qToken and selectedAuthorId are required' });
            }

            const tokenData = verifyQuestionToken(qToken);
            if (!tokenData) {
                return res.status(400).json({ error: 'Invalid or expired question token' });
            }

            const selectedId = String(selectedAuthorId).trim();
            const isCorrect = safeEqual(createAnswerHash(tokenData.id, selectedId), tokenData.ansHash);

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
                correctAuthorId,
                correctAuthor: authorInfo
            });
        }

        res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
};
