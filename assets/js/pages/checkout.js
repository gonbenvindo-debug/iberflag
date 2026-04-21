// ===== CHECKOUT PAGE LOGIC =====

const FREE_SHIPPING_THRESHOLD = 0;
const SHIPPING_COST = 0;
const DESIGN_REVIEW_FEE = 5;

// ===== DOM ELEMENTS =====
const checkoutForm = document.getElementById('checkout-form');
const orderItems = document.getElementById('order-items');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const totalEl = document.getElementById('total');
const remainingEl = document.getElementById('remaining');
const freeShippingMsg = document.getElementById('free-shipping-msg');
const placeOrderBtn = document.getElementById('place-order-btn');
const designReviewCheckbox = document.getElementById('design-review-checkbox');
const designReviewRow = document.getElementById('design-review-row');
const designReviewAmountEl = document.getElementById('design-review-amount');
const termsCheckbox = document.getElementById('terms-checkbox');
const checkoutFeedback = document.getElementById('checkout-feedback');
const customerTypeSelect = document.getElementById('customer-type-select');
const customerTypeDescription = document.getElementById('customer-type-description');
const nifInput = document.getElementById('nif-input');
const phoneInput = checkoutForm?.elements?.telefone || null;
const emailInput = checkoutForm?.elements?.email || null;
const postalCodeInput = checkoutForm?.elements?.codigo_postal || null;
const cityInput = checkoutForm?.elements?.cidade || null;
const companyInput = checkoutForm?.elements?.empresa || null;
const contactNameLabel = document.getElementById('contact-name-label');
const companyLabel = document.getElementById('company-label');
const nifLabel = document.getElementById('nif-label');
const nifHelp = document.getElementById('nif-help');
const companyLookupStatus = document.getElementById('company-lookup-status');
const companyFieldRow = document.getElementById('company-field-row');
const toggleOrderNotesBtn = document.getElementById('toggle-order-notes');
const orderNotesField = document.getElementById('order-notes-field');
const notesTextarea = checkoutForm?.elements?.notas || null;
const countrySelect = document.getElementById('country-select');
const addressCountrySelect = document.getElementById('address-country-select');
const addressRegionSelect = document.getElementById('address-region-select');
const addressMunicipalitySelect = document.getElementById('address-municipality-select');
const addressRegionLabel = document.getElementById('address-region-label');
const addressMunicipalityLabel = document.getElementById('address-municipality-label');
const fiscalSummaryName = document.getElementById('fiscal-summary-name');
const fiscalSummaryDocument = document.getElementById('fiscal-summary-document');
const fiscalSummaryTaxId = document.getElementById('fiscal-summary-tax-id');
const fiscalSummaryRegime = document.getElementById('fiscal-summary-regime');
const fiscalSummaryCountry = document.getElementById('fiscal-summary-country');
const fiscalSummaryTreatment = document.getElementById('fiscal-summary-treatment');
const fiscalSummaryWarning = document.getElementById('fiscal-summary-warning');

