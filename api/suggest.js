const https = require('https');
const { applyCors, getClientIp } = require('./_cors');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vwglpnluozdgnztasrrp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ffnMzR_piobvuDkt1VPzyw_dNQDLzdE';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_SCREENSHOT_CHARS = 1.5 * 1024 * 1024;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function insertSuggestion(record) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/suggestions_posts`);
        const payload = JSON.stringify(record);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Prefer': 'return=minimal'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve();
                else reject(new Error(`Supabase error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function isRateLimited(ip) {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    if (list.length >= RATE_LIMIT) {
        hits.set(ip, list);
        return true;
    }
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) {
        for (const [key, value] of hits) {
            if (!value.some(t => now - t < RATE_WINDOW_MS)) hits.delete(key);
        }
    }
    return false;
}

function str(value, max) {
    return typeof value === 'string' ? value.slice(0, max) : '';
}

module.exports = async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const declaredLength = parseInt(req.headers['content-length'] || '0', 10);
    if (declaredLength > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'Слишком большой запрос (максимум 2 МБ)' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid body' });
    }
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'Слишком большой запрос (максимум 2 МБ)' });
    }

    const screenshot = body.screenshot;
    if (typeof screenshot !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshot)) {
        return res.status(400).json({ error: 'Некорректный скриншот' });
    }
    if (screenshot.length > MAX_SCREENSHOT_CHARS) {
        return res.status(413).json({ error: 'Скриншот слишком большой' });
    }

    if (isRateLimited(getClientIp(req))) {
        res.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
        return res.status(429).json({ error: 'Слишком много предложений. Попробуйте позже.' });
    }

    const record = {
        author_id: str(body.author_id, 100) || null,
        author_name: str(body.author_name, 100) || 'Не указан',
        screenshot,
        post_text: str(body.post_text, 2000),
        submitted_by: str(body.submitted_by, 50) || 'Аноним',
        status: 'pending'
    };

    try {
        await insertSuggestion(record);
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: 'Не удалось сохранить предложение' });
    }
};

module.exports.config = {
    api: { bodyParser: { sizeLimit: '2mb' } }
};
