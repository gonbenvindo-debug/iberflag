const ALLOWED_HOSTS = new Set([
    'cdn.pixabay.com',
    'pixabay.com',
    'www.pixabay.com'
]);

const {
    applyRateLimit,
    sendJson,
    setSecurityHeaders
} = require('../lib/server/http');

module.exports = async function pixabayImageHandler(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        return;
    }

    if (!applyRateLimit(req, res, {
        key: 'pixabay-image',
        windowMs: 60 * 1000,
        max: 30,
        message: 'Demasiados pedidos de imagem. Aguarde um pouco e volte a tentar.'
    })) {
        return;
    }

    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const rawUrl = requestUrl.searchParams.get('url');
    if (!rawUrl) {
        sendJson(res, 400, { error: 'Missing image url' });
        return;
    }

    let targetUrl;
    try {
        targetUrl = new URL(String(rawUrl));
    } catch {
        sendJson(res, 400, { error: 'Invalid image url' });
        return;
    }

    if (targetUrl.protocol !== 'https:') {
        sendJson(res, 400, { error: 'Image protocol is not allowed' });
        return;
    }

    if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
        sendJson(res, 400, { error: 'Image host is not allowed' });
        return;
    }

    try {
        const upstream = await fetch(targetUrl.toString(), {
            headers: {
                Accept: 'image/*'
            }
        });

        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            sendJson(res, upstream.status, {
                error: text || `Unable to fetch image (${upstream.status})`
            });
            return;
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const contentLength = Number(upstream.headers.get('content-length') || '0');

        if (!contentType.toLowerCase().startsWith('image/')) {
            sendJson(res, 415, { error: 'Upstream response is not an image' });
            return;
        }

        if (contentLength > 25 * 1024 * 1024) {
            sendJson(res, 413, { error: 'Image too large' });
            return;
        }

        const bytes = await upstream.arrayBuffer();
        if (bytes.byteLength > 25 * 1024 * 1024) {
            sendJson(res, 413, { error: 'Image too large' });
            return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        setSecurityHeaders(res);
        res.end(Buffer.from(bytes));
    } catch (error) {
        sendJson(res, 500, {
            error: error?.message || 'Unexpected Pixabay image error'
        });
    }
};