const PLACE_ORDER_DEFAULT_LABEL = '<i data-lucide="lock" class="w-5 h-5"></i> Finalizar Encomenda';
const COMMON_EMAIL_DOMAIN_FIXES = {
    'gmail.com.pt': 'gmail.com',
    'gmail.pt': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'outlook.con': 'outlook.com'
};
const companyLookupCache = new Map();
const COMPANY_LOOKUP_DEBOUNCE_MS = 500;
const POSTAL_LOOKUP_DEBOUNCE_MS = 650;
const LOCATION_HELPERS = window.IBERFLAG_LOCATION_HELPERS || {};
const COUNTRY_LABELS = {
    PT: 'Portugal',
    ES: 'Espanha',
    FR: 'França',
    DE: 'Alemanha',
    IT: 'Itália',
    NL: 'Países Baixos',
    BE: 'Bélgica',
    IE: 'Irlanda',
    LU: 'Luxemburgo',
    AT: 'Áustria',
    PL: 'Polónia',
    CZ: 'Chéquia',
    SE: 'Suécia',
    DK: 'Dinamarca',
    FI: 'Finlândia',
    RO: 'Roménia',
    BG: 'Bulgária',
    HR: 'Croácia',
    GR: 'Grécia',
    HU: 'Hungria',
    LT: 'Lituânia',
    LV: 'Letónia',
    SI: 'Eslovénia',
    SK: 'Eslováquia',
    EE: 'Estónia',
    CY: 'Chipre',
    MT: 'Malta',
    US: 'Estados Unidos',
    GB: 'Reino Unido',
    CH: 'Suíça',
    BR: 'Brasil',
    AO: 'Angola',
    MZ: 'Moçambique',
    OTHER: 'Outro país'
};
const EU_COUNTRIES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE'
]);
let companyLookupInFlight = false;
let companyLookupDebounceTimer = null;
let beginCheckoutTracked = false;
let latestVatValidation = null;
let postalLookupDebounceTimer = null;
let postalLookupController = null;
let latestPostalLookupKey = '';
let addressCountryTouched = false;
let lastAutoCityValue = '';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setElementHidden(element, hidden) {
    if (!element) {
        return;
    }

    element.classList.toggle('hidden', hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function normalizeTaxId(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeCheckoutEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function validateCheckoutEmail(value) {
    const normalized = normalizeCheckoutEmail(value);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return {
            valid: false,
            normalized,
            message: 'Introduza um email valido.'
        };
    }

    const domain = normalized.split('@').pop();
    const suggestedDomain = COMMON_EMAIL_DOMAIN_FIXES[domain];
    if (suggestedDomain) {
        return {
            valid: false,
            normalized,
            suggestion: normalized.replace(/@[^@]+$/, `@${suggestedDomain}`),
            message: `O dominio do email parece invalido: @${domain}. Queria dizer @${suggestedDomain}?`
        };
    }

    return {
        valid: true,
        normalized,
        message: ''
    };
}

function updateEmailValidity({ normalizeInput = false } = {}) {
    const emailInput = checkoutForm?.elements?.email;
    if (!emailInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const validation = validateCheckoutEmail(emailInput.value);
    if (normalizeInput) {
        emailInput.value = validation.normalized;
    }
    emailInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function normalizeCustomerType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'empresa') {
        return 'empresa';
    }
    return 'particular';
}

function getSelectedCustomerType() {
    return normalizeCustomerType(customerTypeSelect?.value || 'particular');
}

function getSelectedFiscalCountry() {
    const normalized = String(countrySelect?.value || 'PT').trim().toUpperCase();
    return normalized || 'PT';
}

function getSelectedAddressCountry() {
    const normalized = String(addressCountrySelect?.value || getSelectedFiscalCountry() || 'PT').trim().toUpperCase();
    return ['PT', 'ES'].includes(normalized) ? normalized : 'PT';
}

function getLocationConfig(countryCode = getSelectedAddressCountry()) {
    return LOCATION_HELPERS[String(countryCode || '').trim().toUpperCase()] || LOCATION_HELPERS.PT || null;
}

function getFiscalCountryLabel(countryCode = '') {
    return COUNTRY_LABELS[String(countryCode || '').trim().toUpperCase()] || String(countryCode || '—').trim() || '—';
}

function isEuCountry(countryCode = '') {
    return EU_COUNTRIES.has(String(countryCode || '').trim().toUpperCase());
}

function isBusinessCustomerSelected() {
    return getSelectedCustomerType() === 'empresa';
}

function detectTaxCountry(value, postalCode = '') {
    const explicitCountry = getSelectedFiscalCountry();
    if (explicitCountry) {
        return explicitCountry;
    }

    const normalized = normalizeTaxId(value);
    const normalizedPostalCode = String(postalCode || '').trim().toUpperCase();

    if (/^[XYZ]\d{7}[A-Z]$/.test(normalized) || /^[A-Z]\d{7}[A-Z0-9]$/.test(normalized)) {
        return 'ES';
    }

    if (/^\d{5}(-\d{4})?$/.test(normalizedPostalCode)) {
        return 'ES';
    }

    return 'PT';
}

function isValidPortugueseNif(value) {
    const nif = normalizeTaxId(value);
    if (!/^[1235689]\d{8}$/.test(nif)) {
        return false;
    }

    const digits = nif.split('').map((digit) => Number.parseInt(digit, 10));
    const sum = digits.slice(0, 8).reduce((acc, digit, index) => acc + (digit * (9 - index)), 0);
    const rawCheckDigit = 11 - (sum % 11);
    const checkDigit = rawCheckDigit >= 10 ? 0 : rawCheckDigit;
    return checkDigit === digits[8];
}

function getSpanishControlLetter(number) {
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    return letters[Number(number) % 23];
}

function isValidSpanishDniOrNie(value) {
    const taxId = normalizeTaxId(value);

    if (/^\d{8}[A-Z]$/.test(taxId)) {
        return getSpanishControlLetter(taxId.slice(0, 8)) === taxId[8];
    }

    if (/^[XYZ]\d{7}[A-Z]$/.test(taxId)) {
        const prefixMap = { X: '0', Y: '1', Z: '2' };
        const number = `${prefixMap[taxId[0]]}${taxId.slice(1, 8)}`;
        return getSpanishControlLetter(number) === taxId[8];
    }

    return false;
}

function isValidSpanishCif(value) {
    const cif = normalizeTaxId(value);
    if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(cif)) {
        return false;
    }

    const digits = cif.slice(1, 8).split('').map((digit) => Number.parseInt(digit, 10));
    const evenSum = digits[1] + digits[3] + digits[5];
    const oddSum = [digits[0], digits[2], digits[4], digits[6]].reduce((sum, digit) => {
        const doubled = digit * 2;
        return sum + Math.floor(doubled / 10) + (doubled % 10);
    }, 0);
    const controlNumber = (10 - ((evenSum + oddSum) % 10)) % 10;
    const controlLetter = 'JABCDEFGHI'[controlNumber];
    const control = cif[8];
    const first = cif[0];

    if ('KPQSW'.includes(first)) {
        return control === controlLetter;
    }

    if ('ABEH'.includes(first)) {
        return control === String(controlNumber);
    }

    return control === String(controlNumber) || control === controlLetter;
}

function validateTaxId(value, postalCode = '') {
    const normalized = normalizeTaxId(value);
    if (!normalized) {
        return { valid: true, normalized, message: '' };
    }

    const country = detectTaxCountry(normalized, postalCode);
    const valid = country === 'ES'
        ? isValidSpanishDniOrNie(normalized) || isValidSpanishCif(normalized)
        : country === 'PT'
            ? isValidPortugueseNif(normalized)
            : /^[A-Z0-9]{2,14}$/.test(normalized);

    return {
        valid,
        normalized,
        message: valid
            ? ''
            : country === 'ES'
                ? 'NIF/NIE espanhol invalido. Verifique o numero fiscal antes de continuar.'
            : country === 'PT'
                ? 'NIF portugues invalido. Verifique os 9 digitos antes de continuar.'
                : 'VAT/NIF intracomunitario invalido. Verifique o numero fiscal antes de continuar.'
    };
}

function normalizeCheckoutPhone(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    let normalized = raw.replace(/[^\d+]/g, '');
    if (normalized.startsWith('00')) {
        normalized = `+${normalized.slice(2)}`;
    }

    if (normalized.startsWith('+')) {
        return `+${normalized.slice(1).replace(/\D/g, '')}`;
    }

    return normalized.replace(/\D/g, '');
}

function normalizePostalCode(value, country = 'PT') {
    const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
        return '';
    }

    if (String(country || '').toUpperCase() === 'ES') {
        return normalized.replace(/[^\d]/g, '').slice(0, 5);
    }

    if (String(country || '').toUpperCase() !== 'PT') {
        return normalized.slice(0, 16);
    }

    const digits = normalized.replace(/[^\d]/g, '').slice(0, 7);
    if (digits.length === 7) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    return normalized;
}

function normalizeLocationKey(value) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function setSelectOptions(select, options, placeholder = '') {
    if (!select) {
        return;
    }

    select.innerHTML = '';
    if (placeholder) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        select.appendChild(option);
    }

    options.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
    });
}

function getAddressRegions() {
    const config = getLocationConfig();
    return Array.isArray(config?.regions) ? config.regions : [];
}

function findAddressRegion(regionName = '') {
    const wanted = normalizeLocationKey(regionName);
    if (!wanted) {
        return null;
    }

    return getAddressRegions().find((region) => (
        normalizeLocationKey(region.name) === wanted
        || normalizeLocationKey(region.code) === wanted
    )) || null;
}

function findAddressMunicipality(region, municipalityName = '') {
    const wanted = normalizeLocationKey(municipalityName);
    if (!region || !wanted) {
        return '';
    }

    return (region.municipalities || []).find((municipality) => normalizeLocationKey(municipality) === wanted) || '';
}

function syncFiscalCountryFromAddress() {
    const addressCountry = getSelectedAddressCountry();
    if (!countrySelect || countrySelect.value === addressCountry) {
        return;
    }

    countrySelect.value = addressCountry;
    applyVatValidationResult(null);
    updateTaxIdValidity();
    updatePhoneValidity();
    updateFiscalSummary();
    scheduleCompanyLookup();
}

