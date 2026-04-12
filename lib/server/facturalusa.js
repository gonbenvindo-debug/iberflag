const { getPaymentEnvironment } = require('./stripe');
const {
    buildFacturalusaItemDetails,
    buildFacturalusaItemReference,
    getPaymentMethodLabel,
    normalizeCustomerType,
    resolveFacturalusaCustomerName,
    resolveFacturalusaCountry,
    resolveFacturalusaCurrency,
    resolveFacturalusaLanguage,
    splitOrderNotesAndMeta
} = require('./checkout');
const { validateTaxId } = require('./tax-id');
const { normalizeFiscalSnapshot, resolveStoredFiscalSnapshot } = require('./fiscal-engine');

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
            ? getEnvValue(['FACTURALUSA_BASE_URL_TEST'])
            : getEnvValue(['FACTURALUSA_BASE_URL_LIVE', 'FACTURALUSA_BASE_URL'])
    ).trim().replace(/\/+$/, '') || 'https://facturalusa.pt/api/v2';
    const token = mode === 'test'
        ? requireEnvValue(['FACTURALUSA_API_TOKEN_TEST', 'FACTURALUSA_BEARER_TOKEN_TEST'], 'FACTURALUSA_API_TOKEN', mode)
        : requireEnvValue(['FACTURALUSA_API_TOKEN_LIVE', 'FACTURALUSA_BEARER_TOKEN_LIVE', 'FACTURALUSA_API_TOKEN', 'FACTURALUSA_BEARER_TOKEN'], 'FACTURALUSA_API_TOKEN', mode);

    return { baseUrl, token, mode };
}

function resolveFacturalusaSeriesId() {
    const mode = getPaymentEnvironment();
    return mode === 'test'
        ? getEnvValue(['FACTURALUSA_SERIE_ID_TEST'])
        : getEnvValue(['FACTURALUSA_SERIE_ID_LIVE', 'FACTURALUSA_SERIE_ID']);
}

function resolveOrderFiscalSnapshot(order = {}) {
    const split = order?.notas ? splitOrderNotesAndMeta(order.notas) : { meta: {} };
    return normalizeFiscalSnapshot(resolveStoredFiscalSnapshot(order, split.meta || {}));
}

function resolveFacturalusaDocumentTypeFromSnapshot(fiscalSnapshot = {}) {
    return String(fiscalSnapshot?.document_type_resolved || '').trim() || 'Factura Recibo';
}

function resolveFacturalusaVatTypeFromSnapshot(fiscalSnapshot = {}) {
    return String(fiscalSnapshot?.vat_type_resolved || '').trim() || 'Não fazer nada';
}

function resolveFacturalusaVatRateFromSnapshot(fiscalSnapshot = {}) {
    const parsed = Number(fiscalSnapshot?.vat_rate_applied);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveFacturalusaVatExemptionCodeFromSnapshot(fiscalSnapshot = {}) {
    return String(fiscalSnapshot?.vat_regime_code || '').trim() || undefined;
}

function resolveOrderItemUnitPrice(item) {
    const quantity = Number(item?.quantidade || item?.quantity || 1);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const subtotal = Number(item?.subtotal);
    const candidates = [
        item?.preco,
        item?.precoUnitario,
        Number.isFinite(subtotal) && subtotal > 0 ? subtotal / safeQuantity : null
    ];

    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric;
        }
    }

    return 0;
}

