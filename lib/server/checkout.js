const crypto = require('crypto');
const {
    normalizeFiscalSnapshot,
    resolveCheckoutCountryCode
} = require('./fiscal-engine');

const META_MARKER = '[IBERFLAG_META]';
const DESIGN_REVIEW_FEE = 5;

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizePaymentMethodType(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (['card', 'mbway', 'multibanco', 'bizum', 'dynamic'].includes(normalized)) {
        return normalized;
    }
    return 'card';
}

function getStripePaymentEnvironment() {
    const mode = normalizeText(process.env.PAYMENT_ENVIRONMENT || process.env.STRIPE_ENVIRONMENT).toLowerCase();
    return mode === 'live' && normalizeText(process.env.PAYMENT_LIVE_ENABLED).toLowerCase() === 'true'
        ? 'live'
        : 'test';
}

function parseStripePaymentMethodList(value) {
    return normalizeText(value)
        .split(/[,\s]+/)
        .map((entry) => normalizeText(entry).toLowerCase())
        .filter(Boolean);
}

function resolveConfiguredStripePaymentMethodTypes() {
    const environment = getStripePaymentEnvironment();
    const configured = environment === 'live'
        ? parseStripePaymentMethodList(process.env.STRIPE_PAYMENT_METHOD_TYPES_LIVE || process.env.STRIPE_PAYMENT_METHOD_TYPES)
        : parseStripePaymentMethodList(process.env.STRIPE_PAYMENT_METHOD_TYPES_TEST || process.env.STRIPE_PAYMENT_METHOD_TYPES);

    if (configured.length > 0) {
        return new Set(configured);
    }

    // Live accounts can reject optional local methods unless they are explicitly enabled in Stripe.
    return environment === 'live'
        ? new Set(['card'])
        : null;
}

function filterConfiguredStripePaymentMethodTypes(methods) {
    const configured = resolveConfiguredStripePaymentMethodTypes();
    const normalizedMethods = (Array.isArray(methods) ? methods : [])
        .map((entry) => normalizeText(entry).toLowerCase())
        .filter(Boolean);

    if (!configured) {
        return normalizedMethods.length > 0 ? normalizedMethods : ['card'];
    }

    const filtered = normalizedMethods.filter((entry) => configured.has(entry));
    return filtered.length > 0 ? filtered : ['card'];
}

function normalizeCheckoutServiceOptions(input = {}) {
    const source = (input && typeof input === 'object') ? input : {};

    return {
        designReview: Boolean(
            source.designReview
            || source.design_review
            || source.designReviewSelected
            || source.design_review_selected
        )
    };
}

function buildServiceOptionItems(serviceOptions = {}) {
    const normalized = normalizeCheckoutServiceOptions(serviceOptions);
    const items = [];

    if (normalized.designReview) {
        items.push({
            serviceType: 'design_review',
            nome: 'Revisao de design',
            quantity: 1,
            preco: DESIGN_REVIEW_FEE,
            imagem: '',
            customized: false,
            details: 'Revisao manual opcional antes da producao'
        });
    }

    return items;
}

function normalizeCustomerType(value, customer = {}) {
    const normalized = normalizeText(value).toLowerCase();

    if (['empresa', 'empresarial', 'business', 'company', 'empresa_b2b'].includes(normalized)) {
        return 'empresa';
    }

    if (['particular', 'consumer', 'private', 'individual'].includes(normalized)) {
        return 'particular';
    }

    return normalizeText(customer?.empresa || customer?.nif) ? 'empresa' : 'particular';
}

function resolveStripePaymentMethodTypes(paymentMethodType, countryCode = '') {
    const normalized = normalizePaymentMethodType(paymentMethodType);
    const country = normalizeText(countryCode).toUpperCase();

    if (normalized === 'dynamic') {
        if (country === 'ES') {
            return filterConfiguredStripePaymentMethodTypes(['card', 'bizum']);
        }

        if (country === 'PT') {
            return filterConfiguredStripePaymentMethodTypes(['card', 'mb_way', 'multibanco', 'bizum']);
        }

        return filterConfiguredStripePaymentMethodTypes(['card']);
    }

    const methodMap = {
        card: ['card'],
        mbway: ['mb_way'],
        multibanco: ['multibanco'],
        bizum: ['bizum']
    };

    return filterConfiguredStripePaymentMethodTypes(methodMap[normalized] || ['card']);
}

