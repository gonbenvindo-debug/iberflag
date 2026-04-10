const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildFiscalDecision,
    buildOrderFiscalFields
} = require('../lib/server/fiscal-engine');

test('PT domestico segue para auto emit', () => {
    const decision = buildFiscalDecision({
        customer: {
            codigo_postal: '4700-001'
        },
        paymentStatus: 'paid'
    });

    assert.equal(decision.countryCode, 'PT');
    assert.equal(decision.scenario, 'pt_domestic');
    assert.equal(decision.decisionMode, 'auto_emit');
    assert.equal(decision.invoiceState, 'ready_to_emit');
    assert.equal(decision.vatRate, 23);
});

test('ES mantem compatibilidade mas exige revisao manual', () => {
    const decision = buildFiscalDecision({
        customer: {
            codigo_postal: '28001'
        },
        paymentStatus: 'paid'
    });

    assert.equal(decision.countryCode, 'ES');
    assert.equal(decision.scenario, 'es_compatible_manual_review');
    assert.equal(decision.decisionMode, 'manual_review');
    assert.equal(decision.invoiceState, 'pending_manual_review');
});

test('Fiscal fields incluem shipping zone e SLA', () => {
    const fields = buildOrderFiscalFields({
        customer: {
            codigo_postal: '1000-100'
        },
        paymentStatus: 'pending',
        referenceDate: new Date('2026-04-10T10:00:00.000Z')
    });

    assert.equal(fields.fiscal_scenario, 'pt_domestic');
    assert.equal(fields.shipping_zone_code, 'pt_continental');
    assert.equal(fields.invoice_state, 'pending_payment');
    assert.match(String(fields.sla_target_at || ''), /^2026-04-12T10:00:00/);
});
