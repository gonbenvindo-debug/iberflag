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
    if (['card', 'mbway', 'multibanco', 'bizum'].includes(normalized)) {
        return normalized;
    }
    return 'card';
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

function resolveStripePaymentMethodTypes(paymentMethodType) {
    const normalized = normalizePaymentMethodType(paymentMethodType);
    const methodMap = {
        card: ['card'],
        mbway: ['mb_way'],
        multibanco: ['multibanco'],
        bizum: ['card']
    };

    return methodMap[normalized] || ['card'];
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
    return normalizeText(process.env.FACTURALUSA_VAT_TYPE) || 'Não fazer nada';
}

function resolveFacturalusaDocumentType() {
    return normalizeText(process.env.FACTURALUSA_DOCUMENT_TYPE) || 'Factura Recibo';
}

function resolveFacturalusaVatRate() {
    const parsed = Number.parseFloat(String(process.env.FACTURALUSA_VAT_RATE || '0'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveFacturalusaCurrency() {
    return normalizeText(process.env.FACTURALUSA_CURRENCY) || '€';
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
                    design: item && item.design ? String(item.design) : '',
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
                design: entry.design ? String(entry.design) : '',
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
        bizum: 'Bizum'
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
    if (Number.isFinite(productId) && productId > 0) {
        return `IBF-P-${productId}`;
    }
    const designId = normalizeText(item?.designId);
    if (designId) {
        return `IBF-D-${designId.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 48)}`;
    }
    return `IBF-${normalizeText(item?.nome || 'produto').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 48)}`;
}

function buildFacturalusaItemDetails(item) {
    const serviceType = normalizeText(item?.serviceType || item?.service_type).toLowerCase();
    if (serviceType === 'design_review') {
        return normalizeText(item?.details) || 'Revisao manual opcional antes da producao';
    }

    const parts = [];
    if (normalizeText(item?.baseNome)) {
        parts.push(`Base: ${normalizeText(item.baseNome)}`);
    }
    if (item?.customized) {
        parts.push('Personalizado');
    }
    if (normalizeText(item?.designId)) {
        parts.push(`Design: ${normalizeText(item.designId)}`);
    }
    return parts.join(' | ');
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

function sanitizeCheckoutNote(value) {
    return normalizeText(value).slice(0, 4000);
}

module.exports = {
    appendWorkflowHistory,
    buildCheckoutPayloadSnapshot,
    buildFacturalusaItemDetails,
    buildFacturalusaItemReference,
    buildOrderItemSnapshots,
    buildOrderNotesWithMeta,
    buildServiceOptionItems,
    buildStripeLineItem,
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
