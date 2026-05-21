const { splitOrderNotesAndMeta, buildOrderNotesWithMeta } = require('./checkout');
const { resolveFacturalusaDocumentState } = require('./invoice-state');
const { updateWithOptionalColumns } = require('./schema-safe');
const { resolveReviewItem, logOperationalEvent } = require('./ops');

function normalizeText(value) {
    return String(value ?? '').trim();
}

async function reconcileInvoiceEmissionState({
    supabase,
    order,
    reason = 'Documento fiscal conciliado'
}) {
    if (!supabase || !order?.id) {
        return { reconciled: false, reason: 'MISSING_SUPABASE_OR_ORDER', order };
    }

    const split = splitOrderNotesAndMeta(order.notas || '');
    const invoice = resolveFacturalusaDocumentState(order, split.meta || {});
    if (!invoice.emitted) {
        return { reconciled: false, reason: 'MISSING_EMITTED_DOCUMENT', order };
    }

    const nextMeta = {
        ...(split.meta || {}),
        facturalusaStatus: 'emitted',
        facturalusaLastError: '',
        facturalusaDocumentNumber: normalizeText(invoice.documentNumber) || normalizeText(split.meta?.facturalusaDocumentNumber),
        facturalusaDocumentUrl: normalizeText(invoice.documentUrl) || normalizeText(split.meta?.facturalusaDocumentUrl),
        facturalusaLastAttemptAt: new Date().toISOString()
    };

    const updates = {
        notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta),
        facturalusa_status: 'emitted',
        facturalusa_last_error: null,
        invoice_state: 'emitted',
        ...(nextMeta.facturalusaDocumentNumber ? { facturalusa_document_number: nextMeta.facturalusaDocumentNumber } : {}),
        ...(nextMeta.facturalusaDocumentUrl ? { facturalusa_document_url: nextMeta.facturalusaDocumentUrl } : {})
    };

    const { error } = await updateWithOptionalColumns(
        supabase,
        'encomendas',
        'id',
        order.id,
        updates
    );

    if (error) {
        throw error;
    }

    await resolveReviewItem(supabase, `invoice:${order.id}`).catch(() => {});
    await logOperationalEvent(supabase, {
        event_name: 'invoice_state_reconciled',
        level: 'info',
        order_id: order.id,
        payload: {
            orderCode: order.numero_encomenda || '',
            reason,
            documentNumber: nextMeta.facturalusaDocumentNumber || '',
            hasDocumentUrl: Boolean(nextMeta.facturalusaDocumentUrl)
        }
    }).catch(() => {});

    return {
        reconciled: true,
        order: {
            ...order,
            ...updates
        }
    };
}

module.exports = {
    reconcileInvoiceEmissionState
};
