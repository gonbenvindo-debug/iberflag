const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { applyRateLimit, readJsonBody, sendJson } = require('../../lib/server/http');
const {
    buildCheckoutCustomerSnapshot,
    validateCheckoutCustomerType,
    validateCheckoutCustomerTaxId
} = require('../../lib/server/order-flow');
const { findCustomerByVatNumber } = require('../../lib/server/facturalusa');
const { normalizeCustomerType } = require('../../lib/server/checkout');
const { validateVatVies } = require('../../lib/server/vies');
const {
    normalizeLookupCountry,
    normalizeLookupPostalCode,
    resolvePostalLookup
} = require('../../lib/server/postal-lookup');

function pickString(source, keys) {
    for (const key of Array.isArray(keys) ? keys : []) {
        const value = String(source?.[key] || '').trim();
        if (value) {
            return value;
        }
    }

    return '';
}

function mapDatabaseCustomer(customer = {}) {
    return {
        empresa: String(customer.empresa || customer.nome || '').trim(),
        cidade: String(customer.cidade || '').trim(),
        tipo_cliente: normalizeCustomerType(customer.tipo_cliente, customer)
    };
}

function mapFacturalusaCustomer(customer = {}, normalizedTaxId = '') {
    const companyName = pickString(customer, [
        'name',
        'company',
        'company_name',
        'business_name',
        'description'
    ]);
    const city = pickString(customer, ['city', 'locality']);
    const vatNumber = pickString(customer, ['vat_number', 'vat', 'nif']) || normalizedTaxId;
    const rawType = pickString(customer, ['type']);

    return {
        empresa: companyName,
        cidade: city,
        tipo_cliente: normalizeCustomerType(rawType, {
            empresa: companyName,
            nif: vatNumber
        })
    };
}

async function findCustomerInDatabase(supabase, taxId) {
    const { data, error } = await supabase
        .from('clientes')
        .select('id,nome,empresa,cidade')
        .eq('nif', taxId)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

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
        const body = await readJsonBody(req);
        const customerSnapshot = buildCheckoutCustomerSnapshot({
            nif: body?.taxId || '',
            codigo_postal: body?.postalCode || '',
            tipo_cliente: body?.customerType || 'empresa',
            country: body?.country || ''
        });
        const customerTypeValidation = validateCheckoutCustomerType(customerSnapshot);
        if (!customerTypeValidation.valid || customerSnapshot.tipo_cliente !== 'empresa') {
            sendJson(res, 400, {
                error: 'COMPANY_LOOKUP_ONLY_FOR_BUSINESS',
                message: 'O preenchimento automatico por NIF so esta disponivel para faturacao empresarial.'
            });
            return;
        }

        const taxIdValidation = validateCheckoutCustomerTaxId(customerSnapshot);
        if (!taxIdValidation.valid || !taxIdValidation.normalized) {
            sendJson(res, 400, {
                error: 'NIF_INVALIDO',
                message: taxIdValidation.message || 'NIF invalido.'
            });
            return;
        }

        const vatValidation = await validateVatVies({
            countryCode: customerSnapshot.country,
            taxId: taxIdValidation.normalized,
            customerType: customerSnapshot.tipo_cliente
        });

        const supabase = getSupabaseAdmin();
        const databaseCustomer = await findCustomerInDatabase(supabase, taxIdValidation.normalized);
        if (databaseCustomer) {
            sendJson(res, 200, {
                found: true,
                source: 'database',
                sourceLabel: 'registos da loja',
                customer: mapDatabaseCustomer(databaseCustomer),
                vatValidation
            });
            return;
        }

        try {
            const facturalusaCustomer = await findCustomerByVatNumber(taxIdValidation.normalized);
            if (facturalusaCustomer?.id || facturalusaCustomer?.code || facturalusaCustomer?.name) {
                sendJson(res, 200, {
                    found: true,
                    source: 'facturalusa',
                    sourceLabel: 'Facturalusa',
                    customer: mapFacturalusaCustomer(facturalusaCustomer, taxIdValidation.normalized),
                    vatValidation
                });
                return;
            }
        } catch (facturalusaError) {
            console.warn('Facturalusa company lookup failed:', facturalusaError);
        }

        sendJson(res, 200, {
            found: false,
            source: 'none',
            vatValidation
        });
    } catch (error) {
        console.error('Checkout company lookup failed:', error);
        sendJson(res, 500, {
            error: 'COMPANY_LOOKUP_FAILED',
            message: 'Nao foi possivel procurar a empresa pelo NIF neste momento.'
        });
    }
};
