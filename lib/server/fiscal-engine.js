const { normalizeTaxId } = require('./tax-id');

const DEFAULT_TAX_PROFILE = 'sole_trader_art53';
const DEFAULT_DOCUMENT_TYPE = 'Factura Recibo';
const DEFAULT_VAT_TYPE = 'Não fazer nada';
const VAT_EXEMPTION_LABELS = {
    M10: 'M10 - IVA - Regime de isenção',
    M16: 'M16 - Isento Artigo 14.º do RITI (ou similar)'
};
const EU_COUNTRIES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE'
]);

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeCountryCode(value) {
    const normalized = normalizeText(value).toUpperCase();
    return normalized || '';
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

function inferCountryFromTaxId(taxId = '') {
    const normalized = normalizeTaxId(taxId);
    if (!normalized) {
        return '';
    }

    if (/^[XYZ]\d{7}[A-Z]$/.test(normalized) || /^[A-Z]\d{7}[A-Z0-9]$/.test(normalized)) {
        return 'ES';
    }

    if (/^[1235689]\d{8}$/.test(normalized)) {
        return 'PT';
    }

    const prefix = normalized.slice(0, 2);
    if (EU_COUNTRIES.has(prefix)) {
        return prefix;
    }

    return '';
}

function resolveCheckoutCountryCode(customer = {}) {
    const explicit = normalizeCountryCode(
        customer.country
        || customer.countryCode
        || customer.country_code
        || customer.pais
        || customer.pais_envio
    );
    if (explicit) {
        return explicit;
    }

    const inferredPostal = inferCountryFromPostalCode(customer.codigo_postal || customer.postalCode || '');
    if (inferredPostal) {
        return inferredPostal;
    }

    const inferredTaxId = inferCountryFromTaxId(customer.nif || customer.vat_number || customer.vatNumber || '');
    if (inferredTaxId) {
        return inferredTaxId;
    }

    return 'PT';
}

function resolveFiscalRegion(countryCode = 'PT') {
    const normalized = normalizeCountryCode(countryCode) || 'PT';
    if (normalized === 'PT') {
        return 'PT';
    }
    if (EU_COUNTRIES.has(normalized)) {
        return 'UE';
    }
    return 'non_eu';
}

function resolveShippingZoneCode(countryCode = 'PT') {
    const normalized = normalizeCountryCode(countryCode) || 'PT';
    if (normalized === 'PT') {
        return 'pt_continental';
    }
    if (normalized === 'ES') {
        return 'es_peninsular';
    }
    if (EU_COUNTRIES.has(normalized)) {
        return 'eu_crossborder';
    }
    return 'international_manual_review';
}

function resolveSlaHours(countryCode = 'PT') {
    const normalized = normalizeCountryCode(countryCode) || 'PT';
    if (normalized === 'PT') {
        return 48;
    }
    if (normalized === 'ES') {
        return 72;
    }
    if (EU_COUNTRIES.has(normalized)) {
        return 96;
    }
    return 120;
}

function resolveSlaTargetAt(referenceDate = new Date(), countryCode = 'PT') {
    const baseDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
    return new Date(safeDate.getTime() + (resolveSlaHours(countryCode) * 60 * 60 * 1000)).toISOString();
}

function getTaxProfile() {
    return normalizeText(process.env.TAX_PROFILE || process.env.FISCAL_TAX_PROFILE) || DEFAULT_TAX_PROFILE;
}

function normalizeVatValidation(validation = {}, customer = {}) {
    const countryCode = normalizeCountryCode(
        validation.countryCode
        || validation.country
        || customer.country
        || customer.countryCode
        || customer.country_code
    ) || resolveCheckoutCountryCode(customer);
    const status = normalizeText(validation.status).toLowerCase() || (
        normalizeTaxId(validation.normalizedTaxId || validation.taxId || customer.nif)
            ? 'not_required'
            : 'not_required'
    );
    const normalizedTaxId = normalizeTaxId(validation.normalizedTaxId || validation.taxId || customer.nif);

    return {
        status: ['not_required', 'valid', 'invalid', 'unavailable'].includes(status) ? status : 'not_required',
        source: normalizeText(validation.source || 'none') || 'none',
        message: normalizeText(validation.message),
        checkedAt: normalizeText(validation.checkedAt || validation.checked_at),
        countryCode,
        normalizedTaxId,
        companyName: normalizeText(validation.companyName || validation.name),
        companyAddress: normalizeText(validation.companyAddress || validation.address),
        raw: validation.raw && typeof validation.raw === 'object' ? validation.raw : {}
    };
}

function buildVatExemptionPayload(code = 'M10') {
    const normalizedCode = normalizeText(code).toUpperCase() || 'M10';
    return {
        code: normalizedCode,
        label: VAT_EXEMPTION_LABELS[normalizedCode] || normalizedCode
    };
}

function buildDecisionReason({ scenario, customerType, countryCode, vatValidationStatus }) {
    switch (scenario) {
        case 'pt_particular_art53':
            return 'Cliente particular em Portugal. Emissão automática sob regime de isenção do artigo 53.º do CIVA.';
        case 'pt_business_art53':
            return 'Cliente empresarial em Portugal. Emissão automática sob regime de isenção do artigo 53.º do CIVA.';
        case 'eu_consumer_art53':
            return `Cliente particular na UE (${countryCode}). Emissão automática no regime atual de isenção do artigo 53.º do CIVA.`;
        case 'eu_business_vies_valid':
            return `Empresa UE validada em VIES (${countryCode}). Tratamento intracomunitário aplicado sem cair em IVA PT por omissão.`;
        case 'eu_business_vies_invalid_fallback':
            return 'Empresa UE com VAT/VIES inválido. Mantém-se faturação normal não intracomunitária, sem benefício intracomunitário.';
        case 'eu_business_vies_unavailable_fallback':
            return 'Empresa UE com validação VIES indisponível. Mantém-se faturação normal não intracomunitária, sem benefício intracomunitário.';
        case 'non_eu_manual_review':
            return `Cliente ${customerType} fora da UE (${countryCode}). Pagamento permitido, mas emissão automática bloqueada para revisão manual.`;
        default:
            return vatValidationStatus === 'valid'
                ? 'Decisão fiscal automática com VAT validado.'
                : 'Decisão fiscal automática preparada a partir dos dados do checkout.';
    }
}

function buildBaseDecision({
    taxProfile,
    customerType,
    countryCode,
    fiscalRegion,
    vatValidation,
    customer = {},
    paymentStatus,
    referenceDate
}) {
    const isPaid = normalizeText(paymentStatus).toLowerCase() === 'paid';
    const validVatExemption = buildVatExemptionPayload(
        normalizeText(process.env.FISCAL_EU_BUSINESS_VALID_VAT_EXEMPTION || 'M16')
    );
    const art53VatExemption = buildVatExemptionPayload('M10');

    let scenario = 'pt_particular_art53';
    let decisionMode = 'auto_emit';
    let evidenceStatus = 'checkout_data';
    let invoiceState = isPaid ? 'ready_to_emit' : 'pending_payment';
    let vatRate = 0;
    let vatExemption = art53VatExemption;
    let vatTypeResolved = DEFAULT_VAT_TYPE;

    if (taxProfile !== DEFAULT_TAX_PROFILE) {
        scenario = 'profile_override_manual_review';
        decisionMode = 'manual_review';
        evidenceStatus = 'unsupported_tax_profile';
        invoiceState = isPaid ? 'pending_manual_review' : 'pending_payment';
        vatRate = null;
        vatExemption = { code: '', label: '' };
        vatTypeResolved = '';
    } else if (fiscalRegion === 'non_eu') {
        scenario = 'non_eu_manual_review';
        decisionMode = 'manual_review';
        evidenceStatus = 'manual_review_non_eu';
        invoiceState = isPaid ? 'pending_manual_review' : 'pending_payment';
        vatRate = null;
        vatExemption = { code: '', label: '' };
        vatTypeResolved = '';
    } else if (countryCode === 'PT' && customerType === 'empresa') {
        scenario = 'pt_business_art53';
        evidenceStatus = 'art53_domestic_business';
    } else if (countryCode === 'PT') {
        scenario = 'pt_particular_art53';
        evidenceStatus = 'art53_domestic_particular';
    } else if (fiscalRegion === 'UE' && customerType === 'particular') {
        scenario = 'eu_consumer_art53';
        evidenceStatus = 'art53_eu_consumer';
    } else if (fiscalRegion === 'UE' && customerType === 'empresa' && vatValidation.status === 'valid') {
        scenario = 'eu_business_vies_valid';
        evidenceStatus = 'eu_business_vies_validated';
        vatExemption = validVatExemption;
    } else if (fiscalRegion === 'UE' && customerType === 'empresa' && vatValidation.status === 'unavailable') {
        scenario = 'eu_business_vies_unavailable_fallback';
        evidenceStatus = 'eu_business_vies_unavailable_fallback';
    } else if (fiscalRegion === 'UE' && customerType === 'empresa') {
        scenario = 'eu_business_vies_invalid_fallback';
        evidenceStatus = 'eu_business_vies_invalid_fallback';
    }

    const decisionReason = buildDecisionReason({
        scenario,
        customerType,
        countryCode,
        vatValidationStatus: vatValidation.status
    });

    return normalizeFiscalSnapshot({
        tax_profile: taxProfile,
        customer_fiscal_name: normalizeText(customerType === 'empresa'
            ? customer.empresa || customer.nome
            : customer.nome || customer.empresa),
        customer_fiscal_country: countryCode,
        customer_type: customerType,
        fiscal_region: fiscalRegion,
        fiscal_scenario: scenario,
        fiscal_decision_mode: decisionMode,
        fiscal_evidence_status: evidenceStatus,
        document_type_resolved: DEFAULT_DOCUMENT_TYPE,
        vat_type_resolved: vatTypeResolved,
        vat_rate_applied: vatRate,
        vat_regime_code: vatExemption.code || '',
        vat_exemption_applied: vatExemption.label || '',
        vat_validation_status: vatValidation.status,
        vat_validation_number: vatValidation.normalizedTaxId,
        vat_validation_source: vatValidation.source || 'none',
        vat_validation_checked_at: vatValidation.checkedAt || '',
        vat_validation_message: vatValidation.message || '',
        vat_validation_payload: vatValidation.raw || {},
        invoice_state: invoiceState,
        fiscal_decision_reason: decisionReason,
        fiscal_decision_mode_display: decisionMode === 'manual_review' ? 'Revisão manual' : 'Emissão automática',
        shipping_zone_code: resolveShippingZoneCode(countryCode),
        sla_target_at: resolveSlaTargetAt(referenceDate, countryCode),
        fiscal_snapshot_locked_at: new Date(referenceDate instanceof Date ? referenceDate : new Date(referenceDate)).toISOString()
    });
}

function normalizeFiscalSnapshot(snapshot = {}) {
    const taxProfile = normalizeText(snapshot.tax_profile || snapshot.taxProfile) || DEFAULT_TAX_PROFILE;
    const customerFiscalName = normalizeText(snapshot.customer_fiscal_name || snapshot.customerFiscalName || snapshot.customer_name || snapshot.customerName);
    const countryCode = normalizeCountryCode(snapshot.customer_fiscal_country || snapshot.customerFiscalCountry || snapshot.countryCode) || 'PT';
    const customerType = normalizeCustomerType(snapshot.customer_type || snapshot.customerType, snapshot);
    const fiscalRegion = normalizeText(snapshot.fiscal_region || snapshot.fiscalRegion) || resolveFiscalRegion(countryCode);
    const decisionMode = normalizeText(snapshot.fiscal_decision_mode || snapshot.fiscalDecisionMode) || 'auto_emit';
    const invoiceState = normalizeText(snapshot.invoice_state || snapshot.invoiceState) || 'pending_payment';
    const vatValidationStatus = normalizeText(snapshot.vat_validation_status || snapshot.vatValidationStatus).toLowerCase() || 'not_required';
    const vatRateAppliedRaw = snapshot.vat_rate_applied ?? snapshot.vatRateApplied ?? snapshot.vatRate;
    const vatRateApplied = vatRateAppliedRaw === null || vatRateAppliedRaw === '' || vatRateAppliedRaw === undefined
        ? null
        : Number(vatRateAppliedRaw);

    return {
        tax_profile: taxProfile,
        customer_fiscal_name: customerFiscalName,
        customer_fiscal_country: countryCode,
        customer_type: customerType,
        fiscal_region: fiscalRegion,
        fiscal_scenario: normalizeText(snapshot.fiscal_scenario || snapshot.fiscalScenario) || 'pt_particular_art53',
        fiscal_decision_mode: decisionMode,
        fiscal_evidence_status: normalizeText(snapshot.fiscal_evidence_status || snapshot.fiscalEvidenceStatus) || 'checkout_data',
        document_type_resolved: normalizeText(snapshot.document_type_resolved || snapshot.documentTypeResolved) || DEFAULT_DOCUMENT_TYPE,
        vat_type_resolved: normalizeText(snapshot.vat_type_resolved || snapshot.vatTypeResolved) || DEFAULT_VAT_TYPE,
        vat_rate_applied: Number.isFinite(vatRateApplied) ? vatRateApplied : null,
        vat_regime_code: normalizeText(snapshot.vat_regime_code || snapshot.vatRegimeCode),
        vat_exemption_applied: normalizeText(snapshot.vat_exemption_applied || snapshot.vatExemptionApplied),
        vat_validation_status: ['not_required', 'valid', 'invalid', 'unavailable'].includes(vatValidationStatus) ? vatValidationStatus : 'not_required',
        vat_validation_number: normalizeTaxId(snapshot.vat_validation_number || snapshot.vatValidationNumber),
        vat_validation_source: normalizeText(snapshot.vat_validation_source || snapshot.vatValidationSource || 'none') || 'none',
        vat_validation_checked_at: normalizeText(snapshot.vat_validation_checked_at || snapshot.vatValidationCheckedAt),
        vat_validation_message: normalizeText(snapshot.vat_validation_message || snapshot.vatValidationMessage),
        vat_validation_payload: snapshot.vat_validation_payload && typeof snapshot.vat_validation_payload === 'object'
            ? snapshot.vat_validation_payload
            : snapshot.vatValidationPayload && typeof snapshot.vatValidationPayload === 'object'
                ? snapshot.vatValidationPayload
                : {},
        invoice_state: invoiceState,
        fiscal_decision_reason: normalizeText(snapshot.fiscal_decision_reason || snapshot.fiscalDecisionReason),
        shipping_zone_code: normalizeText(snapshot.shipping_zone_code || snapshot.shippingZoneCode) || resolveShippingZoneCode(countryCode),
        sla_target_at: normalizeText(snapshot.sla_target_at || snapshot.slaTargetAt) || '',
        fiscal_snapshot_locked_at: normalizeText(snapshot.fiscal_snapshot_locked_at || snapshot.fiscalSnapshotLockedAt),
        fiscal_divergence_status: normalizeText(snapshot.fiscal_divergence_status || snapshot.fiscalDivergenceStatus),
        fiscal_divergence_reason: normalizeText(snapshot.fiscal_divergence_reason || snapshot.fiscalDivergenceReason)
    };
}

function refreshFiscalSnapshotForPaymentStatus(fiscalSnapshot, paymentStatus = 'pending', referenceDate = new Date()) {
    const normalized = normalizeFiscalSnapshot(fiscalSnapshot);
    const isPaid = normalizeText(paymentStatus).toLowerCase() === 'paid';
    const paidState = normalized.fiscal_decision_mode === 'manual_review'
        ? 'pending_manual_review'
        : 'ready_to_emit';
    return normalizeFiscalSnapshot({
        ...normalized,
        invoice_state: isPaid ? paidState : 'pending_payment',
        sla_target_at: normalized.sla_target_at || resolveSlaTargetAt(referenceDate, normalized.customer_fiscal_country)
    });
}

function buildFiscalSnapshot({ customer = {}, paymentStatus = 'pending', vatValidation = null, referenceDate = new Date(), taxProfile } = {}) {
    const resolvedTaxProfile = normalizeText(taxProfile) || getTaxProfile();
    const customerType = normalizeCustomerType(
        customer.customerType
        || customer.tipo_cliente
        || customer.tipoCliente,
        customer
    );
    const countryCode = resolveCheckoutCountryCode(customer);
    const fiscalRegion = resolveFiscalRegion(countryCode);
    const normalizedVatValidation = normalizeVatValidation(vatValidation || {}, {
        ...customer,
        country: countryCode
    });

    return buildBaseDecision({
        taxProfile: resolvedTaxProfile,
        customerType,
        countryCode,
        fiscalRegion,
        vatValidation: normalizedVatValidation,
        customer,
        paymentStatus,
        referenceDate
    });
}

function buildFiscalDecision(args = {}) {
    const snapshot = buildFiscalSnapshot(args);
    return {
        taxProfile: snapshot.tax_profile,
        countryCode: snapshot.customer_fiscal_country,
        customerType: snapshot.customer_type,
        fiscalRegion: snapshot.fiscal_region,
        scenario: snapshot.fiscal_scenario,
        decisionMode: snapshot.fiscal_decision_mode,
        evidenceStatus: snapshot.fiscal_evidence_status,
        invoiceState: snapshot.invoice_state,
        vatRate: snapshot.vat_rate_applied,
        vatExemption: snapshot.vat_exemption_applied,
        vatRegimeCode: snapshot.vat_regime_code,
        vatType: snapshot.vat_type_resolved,
        vatValidationStatus: snapshot.vat_validation_status,
        vatValidationNumber: snapshot.vat_validation_number,
        documentType: snapshot.document_type_resolved,
        reason: snapshot.fiscal_decision_reason,
        shippingZoneCode: snapshot.shipping_zone_code,
        slaTargetAt: snapshot.sla_target_at,
        snapshot
    };
}

function buildOrderFiscalFields({ customer = {}, paymentStatus = 'pending', referenceDate = new Date(), vatValidation = null, fiscalSnapshot = null } = {}) {
    const snapshot = fiscalSnapshot
        ? refreshFiscalSnapshotForPaymentStatus(fiscalSnapshot, paymentStatus, referenceDate)
        : buildFiscalSnapshot({ customer, paymentStatus, referenceDate, vatValidation });

    return {
        tax_profile: snapshot.tax_profile,
        customer_fiscal_name: snapshot.customer_fiscal_name || null,
        fiscal_scenario: snapshot.fiscal_scenario,
        fiscal_decision_mode: snapshot.fiscal_decision_mode,
        fiscal_evidence_status: snapshot.fiscal_evidence_status,
        customer_fiscal_country: snapshot.customer_fiscal_country,
        customer_type: snapshot.customer_type,
        vat_validation_status: snapshot.vat_validation_status,
        vat_validation_number: snapshot.vat_validation_number || null,
        document_type_resolved: snapshot.document_type_resolved,
        vat_rate_applied: snapshot.vat_rate_applied,
        vat_regime_code: snapshot.vat_regime_code || null,
        vat_exemption_applied: snapshot.vat_exemption_applied || null,
        invoice_state: snapshot.invoice_state,
        fiscal_decision_reason: snapshot.fiscal_decision_reason,
        shipping_zone_code: snapshot.shipping_zone_code,
        sla_target_at: snapshot.sla_target_at || null,
        fiscal_snapshot: snapshot
    };
}

function resolveStoredFiscalSnapshot(order = {}, meta = {}) {
    const checkoutPayload = order?.checkout_payload && typeof order.checkout_payload === 'object'
        ? order.checkout_payload
        : {};
    const sources = [
        order?.fiscal_snapshot,
        checkoutPayload?.fiscalSnapshot,
        checkoutPayload?.fiscal_snapshot,
        meta?.fiscalSnapshot,
        {
            tax_profile: order?.tax_profile,
            customer_fiscal_name: order?.customer_fiscal_name,
            fiscal_scenario: order?.fiscal_scenario,
            fiscal_decision_mode: order?.fiscal_decision_mode,
            fiscal_evidence_status: order?.fiscal_evidence_status,
            customer_fiscal_country: order?.customer_fiscal_country,
            customer_type: order?.customer_type,
            vat_validation_status: order?.vat_validation_status,
            vat_validation_number: order?.vat_validation_number,
            document_type_resolved: order?.document_type_resolved,
            vat_rate_applied: order?.vat_rate_applied,
            vat_regime_code: order?.vat_regime_code,
            vat_exemption_applied: order?.vat_exemption_applied,
            invoice_state: order?.invoice_state,
            fiscal_decision_reason: order?.fiscal_decision_reason,
            shipping_zone_code: order?.shipping_zone_code,
            sla_target_at: order?.sla_target_at
        }
    ].filter((entry) => entry && typeof entry === 'object');

    const merged = sources.reduce((acc, source) => ({ ...acc, ...source }), {});
    return normalizeFiscalSnapshot(merged);
}

function resolveFiscalSnapshotForPayment(order = {}, meta = {}, paymentStatus = 'paid', referenceDate = new Date()) {
    return refreshFiscalSnapshotForPaymentStatus(resolveStoredFiscalSnapshot(order, meta), paymentStatus, referenceDate);
}

function detectFiscalSnapshotDivergence(fiscalSnapshot = {}, customer = {}) {
    const snapshot = normalizeFiscalSnapshot(fiscalSnapshot);
    const customerName = normalizeText(customer.empresa || customer.nome);
    const customerTaxId = normalizeTaxId(customer.nif || customer.vat_number || customer.vatNumber);
    const customerCountry = resolveCheckoutCountryCode(customer);
    const customerType = normalizeCustomerType(customer.tipo_cliente || customer.customerType, customer);
    const diffs = [];

    const expectedName = normalizeText(customerType === 'empresa' ? customer.empresa || customer.nome : customer.nome || customer.empresa);
    const snapshotName = normalizeText(
        fiscalSnapshot.customer_fiscal_name
        || fiscalSnapshot.customerFiscalName
        || fiscalSnapshot.customer_name
        || fiscalSnapshot.customerName
    );
    if (snapshotName && expectedName && snapshotName !== expectedName) {
        diffs.push('nome fiscal');
    }

    if (snapshot.vat_validation_number && customerTaxId && snapshot.vat_validation_number !== customerTaxId) {
        diffs.push('NIF/VAT');
    }

    if (snapshot.customer_fiscal_country && customerCountry && snapshot.customer_fiscal_country !== customerCountry) {
        diffs.push('país fiscal');
    }

    if (snapshot.customer_type && customerType && snapshot.customer_type !== customerType) {
        diffs.push('tipo de cliente');
    }

    if (snapshot.tax_profile && snapshot.tax_profile !== getTaxProfile()) {
        diffs.push('perfil fiscal');
    }

    return {
        diverged: diffs.length > 0,
        fields: diffs,
        reason: diffs.length > 0
            ? `Os dados atuais diferem do snapshot fiscal emitido: ${diffs.join(', ')}.`
            : ''
    };
}

module.exports = {
    DEFAULT_DOCUMENT_TYPE,
    DEFAULT_TAX_PROFILE,
    DEFAULT_VAT_TYPE,
    EU_COUNTRIES,
    VAT_EXEMPTION_LABELS,
    buildFiscalDecision,
    buildFiscalSnapshot,
    buildOrderFiscalFields,
    detectFiscalSnapshotDivergence,
    getTaxProfile,
    normalizeCountryCode,
    normalizeCustomerType,
    normalizeFiscalSnapshot,
    normalizeVatValidation,
    refreshFiscalSnapshotForPaymentStatus,
    resolveCheckoutCountryCode,
    resolveFiscalRegion,
    resolveFiscalSnapshotForPayment,
    resolveShippingZoneCode,
    resolveSlaHours,
    resolveSlaTargetAt,
    resolveStoredFiscalSnapshot
};
