const { getSupabaseAdmin } = require('../../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../../lib/server/http');
const {
    appendWorkflowHistory,
    buildOrderNotesWithMeta,
    splitOrderNotesAndMeta
} = require('../../../lib/server/checkout');
const {
    classifyFacturalusaError,
    issueFacturalusaDocumentForOrder
} = require('../../../lib/server/facturalusa');

async function findOrderByIdOrCode(supabase, orderId, orderCode) {
    if (orderId) {
        const { data, error } = await supabase
            .from('encomendas')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (error) throw error;
        if (data) return data;
    }

    if (orderCode) {
        const { data, error } = await supabase
            .from('encomendas')
            .select('*')
            .eq('numero_encomenda', orderCode)
            .maybeSingle();

        if (error) throw error;
        if (data) return data;
    }

    return null;
}

module.exports = async function adminReemitFacturalusaHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const orderId = String(body?.orderId || body?.id || '').trim();
        const orderCode = String(body?.orderCode || body?.codigo || '').trim();

        if (!orderId && !orderCode) {
            sendJson(res, 400, {
                error: 'MISSING_ORDER_REFERENCE',
                message: 'Indique o ID ou o código da encomenda.'
            });
            return;
        }

        const supabase = getSupabaseAdmin();
        const order = await findOrderByIdOrCode(supabase, orderId, orderCode);

        if (!order) {
            sendJson(res, 404, {
                error: 'ORDER_NOT_FOUND',
                message: 'Encomenda não encontrada.'
            });
            return;
        }

        const split = splitOrderNotesAndMeta(order.notas || '');
        if (split.meta.facturalusaDocumentNumber) {
            sendJson(res, 200, {
                success: true,
                alreadyEmitted: true,
                documentNumber: split.meta.facturalusaDocumentNumber,
                documentUrl: split.meta.facturalusaDocumentUrl || null
            });
            return;
        }

        if (split.meta.paymentStatus !== 'paid') {
            sendJson(res, 409, {
                error: 'ORDER_NOT_PAID',
                message: 'A encomenda ainda não está marcada como paga.'
            });
            return;
        }

        const session = {
            id: split.meta.stripeSessionId || order.stripe_session_id || null,
            customer_email: split.meta.checkoutCustomer?.email || order.clientes?.email || '',
            metadata: {
                payment_method: split.meta.paymentMethod || order.metodo_pagamento || 'card'
            }
        };

        try {
            const emissionResult = await issueFacturalusaDocumentForOrder({
                supabase,
                order,
                session
            });

            const sale = emissionResult.sale;
            const customer = emissionResult.customer;
            const facturalusaDocumentNumber = sale?.document_full_number || sale?.number || sale?.reference || '';
            const facturalusaDocumentUrl = sale?.url_file || sale?.url || '';
            const facturalusaCustomerCode = customer?.code || customer?.id || '';

            const nextMeta = appendWorkflowHistory(split.meta, split.meta.workflowStatus, 'Documento fiscal emitido no Facturalusa');
            nextMeta.paymentStatus = 'paid';
            nextMeta.paymentProvider = 'stripe';
            nextMeta.paymentMethod = session.metadata.payment_method || nextMeta.paymentMethod || 'card';
            nextMeta.stripeSessionId = session.id || nextMeta.stripeSessionId || '';
            nextMeta.facturalusaCustomerCode = facturalusaCustomerCode ? String(facturalusaCustomerCode) : nextMeta.facturalusaCustomerCode || '';
            nextMeta.facturalusaDocumentNumber = facturalusaDocumentNumber ? String(facturalusaDocumentNumber) : nextMeta.facturalusaDocumentNumber || '';
            nextMeta.facturalusaDocumentUrl = facturalusaDocumentUrl ? String(facturalusaDocumentUrl) : nextMeta.facturalusaDocumentUrl || '';
            nextMeta.facturalusaLastError = '';
            nextMeta.facturalusaStatus = 'emitted';
            nextMeta.facturalusaLastAttemptAt = new Date().toISOString();

            const { error: updateError } = await supabase
                .from('encomendas')
                .update({
                    notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta)
                })
                .eq('id', order.id);

            if (updateError) {
                throw updateError;
            }

            sendJson(res, 200, {
                success: true,
                orderId: order.id,
                documentNumber: facturalusaDocumentNumber || null,
                documentUrl: facturalusaDocumentUrl || null
            });
        } catch (invoiceError) {
            const classified = classifyFacturalusaError(invoiceError);
            const nextMeta = appendWorkflowHistory(split.meta, split.meta.workflowStatus, 'Falha ao emitir documento no Facturalusa');
            nextMeta.paymentStatus = split.meta.paymentStatus || 'paid';
            nextMeta.paymentProvider = 'stripe';
            nextMeta.paymentMethod = session.metadata.payment_method || nextMeta.paymentMethod || 'card';
            nextMeta.stripeSessionId = session.id || nextMeta.stripeSessionId || '';
            nextMeta.facturalusaLastError = classified.message || invoiceError?.message || 'Falha ao emitir documento no Facturalusa';
            nextMeta.facturalusaStatus = classified.retryable ? 'error' : 'blocked';
            nextMeta.facturalusaLastAttemptAt = new Date().toISOString();

            await supabase
                .from('encomendas')
                .update({
                    notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta)
                })
                .eq('id', order.id);

            throw invoiceError;
        }
    } catch (error) {
        const classified = classifyFacturalusaError(error);
        console.error('Erro ao reenviar Facturalusa:', error);
        sendJson(res, 500, {
            error: classified.code || 'FACTURALUSA_REEMIT_FAILED',
            message: classified.message || error?.message || 'Falha ao reenviar documento na Facturalusa.'
        });
    }
};
