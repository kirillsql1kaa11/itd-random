const https = require('https');
const crypto = require('crypto');
const { applyCors, getClientIp } = require('./_cors');

const MAX_FAILED_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const memoryAttempts = new Map();

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

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (Buffer.byteLength(bufA) !== Buffer.byteLength(bufB)) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function passwordFingerprint(storedPassword) {
    return createHmacHash(`pwf:${storedPassword}`).slice(0, 32);
}

function createAdminToken(storedPassword) {
    const payload = Buffer.from(JSON.stringify({
        role: 'admin',
        iat: Date.now(),
        pwf: passwordFingerprint(storedPassword),
        exp: Date.now() + 24 * 60 * 60 * 1000
    })).toString('base64url');

    const sig = createHmacHash(payload);
    return `${payload}.${sig}`;
}

async function verifyAdminToken(token) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 2) return false;
    const [payloadStr, sig] = parts;
    const expectedSig = createHmacHash(payloadStr);

    if (!safeEqual(sig, expectedSig)) {
        return false;
    }

    let data;
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

const ITD_HOST = 'xn--d1ah4a.com';
const ITD_MAX_JSON = 1024 * 1024;
const ITD_MAX_IMAGE = 3 * 1024 * 1024;

function isItdHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    return h === ITD_HOST || h.endsWith('.' + ITD_HOST);
}

