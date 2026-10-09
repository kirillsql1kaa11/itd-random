const DEFAULT_APP_URL = 'https://itd-random.vercel.app';

function normalizeOrigin(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    try {
        const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        return new URL(withProto).origin.toLowerCase();
    } catch {
        return '';
    }
}

function getAllowedOrigins() {
    const list = new Set();
    const def = normalizeOrigin(DEFAULT_APP_URL);
    if (def) list.add(def);

    if (process.env.APP_URL) {
        const parts = String(process.env.APP_URL).split(/[\s,]+/);
        for (const part of parts) {
            const norm = normalizeOrigin(part);
            if (norm) list.add(norm);
        }
    }
    return Array.from(list);
}

function applyCors(req, res) {
    const origin = req.headers['origin'];
    const referer = req.headers['referer'] || req.headers['referrer'];
    const secFetchSite = req.headers['sec-fetch-site'];
    const allowed = getAllowedOrigins();

    res.setHeader('Vary', 'Origin');

    if (origin) {
        const normOrigin = normalizeOrigin(origin);
        if (!normOrigin || !allowed.includes(normOrigin)) {
            res.status(403).json({ error: 'Origin not allowed' });
            return true;
        }
        res.setHeader('Access-Control-Allow-Origin', normOrigin);
    } else {
        if (referer) {
            const refOrigin = normalizeOrigin(referer);
            if (refOrigin && !allowed.includes(refOrigin)) {
                res.status(403).json({ error: 'Origin not allowed' });
                return true;
            }
        }
        if (secFetchSite === 'cross-site') {
            res.status(403).json({ error: 'Origin not allowed' });
            return true;
        }
        if (allowed.length > 0) {
            res.setHeader('Access-Control-Allow-Origin', allowed[0]);
        }
    }

    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}

function getClientIp(req) {
    const h = req.headers || {};
    const raw = h['x-real-ip'] || h['x-vercel-forwarded-for'] || h['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown';
    return String(raw).split(',')[0].trim() || 'unknown';
}

module.exports = { applyCors, getClientIp };