function syncAddressCountryFromFiscal({ force = false } = {}) {
    if (!addressCountrySelect) {
        return;
    }

    const fiscalCountry = getSelectedFiscalCountry();
    if (!['PT', 'ES'].includes(fiscalCountry)) {
        return;
    }

    if (!force && addressCountryTouched && addressCountrySelect.value !== fiscalCountry) {
        return;
    }

    addressCountrySelect.value = fiscalCountry;
}

function updateAddressLabels() {
    const config = getLocationConfig();
    if (addressRegionLabel) {
        addressRegionLabel.textContent = `${config?.regionLabel || 'Distrito / província'} *`;
    }
    if (addressMunicipalityLabel) {
        addressMunicipalityLabel.textContent = `${config?.municipalityLabel || 'Concelho / município'} *`;
    }
    if (postalCodeInput && config?.postalPlaceholder) {
        postalCodeInput.placeholder = config.postalPlaceholder;
    }
}

function populateAddressMunicipalities({ preserveValue = true } = {}) {
    if (!addressMunicipalitySelect) {
        return;
    }

    const previousValue = preserveValue ? addressMunicipalitySelect.value : '';
    const region = findAddressRegion(addressRegionSelect?.value || '');
    const municipalityLabel = getLocationConfig()?.municipalityLabel || 'concelho';
    if (!region) {
        setSelectOptions(addressMunicipalitySelect, [], `Escolha primeiro o ${getLocationConfig()?.regionLabel?.toLowerCase() || 'distrito'}`);
        addressMunicipalitySelect.value = '';
        addressMunicipalitySelect.disabled = true;
        return;
    }

    addressMunicipalitySelect.disabled = false;
    setSelectOptions(
        addressMunicipalitySelect,
        (region.municipalities || []).map((municipality) => ({ value: municipality, label: municipality })),
        `Escolha o ${municipalityLabel.toLowerCase()}`
    );

    const matchingValue = findAddressMunicipality(region, previousValue);
    if (matchingValue) {
        addressMunicipalitySelect.value = matchingValue;
    }
}

function populateAddressRegions({ preserveValue = true } = {}) {
    if (!addressRegionSelect) {
        return;
    }

    updateAddressLabels();

    const previousValue = preserveValue ? addressRegionSelect.value : '';
    const regions = getAddressRegions();
    setSelectOptions(
        addressRegionSelect,
        regions.map((region) => ({ value: region.name, label: region.name })),
        `Escolha o ${(getLocationConfig()?.regionLabel || 'distrito').toLowerCase()}`
    );

    const matchingRegion = findAddressRegion(previousValue);
    addressRegionSelect.value = matchingRegion?.name || '';
    populateAddressMunicipalities({ preserveValue });
}

function setAddressSelection({ country, region, municipality, city, forceCity = false } = {}) {
    if (country && addressCountrySelect && ['PT', 'ES'].includes(String(country).toUpperCase())) {
        addressCountrySelect.value = String(country).toUpperCase();
        populateAddressRegions({ preserveValue: false });
    }

    if (region && addressRegionSelect) {
        const matchingRegion = findAddressRegion(region);
        if (matchingRegion) {
            addressRegionSelect.value = matchingRegion.name;
            populateAddressMunicipalities({ preserveValue: false });
        }
    }

    if (municipality && addressMunicipalitySelect) {
        const selectedRegion = findAddressRegion(addressRegionSelect?.value || '');
        const matchingMunicipality = findAddressMunicipality(selectedRegion, municipality);
        if (matchingMunicipality) {
            addressMunicipalitySelect.value = matchingMunicipality;
        }
    }

    const resolvedCity = String(city || municipality || addressMunicipalitySelect?.value || '').trim();
    if (cityInput && resolvedCity && (forceCity || !cityInput.value.trim() || cityInput.value === lastAutoCityValue)) {
        cityInput.value = resolvedCity;
        lastAutoCityValue = resolvedCity;
    }
}

function syncCityFromMunicipality({ force = false } = {}) {
    const municipality = String(addressMunicipalitySelect?.value || '').trim();
    if (!municipality || !cityInput) {
        return;
    }

    if (force || !cityInput.value.trim() || cityInput.value === lastAutoCityValue) {
        cityInput.value = municipality;
        lastAutoCityValue = municipality;
    }
}

function inferAddressCountryFromPostalCode(value = '') {
    const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (/^\d{4}-?\d{3}$/.test(raw)) {
        return 'PT';
    }
    if (/^\d{5}$/.test(raw)) {
        return 'ES';
    }
    return '';
}

function isPostalCodeReadyForLookup(value = '', country = getSelectedAddressCountry()) {
    const normalized = normalizePostalCode(value, country);
    return country === 'PT'
        ? /^\d{4}-\d{3}$/.test(normalized)
        : country === 'ES'
            ? /^\d{5}$/.test(normalized)
            : false;
}

function clearPostalLookupDebounce() {
    if (postalLookupDebounceTimer) {
        window.clearTimeout(postalLookupDebounceTimer);
        postalLookupDebounceTimer = null;
    }
}

async function lookupPostalCode({ force = false } = {}) {
    if (!postalCodeInput || typeof fetch !== 'function') {
        return;
    }

    const inferredCountry = inferAddressCountryFromPostalCode(postalCodeInput.value);
    if (inferredCountry && addressCountrySelect?.value !== inferredCountry) {
        addressCountrySelect.value = inferredCountry;
        populateAddressRegions({ preserveValue: false });
        syncFiscalCountryFromAddress();
    }

    const country = getSelectedAddressCountry();
    const normalized = normalizePostalCode(postalCodeInput.value, country);
    if (!isPostalCodeReadyForLookup(normalized, country)) {
        return;
    }

    const lookupKey = `${country}:${normalized}`;
    if (!force && lookupKey === latestPostalLookupKey) {
        return;
    }
    latestPostalLookupKey = lookupKey;

    try {
        if (postalLookupController) {
            postalLookupController.abort();
        }
        postalLookupController = new AbortController();

        const response = await fetch(`https://api.zippopotam.us/${country.toLowerCase()}/${encodeURIComponent(normalized)}`, {
            signal: postalLookupController.signal
        });
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const place = Array.isArray(data?.places) ? data.places[0] : null;
        if (!place) {
            return;
        }

        setAddressSelection({
            country,
            region: place.state,
            municipality: place['place name'],
            city: place['place name'],
            forceCity: false
        });
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.warn('Não foi possível preencher a morada pelo código postal:', error);
        }
    }
}

function schedulePostalLookup() {
    clearPostalLookupDebounce();
    if (!postalCodeInput) {
        return;
    }

    const inferredCountry = inferAddressCountryFromPostalCode(postalCodeInput.value);
    const lookupCountry = inferredCountry || getSelectedAddressCountry();
    if (!isPostalCodeReadyForLookup(postalCodeInput.value, lookupCountry)) {
        return;
    }

    postalLookupDebounceTimer = window.setTimeout(() => {
        postalLookupDebounceTimer = null;
        void lookupPostalCode();
    }, POSTAL_LOOKUP_DEBOUNCE_MS);
}

