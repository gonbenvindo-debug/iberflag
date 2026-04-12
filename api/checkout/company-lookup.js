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

module.exports = async function checkoutCompanyLookupHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
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
