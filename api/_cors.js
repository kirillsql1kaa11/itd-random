const DEFAULT_APP_URL = 'https://itd-random.vercel.app';

function normalizeOrigin(value) {
    if (!value) return '';
    try {
        return new URL(String(value).trim()).origin;
    } catch {
        return '';
    }
}

function getAllowedOrigins() {
    const list = [normalizeOrigin(DEFAULT_APP_URL)];
    const fromEnv = normalizeOrigin(process.env.APP_URL);
    if (fromEnv) list.push(fromEnv);
    return list;
}

/**
 * Applies CORS headers and rejects unauthorized Origins.
 * Returns true if the request was fully handled (rejected or preflight).
 * Requests without an Origin header (same-origin GET, server-to-server) pass through.
 */
function applyCors(req, res) {
    const origin = req.headers['origin'];
    const allowed = getAllowedOrigins();

    res.setHeader('Vary', 'Origin');

    if (origin) {
        if (!allowed.includes(normalizeOrigin(origin))) {
            res.status(403).json({ error: 'Origin not allowed' });
            return true;
        }
        res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
    }

    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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