function generateOrderNumber() {
    const stamp = Date.now().toString();
    const tail = crypto.randomBytes(3).toString('hex').slice(0, 6).toUpperCase();
    return `IBF${stamp.slice(-8)}${tail}`;
}

function detectCountryCode(postalCode) {
    const normalized = normalizeText(postalCode);
    if (/^\d{4}-\d{3}$/.test(normalized)) {
        return 'PT';
    }
    if (/^\d{5}(-\d{4})?$/.test(normalized)) {
        return 'ES';
    }
    return 'PT';
}

function resolveCustomerType(customer = {}) {
    return normalizeCustomerType(
        customer?.tipo_cliente || customer?.tipoCliente || customer?.customerType,
        customer
    ) === 'empresa'
        ? 'Empresarial'
        : 'Particular';
}

function resolveFacturalusaCustomerName(customer = {}) {
    const normalizedType = normalizeCustomerType(
        customer?.tipo_cliente || customer?.tipoCliente || customer?.customerType,
        customer
    );
    const companyName = normalizeText(customer?.empresa);
    const contactName = normalizeText(customer?.nome);

    if (normalizedType === 'empresa') {
        return companyName || contactName || 'Cliente IberFlag';
    }

    return contactName || companyName || 'Cliente IberFlag';
}

function resolveFacturalusaVatType() {
    return normalizeText(process.env.FACTURALUSA_VAT_TYPE) || 'Nao fazer nada';
}

function resolveFacturalusaDocumentType() {
    return normalizeText(process.env.FACTURALUSA_DOCUMENT_TYPE) || 'Factura Recibo';
}

function resolveFacturalusaVatRate() {
    const parsed = Number.parseFloat(String(process.env.FACTURALUSA_VAT_RATE || '0'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveFacturalusaCurrency() {
    const value = normalizeText(process.env.FACTURALUSA_CURRENCY);
    if (!value) return 'Euro';
    const normalized = value.toLowerCase();
    if (normalized === 'eur' || normalized === '€' || normalized === 'euro') return 'Euro';
    return value;
}

function resolveFacturalusaLanguage() {
    return normalizeText(process.env.FACTURALUSA_LANGUAGE) || 'PT';
}

function resolveFacturalusaCountry(customer = {}) {
    return normalizeText(customer.country || customer.countryCode || customer.country_code) || detectCountryCode(customer.codigo_postal);
}

function normalizeWorkflowStatusValue(statusValue) {
    const normalized = normalizeText(statusValue);
    const aliases = {
        pendente_confirmacao: 'em_preparacao',
        aguarda_pagamento: 'em_preparacao',
        arte_em_validacao: 'em_preparacao',
        producao: 'em_producao',
        acabamento: 'em_producao',
        embalagem: 'em_producao',
        expedida: 'expedido',
        cancelada: 'em_preparacao'
    };

    return aliases[normalized] || normalized || 'em_preparacao';
}

function buildOrderItemSnapshots(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        serviceType: normalizeText(item.serviceType || item.service_type),
        designId: item.designId || item.design_id || null,
        produtoId: Number(item.id) || null,
        nome: item.nome || 'Produto',
        quantidade: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
        precoUnitario: Number(item.preco || 0),
        imagem: item.imagem || '',
        customized: Boolean(item.customized),
        baseNome: item.baseNome || '',
        baseId: Number(item.baseId || item.base_id || 0) || null,
        baseImagem: item.baseImagem || item.base_imagem || '',
        basePrecoExtra: Number(item.basePrecoExtra || 0),
        design: item.design || '',
        designPreview: item.designPreview || '',
        designReadToken: item.designReadToken || item.design_read_token || '',
        designSvgUrl: item.designSvgUrl || item.design_svg_url || '',
        designStorageBucket: item.designStorageBucket || item.design_storage_bucket || '',
        designStoragePath: item.designStoragePath || item.design_storage_path || '',
        designSceneV1: item && item.designSceneV1 && typeof item.designSceneV1 === 'object'
            ? item.designSceneV1
            : (item && item.design_scene_v1 && typeof item.design_scene_v1 === 'object' ? item.design_scene_v1 : null),
        details: normalizeText(item.details)
    }));
}

