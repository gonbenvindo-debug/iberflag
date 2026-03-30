const PIXABAY_API_BASE = 'https://pixabay.com/api/';

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function normalizeQuery(value) {
    return String(value || '').trim().slice(0, 100);
}

module.exports = async function pixabaySearchHandler(req, res) {
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            error: 'PIXABAY_API_KEY not configured',
            message: 'Set PIXABAY_API_KEY in your Vercel or local environment.'
        }));
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

        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400');

        if (!upstream.ok) {
            res.end(JSON.stringify({
                error: payload?.error || payload?.message || text || 'Pixabay search failed'
            }));
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

        res.end(JSON.stringify({
            total: Number(payload?.total || 0),
            totalHits: Number(payload?.totalHits || 0),
            hits
        }));
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            error: error?.message || 'Unexpected Pixabay search error'
        }));
    }
};
