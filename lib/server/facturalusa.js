const { getPaymentEnvironment } = require('./stripe');
const {
    buildFacturalusaItemDetails,
    buildFacturalusaItemReference,
    getPaymentMethodLabel,
    resolveCustomerType,
    resolveFacturalusaCountry,
    resolveFacturalusaCurrency,
    resolveFacturalusaDocumentType,
    resolveFacturalusaLanguage,
    resolveFacturalusaVatRate,
    resolveFacturalusaVatType
} = require('./checkout');

function getEnvValue(keys) {
    return String(keys
        .map((key) => process.env[key])
        .find((value) => String(value || '').trim()) || '').trim();
}

function requireEnvValue(keys, label, environment) {
    const value = getEnvValue(keys);
    if (!value) {
        const error = new Error(`${label} not configured for ${environment} environment`);
        error.code = `${label}_${environment.toUpperCase()}_NOT_CONFIGURED`;
        throw error;
    }

    return value;
}

function getFacturalusaConfig() {
    const mode = getPaymentEnvironment();
    const baseUrl = String(
        mode === 'test'
            ? getEnvValue(['FACTURALUSA_BASE_URL_TEST', 'FACTURALUSA_BASE_URL'])
            : getEnvValue(['FACTURALUSA_BASE_URL_LIVE', 'FACTURALUSA_BASE_URL'])
    ).trim().replace(/\/+$/, '') || 'https://facturalusa.pt/api/v2';
    const token = mode === 'test'
        ? requireEnvValue(['FACTURALUSA_API_TOKEN_TEST', 'FACTURALUSA_BEARER_TOKEN_TEST'], 'FACTURALUSA_API_TOKEN', mode)
        : requireEnvValue(['FACTURALUSA_API_TOKEN_LIVE', 'FACTURALUSA_BEARER_TOKEN_LIVE', 'FACTURALUSA_API_TOKEN', 'FACTURALUSA_BEARER_TOKEN'], 'FACTURALUSA_API_TOKEN', mode);

    return { baseUrl, token, mode };
}

async function facturalusaRequest(path, options = {}) {
    const { baseUrl, token } = getFacturalusaConfig();
    const endpoint = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const method = String(options.method || 'POST').toUpperCase();
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.headers || {})
    };
    let body = options.body;

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(endpoint, {
        method,
        headers,
        body
    });

    const rawText = await response.text();
    let payload = null;
    if (rawText) {
        try {
            payload = JSON.parse(rawText);
        } catch {
            payload = rawText;
        }
    }

    if (!response.ok) {
        const error = new Error(
            (payload && typeof payload === 'object' && (payload.error || payload.message || payload.detail))
                || rawText
                || `Facturalusa request failed (${response.status})`
        );
        error.status = response.status;
        error.response = payload;
        throw error;
    }

    return payload;
}

