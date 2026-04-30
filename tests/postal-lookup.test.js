const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeLookupPostalCode,
    resolveMunicipalityFromReverseAddress,
    resolveMunicipalityFromPostalPlace,
    resolvePostalLookup
} = require('../lib/server/postal-lookup');

test('postal lookup normaliza codigo postal portugues', () => {
    assert.equal(normalizeLookupPostalCode('2975331', 'PT'), '2975-331');
    assert.equal(normalizeLookupPostalCode('2975 331', 'PT'), '2975-331');
});

test('postal lookup usa cidade/town como concelho portugues e ignora freguesia', () => {
    const municipality = resolveMunicipalityFromReverseAddress({
        village: 'Castelo',
        town: 'Sesimbra',
        county: 'Set\u00fabal'
    }, 'PT');

    assert.equal(municipality, 'Sesimbra');
});

test('postal lookup corrige localidade portuguesa conhecida para o concelho real', () => {
    assert.equal(resolveMunicipalityFromPostalPlace('Quinta do Conde', 'PT'), 'Sesimbra');
    assert.equal(resolveMunicipalityFromPostalPlace('Fernão Ferro', 'PT'), 'Seixal');
    assert.equal(resolveMunicipalityFromPostalPlace('Pinhal General', 'PT'), 'Seixal');
});

test('postal lookup resolve 2975-331 como Sesimbra e Quinta do Conde', async () => {
    const calls = [];
    const fetchMock = async (url) => {
        calls.push(String(url));
        if (String(url).startsWith('https://api.zippopotam.us/pt/2975-331')) {
            return {
                ok: true,
                json: async () => ({
                    places: [{
                        'place name': 'Quinta do Conde',
                        state: 'Set\u00fabal',
                        latitude: '38.4442',
                        longitude: '-9.0485'
                    }]
                })
            };
        }

        if (String(url).startsWith('https://nominatim.openstreetmap.org/reverse')) {
            return {
                ok: true,
                json: async () => ({
                    address: {
                        village: 'Castelo',
                        town: 'Sesimbra',
                        county: 'Set\u00fabal'
                    }
                })
            };
        }

        throw new Error(`Unexpected URL ${url}`);
    };

    const result = await resolvePostalLookup({
        country: 'PT',
        postalCode: '2975-331',
        fetchImpl: fetchMock
    });

    assert.equal(result.region, 'Set\u00fabal');
    assert.equal(result.municipality, 'Sesimbra');
    assert.equal(result.city, 'Quinta do Conde');
    assert.equal(calls.length, 1);
});

test('postal lookup resolve 2865-343 como Seixal e Fernão Ferro', async () => {
    const calls = [];
    const fetchMock = async (url) => {
        calls.push(String(url));
        if (String(url).startsWith('https://api.zippopotam.us/pt/2865-343')) {
            return {
                ok: true,
                json: async () => ({
                    places: [{
                        'place name': 'Pinhal General',
                        state: 'Setúbal',
                        latitude: '38.5757',
                        longitude: '-9.0794'
                    }]
                })
            };
        }

        if (String(url).startsWith('https://nominatim.openstreetmap.org/reverse')) {
            return {
                ok: true,
                json: async () => ({
                    address: {
                        town: 'Moita',
                        county: 'Setúbal'
                    }
                })
            };
        }

        throw new Error(`Unexpected URL ${url}`);
    };

    const result = await resolvePostalLookup({
        country: 'PT',
        postalCode: '2865-343',
        fetchImpl: fetchMock
    });

    assert.equal(result.region, 'Setúbal');
    assert.equal(result.municipality, 'Seixal');
    assert.equal(result.city, 'Fernão Ferro');
    assert.equal(calls.length, 1);
});
