function normalizeLookupCountry(value = '') {
    const country = String(value || '').trim().toUpperCase();
    return ['PT', 'ES'].includes(country) ? country : 'PT';
}

function normalizeLookupPostalCode(value = '', country = 'PT') {
    const normalizedCountry = normalizeLookupCountry(country);
    const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');

    if (normalizedCountry === 'ES') {
        return raw.replace(/[^\d]/g, '').slice(0, 5);
    }

    const digits = raw.replace(/[^\d]/g, '').slice(0, 7);
    if (digits.length === 7) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    return raw;
}

function isLookupPostalCodeReady(value = '', country = 'PT') {
    const normalizedCountry = normalizeLookupCountry(country);
    const normalized = normalizeLookupPostalCode(value, normalizedCountry);
    return normalizedCountry === 'ES'
        ? /^\d{5}$/.test(normalized)
        : /^\d{4}-\d{3}$/.test(normalized);
}

function normalizeLookupKey(value = '') {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

const PORTUGAL_PLACE_OVERRIDES = new Map([
    ['amora', { municipality: 'Seixal' }],
    ['arrentela', { municipality: 'Seixal' }],
    ['corroios', { municipality: 'Seixal' }],
    ['fernao ferro', { municipality: 'Seixal' }],
    ['paio pires', { municipality: 'Seixal' }],
    ['pinhal general', { municipality: 'Seixal', city: 'Fernão Ferro' }],
    ['quinta do conde', { municipality: 'Sesimbra' }]
]);

function pickString(source, keys = []) {
    for (const key of keys) {
        const value = String(source?.[key] || '').trim();
        if (value) {
            return value;
        }
    }

    return '';
}

function resolveMunicipalityFromReverseAddress(address = {}, country = 'PT') {
    const normalizedCountry = normalizeLookupCountry(country);
    if (normalizedCountry === 'PT') {
        return pickString(address, [
            'municipality',
            'town',
            'city'
        ]);
    }

    return pickString(address, [
        'municipality',
        'city',
        'town',
        'village'
    ]);
}

function resolveMunicipalityFromPostalPlace(placeName = '', country = 'PT') {
    if (normalizeLookupCountry(country) !== 'PT') {
        return '';
    }

    return PORTUGAL_PLACE_OVERRIDES.get(normalizeLookupKey(placeName))?.municipality || '';
}

function resolvePostalPlaceCity(placeName = '', country = 'PT') {
    if (normalizeLookupCountry(country) !== 'PT') {
        return '';
    }

    return PORTUGAL_PLACE_OVERRIDES.get(normalizeLookupKey(placeName))?.city || '';
}

function buildNominatimUrl(latitude, longitude) {
    const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '10',
        addressdetails: '1'
    });
    return `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
}

async function fetchJson(fetchImpl, url, options = {}) {
    const response = await fetchImpl(url, options);
    if (!response?.ok) {
        const error = new Error(`POSTAL_LOOKUP_HTTP_${response?.status || 'ERROR'}`);
        error.statusCode = response?.status || 502;
        throw error;
    }

    return response.json();
}

async function resolvePostalLookup({
    country,
    postalCode,
    fetchImpl = globalThis.fetch,
    userAgent = 'IberFlagCheckout/1.0 (geral@iberflag.com)'
} = {}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('FETCH_UNAVAILABLE');
    }

    const normalizedCountry = normalizeLookupCountry(country);
    const normalizedPostalCode = normalizeLookupPostalCode(postalCode, normalizedCountry);
    if (!isLookupPostalCodeReady(normalizedPostalCode, normalizedCountry)) {
        const error = new Error('POSTAL_CODE_INVALID');
        error.statusCode = 400;
        throw error;
    }

    const zippopotamUrl = `https://api.zippopotam.us/${normalizedCountry.toLowerCase()}/${encodeURIComponent(normalizedPostalCode)}`;
    const zippopotamData = await fetchJson(fetchImpl, zippopotamUrl);
    const place = Array.isArray(zippopotamData?.places) ? zippopotamData.places[0] : null;
    if (!place) {
        const error = new Error('POSTAL_CODE_NOT_FOUND');
        error.statusCode = 404;
        throw error;
    }

    const latitude = pickString(place, ['latitude']);
    const longitude = pickString(place, ['longitude']);
    const rawCity = pickString(place, ['place name']);
    const city = resolvePostalPlaceCity(rawCity, normalizedCountry) || rawCity;
    const placeMunicipalityOverride = resolveMunicipalityFromPostalPlace(rawCity, normalizedCountry);
    let municipality = normalizedCountry === 'PT' ? placeMunicipalityOverride : city;

    if (!municipality && latitude && longitude) {
        try {
            const reverseData = await fetchJson(fetchImpl, buildNominatimUrl(latitude, longitude), {
                headers: {
                    'User-Agent': userAgent,
                    Accept: 'application/json'
                }
            });
            municipality = resolveMunicipalityFromReverseAddress(reverseData?.address || {}, normalizedCountry) || municipality;
        } catch (error) {
            if (normalizedCountry !== 'PT') {
                municipality = municipality || city;
            }
        }
    }

    if (!municipality && normalizedCountry === 'PT') {
        municipality = city;
    }

    return {
        country: normalizedCountry,
        postalCode: normalizedPostalCode,
        region: pickString(place, ['state']),
        municipality,
        city,
        latitude,
        longitude
    };
}

module.exports = {
    normalizeLookupCountry,
    normalizeLookupPostalCode,
    isLookupPostalCodeReady,
    resolveMunicipalityFromReverseAddress,
    resolveMunicipalityFromPostalPlace,
    resolvePostalLookup
};