function normalizeOrderMeta(meta) {
    const source = (meta && typeof meta === 'object') ? meta : {};
    const workflowStatus = normalizeWorkflowStatusValue(source.workflowStatus);
    const trackingCode = normalizeText(source.trackingCode);
    const trackingUrl = normalizeText(source.trackingUrl);
    const paymentStatus = normalizeText(source.paymentStatus) || 'pending';
    const paymentProvider = normalizeText(source.paymentProvider) || 'stripe';
    const paymentMethod = normalizeText(source.paymentMethod) || '';
    const stripeSessionId = normalizeText(source.stripeSessionId);
    const stripePaymentIntent = normalizeText(source.stripePaymentIntent);
    const facturalusaCustomerCode = normalizeText(source.facturalusaCustomerCode);
    const facturalusaDocumentNumber = normalizeText(source.facturalusaDocumentNumber);
    const facturalusaDocumentUrl = normalizeText(source.facturalusaDocumentUrl);
    const facturalusaLastError = normalizeText(source.facturalusaLastError);
    const facturalusaStatus = normalizeText(source.facturalusaStatus) || (
        facturalusaDocumentNumber ? 'emitted'
            : facturalusaLastError ? 'blocked'
                : ''
    );
    const facturalusaLastAttemptAt = normalizeText(source.facturalusaLastAttemptAt);

    const checkoutCustomer = source.checkoutCustomer && typeof source.checkoutCustomer === 'object'
        ? {
            nome: normalizeText(source.checkoutCustomer.nome),
            email: normalizeText(source.checkoutCustomer.email),
            telefone: normalizeText(source.checkoutCustomer.telefone),
            tipo_cliente: normalizeCustomerType(source.checkoutCustomer.tipo_cliente, source.checkoutCustomer),
            empresa: normalizeText(source.checkoutCustomer.empresa),
            nif: normalizeText(source.checkoutCustomer.nif),
            morada: normalizeText(source.checkoutCustomer.morada),
            codigo_postal: normalizeText(source.checkoutCustomer.codigo_postal),
            cidade: normalizeText(source.checkoutCustomer.cidade),
            country: normalizeText(source.checkoutCustomer.country || source.checkoutCustomer.countryCode)
        }
        : null;

    const checkoutSnapshot = source.checkoutSnapshot && typeof source.checkoutSnapshot === 'object'
        ? {
            customer: source.checkoutSnapshot.customer && typeof source.checkoutSnapshot.customer === 'object'
                ? {
                    nome: normalizeText(source.checkoutSnapshot.customer.nome),
                    email: normalizeText(source.checkoutSnapshot.customer.email),
                    telefone: normalizeText(source.checkoutSnapshot.customer.telefone),
                    tipo_cliente: normalizeCustomerType(source.checkoutSnapshot.customer.tipo_cliente, source.checkoutSnapshot.customer),
                    empresa: normalizeText(source.checkoutSnapshot.customer.empresa),
                    nif: normalizeText(source.checkoutSnapshot.customer.nif),
                    morada: normalizeText(source.checkoutSnapshot.customer.morada),
                    codigo_postal: normalizeText(source.checkoutSnapshot.customer.codigo_postal),
                    cidade: normalizeText(source.checkoutSnapshot.customer.cidade),
                    country: normalizeText(source.checkoutSnapshot.customer.country || source.checkoutSnapshot.customer.countryCode)
                }
                : null,
            cart: Array.isArray(source.checkoutSnapshot.cart)
                ? source.checkoutSnapshot.cart.map((item) => ({
                    serviceType: normalizeText(item && (item.serviceType || item.service_type)),
                    designId: item && item.designId ? String(item.designId) : '',
                    produtoId: Number(item && item.produtoId) || Number(item && item.id) || null,
                    nome: item && item.nome ? String(item.nome) : 'Produto',
                    quantidade: Math.max(1, Number.parseInt(item && (item.quantidade || item.quantity) || 1, 10) || 1),
                    precoUnitario: Number(item && (item.precoUnitario || item.preco) || 0),
                    imagem: item && item.imagem ? String(item.imagem) : '',
                    designPreview: item && item.designPreview ? String(item.designPreview) : '',
                    designReadToken: item && (item.designReadToken || item.design_read_token) ? String(item.designReadToken || item.design_read_token) : '',
                    designSvgUrl: item && (item.designSvgUrl || item.design_svg_url) ? String(item.designSvgUrl || item.design_svg_url) : '',
                    designStorageBucket: item && (item.designStorageBucket || item.design_storage_bucket) ? String(item.designStorageBucket || item.design_storage_bucket) : '',
                    designStoragePath: item && (item.designStoragePath || item.design_storage_path) ? String(item.designStoragePath || item.design_storage_path) : '',
                    design: item && item.design ? String(item.design) : '',
                    designSceneV1: item && item.designSceneV1 && typeof item.designSceneV1 === 'object'
                        ? item.designSceneV1
                        : (item && item.design_scene_v1 && typeof item.design_scene_v1 === 'object' ? item.design_scene_v1 : null),
                    customized: Boolean(item && item.customized),
                    baseNome: item && item.baseNome ? String(item.baseNome) : '',
                    baseId: Number(item && (item.baseId || item.base_id) || 0) || null,
                    baseImagem: item && (item.baseImagem || item.base_imagem) ? String(item.baseImagem || item.base_imagem) : '',
                    basePrecoExtra: Number(item && item.basePrecoExtra || 0),
                    details: normalizeText(item && item.details)
                }))
                : [],
            paymentMethod: normalizePaymentMethodType(source.checkoutSnapshot.paymentMethod),
            notes: normalizeText(source.checkoutSnapshot.notes),
            serviceOptions: normalizeCheckoutServiceOptions(source.checkoutSnapshot.serviceOptions),
            fiscalSnapshot: normalizeFiscalSnapshot(source.checkoutSnapshot.fiscalSnapshot || source.checkoutSnapshot.fiscal_snapshot || {}),
            vatValidation: source.checkoutSnapshot.vatValidation && typeof source.checkoutSnapshot.vatValidation === 'object'
                ? source.checkoutSnapshot.vatValidation
                : {}
        }
        : null;

    const fiscalSnapshot = normalizeFiscalSnapshot(source.fiscalSnapshot || source.fiscal_snapshot || {});
    const vatValidation = source.vatValidation && typeof source.vatValidation === 'object'
        ? source.vatValidation
        : {};
    const fiscalDivergence = source.fiscalDivergence && typeof source.fiscalDivergence === 'object'
        ? {
            diverged: Boolean(source.fiscalDivergence.diverged),
            fields: Array.isArray(source.fiscalDivergence.fields)
                ? source.fiscalDivergence.fields.map((value) => normalizeText(value)).filter(Boolean)
                : [],
            reason: normalizeText(source.fiscalDivergence.reason)
        }
        : {
            diverged: false,
            fields: [],
            reason: ''
        };

    const statusHistory = Array.isArray(source.statusHistory)
        ? source.statusHistory
            .filter((entry) => entry && typeof entry === 'object' && entry.status)
            .map((entry) => ({
                status: normalizeWorkflowStatusValue(entry.status),
                at: entry.at ? String(entry.at) : new Date().toISOString(),
                note: entry.note ? String(entry.note) : ''
            }))
        : [];

    const itemSnapshots = Array.isArray(source.itemSnapshots)
        ? source.itemSnapshots
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
                serviceType: normalizeText(entry.serviceType || entry.service_type),
                designId: entry.designId ? String(entry.designId) : '',
                produtoId: Number(entry.produtoId) || null,
                nome: entry.nome ? String(entry.nome) : 'Produto',
                quantidade: Math.max(1, Number.parseInt(entry.quantidade || 1, 10) || 1),
                precoUnitario: Number(entry.precoUnitario || 0),
                imagem: entry.imagem ? String(entry.imagem) : '',
                designPreview: entry.designPreview ? String(entry.designPreview) : '',
                designReadToken: entry.designReadToken || entry.design_read_token ? String(entry.designReadToken || entry.design_read_token) : '',
                designSvgUrl: entry.designSvgUrl || entry.design_svg_url ? String(entry.designSvgUrl || entry.design_svg_url) : '',
                designStorageBucket: entry.designStorageBucket || entry.design_storage_bucket ? String(entry.designStorageBucket || entry.design_storage_bucket) : '',
                designStoragePath: entry.designStoragePath || entry.design_storage_path ? String(entry.designStoragePath || entry.design_storage_path) : '',
                design: entry.design ? String(entry.design) : '',
                designSceneV1: entry.designSceneV1 && typeof entry.designSceneV1 === 'object'
                    ? entry.designSceneV1
                    : (entry.design_scene_v1 && typeof entry.design_scene_v1 === 'object' ? entry.design_scene_v1 : null),
                customized: Boolean(entry.customized),
                baseNome: entry.baseNome ? String(entry.baseNome) : '',
                baseId: Number(entry.baseId || entry.base_id || 0) || null,
                baseImagem: entry.baseImagem || entry.base_imagem ? String(entry.baseImagem || entry.base_imagem) : '',
                basePrecoExtra: Number(entry.basePrecoExtra || 0),
                details: normalizeText(entry.details)
            }))
        : [];

    const serviceOptions = normalizeCheckoutServiceOptions(source.serviceOptions);

    return {
        workflowStatus,
        trackingCode,
        trackingUrl,
        paymentStatus,
        paymentProvider,
        paymentMethod,
        stripeSessionId,
        stripePaymentIntent,
        facturalusaCustomerCode,
        facturalusaDocumentNumber,
        facturalusaDocumentUrl,
        facturalusaLastError,
        facturalusaStatus,
        facturalusaLastAttemptAt,
        checkoutCustomer,
        checkoutSnapshot,
        fiscalSnapshot,
        vatValidation,
        serviceOptions,
        fiscalDivergence,
        statusHistory,
        itemSnapshots
    };
}