function validateCheckoutPhone(value, postalCode = '', taxId = '') {
    const normalized = normalizeCheckoutPhone(value);
    const country = detectTaxCountry(taxId, postalCode);
    if (!normalized) {
        return {
            valid: false,
            normalized,
            message: 'Introduza um numero de telemovel ou telefone valido.'
        };
    }

    const digits = normalized.replace(/^\+/, '');

    if (digits.startsWith('351')) {
        const localNumber = digits.slice(3);
        return {
            valid: /^[29]\d{8}$/.test(localNumber),
            normalized: `+${digits}`,
            message: /^[29]\d{8}$/.test(localNumber)
                ? ''
                : 'O numero de contacto portugues parece invalido.'
        };
    }

    if (digits.startsWith('34')) {
        const localNumber = digits.slice(2);
        return {
            valid: /^[6789]\d{8}$/.test(localNumber),
            normalized: `+${digits}`,
            message: /^[6789]\d{8}$/.test(localNumber)
                ? ''
                : 'O numero de contacto espanhol parece invalido.'
        };
    }

    if (country === 'ES' || /^[678]\d{8}$/.test(digits)) {
        return {
            valid: /^[6789]\d{8}$/.test(digits),
            normalized: `+34${digits}`,
            country: 'ES',
            message: /^[6789]\d{8}$/.test(digits)
                ? ''
                : 'Introduza um numero espanhol com 9 digitos valido.'
        };
    }

    if (country !== 'PT' && country !== 'ES') {
        const validInternational = /^\d{6,15}$/.test(digits);
        return {
            valid: validInternational,
            normalized: normalized.startsWith('+') ? normalized : `+${digits}`,
            country,
            message: validInternational
                ? ''
                : 'Introduza um numero internacional valido com indicativo.'
        };
    }

    return {
        valid: /^[29]\d{8}$/.test(digits),
        normalized: `+351${digits}`,
        message: /^[29]\d{8}$/.test(digits)
            ? ''
            : 'Introduza um numero portugues com 9 digitos valido.'
    };
}