function resolveOrderItemQuantity(item) {
    const numeric = Number(item?.quantidade || item?.quantity || 1);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function classifyFacturalusaError(error) {
    const raw = String(error?.message || error?.response || error?.details || '').toLowerCase();
    const responseRaw = String(error?.response && typeof error.response === 'object'
        ? JSON.stringify(error.response)
        : error?.response || '').toLowerCase();
    const text = `${raw} ${responseRaw}`.trim();

    if (error?.code === 'FACTURALUSA_AT_USER_NOT_CONFIGURED') {
        return {
            code: 'FACTURALUSA_AT_USER_NOT_CONFIGURED',
            message: error?.message || 'A conta Facturalusa ainda nao tem o utilizador de acesso ao webservice AT configurado.',
            retryable: false
        };
    }

    if (error?.code === 'FACTURALUSA_SERIE_NOT_COMMUNICATED') {
        return {
            code: 'FACTURALUSA_SERIE_NOT_COMMUNICATED',
            message: error?.message || 'A serie Facturalusa selecionada nao esta comunicada à AT para este tipo de documento.',
            retryable: false
        };
    }

    if (error?.code === 'FACTURALUSA_INVALID_TAX_ID') {
        return {
            code: 'FACTURALUSA_INVALID_TAX_ID',
            message: error?.message || 'NIF invalido. Corrija o numero fiscal do cliente antes de reemitir o documento.',
            retryable: false
        };
    }

    if (error?.code === 'FACTURALUSA_MANUAL_REVIEW_REQUIRED') {
        return {
            code: 'FACTURALUSA_MANUAL_REVIEW_REQUIRED',
            message: error?.message || 'A encomenda requer revisão fiscal manual antes de emitir o documento.',
            retryable: false
        };
    }

    if (error?.code === 'FACTURALUSA_INVALID_VAT_CONFIGURATION') {
        return {
            code: 'FACTURALUSA_INVALID_VAT_CONFIGURATION',
            message: error?.message || 'A configuração fiscal do documento é incompatível com o perfil Artigo 53.',
            retryable: false
        };
    }

    if (!text) {
        return {
            code: 'FACTURALUSA_UNKNOWN_ERROR',
            message: 'Falha ao comunicar com a Facturalusa.',
            retryable: true
        };
    }

    if (text.includes('utilizador de acesso ao webservice at') || text.includes('configure primeiro o utilizador de acesso ao webservice at')) {
        return {
            code: 'FACTURALUSA_AT_USER_NOT_CONFIGURED',
            message: 'A conta Facturalusa ainda nao tem o utilizador de acesso ao webservice AT configurado.',
            retryable: false
        };
    }

    if (text.includes('serie_id') || text.includes('série não se encontra comunicada') || text.includes('serie nao se encontra comunicada') || text.includes('nao esta comunicada à at') || text.includes('nao esta comunicada a at')) {
        return {
            code: 'FACTURALUSA_SERIE_NOT_COMMUNICATED',
            message: 'A serie Facturalusa selecionada nao esta comunicada à AT para este tipo de documento.',
            retryable: false
        };
    }

    if (text.includes('token') || text.includes('unauthorized') || text.includes('forbidden')) {
        return {
            code: 'FACTURALUSA_AUTH_ERROR',
            message: 'Falha de autenticacao com a Facturalusa.',
            retryable: false
        };
    }

    if (text.includes('nif') && (text.includes('invalid') || text.includes('invalido') || text.includes('inválido'))) {
        return {
            code: 'FACTURALUSA_INVALID_TAX_ID',
            message: 'NIF invalido. Corrija o numero fiscal do cliente antes de reemitir o documento.',
            retryable: false
        };
    }

    if (text.includes('fetch failed') || text.includes('econnreset') || text.includes('etimedout') || text.includes('network')) {
        return {
            code: 'FACTURALUSA_NETWORK_ERROR',
            message: 'Falha de rede ao comunicar com a Facturalusa.',
            retryable: true
        };
    }

    return {
        code: error?.code || 'FACTURALUSA_REQUEST_FAILED',
        message: error?.message || 'Falha ao comunicar com a Facturalusa.',
        retryable: true
    };
}

async function ensureFacturalusaSeriesCommunicated(seriesId, documentType) {
    const id = Number(seriesId);
    if (!Number.isFinite(id) || id <= 0) {
        const error = new Error('A serie Facturalusa nao esta configurada.');
        error.code = 'FACTURALUSA_SERIE_ID_NOT_CONFIGURED';
        error.retryable = false;
        throw error;
    }

    const result = await facturalusaRequest(`/administration/series/${id}/check_communication`, {
        body: {
            document_type: documentType
        }
    });

    if (result !== true) {
        const error = new Error('A serie Facturalusa selecionada nao esta comunicada à AT para este tipo de documento.');
        error.code = 'FACTURALUSA_SERIE_NOT_COMMUNICATED';
        error.retryable = false;
        error.response = result;
        throw error;
    }

    return true;
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
    const fiscalSnapshot = normalizeFiscalSnapshot(context?.fiscalSnapshot || {});
    const normalizedType = normalizeCustomerType(
        customer?.tipo_cliente || customer?.tipoCliente || customer?.customerType,
        customer
    );

    const payload = {
        name: resolveFacturalusaCustomerName(customer),
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
        type: normalizedType === 'empresa' ? 'Empresarial' : 'Particular',
        vat_type: resolveFacturalusaVatTypeFromSnapshot(fiscalSnapshot),
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

    const byVat = vatNumber ? await findCustomerByVatNumber(vatNumber) : null;
    if (byVat?.id) {
        return byVat;
    }

    const byEmail = email ? await findCustomerByEmail(email) : null;
    if (byEmail?.id) {
        return byEmail;
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
    const fiscalSnapshot = normalizeFiscalSnapshot(context?.fiscalSnapshot || {});
    const payload = {
        reference: buildFacturalusaItemReference(item),
        description: String(item?.nome || item?.description || 'Produto').trim(),
        details: String(buildFacturalusaItemDetails(item)).trim() || undefined,
        details_show_print: true,
        unit: 'uni',
        vat: resolveFacturalusaVatRateFromSnapshot(fiscalSnapshot),
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
        sourceCustomer,
        session
    } = orderContext || {};

    const { mode } = getFacturalusaConfig();
    const fiscalSnapshot = resolveOrderFiscalSnapshot(order);
    const documentType = resolveFacturalusaDocumentTypeFromSnapshot(fiscalSnapshot);
    const currency = resolveFacturalusaCurrency();
    const country = resolveFacturalusaCountry({
        ...(sourceCustomer || customer || {}),
        country: sourceCustomer?.country || fiscalSnapshot.customer_fiscal_country || ''
    });
    const customerCode = customer?.code || customer?.id;
    const paymentMethodLabel = getPaymentMethodLabel(paymentMethod);
    const forceSendEmail = String(
        process.env.FACTURALUSA_FORCE_SEND_EMAIL
        || (mode === 'test' ? 'false' : 'true')
    ).toLowerCase() !== 'false';
    const seriesId = resolveFacturalusaSeriesId();
    const items = Array.isArray(cartItems) ? cartItems : [];

    await ensureFacturalusaSeriesCommunicated(seriesId, documentType);

    const savedItems = [];
    for (const item of items) {
        const product = await findOrCreateItem(item, {
            observations: `IberFlag order ${order?.numero_encomenda || ''}`,
            fiscalSnapshot
        });
        savedItems.push({
            id: product.reference || product.id,
            details: buildFacturalusaItemDetails(item) || undefined,
            price: resolveOrderItemUnitPrice(item),
            quantity: resolveOrderItemQuantity(item),
            vat: resolveFacturalusaVatRateFromSnapshot(fiscalSnapshot),
            vat_exemption: resolveFacturalusaVatExemptionCodeFromSnapshot(fiscalSnapshot)
        });
    }

    return facturalusaRequest('/sales', {
        body: {
            issue_date: new Date().toISOString().slice(0, 10),
            document_type: documentType,
            ...(seriesId ? { serie_id: Number(seriesId) || seriesId, serie: Number(seriesId) || seriesId } : {}),
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
            vat_type: resolveFacturalusaVatTypeFromSnapshot(fiscalSnapshot),
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

async function issueFacturalusaDocumentForOrder(orderContext) {
    const {
        order,
        session,
        customer: providedCustomer
    } = orderContext || {};

    const split = order?.notas ? splitOrderNotesAndMeta(order.notas) : { publicNotes: '', meta: {} };
    const fiscalSnapshot = resolveOrderFiscalSnapshot(order);
    if (split.meta?.facturalusaDocumentNumber) {
        return {
            alreadyEmitted: true,
            documentNumber: split.meta.facturalusaDocumentNumber,
            documentUrl: split.meta.facturalusaDocumentUrl || null
        };
    }

    if (fiscalSnapshot.fiscal_decision_mode !== 'auto_emit' || fiscalSnapshot.invoice_state !== 'ready_to_emit') {
        const error = new Error('A encomenda não está elegível para emissão automática neste momento.');
        error.code = 'FACTURALUSA_MANUAL_REVIEW_REQUIRED';
        error.retryable = false;
        throw error;
    }

    if (fiscalSnapshot.tax_profile === 'sole_trader_art53' && Number(fiscalSnapshot.vat_rate_applied || 0) > 0) {
        const error = new Error('O perfil fiscal ativo está em Artigo 53, mas o payload fiscal ainda tenta aplicar IVA acima de 0%.');
        error.code = 'FACTURALUSA_INVALID_VAT_CONFIGURATION';
        error.retryable = false;
        throw error;
    }

    const checkoutCustomer = split.meta.checkoutCustomer && typeof split.meta.checkoutCustomer === 'object'
        ? split.meta.checkoutCustomer
        : split.meta.customer && typeof split.meta.customer === 'object'
            ? split.meta.customer
            : {};

    const customerData = {
        nome: checkoutCustomer.nome || providedCustomer?.nome || 'Cliente IberFlag',
        email: checkoutCustomer.email || session?.customer_email || providedCustomer?.email || '',
        telefone: checkoutCustomer.telefone || providedCustomer?.telefone || '',
        tipo_cliente: checkoutCustomer.tipo_cliente || providedCustomer?.tipo_cliente || providedCustomer?.type || '',
        empresa: checkoutCustomer.empresa || providedCustomer?.empresa || '',
        nif: checkoutCustomer.nif || providedCustomer?.nif || '',
        morada: checkoutCustomer.morada || providedCustomer?.morada || '',
        codigo_postal: checkoutCustomer.codigo_postal || providedCustomer?.codigo_postal || '',
        cidade: checkoutCustomer.cidade || providedCustomer?.cidade || '',
        country: checkoutCustomer.country || providedCustomer?.country || ''
    };
    const taxIdValidation = validateTaxId(customerData.nif, {
        postalCode: customerData.codigo_postal,
        country: customerData.country
    });
    if (!taxIdValidation.valid) {
        const error = new Error(taxIdValidation.message || 'NIF invalido.');
        error.code = 'FACTURALUSA_INVALID_TAX_ID';
        error.retryable = false;
        throw error;
    }
    customerData.nif = taxIdValidation.normalized;

    const items = Array.isArray(split.meta.itemSnapshots) && split.meta.itemSnapshots.length > 0
        ? split.meta.itemSnapshots
        : [];

    const customer = providedCustomer?.code || providedCustomer?.id
        ? providedCustomer
        : await findOrCreateCustomer(customerData, {
            paymentMethod: session?.metadata?.payment_method || order?.metodo_pagamento || split.meta.paymentMethod || 'card',
            fiscalSnapshot
        });

    const sale = await createSaleForOrder({
        customer,
        order: {
            ...order,
            stripe_session_id: session?.id || order?.stripe_session_id || null
        },
        cartItems: items,
        paymentMethod: session?.metadata?.payment_method || order?.metodo_pagamento || split.meta.paymentMethod || 'card',
        sourceCustomer: customerData,
        session,
        fiscalSnapshot
    });

    return {
        sale,
        customer
    };
}

module.exports = {
    classifyFacturalusaError,
    createCustomer,
    createItem,
    createSaleForOrder,
    ensureFacturalusaSeriesCommunicated,
    facturalusaRequest,
    issueFacturalusaDocumentForOrder,
    findCustomerByEmail,
    findCustomerByVatNumber,
    findItemByReference,
    findOrCreateCustomer,
    findOrCreateItem
};
