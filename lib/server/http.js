const SECURITY_HEADERS = Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
});

const RATE_LIMIT_STORE = globalThis.__IBERFLAG_RATE_LIMIT_STORE__ || new Map();
globalThis.__IBERFLAG_RATE_LIMIT_STORE__ = RATE_LIMIT_STORE;

function setSecurityHeaders(res, extraHeaders = {}) {
    const headers = {
        ...SECURITY_HEADERS,
        ...(extraHeaders || {})
    };

    Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            res.setHeader(key, String(value));
        }
    });
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    setSecurityHeaders(res, extraHeaders);
    res.end(JSON.stringify(payload));
}

function getHeaderValue(req, name) {
    if (!req?.headers) return '';
    const value = req.headers[name] || req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : String(value || '');
}

function normalizeConfiguredOrigin(value) {
    const normalized = String(value || '').trim().replace(/\/+$/, '');
    if (!normalized) {
        return '';
    }

    return normalized.startsWith('http')
        ? normalized
        : `https://${normalized}`;
}

function isTrustedFallbackHost(host) {
    const normalizedHost = String(host || '').trim().split(',')[0].trim().toLowerCase();
    if (!normalizedHost) {
        return false;
    }

    return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedHost)
        || normalizedHost.endsWith('.vercel.app');
}

function getRequestOrigin(req) {
    const configured = normalizeConfiguredOrigin(
        process.env.PUBLIC_SITE_URL
        || process.env.NEXT_PUBLIC_SITE_URL
        || process.env.VERCEL_PROJECT_PRODUCTION_URL
        || process.env.VERCEL_URL
    );
    if (configured) {
        return configured;
    }

    const forwardedHost = getHeaderValue(req, 'x-forwarded-host');
    const host = getHeaderValue(req, 'host');
    const candidateHost = forwardedHost || host || 'localhost:3000';

    if (isTrustedFallbackHost(candidateHost)) {
        const normalizedHost = candidateHost.split(',')[0].trim();
        const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedHost)
            ? 'http'
            : 'https';
        return `${protocol}://${normalizedHost}`.replace(/\/+$/, '');
    }

    return 'http://localhost:3000';
}

function getPublicBaseUrl(req) {
    return getRequestOrigin(req);
}

function getClientIp(req) {
    const forwarded = getHeaderValue(req, 'x-forwarded-for');
    const realIp = getHeaderValue(req, 'x-real-ip');
    const remote = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';

    return String(forwarded || realIp || remote || 'unknown')
        .split(',')[0]
        .trim()
        .slice(0, 120);
}

function cleanupRateLimitStore(now) {
    for (const [key, entry] of RATE_LIMIT_STORE.entries()) {
        if (!entry || entry.expiresAt <= now) {
            RATE_LIMIT_STORE.delete(key);
        }
    }
}

function applyRateLimit(req, res, options = {}) {
    const now = Date.now();
    const windowMs = Math.max(1000, Number(options.windowMs || 60_000));
    const max = Math.max(1, Number(options.max || 30));
    const message = String(options.message || 'Demasiados pedidos. Tente novamente dentro de instantes.');
    const routeKey = String(options.key || req?.url || 'rate-limit');
    const clientKey = `${routeKey}:${getClientIp(req)}`;

    cleanupRateLimitStore(now);

    const existing = RATE_LIMIT_STORE.get(clientKey);
    if (!existing || existing.expiresAt <= now) {
        RATE_LIMIT_STORE.set(clientKey, {
            count: 1,
            expiresAt: now + windowMs
        });
        return true;
    }

    existing.count += 1;
    RATE_LIMIT_STORE.set(clientKey, existing);

    if (existing.count > max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
        sendJson(res, 429, {
            error: 'RATE_LIMITED',
            message
        }, {
            'Retry-After': retryAfterSeconds
        });
        return false;
    }

    return true;
}

async function readRawBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        const maxBytes = Number(process.env.REQUEST_BODY_MAX_BYTES || 8 * 1024 * 1024);

        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            raw += chunk;

            if (raw.length > maxBytes) {
                reject(new Error('REQUEST_BODY_TOO_LARGE'));
                req.destroy();
            }
        });

        req.on('end', () => resolve(raw));
        req.on('error', reject);
    });
}

async function readJsonBody(req) {
    const raw = await readRawBody(req);
    if (!raw || !raw.trim()) {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        const parseError = new Error('INVALID_JSON_BODY');
        parseError.cause = error;
        throw parseError;
    }
}

module.exports = {
    applyRateLimit,
    getPublicBaseUrl,
    getRequestOrigin,
    readJsonBody,
    readRawBody,
    setSecurityHeaders,
    sendJson
};