function updatePhoneValidity({ normalizeInput = false } = {}) {
    if (!phoneInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const validation = validateCheckoutPhone(
        phoneInput.value,
        postalCodeInput?.value || '',
        nifInput?.value || ''
    );
    if (normalizeInput) {
        phoneInput.value = validation.normalized;
    }
    phoneInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function updatePostalCodeFormatting() {
    if (!postalCodeInput) {
        return '';
    }

    const normalizedCountry = getSelectedAddressCountry();
    const normalized = normalizePostalCode(postalCodeInput.value, normalizedCountry);
    postalCodeInput.value = normalized;
    return normalized;
}

function updateTaxIdValidity() {
    if (!nifInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const postalCode = postalCodeInput?.value || '';
    const validation = validateTaxId(nifInput.value, postalCode);
    nifInput.value = validation.normalized;
    const nifRequired = isBusinessCustomerSelected();
    if (nifRequired && !validation.normalized) {
        nifInput.setCustomValidity('Para faturacao empresarial o NIF e obrigatorio.');
        return {
            valid: false,
            normalized: validation.normalized,
            message: 'Para faturacao empresarial o NIF e obrigatorio.'
        };
    }

    nifInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function updateCompanyValidity() {
    if (!companyInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const normalized = String(companyInput.value || '').trim();
    const required = isBusinessCustomerSelected();
    const message = required && !normalized
        ? 'Indique o nome fiscal da empresa.'
        : '';

    companyInput.setCustomValidity(message);
    return {
        valid: !message,
        normalized,
        message
    };
}

function setCompanyLookupStatus(message = '', type = 'info') {
    if (!companyLookupStatus) {
        return;
    }

    if (!message) {
        companyLookupStatus.classList.add('hidden');
        companyLookupStatus.textContent = '';
        companyLookupStatus.className = 'hidden';
        return;
    }

    const palette = {
        info: 'checkout-inline-status text-slate-600 bg-slate-50 border-slate-200',
        success: 'checkout-inline-status text-emerald-700 bg-emerald-50 border-emerald-200',
        warning: 'checkout-inline-status text-amber-700 bg-amber-50 border-amber-200',
        error: 'checkout-inline-status text-red-700 bg-red-50 border-red-200'
    };

    companyLookupStatus.className = palette[type] || palette.info;
    companyLookupStatus.textContent = message;
}

function setCompanyLookupLoading(isLoading) {
    companyLookupInFlight = isLoading;
    if (!nifInput) {
        return;
    }

    nifInput.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

function clearCompanyLookupDebounce() {
    if (companyLookupDebounceTimer) {
        window.clearTimeout(companyLookupDebounceTimer);
        companyLookupDebounceTimer = null;
    }
}

function isTaxIdLookupReady(normalized, postalCode = '') {
    if (!normalized) {
        return false;
    }

    const country = detectTaxCountry(normalized, postalCode);
    if (country === 'PT') {
        return /^\d{9}$/.test(normalized);
    }

    if (country !== 'ES') {
        return /^[A-Z0-9]{2,14}$/.test(normalized);
    }

    return /^[A-Z]\d{7}[A-Z0-9]$/.test(normalized) || /^\d{8}[A-Z]$/.test(normalized);
}

function scheduleCompanyLookup() {
    clearCompanyLookupDebounce();

    if (!isBusinessCustomerSelected() || !nifInput) {
        return;
    }

    const validation = updateTaxIdValidity();
    if (!validation.normalized) {
        setCompanyLookupStatus('');
        return;
    }

    if (!isTaxIdLookupReady(validation.normalized, postalCodeInput?.value || '') || !validation.valid) {
        return;
    }

    companyLookupDebounceTimer = window.setTimeout(() => {
        companyLookupDebounceTimer = null;
        void lookupCompanyByTaxId();
    }, COMPANY_LOOKUP_DEBOUNCE_MS);
}

function applyCompanyLookupResult(customer = {}) {
    if (!customer || typeof customer !== 'object') {
        return;
    }

    if (companyInput && !String(companyInput.value || '').trim() && String(customer.empresa || '').trim()) {
        companyInput.value = String(customer.empresa || '').trim();
    }

    if (cityInput && !String(cityInput.value || '').trim() && String(customer.cidade || '').trim()) {
        cityInput.value = String(customer.cidade || '').trim();
    }

    updateCompanyValidity();
}

function applyVatValidationResult(vatValidation = null) {
    latestVatValidation = vatValidation && typeof vatValidation === 'object'
        ? { ...vatValidation }
        : null;
    updateFiscalSummary();
}

function getCurrentVatValidationStatus() {
    return String(latestVatValidation?.status || 'not_required').trim().toLowerCase() || 'not_required';
}

function buildFiscalSummaryState() {
    const customerType = getSelectedCustomerType();
    const countryCode = getSelectedFiscalCountry();
    const taxId = normalizeTaxId(nifInput?.value || '');
    const companyName = String(companyInput?.value || '').trim();
    const personName = String(checkoutForm?.elements?.nome?.value || '').trim();
    const fiscalName = customerType === 'empresa'
        ? (companyName || personName || 'Por definir')
        : (personName || 'Por definir');
    const vatValidationStatus = getCurrentVatValidationStatus();

    let treatment = 'Sem liquidação de IVA (M10)';
    let warning = '';

    if (!countryCode || countryCode === 'OTHER' || !isEuCountry(countryCode)) {
        treatment = 'Revisão manual antes de emitir';
        warning = 'Este país fica fora da emissão automática. O pagamento pode avançar, mas a faturação segue para revisão manual.';
    } else if (customerType === 'empresa' && countryCode !== 'PT' && vatValidationStatus === 'valid') {
        treatment = 'Empresa UE validada em VIES';
    } else if (customerType === 'empresa' && countryCode !== 'PT' && vatValidationStatus === 'invalid') {
        treatment = 'Faturação normal sem benefício intracomunitário';
        warning = latestVatValidation?.message || 'O VAT não foi validado no VIES. A compra pode continuar, mas sem tratamento intracomunitário.';
    } else if (customerType === 'empresa' && countryCode !== 'PT' && vatValidationStatus === 'unavailable') {
        treatment = 'Faturação normal sem benefício intracomunitário';
        warning = latestVatValidation?.message || 'O VIES está indisponível. A compra pode continuar, mas sem tratamento intracomunitário automático.';
    }

    return {
        fiscalName,
        countryCode,
        taxId: taxId || '—',
        treatment,
        warning
    };
}

function updateFiscalSummary() {
    const summary = buildFiscalSummaryState();

    if (fiscalSummaryName) {
        fiscalSummaryName.textContent = summary.fiscalName;
    }
    if (fiscalSummaryDocument) {
        fiscalSummaryDocument.textContent = 'Factura Recibo';
    }
    if (fiscalSummaryTaxId) {
        fiscalSummaryTaxId.textContent = summary.taxId;
    }
    if (fiscalSummaryRegime) {
        fiscalSummaryRegime.textContent = 'Artigo 53.º do CIVA';
    }
    if (fiscalSummaryCountry) {
        fiscalSummaryCountry.textContent = getFiscalCountryLabel(summary.countryCode);
    }
    if (fiscalSummaryTreatment) {
        fiscalSummaryTreatment.textContent = summary.treatment;
    }
    if (fiscalSummaryWarning) {
        const hasWarning = Boolean(String(summary.warning || '').trim());
        fiscalSummaryWarning.textContent = summary.warning || '';
        fiscalSummaryWarning.classList.toggle('hidden', !hasWarning);
    }
}

async function lookupCompanyByTaxId({ force = false } = {}) {
    if (!isBusinessCustomerSelected() || !nifInput) {
        return null;
    }

    const taxValidation = updateTaxIdValidity();
    if (!taxValidation.valid || !taxValidation.normalized) {
        return null;
    }

    const cacheKey = taxValidation.normalized;
    if (!force && companyLookupCache.has(cacheKey)) {
        const cached = companyLookupCache.get(cacheKey);
        applyVatValidationResult(cached?.vatValidation || null);
        if (cached?.found && cached.customer) {
            applyCompanyLookupResult(cached.customer);
            setCompanyLookupStatus(`Dados encontrados em ${cached.sourceLabel || 'registos anteriores'}.`, 'success');
        } else if (cached?.vatValidation?.status === 'invalid' || cached?.vatValidation?.status === 'unavailable') {
            setCompanyLookupStatus(cached.vatValidation.message || 'Nao foi possivel validar o VAT automaticamente.', 'warning');
        }
        return cached;
    }

    if (companyLookupInFlight) {
        return null;
    }

    setCompanyLookupLoading(true);
    setCompanyLookupStatus('A procurar dados fiscais para este NIF...', 'info');

    try {
        const response = await fetch('/api/checkout/company-lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taxId: taxValidation.normalized,
                postalCode: postalCodeInput?.value || '',
                customerType: getSelectedCustomerType(),
                country: getSelectedFiscalCountry()
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = String(payload?.message || 'Nao foi possivel procurar a empresa pelo NIF.');
            setCompanyLookupStatus(message, 'warning');
            return null;
        }

        companyLookupCache.set(cacheKey, payload || {});
        applyVatValidationResult(payload?.vatValidation || null);

        if (payload?.found && payload?.customer) {
            applyCompanyLookupResult(payload.customer);
            const vatWarning = payload?.vatValidation?.status === 'invalid' || payload?.vatValidation?.status === 'unavailable'
                ? ` ${payload.vatValidation.message || ''}`.trim()
                : '';
            setCompanyLookupStatus(
                `Nome fiscal encontrado em ${payload.sourceLabel || 'registos existentes'} e aplicado aos campos em falta.${vatWarning ? ` ${vatWarning}` : ''}`,
                vatWarning ? 'warning' : 'success'
            );
            return payload;
        }

        if (payload?.vatValidation?.status === 'invalid' || payload?.vatValidation?.status === 'unavailable') {
            setCompanyLookupStatus(payload.vatValidation.message || 'Nao foi possivel validar o VAT automaticamente.', 'warning');
        } else {
            setCompanyLookupStatus('Nao encontrámos dados automaticos para este NIF. Podes continuar e preencher manualmente.', 'info');
        }
        return payload;
    } catch (error) {
        console.warn('Falha ao procurar empresa por NIF:', error);
        setCompanyLookupStatus('Nao foi possivel procurar dados automaticos agora. Podes continuar manualmente.', 'warning');
        return null;
    } finally {
        setCompanyLookupLoading(false);
    }
}

function syncCustomerTypeUI() {
    const business = isBusinessCustomerSelected();

    if (customerTypeDescription) {
        customerTypeDescription.textContent = business
            ? 'Mostramos os campos fiscais da empresa e tentamos preencher o nome fiscal pelo NIF.'
            : 'Mantemos apenas os dados pessoais essenciais. O NIF continua opcional.';
    }

    if (contactNameLabel) {
        contactNameLabel.textContent = business ? 'Pessoa de contacto *' : 'Nome completo *';
    }

    if (companyLabel) {
        companyLabel.textContent = 'Empresa *';
    }

    if (nifLabel) {
        nifLabel.textContent = business ? 'NIF / VAT / CIF *' : 'NIF / NIE (opcional)';
    }

    if (nifHelp) {
        nifHelp.textContent = business
            ? 'Para faturacao empresarial precisamos do NIF valido e, se existir, tentamos preencher os dados automaticamente.'
            : 'Se preencher, o numero fiscal tem de ser valido para emitirmos a fatura.';
    }

    if (companyFieldRow) {
        setElementHidden(companyFieldRow, !business);
    }

    if (companyInput) {
        companyInput.required = business;
        if (!business) {
            companyInput.value = '';
            companyInput.setCustomValidity('');
        }
    }

    if (nifInput) {
        nifInput.required = business;
    }

    updateCompanyValidity();
    updateTaxIdValidity();
    updateFiscalSummary();
    clearCheckoutFeedback();

    if (!business) {
        clearCompanyLookupDebounce();
        setCompanyLookupStatus('');
        applyVatValidationResult(null);
    }
}

function syncOrderNotesVisibility({ forceOpen = null } = {}) {
    const shouldOpen = forceOpen === null
        ? Boolean(String(notesTextarea?.value || '').trim())
        : Boolean(forceOpen);

    setElementHidden(orderNotesField, !shouldOpen);

    if (toggleOrderNotesBtn) {
        toggleOrderNotesBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        toggleOrderNotesBtn.textContent = shouldOpen
            ? 'Remover nota da encomenda'
            : 'Adicionar nota a encomenda';
    }

    if (!shouldOpen && notesTextarea) {
        notesTextarea.value = '';
    }
}

function isSupabaseReady() {
    return Boolean(supabaseClient && typeof supabaseClient.from === 'function' && typeof supabaseClient.rpc === 'function');
}

function setCheckoutFeedback(message, type = 'error') {
    if (!checkoutFeedback) return;

    const palette = {
        error: 'border-red-200 bg-red-50 text-red-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-slate-200 bg-slate-50 text-slate-700'
    };

    checkoutFeedback.className = `rounded-xl border px-4 py-3 text-sm font-medium ${palette[type] || palette.error}`;
    checkoutFeedback.textContent = message;
    checkoutFeedback.classList.remove('hidden');
}

function clearCheckoutFeedback() {
    if (!checkoutFeedback) return;
    checkoutFeedback.classList.add('hidden');
    checkoutFeedback.textContent = '';
}

function getCheckoutScrollOffset() {
    const stickyNav = document.querySelector('.checkout-page nav.sticky, nav.sticky');
    const navHeight = stickyNav?.getBoundingClientRect?.().height || 0;
    return Math.max(88, navHeight + 28);
}

function getFirstInvalidCheckoutField() {
    if (!checkoutForm) {
        return null;
    }

    return checkoutForm.querySelector(':invalid');
}

function revealCheckoutField(field = null) {
    const target = field || getFirstInvalidCheckoutField();
    if (!target || typeof target.getBoundingClientRect !== 'function') {
        checkoutForm?.reportValidity?.();
        return;
    }

    const rect = target.getBoundingClientRect();
    const nextTop = Math.max(0, window.scrollY + rect.top - getCheckoutScrollOffset());
    window.scrollTo({ top: nextTop, behavior: 'smooth' });

    try {
        target.focus({ preventScroll: true });
    } catch {
        target.focus?.();
    }

    window.setTimeout(() => {
        if (typeof target.reportValidity === 'function') {
            target.reportValidity();
            return;
        }
        checkoutForm?.reportValidity?.();
    }, 260);
}

function setPlaceOrderLoading(isLoading) {
    if (!placeOrderBtn) return;
    placeOrderBtn.disabled = isLoading;
    placeOrderBtn.innerHTML = isLoading
        ? '<div class="spinner mx-auto"></div>'
        : PLACE_ORDER_DEFAULT_LABEL;

    if (!isLoading && typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getCheckoutErrorMessage(error) {
    const rawMessage = String(error?.message || error?.details || error?.hint || '').toLowerCase();

    if (error?.code === 'MISSING_PRODUCT_MAPPING') {
        return 'Existem produtos no carrinho que ja nao existem na base de dados. Atualize o carrinho e tente novamente.';
    }

    if (error?.code === 'PRODUCT_INACTIVE') {
        return 'Um produto do carrinho deixou de estar disponivel. Atualize o carrinho e tente novamente.';
    }

    if (error?.code === 'BASE_INVALIDA') {
        return 'Uma base selecionada ja nao esta disponivel para esse produto. Reabra o personalizador e escolha outra base.';
    }

    if (error?.code === '23503') {
        return 'Um produto do carrinho deixou de existir. Reabra o produto e adicione novamente ao carrinho.';
    }

    if (error?.code === 'CARRINHO_VAZIO') {
        return 'O carrinho esta vazio.';
    }

    if (error?.code === 'DADOS_CLIENTE_INVALIDOS') {
        return 'Preencha nome, email e telefone.';
    }

    if (error?.code === 'EMAIL_INVALIDO') {
        return error?.message || 'Introduza um email valido para iniciar o checkout.';
    }

    if (error?.code === 'CUSTOMER_IDENTITY_CONFLICT') {
        return error?.message || 'Ja existe um cliente com este NIF associado a outro contacto. Confirme o email e o nome fiscal antes de continuar.';
    }

    if (error?.code === 'TELEFONE_INVALIDO') {
        return error?.message || 'Introduza um numero de contacto valido.';
    }

    if (error?.code === 'MORADA_INVALIDA') {
        return 'Preencha morada, codigo postal e cidade.';
    }

    if (error?.code === 'CODIGO_POSTAL_INVALIDO') {
        return error?.message || 'Introduza um codigo postal valido.';
    }

    if (error?.code === 'COUNTRY_REQUIRED') {
        return error?.message || 'Escolha o pais fiscal antes de continuar.';
    }

    if (error?.code === 'TOTAL_INVALIDO') {
        return 'O total da encomenda nao e valido.';
    }

    if (error?.code === 'NIF_INVALIDO') {
        return error?.message || 'NIF invalido. Verifique o numero fiscal antes de continuar.';
    }

    if (error?.code === 'NIF_REQUIRED') {
        return error?.message || 'Para faturacao empresarial o NIF e obrigatorio.';
    }

    if (error?.code === 'EMPRESA_REQUIRED') {
        return error?.message || 'Indique o nome fiscal da empresa.';
    }

    if (error?.code === 'TIPO_CLIENTE_INVALIDO') {
        return error?.message || 'Escolha se a faturacao e para particular ou empresa.';
    }

    if (error?.code === 'CHECKOUT_SESSION_FAILED') {
        return error?.message || 'Nao foi possivel iniciar a sessao de pagamento.';
    }

    if (rawMessage.includes('stripe')) {
        return 'Nao foi possivel iniciar o checkout com o Stripe.';
    }

    if (rawMessage.includes('facturalusa')) {
        return 'Nao foi possivel comunicar com o Facturalusa.';
    }

    return 'Erro ao iniciar o checkout. Por favor, tente novamente.';
}

function buildCheckoutRequestCart(items) {
    return items.map((item) => ({
        id: item.id ?? null,
        nome: String(item.nome || 'Produto').trim(),
        quantity: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
        customized: Boolean(item.customized),
        baseNome: String(item.baseNome || '').trim(),
        baseId: item.baseId || item.base_id || null,
        designId: item.designId || item.design_id || null
    }));
}

function getCatalogPath() {
    return typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.STATIC_PATHS.products
        : '/produtos';
}

function isDesignReviewSelected() {
    return Boolean(designReviewCheckbox?.checked);
}

function calculateCheckoutSummary(items = []) {
    const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
        return sum + (Number(item.preco || 0) * Number(item.quantity || 0));
    }, 0);
    const designReview = isDesignReviewSelected() ? DESIGN_REVIEW_FEE : 0;
    const shipping = SHIPPING_COST;
    const total = subtotal + designReview + shipping;

    return {
        subtotal,
        designReview,
        shipping,
        total
    };
}

function renderCheckoutSummary(items = []) {
    const summary = calculateCheckoutSummary(items);

    if (subtotalEl) {
        subtotalEl.textContent = `${summary.subtotal.toFixed(2)}€`;
    }

    if (designReviewAmountEl) {
        designReviewAmountEl.textContent = `${summary.designReview.toFixed(2)}€`;
    }

    setElementHidden(designReviewRow, summary.designReview <= 0);

    if (shippingEl) {
        shippingEl.textContent = summary.shipping > 0
            ? `${summary.shipping.toFixed(2)}€`
            : 'Gratis';
    }

    if (totalEl) {
        totalEl.textContent = `${summary.total.toFixed(2)}€`;
    }

    return summary;
}

// ===== LOAD CART =====
async function loadCart() {
    if (window.cartHydrationPromise) {
        await window.cartHydrationPromise;
    }

    if (!cart || cart.length === 0) {
        window.location.href = getCatalogPath();
        return;
    }

    // Render cart items
    orderItems.innerHTML = cart.map(item => `
        <div class="flex gap-3 pb-4 border-b">
            <img src="${escapeHtml(typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem)}" alt="${escapeHtml(item.nome)}" class="w-16 h-16 object-cover rounded bg-gray-50 border border-gray-100">
            <div class="flex-1">
                <h4 class="font-semibold text-sm">${escapeHtml(item.nome)}</h4>
                ${item.customized ? '<span class="text-xs text-green-600 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Personalizado</span>' : ''}
                ${item.baseNome ? `<p class="text-xs text-gray-500 mt-1">Base: ${escapeHtml(item.baseNome)}${Number(item.basePrecoExtra || 0) > 0 ? ` (+${Number(item.basePrecoExtra).toFixed(2)}€)` : ''}</p>` : ''}
                <p class="text-sm text-gray-600">Qtd: ${Number(item.quantity || 0)}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-blue-600">${(Number(item.preco || 0) * Number(item.quantity || 0)).toFixed(2)}€</p>
            </div>
        </div>
    `).join('');

    const summary = renderCheckoutSummary(cart);

    // Free shipping message
    if (freeShippingMsg) {
        freeShippingMsg.innerHTML = '<p class="font-semibold">Envio gratis aplicado nas zonas operacionais ativas.</p>';
    }
    if (remainingEl) {
        remainingEl.textContent = '0.00€';
    }

    if (!beginCheckoutTracked && typeof window.trackAnalyticsEvent === 'function') {
        beginCheckoutTracked = true;
        void window.trackAnalyticsEvent('begin_checkout', {
            productId: cart[0]?.id || null,
            countryCode: getSelectedFiscalCountry(),
            metadata: {
                itemCount: cart.length,
                total: summary.total,
                designReviewSelected: isDesignReviewSelected()
            }
        });
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===== VALIDATE CUSTOMIZATION =====
function validateCustomization() {
    const hasUncustomized = cart.some(item => !item.customized);
    
    if (hasUncustomized) {
        showToast('Todos os produtos devem ser personalizados antes da compra', 'error');
        setTimeout(() => {
            window.location.href = getCatalogPath();
        }, 2000);
        return false;
    }
    
    return true;
}

// ===== PLACE ORDER =====
if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (window.cartHydrationPromise) {
            await window.cartHydrationPromise;
        }

        clearCheckoutFeedback();
        const customerType = getSelectedCustomerType();
        syncCustomerTypeUI();
        const emailValidation = updateEmailValidity({ normalizeInput: true });
        if (!emailValidation.valid) {
            setCheckoutFeedback(emailValidation.message, 'error');
            revealCheckoutField(emailInput);
            return;
        }

        const phoneValidation = updatePhoneValidity({ normalizeInput: true });
        if (!phoneValidation.valid) {
            setCheckoutFeedback(phoneValidation.message, 'error');
            revealCheckoutField(phoneInput);
            return;
        }

        updatePostalCodeFormatting();
        updateFiscalSummary();

        const taxIdValidation = updateTaxIdValidity();
        if (!taxIdValidation.valid) {
            setCheckoutFeedback(taxIdValidation.message, 'error');
            revealCheckoutField(nifInput);
            return;
        }

        const companyValidation = updateCompanyValidity();
        if (!companyValidation.valid) {
            setCheckoutFeedback(companyValidation.message, 'error');
            revealCheckoutField(companyInput);
            return;
        }

        if (!getSelectedFiscalCountry()) {
            setCheckoutFeedback('Escolha o país fiscal antes de continuar.', 'error');
            revealCheckoutField(countrySelect);
            return;
        }

        syncFiscalCountryFromAddress();
        syncCityFromMunicipality({ force: false });

        if (isBusinessCustomerSelected() && taxIdValidation.normalized) {
            const shouldValidateEuBusiness = getSelectedFiscalCountry() !== 'PT' && isEuCountry(getSelectedFiscalCountry());
            if (shouldValidateEuBusiness || !latestVatValidation) {
                await lookupCompanyByTaxId({ force: true });
            }
        }
        
        // Validate form
        if (!checkoutForm.checkValidity()) {
            revealCheckoutField();
            return;
        }

        // Check terms
        if (!termsCheckbox.checked) {
            showToast('Por favor, aceite os termos e condições', 'error');
            return;
        }

        // Validate customization
        if (!validateCustomization()) {
            return;
        }

        // Get form data
        const formData = new FormData(checkoutForm);
        const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'card';
        const customerData = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            telefone: formData.get('telefone'),
            tipo_cliente: customerType,
            country: getSelectedFiscalCountry(),
            nif: formData.get('nif') || null,
            empresa: formData.get('empresa') || null,
            morada: formData.get('morada'),
            codigo_postal: formData.get('codigo_postal'),
            cidade: formData.get('cidade'),
            pais_entrega: getSelectedAddressCountry(),
            distrito: formData.get('distrito') || null,
            concelho: formData.get('concelho') || null
        };

        const orderNotes = formData.get('notas') || null;

        // Disable button
        setPlaceOrderLoading(true);

        try {
            const response = await fetch('/api/checkout/create-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customer: customerData,
                    cart: buildCheckoutRequestCart(cart),
                    designReviewSelected: isDesignReviewSelected(),
                    paymentMethod: selectedPaymentMethod,
                    notes: orderNotes
                })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = getCheckoutErrorMessage({
                    code: payload?.error,
                    message: payload?.message || payload?.error || 'CHECKOUT_SESSION_FAILED'
                });
                throw {
                    code: payload?.error || 'CHECKOUT_SESSION_FAILED',
                    message
                };
            }

            if (payload?.fiscalSummary?.warning) {
                setCheckoutFeedback(payload.fiscalSummary.warning, 'info');
            }

            setCheckoutFeedback('Pagamento iniciado. Vamos abrir o checkout seguro.', 'success');
            showToast('Pagamento iniciado com sucesso!', 'success');

            cart = [];
            localStorage.removeItem('iberflag_cart');
            localStorage.removeItem('cart');
            if (window.CartAssetStore?.cleanupUnusedDesigns) {
                window.CartAssetStore.cleanupUnusedDesigns([]).catch((cleanupError) => {
                    console.warn('Falha ao limpar designs do carrinho após checkout:', cleanupError);
                });
            }

            setTimeout(() => {
                if (payload?.url) {
                    window.location.href = payload.url;
                    return;
                }

                const fallbackSuccessPath = typeof SiteRoutes !== 'undefined'
                    ? SiteRoutes.buildCheckoutSuccessPath({ codigo: payload?.orderCode || '' })
                    : `/checkout/sucesso?codigo=${encodeURIComponent(payload?.orderCode || '')}`;
                window.location.href = fallbackSuccessPath;
            }, 1000);

        } catch (error) {
            console.error('Erro ao criar encomenda:', error);
            const errorMessage = getCheckoutErrorMessage(error);
            setCheckoutFeedback(errorMessage, 'error');
            showToast(errorMessage, 'error');
            
            // Re-enable button
            setPlaceOrderLoading(false);
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            updateEmailValidity();
            updateFiscalSummary();
        });
        emailInput.addEventListener('blur', () => {
            const validation = updateEmailValidity({ normalizeInput: true });
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
            }
        });
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            updatePhoneValidity();
        });
        phoneInput.addEventListener('blur', () => {
            const validation = updatePhoneValidity({ normalizeInput: true });
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
            }
        });
    }
    if (nifInput) {
        nifInput.addEventListener('input', () => {
            updateTaxIdValidity();
            setCompanyLookupStatus('');
            applyVatValidationResult(null);
            updateFiscalSummary();
            scheduleCompanyLookup();
        });
        nifInput.addEventListener('blur', () => {
            clearCompanyLookupDebounce();
            const validation = updateTaxIdValidity();
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
                return;
            }
            if (isBusinessCustomerSelected() && validation.normalized && isTaxIdLookupReady(validation.normalized, postalCodeInput?.value || '')) {
                void lookupCompanyByTaxId();
            }
        });
    }
    if (postalCodeInput) {
        postalCodeInput.addEventListener('input', () => {
            updateTaxIdValidity();
            updateFiscalSummary();
            scheduleCompanyLookup();
            schedulePostalLookup();
        });
        postalCodeInput.addEventListener('blur', () => {
            updatePostalCodeFormatting();
            updateTaxIdValidity();
            updatePhoneValidity();
            updateFiscalSummary();
            scheduleCompanyLookup();
            void lookupPostalCode({ force: true });
        });
    }
    addressCountrySelect?.addEventListener('change', () => {
        addressCountryTouched = true;
        populateAddressRegions({ preserveValue: false });
        updatePostalCodeFormatting();
        syncFiscalCountryFromAddress();
        schedulePostalLookup();
    });
    addressRegionSelect?.addEventListener('change', () => {
        populateAddressMunicipalities({ preserveValue: false });
        syncCityFromMunicipality({ force: false });
    });
    addressMunicipalitySelect?.addEventListener('change', () => {
        syncCityFromMunicipality({ force: true });
    });
    cityInput?.addEventListener('input', () => {
        if (cityInput.value !== lastAutoCityValue) {
            lastAutoCityValue = '';
        }
    });
    if (companyInput) {
        companyInput.addEventListener('input', () => {
            updateCompanyValidity();
            updateFiscalSummary();
        });
    }
    checkoutForm?.elements?.nome?.addEventListener('input', () => {
        updateFiscalSummary();
    });
    countrySelect?.addEventListener('change', () => {
        syncAddressCountryFromFiscal({ force: true });
        populateAddressRegions({ preserveValue: true });
        updatePostalCodeFormatting();
        updateTaxIdValidity();
        updatePhoneValidity();
        applyVatValidationResult(null);
        setCompanyLookupStatus('');
        updateFiscalSummary();
        scheduleCompanyLookup();
        schedulePostalLookup();
    });
    if (toggleOrderNotesBtn) {
        toggleOrderNotesBtn.addEventListener('click', () => {
            const isOpen = toggleOrderNotesBtn.getAttribute('aria-expanded') === 'true';
            syncOrderNotesVisibility({ forceOpen: !isOpen });
        });
    }
    if (notesTextarea) {
        notesTextarea.addEventListener('input', () => {
            if (String(notesTextarea.value || '').trim()) {
                syncOrderNotesVisibility({ forceOpen: true });
            }
        });
    }
    if (customerTypeSelect) {
        customerTypeSelect.addEventListener('change', () => {
            syncCustomerTypeUI();
        });
    }
    if (designReviewCheckbox) {
        designReviewCheckbox.addEventListener('change', () => {
            clearCheckoutFeedback();
            renderCheckoutSummary(cart);
        });
    }

    syncAddressCountryFromFiscal({ force: true });
    populateAddressRegions({ preserveValue: true });
    syncCustomerTypeUI();
    syncOrderNotesVisibility();
    updateFiscalSummary();

    void loadCart();
});
