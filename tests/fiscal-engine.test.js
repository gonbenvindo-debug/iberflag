const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildFiscalDecision,
    buildFiscalSnapshot,
    buildOrderFiscalFields,
    detectFiscalSnapshotDivergence
} = require('../lib/server/fiscal-engine');

test('PT particular paga e fica pronta a emitir em Artigo 53', () => {
    const decision = buildFiscalDecision({
        customer: {
            country: 'PT',
            tipo_cliente: 'particular',
            nome: 'Joao Teste',
            codigo_postal: '4700-001'
        },
        paymentStatus: 'paid'
    });

    assert.equal(decision.countryCode, 'PT');
    assert.equal(decision.scenario, 'pt_particular_art53');
    assert.equal(decision.decisionMode, 'auto_emit');
    assert.equal(decision.invoiceState, 'ready_to_emit');
    assert.equal(decision.vatRate, 0);
    assert.equal(decision.vatRegimeCode, 'M10');
});

test('PT empresa paga e fica pronta a emitir sem IVA', () => {
    const snapshot = buildFiscalSnapshot({
        customer: {
            country: 'PT',
            tipo_cliente: 'empresa',
            empresa: 'Empresa Teste Lda',
            nome: 'Empresa Teste Lda',
            nif: '123456789',
            codigo_postal: '1000-100'
        },
        paymentStatus: 'paid'
    });

    assert.equal(snapshot.fiscal_scenario, 'pt_business_art53');
    assert.equal(snapshot.invoice_state, 'ready_to_emit');
    assert.equal(snapshot.vat_rate_applied, 0);
    assert.equal(snapshot.vat_regime_code, 'M10');
    assert.equal(snapshot.document_type_resolved, 'Factura Recibo');
});

test('UE empresa com VIES valido segue em auto emit com cenário intracomunitario', () => {
    const snapshot = buildFiscalSnapshot({
        customer: {
            country: 'FR',
            tipo_cliente: 'empresa',
            empresa: 'Société Test',
            nif: 'FR12345678901'
        },
        paymentStatus: 'paid',
        vatValidation: {
            status: 'valid',
            source: 'vies',
            normalizedTaxId: 'FR12345678901'
        }
    });

    assert.equal(snapshot.fiscal_scenario, 'eu_business_vies_valid');
    assert.equal(snapshot.fiscal_decision_mode, 'auto_emit');
    assert.equal(snapshot.invoice_state, 'ready_to_emit');
    assert.equal(snapshot.vat_validation_status, 'valid');
    assert.equal(snapshot.vat_rate_applied, 0);
});

test('UE empresa com VIES invalido cai em fallback sem beneficio intracomunitario', () => {
    const fields = buildOrderFiscalFields({
        fiscalSnapshot: buildFiscalSnapshot({
            customer: {
                country: 'DE',
                tipo_cliente: 'empresa',
                empresa: 'Firma Test',
                nif: 'DE123'
            },
            paymentStatus: 'paid',
            vatValidation: {
                status: 'invalid',
                source: 'vies',
                normalizedTaxId: 'DE123'
            }
        }),
        paymentStatus: 'paid',
        referenceDate: new Date('2026-04-12T10:00:00.000Z')
    });

    assert.equal(fields.fiscal_scenario, 'eu_business_vies_invalid_fallback');
    assert.equal(fields.invoice_state, 'ready_to_emit');
    assert.equal(fields.vat_rate_applied, 0);
    assert.equal(fields.vat_regime_code, 'M10');
});

test('fora da UE fica sempre em revisao manual depois do pagamento', () => {
    const snapshot = buildFiscalSnapshot({
        customer: {
            country: 'US',
            tipo_cliente: 'particular',
            nome: 'Client Test'
        },
        paymentStatus: 'paid'
    });

    assert.equal(snapshot.fiscal_scenario, 'non_eu_manual_review');
    assert.equal(snapshot.fiscal_decision_mode, 'manual_review');
    assert.equal(snapshot.invoice_state, 'pending_manual_review');
});

test('divergencia fiscal deteta alteracao de dados congelados', () => {
    const divergence = detectFiscalSnapshotDivergence(
        {
            customer_fiscal_name: 'Empresa Original Lda',
            customer_fiscal_country: 'PT',
            customer_type: 'empresa',
            vat_validation_number: '123456789'
        },
        {
            empresa: 'Empresa Alterada Lda',
            nif: '123456780',
            country: 'ES',
            tipo_cliente: 'particular'
        }
    );

    assert.equal(divergence.diverged, true);
    assert.ok(divergence.fields.includes('nome fiscal'));
    assert.ok(divergence.fields.includes('NIF/VAT'));
    assert.ok(divergence.fields.includes('país fiscal'));
    assert.ok(divergence.fields.includes('tipo de cliente'));
});
