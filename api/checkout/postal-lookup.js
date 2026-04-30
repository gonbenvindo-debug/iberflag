const { applyRateLimit, sendJson } = require('../../lib/server/http');
const { resolvePostalLookup } = require('../../lib/server/postal-lookup');

module.exports = async function checkoutPostalLookupHandler(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        return;
    }

    if (!applyRateLimit(req, res, {
        key: 'checkout-postal-lookup',
        windowMs: 5 * 60 * 1000,
        max: 60,
        message: 'Demasiadas pesquisas de codigo postal. Aguarde um pouco e tente novamente.'
    })) {
        return;
    }

    try {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const country = requestUrl.searchParams.get('country') || '';
        const postalCode = requestUrl.searchParams.get('postalCode') || '';
        const result = await resolvePostalLookup({ country, postalCode });

        sendJson(res, 200, result, {
            'Cache-Control': 'public, max-age=86400, s-maxage=86400'
        });
    } catch (error) {
        const statusCode = Number(error?.statusCode || 500);
        const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
        sendJson(res, safeStatusCode, {
            error: error?.message || 'POSTAL_LOOKUP_FAILED',
            message: safeStatusCode === 404
                ? 'Nao foi possivel encontrar este codigo postal.'
                : safeStatusCode === 400
                    ? 'Introduza um codigo postal valido.'
                    : 'Nao foi possivel validar o codigo postal agora.'
        });
    }
};
