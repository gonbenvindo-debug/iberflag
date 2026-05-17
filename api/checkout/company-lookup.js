const { applyRateLimit, readJsonBody, sendJson } = require('../../lib/server/http');
const {
    normalizeLookupCountry,
    normalizeLookupPostalCode,
    resolvePostalLookup
} = require('../../lib/server/postal-lookup');

async function handlePostalLookup(req, res, requestUrl) {
    if (!applyRateLimit(req, res, {
        key: 'checkout-postal-lookup',
        windowMs: 5 * 60 * 1000,
        max: 60,
        message: 'Demasiadas pesquisas de codigo postal. Aguarde um pouco e tente novamente.'
    })) {
        return;
    }

    try {
        const country = requestUrl.searchParams.get('country') || '';
        const postalCode = requestUrl.searchParams.get('postalCode') || '';
        const result = await resolvePostalLookup({ country, postalCode });

        sendJson(res, 200, result, {
            'Cache-Control': 'private, max-age=300'
        });
    } catch (error) {
        const statusCode = Number(error?.statusCode || 500);
        const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
        if (safeStatusCode === 404) {
            const country = normalizeLookupCountry(requestUrl.searchParams.get('country') || '');
            const postalCode = normalizeLookupPostalCode(requestUrl.searchParams.get('postalCode') || '', country);
            sendJson(res, 200, {
                found: false,
                country,
                postalCode,
                region: '',
                municipality: '',
                city: '',
                message: 'Codigo postal nao encontrado.'
            }, {
                'Cache-Control': 'private, max-age=300'
            });
            return;
        }

        sendJson(res, safeStatusCode, {
            error: error?.message || 'POSTAL_LOOKUP_FAILED',
            message: safeStatusCode === 404
                ? 'Nao foi possivel encontrar este codigo postal.'
                : safeStatusCode === 400
                    ? 'Introduza um codigo postal valido.'
                    : 'Nao foi possivel validar o codigo postal agora.'
        });
    }
}

module.exports = async function checkoutCompanyLookupHandler(req, res) {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const lookupMode = String(requestUrl.searchParams.get('mode') || '').trim().toLowerCase();
    if (req.method === 'GET' && lookupMode === 'postal') {
        await handlePostalLookup(req, res, requestUrl);
        return;
    }

    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
        return;
    }

    if (!applyRateLimit(req, res, {
        key: 'checkout-company-lookup',
        windowMs: 5 * 60 * 1000,
        max: 24,
        message: 'Demasiadas pesquisas de NIF. Aguarde um pouco e tente novamente.'
    })) {
        return;
    }

    try {
        await readJsonBody(req);

        sendJson(res, 200, {
            found: false,
            source: 'disabled',
            sourceLabel: 'disabled',
            vatValidation: {
                status: 'not_required',
                source: 'disabled',
                message: ''
            }
        });
    } catch (error) {
        console.error('Checkout company lookup failed:', error);
        sendJson(res, 500, {
            error: 'COMPANY_LOOKUP_FAILED',
            message: 'Nao foi possivel procurar a empresa pelo NIF neste momento.'
        });
    }
};