function splitOrderNotesAndMeta(rawNotes) {
    const notesText = typeof rawNotes === 'string' ? rawNotes : '';
    const markerIndex = notesText.lastIndexOf(META_MARKER);

    if (markerIndex === -1) {
        return {
            publicNotes: notesText.trim(),
            meta: normalizeOrderMeta(null)
        };
    }

    const publicNotes = notesText.slice(0, markerIndex).trim();
    const jsonText = notesText.slice(markerIndex + META_MARKER.length).trim();

    try {
        const parsedMeta = jsonText ? JSON.parse(jsonText) : null;
        return {
            publicNotes,
            meta: normalizeOrderMeta(parsedMeta)
        };
    } catch {
        return {
            publicNotes,
            meta: normalizeOrderMeta(null)
        };
    }
}

function buildOrderNotesWithMeta(publicNotes, meta) {
    const cleanNotes = normalizeText(publicNotes);
    const serializedMeta = `${META_MARKER}${JSON.stringify(normalizeOrderMeta(meta))}`;
    return cleanNotes ? `${cleanNotes}\n\n${serializedMeta}` : serializedMeta;
}

function appendWorkflowHistory(meta, nextStatus, note) {
    const normalized = normalizeOrderMeta(meta);
    normalized.statusHistory.push({
        status: nextStatus,
        at: new Date().toISOString(),
        note: normalizeText(note)
    });
    return normalized;
}

