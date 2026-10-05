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
            'Prefer': options.prefer || 'return=representation',
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

function createAdminToken() {
    const payload = Buffer.from(JSON.stringify({
        role: 'admin',
        iat: Date.now(),
        exp: Date.now() + 24 * 60 * 60 * 1000
    })).toString('base64url');

    const sig = createHmacHash(payload);
    return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 2) return false;
    const [payloadStr, sig] = parts;
    const expectedSig = createHmacHash(payloadStr);

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        return false;
    }

    try {
        const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
        if (Date.now() > data.exp || data.role !== 'admin') return false;
        return true;
    } catch {
        return false;
    }
}

async function getStoredAdminPassword() {
    try {
        const data = await fetchSupabase('admin_settings?key=eq.admin_password&select=value');
        if (Array.isArray(data) && data.length > 0 && data[0].value) {
            return String(data[0].value).trim();
        }
    } catch (e) {
        console.warn(e);
    }
    return process.env.ADMIN_PASSWORD || null;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const action = req.query.action || (req.body && req.body.action);
    const authHeader = req.headers['authorization'] || '';

    if (action === 'login') {
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const candidate = String(password).trim();
        const stored = await getStoredAdminPassword();

        if (!stored) {
            return res.status(500).json({ error: 'Password not configured' });
        }

        const candidateHash = crypto.createHash('sha256').update(candidate).digest('hex');
        const isMatch = (candidate === stored) || (candidateHash === stored);

        if (!isMatch) {
            await new Promise(r => setTimeout(r, 600));
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        const token = createAdminToken();
        return res.status(200).json({
            ok: true,
            token,
            message: 'Авторизация успешна'
        });
    }

    if (action === 'verify') {
        const token = (req.body && req.body.token) || authHeader;
        const valid = verifyAdminToken(token);
        return res.status(200).json({ valid });
    }

    const token = (req.body && req.body.adminToken) || authHeader;
    if (!verifyAdminToken(token)) {
        return res.status(401).json({ error: 'Требуется авторизация администратора' });
    }

    try {
        if (action === 'save_post') {
            const { post } = req.body || {};
            if (!post || !post.screenshot || !post.correctAuthorId) {
                return res.status(400).json({ error: 'Invalid post data' });
            }

            const record = {
                id: post.id || ('post_' + Date.now()),
                correct_author_id: post.correctAuthorId,
                post_text: post.postText || '',
                screenshot: post.screenshot,
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

            return res.status(200).json({ ok: true, post: record });
        }

        if (action === 'delete_post') {
            const { id } = req.body || {};
            if (!id) return res.status(400).json({ error: 'Post ID required' });

            await fetchSupabase(`posts?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });

            return res.status(200).json({ ok: true });
        }

        if (action === 'save_author') {
            const { author } = req.body || {};
            if (!author || !author.name) {
                return res.status(400).json({ error: 'Invalid author data' });
            }

            const record = {
                id: author.id,
                name: author.name,
                handle: author.handle,
                avatar_color: author.avatarColor || author.avatar_color,
                avatar_text: author.avatarText || author.avatar_text,
                badge: author.badge || null,
                bio: author.bio || null,
                verified: Boolean(author.verified)
            };

            await fetchSupabase('authors', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: record
            });

            return res.status(200).json({ ok: true, author: record });
        }

        if (action === 'delete_author') {
            const { id } = req.body || {};
            if (!id) return res.status(400).json({ error: 'Author ID required' });

            await fetchSupabase(`authors?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });

            return res.status(200).json({ ok: true });
        }

        if (action === 'change_password') {
            const { newPassword } = req.body || {};
            if (!newPassword || newPassword.trim().length < 3) {
                return res.status(400).json({ error: 'Password too short' });
            }

            const val = newPassword.trim();
            await fetchSupabase('admin_settings', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: {
                    key: 'admin_password',
                    value: val,
                    updated_at: new Date().toISOString()
                }
            });

            return res.status(200).json({ ok: true, message: 'Пароль администратора обновлен' });
        }

        if (action === 'moderate_post') {
            const { id, status, postRecord } = req.body || {};
            if (!id) return res.status(400).json({ error: 'Suggestion ID required' });

            if (status === 'approved' && postRecord) {
                await fetchSupabase('posts', {
                    method: 'POST',
                    prefer: 'resolution=merge-duplicates',
                    body: {
                        id: postRecord.id || ('post_' + Date.now()),
                        correct_author_id: postRecord.correctAuthorId,
                        post_text: postRecord.postText || '',
                        screenshot: postRecord.screenshot,
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
            } catch (e) {
                await fetchSupabase(`suggestions_posts?id=eq.${encodeURIComponent(id)}`, {
                    method: 'DELETE'
                });
            }

            return res.status(200).json({ ok: true });
        }

        if (action === 'moderate_author') {
            const { id, status, authorRecord } = req.body || {};
            if (!id) return res.status(400).json({ error: 'Author suggestion ID required' });

            if (status === 'approved' && authorRecord) {
                await fetchSupabase('authors', {
                    method: 'POST',
                    prefer: 'resolution=merge-duplicates',
                    body: {
                        id: authorRecord.id,
                        name: authorRecord.name,
                        handle: authorRecord.handle,
                        avatar_color: authorRecord.avatarColor,
                        avatar_text: authorRecord.avatarText,
                        badge: authorRecord.badge || 'Автор ИТД',
                        bio: authorRecord.bio || null,
                        verified: Boolean(authorRecord.verified)
                    }
                });
            }

            try {
                await fetchSupabase(`suggestions_authors?id=eq.${encodeURIComponent(id)}`, {
                    method: 'PATCH',
                    body: { status }
                });
            } catch (e) {
                await fetchSupabase(`suggestions_authors?id=eq.${encodeURIComponent(id)}`, {
                    method: 'DELETE'
                });
            }

            return res.status(200).json({ ok: true });
        }

        res.status(400).json({ error: `Unknown admin action: ${action}` });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
};
