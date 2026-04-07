const META_MARKER = '[IBERFLAG_META]';

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

function resolveStripePaymentMethodTypes(paymentMethodType) {
    return [normalizePaymentMethodType(paymentMethodType)];
}

function generateOrderNumber() {
    const stamp = Date.now().toString();
    const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
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
    return normalizeText(customer.empresa || customer.nif) ? 'Empresarial' : 'Particular';
}

function resolveFacturalusaVatType() {
    return normalizeText(process.env.FACTURALUSA_VAT_TYPE) || 'IVA incluído';
}

function resolveFacturalusaDocumentType() {
    return normalizeText(process.env.FACTURALUSA_DOCUMENT_TYPE) || 'Factura Recibo';
}

function resolveFacturalusaVatRate() {
    const parsed = Number.parseFloat(String(process.env.FACTURALUSA_VAT_RATE || '23'));
    return Number.isFinite(parsed) ? parsed : 23;
}

function resolveFacturalusaCurrency() {
    return normalizeText(process.env.FACTURALUSA_CURRENCY) || '€';
}

function resolveFacturalusaLanguage() {
    return normalizeText(process.env.FACTURALUSA_LANGUAGE) || 'PT';
}

function resolveFacturalusaCountry(customer = {}) {
    return normalizeText(customer.country) || detectCountryCode(customer.codigo_postal);
}

function buildOrderItemSnapshots(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        designId: item.designId || item.design_id || null,
        produtoId: Number(item.id) || null,
        nome: item.nome || 'Produto',
        quantidade: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
        precoUnitario: Number(item.preco || 0),
        imagem: item.imagem || '',
        customized: Boolean(item.customized),
        baseNome: item.baseNome || '',
        basePrecoExtra: Number(item.basePrecoExtra || 0),
        design: item.design || '',
        designPreview: item.designPreview || ''
    }));
}

function normalizeOrderMeta(meta) {
    const source = (meta && typeof meta === 'object') ? meta : {};
    const workflowStatus = normalizeText(source.workflowStatus) || 'pendente_confirmacao';
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

    const statusHistory = Array.isArray(source.statusHistory)
        ? source.statusHistory
            .filter((entry) => entry && typeof entry === 'object' && entry.status)
            .map((entry) => ({
                status: String(entry.status),
                at: entry.at ? String(entry.at) : new Date().toISOString(),
                note: entry.note ? String(entry.note) : ''
            }))
        : [];

    const itemSnapshots = Array.isArray(source.itemSnapshots)
        ? source.itemSnapshots
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
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
                basePrecoExtra: Number(entry.basePrecoExtra || 0)
            }))
        : [];

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

function buildCheckoutPayloadSnapshot(customer, cart, paymentMethod, notes) {
    return {
        customer: {
            nome: normalizeText(customer?.nome),
            email: normalizeText(customer?.email),
            telefone: normalizeText(customer?.telefone),
            empresa: normalizeText(customer?.empresa),
            nif: normalizeText(customer?.nif),
            morada: normalizeText(customer?.morada),
            codigo_postal: normalizeText(customer?.codigo_postal),
            cidade: normalizeText(customer?.cidade)
        },
        cart: buildOrderItemSnapshots(cart),
        paymentMethod: normalizePaymentMethodType(paymentMethod),
        notes: normalizeText(notes)
    };
}

function buildFacturalusaItemReference(item) {
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
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitAmount = Math.max(0, Math.round(Number(item.preco || 0) * 100));

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
    buildStripeLineItem,
    detectCountryCode,
    generateOrderNumber,
    getPaymentMethodLabel,
    normalizeOrderMeta,
    normalizePaymentMethodType,
    resolveCustomerType,
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
