const ALLOWED_HOSTS = new Set([
    'cdn.pixabay.com',
    'pixabay.com',
    'www.pixabay.com'
]);

module.exports = async function pixabayImageHandler(req, res) {
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const rawUrl = requestUrl.searchParams.get('url');
    if (!rawUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Missing image url' }));
        return;
    }

    let targetUrl;
    try {
        targetUrl = new URL(String(rawUrl));
    } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Invalid image url' }));
        return;
    }

    if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Image host is not allowed' }));
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
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
                error: text || `Unable to fetch image (${upstream.status})`
            }));
            return;
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const contentLength = Number(upstream.headers.get('content-length') || '0');

        if (contentLength > 25 * 1024 * 1024) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Image too large' }));
            return;
        }

        const bytes = await upstream.arrayBuffer();
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.end(Buffer.from(bytes));
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            error: error?.message || 'Unexpected Pixabay image error'
        }));
    }
};