function parseItdPostUrl(raw) {
    let u;
    try { u = new URL(String(raw || '').trim()); } catch { return null; }
    if (u.protocol !== 'https:' || !isItdHost(u.hostname)) return null;
    const m = u.pathname.match(/^\/@([^/]+)\/post\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (!m) return null;
    return { handle: decodeURIComponent(m[1]), id: m[2].toLowerCase() };
}

function itdGet(urlStr, headers, maxBytes) {
    return new Promise((resolve, reject) => {
        const req = https.get(new URL(urlStr), { headers, timeout: 10000 }, (res) => {
            const chunks = [];
            let size = 0;
            res.on('data', (c) => {
                size += c.length;
                if (size > maxBytes) {
                    req.destroy(new Error('Response too large'));
                    return;
                }
                chunks.push(c);
            });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on('timeout', () => req.destroy(new Error('Timeout')));
        req.on('error', reject);
    });
}

function pickMediaUrl(root) {
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

async function importItdPost(rawUrl, itdToken) {
    const parsed = parseItdPostUrl(rawUrl);
    if (!parsed) {
        return { status: 400, body: { error: 'Ссылка должна вести на пост ИТД: https://итд.com/@автор/post/<id>' } };
    }
    if (!itdToken || typeof itdToken !== 'string') {
        return { status: 400, body: { error: 'Укажите токен авторизации ИТД' } };
    }

    const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${itdToken.replace(/^Bearer\s+/i, '').trim()}`,
        'User-Agent': 'Mozilla/5.0 (itd-random admin import)'
    };

    const apiRes = await itdGet(`https://${ITD_HOST}/api/posts/${parsed.id}`, headers, ITD_MAX_JSON);
    if (apiRes.status === 401 || apiRes.status === 403) {
        return { status: 422, body: { error: 'ИТД отклонил токен (401/403). Обновите токен.' } };
    }
    if (apiRes.status === 404) {
        return { status: 404, body: { error: 'Пост не найден в ИТД' } };
    }
    if (apiRes.status < 200 || apiRes.status >= 300) {
        return { status: 502, body: { error: `ИТД вернул ошибку ${apiRes.status}` } };
    }

    let json;
    try { json = JSON.parse(apiRes.body.toString('utf-8')); } catch {
        return { status: 502, body: { error: 'Не удалось разобрать ответ ИТД' } };
    }

    const root = (json && (json.data || json.post)) || json || {};
    const author = root.author || root.user || root.owner || {};
    const result = {
        id: parsed.id,
        authorHandle: '@' + String(author.username || author.handle || author.login || parsed.handle).replace(/^@/, ''),
        authorName: author.displayName || author.display_name || author.name || author.nickname || author.username || parsed.handle,
        text: String(root.content || root.text || root.body || root.caption || '').slice(0, 2000),
        mediaUrl: null,
        screenshot: null,
        fields: Object.keys(root).slice(0, 40)
    };

    let mediaUrl = pickMediaUrl(root);
    if (mediaUrl) {
        try {
            mediaUrl = new URL(mediaUrl, `https://${ITD_HOST}`).toString();
            const mu = new URL(mediaUrl);
            if (mu.protocol === 'https:' && isItdHost(mu.hostname)) {
                result.mediaUrl = mediaUrl;
                const img = await itdGet(mediaUrl, { 'User-Agent': headers['User-Agent'] }, ITD_MAX_IMAGE);
                const ctype = String(img.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
                if (img.status === 200 && /^image\/(png|jpe?g|webp|gif)$/.test(ctype)) {
                    result.screenshot = `data:${ctype};base64,${img.body.toString('base64')}`;
                }
            }
        } catch (e) {
            result.mediaWarning = 'Не удалось скачать картинку: ' + e.message;
        }
    }

    return { status: 200, body: { ok: true, post: result } };
}

function rateKey(ip) {
    return 'rl_login:' + createHmacHash('ip:' + ip).slice(0, 32);
}

function pruneAttempts(list, now) {
    return (Array.isArray(list) ? list : []).filter(t => typeof t === 'number' && now - t < RATE_WINDOW_MS);
}

async function loadAttempts(ip) {
    const now = Date.now();
    let list = pruneAttempts(memoryAttempts.get(ip), now);
    try {
        const data = await fetchSupabase(`admin_settings?key=eq.${encodeURIComponent(rateKey(ip))}&select=value`);
        if (Array.isArray(data) && data[0] && data[0].value) {
            const remote = pruneAttempts(JSON.parse(data[0].value), now);
            if (remote.length > list.length) list = remote;
        }
    } catch (e) {
        console.warn('rate limit load failed', e.message);
    }
    return list;
}

async function saveAttempts(ip, list) {
    if (list.length) memoryAttempts.set(ip, list); else memoryAttempts.delete(ip);
    try {
        if (list.length) {
            await fetchSupabase('admin_settings?on_conflict=key', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: { key: rateKey(ip), value: JSON.stringify(list), updated_at: new Date().toISOString() }
            });
        } else {
            await fetchSupabase(`admin_settings?key=eq.${encodeURIComponent(rateKey(ip))}`, { method: 'DELETE' });
        }
    } catch (e) {
        console.warn('rate limit save failed', e.message);
    }
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    const action = req.query.action || (req.body && req.body.action);
    const authHeader = req.headers['authorization'] || '';

    if (action === 'login') {
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const ip = getClientIp(req);
        const attempts = await loadAttempts(ip);
        if (attempts.length >= MAX_FAILED_ATTEMPTS) {
            const retryAfter = Math.ceil((attempts[0] + RATE_WINDOW_MS - Date.now()) / 1000);
            res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
            return res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте позже.', retryAfter });
        }

        const candidate = String(password).trim();
        const stored = await getStoredAdminPassword();

        if (!stored) {
            return res.status(500).json({ error: 'Password not configured' });
        }

        const candidateHash = crypto.createHash('sha256').update(candidate).digest('hex');
        const isMatch = (candidate === stored) || (candidateHash === stored);

        if (!isMatch) {
            attempts.push(Date.now());
            await saveAttempts(ip, attempts);
            await new Promise(r => setTimeout(r, 600));
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        if (attempts.length) await saveAttempts(ip, []);

        const token = createAdminToken(stored);
        return res.status(200).json({
            ok: true,
            token,
            message: 'Авторизация успешна'
        });
    }

    if (action === 'verify') {
        const token = (req.body && req.body.token) || authHeader;
        const valid = await verifyAdminToken(token);
        return res.status(200).json({ valid });
    }

    const token = (req.body && req.body.adminToken) || authHeader;
    if (!(await verifyAdminToken(token))) {
        return res.status(401).json({ error: 'Требуется авторизация администратора' });
    }

    try {
        if (action === 'fetch_itd_post') {
            const { url, itdToken } = req.body || {};
            const out = await importItdPost(url, itdToken);
            return res.status(out.status).json(out.body);
        }

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
            await fetchSupabase('admin_settings?on_conflict=key', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: {
                    key: 'admin_password',
                    value: val,
                    updated_at: new Date().toISOString()
                }
            });

            return res.status(200).json({ ok: true, token: createAdminToken(val), message: 'Пароль администратора обновлен' });
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