function getPaymentMethodLabel(method) {
    const normalized = normalizePaymentMethodType(method);
    const labels = {
        card: 'Cartao',
        mbway: 'MB Way',
        multibanco: 'Multibanco',
        bizum: 'Bizum',
        dynamic: 'Pagamento online'
    };
    return labels[normalized] || 'Pagamento online';
}

function buildCheckoutPayloadSnapshot(customer, cart, paymentMethod, notes, serviceOptions = {}) {
    return {
        customer: {
            nome: normalizeText(customer?.nome),
            email: normalizeText(customer?.email),
            telefone: normalizeText(customer?.telefone),
            tipo_cliente: normalizeCustomerType(customer?.tipo_cliente || customer?.tipoCliente || customer?.customerType, customer),
            empresa: normalizeText(customer?.empresa),
            nif: normalizeText(customer?.nif),
            morada: normalizeText(customer?.morada),
            codigo_postal: normalizeText(customer?.codigo_postal),
            cidade: normalizeText(customer?.cidade),
            country: resolveCheckoutCountryCode(customer)
        },
        cart: buildOrderItemSnapshots(cart),
        paymentMethod: normalizePaymentMethodType(paymentMethod),
        notes: normalizeText(notes),
        serviceOptions: normalizeCheckoutServiceOptions(serviceOptions)
    };
}

function buildFacturalusaItemReference(item) {
    const serviceType = normalizeText(item?.serviceType || item?.service_type).toLowerCase();
    if (serviceType === 'design_review') {
        return 'IBF-S-DESIGN-REVIEW';
    }

    const productId = Number(item?.produtoId || item?.id || 0);
    const baseId = Number(item?.baseId || item?.base_id || 0);
    const customized = Boolean(item?.customized);
    if (Number.isFinite(productId) && productId > 0) {
        return customized ? `IBF-P-${productId}-CUSTOM` : `IBF-P-${productId}`;
    }

    if (Number.isFinite(baseId) && baseId > 0) {
        return customized ? `IBF-B-${baseId}-CUSTOM` : `IBF-B-${baseId}`;
    }

    const fallbackName = normalizeText(item?.nome || 'produto')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);

    return customized
        ? `IBF-CUSTOM-${fallbackName || 'PRODUTO'}`
        : `IBF-${fallbackName || 'PRODUTO'}`;
}

