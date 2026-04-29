const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getPaymentMethodLabel,
    normalizePaymentMethodType,
    resolveStripePaymentMethodTypes
} = require('../lib/server/checkout');

test('checkout aceita modo dinamico para pagamento embebido', () => {
    assert.equal(normalizePaymentMethodType('dynamic'), 'dynamic');
    assert.equal(getPaymentMethodLabel('dynamic'), 'Pagamento online');
    assert.deepEqual(resolveStripePaymentMethodTypes('dynamic'), []);
});

test('checkout mantem normalizacao dos metodos legados', () => {
    assert.equal(normalizePaymentMethodType('mbway'), 'mbway');
    assert.deepEqual(resolveStripePaymentMethodTypes('multibanco'), ['multibanco']);
});
