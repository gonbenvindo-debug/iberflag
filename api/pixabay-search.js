const PIXABAY_API_BASE = 'https://pixabay.com/api/';
const {
    applyRateLimit,
    sendJson,
    setSecurityHeaders
} = require('../lib/server/http');

const ALLOWED_IMAGE_HOSTS = new Set([
    'cdn.pixabay.com',
    'pixabay.com',
    'www.pixabay.com'
]);

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function normalizeQuery(value) {
    return String(value || '').trim().slice(0, 100);
}

function getRequestUrl(req) {
    return new URL(req.url || '/', 'http://localhost');
}

async function handleImageProxy(req, res, requestUrl) {
    if (!applyRateLimit(req, res, {
        key: 'pixabay-image',
        windowMs: 60 * 1000,
        max: 30,
        message: 'Demasiados pedidos de imagem. Aguarde um pouco e volte a tentar.'
    })) {
        return;
    }

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

    if (!ALLOWED_IMAGE_HOSTS.has(targetUrl.hostname)) {
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
}

async function handleSearch(req, res, requestUrl) {
    if (!applyRateLimit(req, res, {
        key: 'pixabay-search',
        windowMs: 60 * 1000,
        max: 30,
        message: 'Demasiadas pesquisas de imagens. Aguarde um pouco e volte a tentar.'
    })) {
        return;
    }

    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) {
        sendJson(res, 500, {
            error: 'PIXABAY_API_KEY not configured',
            message: 'Set PIXABAY_API_KEY in your Vercel or local environment.'
        });
        return;
    }

    const query = normalizeQuery(requestUrl.searchParams.get('q'));
    const page = clampInteger(requestUrl.searchParams.get('page'), 1, 1, 50);
    const perPage = clampInteger(requestUrl.searchParams.get('per_page'), 12, 3, 50);
    const imageType = ['photo', 'illustration', 'vector'].includes(String(requestUrl.searchParams.get('image_type') || 'photo'))
        ? String(requestUrl.searchParams.get('image_type') || 'photo')
        : 'photo';
    const order = String(requestUrl.searchParams.get('order') || 'popular') === 'latest' ? 'latest' : 'popular';
    const orientation = String(requestUrl.searchParams.get('orientation') || 'all');
    const category = String(requestUrl.searchParams.get('category') || '').trim();

    try {
        const searchUrl = new URL(PIXABAY_API_BASE);
        searchUrl.searchParams.set('key', apiKey);
        if (query) {
            searchUrl.searchParams.set('q', query);
        }
        searchUrl.searchParams.set('lang', 'pt');
        searchUrl.searchParams.set('image_type', imageType);
        searchUrl.searchParams.set('orientation', orientation);
        searchUrl.searchParams.set('order', order);
        searchUrl.searchParams.set('safesearch', 'true');
        searchUrl.searchParams.set('page', String(page));
        searchUrl.searchParams.set('per_page', String(perPage));
        if (category) {
            searchUrl.searchParams.set('category', category);
        }

        const upstream = await fetch(searchUrl.toString(), {
            headers: {
                Accept: 'application/json'
            }
        });

        const text = await upstream.text();
        let payload = {};
        try {
            payload = text ? JSON.parse(text) : {};
        } catch {
            payload = null;
        }

        if (!upstream.ok) {
            sendJson(res, upstream.status, {
                error: payload?.error || payload?.message || text || 'Pixabay search failed'
            }, {
                'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400'
            });
            return;
        }

        const hits = Array.isArray(payload?.hits)
            ? payload.hits.map((hit) => ({
                id: hit.id,
                pageURL: hit.pageURL,
                previewURL: hit.previewURL,
                webformatURL: hit.webformatURL,
                largeImageURL: hit.largeImageURL,
                imageWidth: hit.imageWidth,
                imageHeight: hit.imageHeight,
                tags: hit.tags,
                user: hit.user,
                userImageURL: hit.userImageURL,
                views: hit.views,
                downloads: hit.downloads,
                likes: hit.likes,
                comments: hit.comments
            }))
            : [];

        sendJson(res, upstream.status, {
            total: Number(payload?.total || 0),
            totalHits: Number(payload?.totalHits || 0),
            hits
        }, {
            'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400'
        });
    } catch (error) {
        sendJson(res, 500, {
            error: error?.message || 'Unexpected Pixabay search error'
        });
    }
}

module.exports = async function pixabaySearchHandler(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        return;
    }

    const requestUrl = getRequestUrl(req);
    const mode = String(requestUrl.searchParams.get('mode') || '').trim().toLowerCase();

    if (mode === 'image') {
        await handleImageProxy(req, res, requestUrl);
        return;
    }

    await handleSearch(req, res, requestUrl);
};