function buildFacturalusaItemDetails(item) {
    const serviceType = normalizeText(item?.serviceType || item?.service_type).toLowerCase();
    if (serviceType === 'design_review') {
        return normalizeText(item?.details) || 'Revisao manual opcional antes da producao';
    }

    const parts = [];
    const baseName = normalizeText(item?.baseNome);
    const itemName = normalizeText(item?.nome);
    if (item?.customized) {
        parts.push(baseName ? `Personalizacao sobre ${baseName}` : 'Produto personalizado');
    } else if (baseName && baseName.toLowerCase() !== itemName.toLowerCase()) {
        parts.push(`Modelo base: ${baseName}`);
    }
    return parts.join(' | ');
}

function buildFacturalusaItemObservations(item) {
    return item?.customized
        ? 'Artigo personalizado comercializado pela loja online IberFlag'
        : 'Artigo comercializado pela loja online IberFlag';
}

function buildFacturalusaOrderObservations(order = {}) {
    const orderNumber = normalizeText(order?.numero_encomenda);
    return orderNumber
        ? `Referencia da encomenda: ${orderNumber}`
        : 'Encomenda realizada na loja online IberFlag';
}

function buildStripeLineItem(item) {
    const quantity = Math.max(1, Number(item.quantity || item.quantidade || 1));
    const unitAmount = Math.max(0, Math.round(Number(item.preco || item.precoUnitario || 0) * 100));

    return {
        quantity,
        price_data: {
            currency: 'eur',
            unit_amount: unitAmount,
            product_data: {
                name: normalizeText(item.nome || 'Produto'),
                description: buildFacturalusaItemDetails(item) || undefined,
                images: normalizeText(item.imagem) ? [normalizeText(item.imagem)] : undefined
            }
        }
    };
}

function buildStripeSessionSummary(session = {}) {
    const source = (session && typeof session === 'object') ? session : {};
    const metadata = source.metadata && typeof source.metadata === 'object' ? source.metadata : {};
    const amountTotal = Number(source.amount_total);
    const amountSubtotal = Number(source.amount_subtotal);

    return {
        id: normalizeText(source.id),
        status: normalizeText(source.status),
        payment_status: normalizeText(source.payment_status),
        payment_method: normalizeText(metadata.payment_method),
        order_code: normalizeText(metadata.order_code) || normalizeText(source.client_reference_id),
        client_reference_id: normalizeText(source.client_reference_id),
        payment_intent: normalizeText(source.payment_intent),
        customer_email: normalizeText(source.customer_email),
        currency: normalizeText(source.currency).toUpperCase(),
        amount_total: Number.isFinite(amountTotal) ? amountTotal : null,
        amount_subtotal: Number.isFinite(amountSubtotal) ? amountSubtotal : null,
        payment_method_types: Array.isArray(source.payment_method_types)
            ? source.payment_method_types.map((entry) => normalizeText(entry)).filter(Boolean)
            : [],
        ui_mode: normalizeText(source.ui_mode),
        redirect_on_completion: normalizeText(source.redirect_on_completion),
        livemode: Boolean(source.livemode)
    };
}

function sanitizeCheckoutNote(value) {
    return normalizeText(value).slice(0, 4000);
}

module.exports = {
    appendWorkflowHistory,
    buildCheckoutPayloadSnapshot,
    buildFacturalusaItemDetails,
    buildFacturalusaItemObservations,
    buildFacturalusaOrderObservations,
    buildFacturalusaItemReference,
    buildOrderItemSnapshots,
    buildOrderNotesWithMeta,
    buildServiceOptionItems,
    buildStripeLineItem,
    buildStripeSessionSummary,
    DESIGN_REVIEW_FEE,
    detectCountryCode,
    generateOrderNumber,
    getPaymentMethodLabel,
    normalizeCheckoutServiceOptions,
    normalizeOrderMeta,
    normalizeCustomerType,
    normalizePaymentMethodType,
    normalizeWorkflowStatusValue,
    resolveCustomerType,
    resolveFacturalusaCustomerName,
    resolveFacturalusaCountry,
    resolveFacturalusaCurrency,
    resolveFacturalusaDocumentType,
    resolveFacturalusaLanguage,
    resolveFacturalusaVatRate,
    resolveFacturalusaVatType,
    resolveStripePaymentMethodTypes,
    sanitizeCheckoutNote,
    splitOrderNotesAndMeta
};
