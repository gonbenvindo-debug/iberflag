const { EU_COUNTRIES, normalizeCountryCode } = require('./fiscal-engine');
const {
    isValidPortugueseNif,
    isValidSpanishCif,
    isValidSpanishDniOrNie,
    normalizeTaxId
} = require('./tax-id');

const VIES_CACHE = new Map();
const VIES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function normalizeText(value) {
    return String(value ?? '').trim();
}

function isEuCountryCode(countryCode = '') {
    return EU_COUNTRIES.has(normalizeCountryCode(countryCode));
}

function getViesEndpoint() {
    return normalizeText(process.env.VIES_ENDPOINT_URL) || 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';
}

function stripVatCountryPrefix(countryCode, taxId) {
    const normalizedCountry = normalizeCountryCode(countryCode);
    const normalizedTaxId = normalizeTaxId(taxId);
    if (normalizedCountry && normalizedTaxId.startsWith(normalizedCountry)) {
        return normalizedTaxId.slice(normalizedCountry.length);
    }
    return normalizedTaxId;
}

function formatVatNumber(countryCode, taxId) {
    const normalizedCountry = normalizeCountryCode(countryCode);
    const stripped = stripVatCountryPrefix(normalizedCountry, taxId);
    return normalizedCountry && stripped ? `${normalizedCountry}${stripped}` : stripped;
}

function isLikelyVatFormat(countryCode, taxId) {
    const normalizedCountry = normalizeCountryCode(countryCode);
    const stripped = stripVatCountryPrefix(normalizedCountry, taxId);

    if (!normalizedCountry || !stripped) {
        return false;
    }

    if (normalizedCountry === 'PT') {
        return isValidPortugueseNif(stripped);
    }

    if (normalizedCountry === 'ES') {
        return isValidSpanishDniOrNie(stripped) || isValidSpanishCif(stripped);
    }

    return /^[A-Z0-9]{2,14}$/.test(stripped);
}

function buildValidationResult({
    status = 'not_required',
    countryCode = '',
    taxId = '',
    source = 'none',
    message = '',
    checkedAt = '',
    companyName = '',
    companyAddress = '',
    raw = {}
} = {}) {
    return {
        status,
        countryCode: normalizeCountryCode(countryCode),
        normalizedTaxId: formatVatNumber(countryCode, taxId),
        source,
        message: normalizeText(message),
        checkedAt: normalizeText(checkedAt) || new Date().toISOString(),
        companyName: normalizeText(companyName),
        companyAddress: normalizeText(companyAddress),
        raw: raw && typeof raw === 'object' ? raw : {}
    };
}

function getCachedValidation(cacheKey) {
    const cached = VIES_CACHE.get(cacheKey);
    if (!cached) {
        return null;
    }

    if ((Date.now() - cached.storedAt) > VIES_CACHE_TTL_MS) {
        VIES_CACHE.delete(cacheKey);
        return null;
    }

    return cached.value;
}

function setCachedValidation(cacheKey, value) {
    VIES_CACHE.set(cacheKey, {
        storedAt: Date.now(),
        value
    });
}

function parseSoapTag(xml, tagName) {
    const match = String(xml || '').match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
    return match ? normalizeText(match[1].replace(/&amp;/g, '&')) : '';
}

async function validateVatVies({
    countryCode = '',
    taxId = '',
    customerType = 'empresa',
    timeoutMs = 4500
} = {}) {
    const normalizedCountry = normalizeCountryCode(countryCode);
    const normalizedCustomerType = normalizeText(customerType).toLowerCase();
    const normalizedTaxId = normalizeTaxId(taxId);

    if (normalizedCustomerType !== 'empresa' || !normalizedTaxId || !isEuCountryCode(normalizedCountry) || normalizedCountry === 'PT') {
        return buildValidationResult({
            status: 'not_required',
            countryCode: normalizedCountry,
            taxId: normalizedTaxId,
            source: 'none',
            message: ''
        });
    }

    if (!isLikelyVatFormat(normalizedCountry, normalizedTaxId)) {
        return buildValidationResult({
            status: 'invalid',
            countryCode: normalizedCountry,
            taxId: normalizedTaxId,
            source: 'local_format',
            message: 'O VAT/NIF intracomunitário não passou na validação de formato.'
        });
    }

    const strippedVat = stripVatCountryPrefix(normalizedCountry, normalizedTaxId);
    const cacheKey = `${normalizedCountry}:${strippedVat}`;
    const cached = getCachedValidation(cacheKey);
    if (cached) {
        return cached;
    }

    const endpoint = getViesEndpoint();
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <tns:checkVat>
      <tns:countryCode>${normalizedCountry}</tns:countryCode>
      <tns:vatNumber>${strippedVat}</tns:vatNumber>
    </tns:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                SOAPAction: ''
            },
            body: envelope,
            signal: controller.signal
        });

        const rawText = await response.text();
        const valid = parseSoapTag(rawText, 'valid').toLowerCase() === 'true';
        const checkedAt = parseSoapTag(rawText, 'requestDate') || new Date().toISOString();
        const companyName = parseSoapTag(rawText, 'name');
        const companyAddress = parseSoapTag(rawText, 'address').replace(/\r?\n/g, ', ');
        const result = buildValidationResult({
            status: valid ? 'valid' : 'invalid',
            countryCode: normalizedCountry,
            taxId: normalizedTaxId,
            source: 'vies',
            message: valid
                ? 'VAT intracomunitário validado com sucesso.'
                : 'O VAT intracomunitário não foi validado no VIES.',
            checkedAt,
            companyName,
            companyAddress,
            raw: {
                httpStatus: response.status,
                valid,
                checkedAt
            }
        });
        setCachedValidation(cacheKey, result);
        return result;
    } catch (error) {
        const result = buildValidationResult({
            status: 'unavailable',
            countryCode: normalizedCountry,
            taxId: normalizedTaxId,
            source: 'vies',
            message: 'O serviço VIES está indisponível neste momento. A compra pode continuar, mas sem tratamento intracomunitário automático.',
            raw: {
                error: error?.message || 'VIES unavailable'
            }
        });
        setCachedValidation(cacheKey, result);
        return result;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    buildValidationResult,
    formatVatNumber,
    getViesEndpoint,
    isEuCountryCode,
    isLikelyVatFormat,
    stripVatCountryPrefix,
    validateVatVies
};
