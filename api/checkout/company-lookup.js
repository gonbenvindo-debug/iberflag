const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { applyRateLimit, readJsonBody, sendJson } = require('../../lib/server/http');
const {
    buildCheckoutCustomerSnapshot,
    validateCheckoutCustomerTaxId
} = require('../../lib/server/order-flow');
const { findCustomerByVatNumber } = require('../../lib/server/facturalusa');
const { normalizeCustomerType } = require('../../lib/server/checkout');

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
        nome: String(customer.nome || '').trim(),
        empresa: String(customer.empresa || customer.nome || '').trim(),
        email: String(customer.email || '').trim(),
        telefone: String(customer.telefone || '').trim(),
        nif: String(customer.nif || '').trim(),
        morada: String(customer.morada || '').trim(),
        codigo_postal: String(customer.codigo_postal || '').trim(),
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
    const phone = pickString(customer, ['mobile', 'telephone', 'phone']);
    const address = pickString(customer, ['address', 'address_1', 'street']);
    const postalCode = pickString(customer, ['postal_code', 'zip_code', 'zipcode']);
    const city = pickString(customer, ['city', 'locality']);
    const email = pickString(customer, ['email']);
    const vatNumber = pickString(customer, ['vat_number', 'vat', 'nif']) || normalizedTaxId;
    const rawType = pickString(customer, ['type']);

    return {
        nome: '',
        empresa: companyName,
        email,
        telefone: phone,
        nif: vatNumber,
        morada: address,
        codigo_postal: postalCode,
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
        .select('id,nome,email,telefone,empresa,nif,morada,codigo_postal,cidade')
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
            tipo_cliente: body?.customerType || 'empresa'
        });

        const taxIdValidation = validateCheckoutCustomerTaxId(customerSnapshot);
        if (!taxIdValidation.valid || !taxIdValidation.normalized) {
            sendJson(res, 400, {
                error: 'NIF_INVALIDO',
                message: taxIdValidation.message || 'NIF invalido.'
            });
            return;
        }

        const supabase = getSupabaseAdmin();
        const databaseCustomer = await findCustomerInDatabase(supabase, taxIdValidation.normalized);
        if (databaseCustomer) {
            sendJson(res, 200, {
                found: true,
                source: 'database',
                sourceLabel: 'registos da loja',
                customer: mapDatabaseCustomer(databaseCustomer)
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
                    customer: mapFacturalusaCustomer(facturalusaCustomer, taxIdValidation.normalized)
                });
                return;
            }
        } catch (facturalusaError) {
            console.warn('Facturalusa company lookup failed:', facturalusaError);
        }

        sendJson(res, 200, {
            found: false,
            source: 'none'
        });
    } catch (error) {
        console.error('Checkout company lookup failed:', error);
        sendJson(res, 500, {
            error: 'COMPANY_LOOKUP_FAILED',
            message: 'Nao foi possivel procurar a empresa pelo NIF neste momento.'
        });
    }
};