async function findCustomerByEmail(email) {
    const value = String(email || '').trim();
    if (!value) {
        return null;
    }

    try {
        return await facturalusaRequest('/customers/find', {
            body: {
                search_in: 'Email',
                value
            }
        });
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}

async function findCustomerByVatNumber(vatNumber) {
    const value = String(vatNumber || '').trim();
    if (!value) {
        return null;
    }

    try {
        return await facturalusaRequest('/customers/find', {
            body: {
                search_in: 'Vat Number',
                value
            }
        });
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}

async function createCustomer(customer, context = {}) {
    const payload = {
        name: String(customer?.nome || '').trim(),
        vat_number: String(customer?.nif || '').trim() || undefined,
        country: resolveFacturalusaCountry(customer),
        address: String(customer?.morada || '').trim(),
        city: String(customer?.cidade || '').trim(),
        postal_code: String(customer?.codigo_postal || '').trim(),
        email: String(customer?.email || '').trim(),
        telephone: String(customer?.telefone || '').trim() || undefined,
        mobile: String(customer?.telefone || '').trim() || undefined,
        payment_method: getPaymentMethodLabel(context.paymentMethod),
        payment_condition: 'Pronto pagamento',
        shipping_mode: 'Envio gratuito',
        price: 'Preços público',
        type: resolveCustomerType(customer),
        vat_type: resolveFacturalusaVatType(),
        language: resolveFacturalusaLanguage(),
        receive_emails: true,
        receive_sms: false
    };

    return facturalusaRequest('/customers', {
        body: payload
    });
}

async function findOrCreateCustomer(customer, context = {}) {
    const email = String(customer?.email || '').trim();
    const vatNumber = String(customer?.nif || '').trim();

    const byEmail = await findCustomerByEmail(email);
    if (byEmail?.id) {
        return byEmail;
    }

    const byVat = vatNumber ? await findCustomerByVatNumber(vatNumber) : null;
    if (byVat?.id) {
        return byVat;
    }

    return createCustomer(customer, context);
}

async function findItemByReference(reference) {
    const value = String(reference || '').trim();
    if (!value) {
        return null;
    }

    try {
        return await facturalusaRequest('/items/find', {
            body: {
                search_in: 'Reference',
                value
            }
        });
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}

async function createItem(item, context = {}) {
    const payload = {
        reference: buildFacturalusaItemReference(item),
        description: String(item?.nome || item?.description || 'Produto').trim(),
        details: String(buildFacturalusaItemDetails(item)).trim() || undefined,
        details_show_print: true,
        unit: 'uni',
        vat: resolveFacturalusaVatRate(),
        type: 'Produtos acabados e intermédios',
        cost_price: 0,
        observations: String(context.observations || '').trim() || undefined
    };

    return facturalusaRequest('/items', {
        body: payload
    });
}

async function findOrCreateItem(item, context = {}) {
    const reference = buildFacturalusaItemReference(item);
    const found = await findItemByReference(reference);
    if (found?.id) {
        return found;
    }
    return createItem(item, context);
}

async function createSaleForOrder(orderContext) {
    const {
        customer,
        order,
        cartItems = [],
        paymentMethod,
        sourceCustomer
    } = orderContext || {};

    const items = Array.isArray(cartItems) ? cartItems : [];
    const savedItems = [];
    const { mode } = getFacturalusaConfig();

    for (const item of items) {
        const product = await findOrCreateItem(item, {
            observations: `IberFlag order ${order?.numero_encomenda || ''}`
        });
        savedItems.push({
            id: product.reference || product.id,
            details: buildFacturalusaItemDetails(item) || undefined,
            price: Number(item.preco || 0),
            quantity: Math.max(1, Number(item.quantidade || item.quantity || 1)),
            vat: resolveFacturalusaVatRate()
        });
    }

    const documentType = resolveFacturalusaDocumentType();
    const currency = resolveFacturalusaCurrency();
    const country = resolveFacturalusaCountry(sourceCustomer || customer || {});
    const customerCode = customer?.code || customer?.id;
    const paymentMethodLabel = getPaymentMethodLabel(paymentMethod);
    const forceSendEmail = String(
        process.env.FACTURALUSA_FORCE_SEND_EMAIL
        || (mode === 'test' ? 'false' : 'true')
    ).toLowerCase() !== 'false';

    return facturalusaRequest('/sales', {
        body: {
            issue_date: new Date().toISOString().slice(0, 10),
            document_type: documentType,
            customer: customerCode,
            vat_number: String(sourceCustomer?.nif || sourceCustomer?.vat_number || '').trim() || undefined,
            address: String(sourceCustomer?.morada || sourceCustomer?.address || '').trim(),
            city: String(sourceCustomer?.cidade || sourceCustomer?.city || '').trim(),
            postal_code: String(sourceCustomer?.codigo_postal || sourceCustomer?.postal_code || '').trim(),
            country,
            delivery_address_address: String(sourceCustomer?.morada || sourceCustomer?.address || '').trim(),
            delivery_address_city: String(sourceCustomer?.cidade || sourceCustomer?.city || '').trim(),
            delivery_address_postal_code: String(sourceCustomer?.codigo_postal || sourceCustomer?.postal_code || '').trim(),
            delivery_address_country: country,
            payment_method: paymentMethodLabel,
            payment_condition: 'Pronto pagamento',
            shipping_mode: 'Envio gratuito',
            shipping_value: 0,
            shipping_vat: 0,
            price: 'Preços público',
            currency,
            vat_type: resolveFacturalusaVatType(),
            observations: [
                `Encomenda IberFlag ${order?.numero_encomenda || ''}`,
                `Stripe session ${order?.stripe_session_id || ''}`,
                `Payment method ${paymentMethodLabel}`
            ].filter(Boolean).join(' | '),
            force_send_email: forceSendEmail,
            status: 'Terminado',
            items: savedItems,
            language: resolveFacturalusaLanguage()
        }
    });
}

module.exports = {
    createCustomer,
    createItem,
    createSaleForOrder,
    facturalusaRequest,
    findCustomerByEmail,
    findCustomerByVatNumber,
    findItemByReference,
    findOrCreateCustomer,
    findOrCreateItem
};
