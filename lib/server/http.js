function sendJson(res, statusCode, payload, extraHeaders = {}) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    Object.entries(extraHeaders || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            res.setHeader(key, String(value));
        }
    });

    res.end(JSON.stringify(payload));
}

function getHeaderValue(req, name) {
    if (!req?.headers) return '';
    const value = req.headers[name] || req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : String(value || '');
}

function getRequestOrigin(req) {
    const configured = String(process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || '').trim();
    if (configured) {
        return configured.startsWith('http') ? configured.replace(/\/+$/, '') : `https://${configured.replace(/\/+$/, '')}`;
    }

    const proto = getHeaderValue(req, 'x-forwarded-proto') || 'https';
    const host = getHeaderValue(req, 'x-forwarded-host') || getHeaderValue(req, 'host') || 'localhost:3000';
    return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`.replace(/\/+$/, '');
}

function getPublicBaseUrl(req) {
    return getRequestOrigin(req);
}

async function readRawBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';

        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            raw += chunk;

            if (raw.length > 2 * 1024 * 1024) {
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
    getPublicBaseUrl,
    readJsonBody,
    readRawBody,
    sendJson
};
