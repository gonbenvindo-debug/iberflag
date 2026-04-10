function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeCountryCode(value) {
    const normalized = normalizeText(value).toUpperCase();
    return normalized || 'PT';
}

function inferCountryFromPostalCode(postalCode = '') {
    const normalized = normalizeText(postalCode);
    if (/^\d{5}(-\d{4})?$/.test(normalized)) {
        return 'ES';
    }
    if (/^\d{4}-\d{3}$/.test(normalized)) {
        return 'PT';
    }
    return '';
}

function resolveCheckoutCountryCode(customer = {}) {
    const explicit = normalizeCountryCode(customer.country || customer.countryCode || customer.pais || customer.pais_envio);
    if (explicit && explicit !== 'PT') {
        return explicit;
    }

    const inferred = inferCountryFromPostalCode(customer.codigo_postal || customer.postalCode || '');
    if (inferred) {
        return inferred;
    }

    return explicit || 'PT';
}

function resolveShippingZoneCode(countryCode = 'PT') {
    return normalizeCountryCode(countryCode) === 'ES'
        ? 'es_peninsular'
        : 'pt_continental';
}

function resolveSlaHours(countryCode = 'PT') {
    return normalizeCountryCode(countryCode) === 'ES' ? 72 : 48;
}

function resolveSlaTargetAt(referenceDate = new Date(), countryCode = 'PT') {
    const baseDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
    return new Date(safeDate.getTime() + (resolveSlaHours(countryCode) * 60 * 60 * 1000)).toISOString();
}

function buildFiscalDecision({ customer = {}, paymentStatus = 'pending' } = {}) {
    const countryCode = resolveCheckoutCountryCode(customer);
    const isPaid = normalizeText(paymentStatus).toLowerCase() === 'paid';

    if (countryCode === 'PT') {
        return {
            countryCode,
            scenario: 'pt_domestic',
            decisionMode: 'auto_emit',
            evidenceStatus: 'domestic_checkout_data',
            invoiceState: isPaid ? 'ready_to_emit' : 'pending_payment',
            vatRate: 23,
            vatExemption: '',
            reason: 'Cenario domestico portugues deterministico.'
        };
    }

    if (countryCode === 'ES') {
        return {
            countryCode,
            scenario: 'es_compatible_manual_review',
            decisionMode: 'manual_review',
            evidenceStatus: 'requires_country_specific_review',
            invoiceState: isPaid ? 'pending_manual_review' : 'pending_payment',
            vatRate: null,
            vatExemption: '',
            reason: 'Compatibilidade com Espanha mantida, mas faturacao automatica fica em revisao manual.'
        };
    }

    return {
        countryCode,
        scenario: 'international_manual_review',
        decisionMode: 'manual_review',
        evidenceStatus: 'requires_manual_review',
        invoiceState: isPaid ? 'pending_manual_review' : 'pending_payment',
        vatRate: null,
        vatExemption: '',
        reason: 'Cenario internacional nao automatico.'
    };
}

function buildOrderFiscalFields({ customer = {}, paymentStatus = 'pending', referenceDate = new Date() } = {}) {
    const decision = buildFiscalDecision({ customer, paymentStatus });
    return {
        fiscal_scenario: decision.scenario,
        fiscal_decision_mode: decision.decisionMode,
        fiscal_evidence_status: decision.evidenceStatus,
        invoice_state: decision.invoiceState,
        vat_rate_applied: decision.vatRate,
        vat_exemption_applied: decision.vatExemption || null,
        fiscal_decision_reason: decision.reason,
        shipping_zone_code: resolveShippingZoneCode(decision.countryCode),
        sla_target_at: resolveSlaTargetAt(referenceDate, decision.countryCode)
    };
}

module.exports = {
    buildFiscalDecision,
    buildOrderFiscalFields,
    resolveCheckoutCountryCode,
    resolveShippingZoneCode,
    resolveSlaHours,
    resolveSlaTargetAt
};
