function normalizeTaxId(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function detectTaxCountry(value, postalCode = '') {
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

function validateTaxId(value, { postalCode = '', country = '' } = {}) {
    const normalized = normalizeTaxId(value);
    const resolvedCountry = String(country || '').trim().toUpperCase() || detectTaxCountry(normalized, postalCode);

    if (!normalized) {
        return {
            valid: true,
            normalized,
            country: resolvedCountry,
            message: ''
        };
    }

    const valid = resolvedCountry === 'ES'
        ? isValidSpanishDniOrNie(normalized) || isValidSpanishCif(normalized)
        : isValidPortugueseNif(normalized);

    return {
        valid,
        normalized,
        country: resolvedCountry,
        message: valid
            ? ''
            : resolvedCountry === 'ES'
                ? 'NIF/NIE espanhol invalido. Verifique o numero fiscal antes de continuar.'
                : 'NIF portugues invalido. Verifique os 9 digitos antes de continuar.'
    };
}

module.exports = {
    detectTaxCountry,
    isValidPortugueseNif,
    isValidSpanishCif,
    isValidSpanishDniOrNie,
    normalizeTaxId,
    validateTaxId
};
