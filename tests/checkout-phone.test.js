const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCheckoutCustomerPhone } = require('../lib/server/order-flow');

test('checkout normaliza telefone portugues local com indicativo PT', () => {
    const validation = validateCheckoutCustomerPhone({
        telefone: '912 345 678',
        country: 'PT'
    });

    assert.equal(validation.valid, true);
    assert.equal(validation.normalized, '+351912345678');
    assert.equal(validation.country, 'PT');
});

test('checkout normaliza telefone espanhol local com indicativo ES', () => {
    const validation = validateCheckoutCustomerPhone({
        telefone: '612 345 678',
        country: 'ES'
    });

    assert.equal(validation.valid, true);
    assert.equal(validation.normalized, '+34612345678');
    assert.equal(validation.country, 'ES');
});

test('checkout nao interpreta numero portugues iniciado por 9 como espanhol', () => {
    const validation = validateCheckoutCustomerPhone({
        telefone: '912345678',
        country: 'PT'
    });

    assert.equal(validation.valid, true);
    assert.equal(validation.normalized, '+351912345678');
    assert.equal(validation.country, 'PT');
});
