const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveStoredCheckoutCustomer } = require('../lib/server/order-flow');
const { detectFiscalSnapshotDivergence } = require('../lib/server/fiscal-engine');

test('resolveStoredCheckoutCustomer preserva o NIF congelado do checkout quando a ficha do cliente muda', () => {
    const order = {
        checkout_payload: {
            customer: {
                nome: 'Empresa Original Lda',
                email: 'financeiro@original.pt',
                tipo_cliente: 'empresa',
                empresa: 'Empresa Original Lda',
                nif: '123456789',
                morada: 'Rua A',
                codigo_postal: '1000-100',
                cidade: 'Lisboa',
                country: 'PT'
            }
        },
        fiscal_snapshot: {
            customer_fiscal_name: 'Empresa Original Lda',
            customer_fiscal_country: 'PT',
            customer_type: 'empresa',
            vat_validation_number: '123456789'
        }
    };

    const latestCustomer = {
        nome: 'Empresa Atualizada Lda',
        email: 'novo@original.pt',
        tipo_cliente: 'empresa',
        empresa: 'Empresa Atualizada Lda',
        nif: '123456780',
        morada: 'Rua Nova',
        codigo_postal: '4000-100',
        cidade: 'Porto',
        country: 'PT'
    };

    const resolved = resolveStoredCheckoutCustomer(order, {}, latestCustomer);
    const divergence = detectFiscalSnapshotDivergence(order.fiscal_snapshot, resolved);

    assert.equal(resolved.nif, '123456789');
    assert.equal(resolved.empresa, 'Empresa Original Lda');
    assert.equal(resolved.email, 'financeiro@original.pt');
    assert.equal(divergence.diverged, false);
});

test('resolveStoredCheckoutCustomer usa o snapshot fiscal quando faltam dados congelados do cliente', () => {
    const order = {
        fiscal_snapshot: {
            customer_fiscal_name: 'Cliente Espanha SL',
            customer_fiscal_country: 'ES',
            customer_type: 'empresa',
            vat_validation_number: 'ESB12345678'
        }
    };

    const latestCustomer = {
        email: 'contabilidad@cliente.es',
        morada: 'Calle Mayor 1',
        codigo_postal: '28001',
        cidade: 'Madrid',
        country: 'ES'
    };

    const resolved = resolveStoredCheckoutCustomer(order, {}, latestCustomer);

    assert.equal(resolved.empresa, 'Cliente Espanha SL');
    assert.equal(resolved.nif, 'ESB12345678');
    assert.equal(resolved.country, 'ES');
    assert.equal(resolved.email, 'contabilidad@cliente.es');
    assert.equal(resolved.codigo_postal, '28001');
});
