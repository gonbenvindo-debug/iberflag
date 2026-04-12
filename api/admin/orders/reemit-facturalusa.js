const { getSupabaseAdmin } = require('../../../lib/server/supabase-admin');
const { requireAdminRequest } = require('../../../lib/server/admin-auth');
const { readJsonBody, sendJson } = require('../../../lib/server/http');
const {
    appendWorkflowHistory,
    buildOrderNotesWithMeta,
    splitOrderNotesAndMeta
} = require('../../../lib/server/checkout');
const {
    detectFiscalSnapshotDivergence,
    resolveStoredFiscalSnapshot
} = require('../../../lib/server/fiscal-engine');
const {
    classifyFacturalusaError,
    issueFacturalusaDocumentForOrder
} = require('../../../lib/server/facturalusa');
const { resolveFacturalusaDocumentState } = require('../../../lib/server/invoice-state');
const { runNonBlockingAction } = require('../../../lib/server/resilience');
const { updateWithOptionalColumns } = require('../../../lib/server/schema-safe');
const { sendOrderEmailNotification } = require('../../../lib/server/email-notifications');
const { logAnalyticsEvent, logOperationalEvent, queueReviewItem, resolveReviewItem } = require('../../../lib/server/ops');

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

async function findCustomerForOrder(supabase, order = {}) {
    if (!order?.cliente_id) {
        return null;
    }

    const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', order.cliente_id)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

module.exports = async function adminReemitFacturalusaHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    try {
        await requireAdminRequest(req);

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
        const invoiceState = resolveFacturalusaDocumentState(order, split.meta);
        const fiscalSnapshot = resolveStoredFiscalSnapshot(order, split.meta || {});
        const latestCustomer = await findCustomerForOrder(supabase, order);
        const divergence = detectFiscalSnapshotDivergence(fiscalSnapshot, {
            ...(split.meta?.checkoutCustomer || {}),
            ...(latestCustomer || {})
        });

        if (divergence.diverged) {
            sendJson(res, 409, {
                error: 'FISCAL_DIVERGENCE_DETECTED',
                message: divergence.reason || 'Os dados fiscais atuais diferem dos dados usados no snapshot fiscal congelado.',
                divergence
            });
            return;
        }

        if (invoiceState.emitted) {
            sendJson(res, 200, {
                success: true,
                alreadyEmitted: true,
                documentNumber: invoiceState.documentNumber,
                documentUrl: invoiceState.documentUrl,
                divergence
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

            const { error: updateError } = await updateWithOptionalColumns(
                supabase,
                'encomendas',
                'id',
                order.id,
                {
                    notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta),
                    payment_provider: 'stripe',
                    payment_status: 'paid',
                    stripe_session_id: session.id || null,
                    stripe_payment_method_type: session.metadata.payment_method || 'card',
                    facturalusa_customer_code: facturalusaCustomerCode ? String(facturalusaCustomerCode) : null,
                    facturalusa_document_number: facturalusaDocumentNumber ? String(facturalusaDocumentNumber) : null,
                    facturalusa_document_url: facturalusaDocumentUrl ? String(facturalusaDocumentUrl) : null,
                    facturalusa_last_error: null,
                    facturalusa_status: 'emitted',
                    invoice_state: 'emitted',
                    facturalusa_payload: sale || {}
                }
            );

            if (updateError) {
                throw updateError;
            }

            await runNonBlockingAction('Nao foi possivel resolver a revisao fiscal no admin', () => resolveReviewItem(supabase, `invoice:${order.id}`));
            await runNonBlockingAction('Nao foi possivel registar analytics de invoice_issued no admin', () => logAnalyticsEvent(supabase, {
                event_name: 'invoice_issued',
                order_id: order.id,
                metadata: {
                    orderCode: order.numero_encomenda || '',
                    documentNumber: facturalusaDocumentNumber || ''
                }
            }));
            await runNonBlockingAction('Nao foi possivel registar operational log de invoice_reemitted_from_admin', () => logOperationalEvent(supabase, {
                event_name: 'invoice_reemitted_from_admin',
                level: 'info',
                order_id: order.id,
                payload: {
                    orderCode: order.numero_encomenda || '',
                    documentNumber: facturalusaDocumentNumber || ''
                }
            }));

            const emailResult = await sendOrderEmailNotification({
                supabase,
                req,
                order: {
                    ...order,
                    notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta),
                    payment_provider: 'stripe',
                    payment_status: 'paid',
                    stripe_session_id: session.id || null,
                    stripe_payment_method_type: session.metadata.payment_method || 'card',
                    facturalusa_customer_code: facturalusaCustomerCode ? String(facturalusaCustomerCode) : null,
                    facturalusa_document_number: facturalusaDocumentNumber ? String(facturalusaDocumentNumber) : null,
                    facturalusa_document_url: facturalusaDocumentUrl ? String(facturalusaDocumentUrl) : null,
                    facturalusa_last_error: null,
                    facturalusa_status: 'emitted',
                    invoice_state: 'emitted',
                    facturalusa_payload: sale || {}
                },
                templateKey: 'invoice_document_ready',
                dedupeKey: `invoice_document_ready:${order.id}`
            });

            if (!emailResult.sent && emailResult.reason !== 'DUPLICATE_EMAIL') {
                console.warn('Email de documento fiscal nao enviado a partir do admin:', emailResult.reason || emailResult.message || emailResult);
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

            const { error: updateError } = await updateWithOptionalColumns(
                supabase,
                'encomendas',
                'id',
                order.id,
                {
                    notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta),
                    payment_provider: 'stripe',
                    payment_status: 'paid',
                    stripe_session_id: session.id || null,
                    stripe_payment_method_type: session.metadata.payment_method || 'card',
                    facturalusa_last_error: nextMeta.facturalusaLastError,
                    facturalusa_status: nextMeta.facturalusaStatus,
                    invoice_state: classified.retryable ? 'invoice_error' : 'pending_manual_review'
                }
            );

            if (updateError) {
                throw updateError;
            }

            await runNonBlockingAction('Nao foi possivel colocar a falha de reemissao fiscal na fila de revisao', () => queueReviewItem(supabase, {
                queue_key: `invoice:${order.id}`,
                order_id: order.id,
                type: 'invoice_retry',
                priority: classified.retryable ? 'normal' : 'high',
                title: 'Reemissao de documento falhou',
                details: nextMeta.facturalusaLastError,
                payload: {
                    orderCode: order.numero_encomenda || '',
                    retryable: classified.retryable
                }
            }));
            await runNonBlockingAction('Nao foi possivel registar operational log de invoice_reemit_failed', () => logOperationalEvent(supabase, {
                event_name: 'invoice_reemit_failed',
                level: classified.retryable ? 'warning' : 'error',
                order_id: order.id,
                payload: {
                    orderCode: order.numero_encomenda || '',
                    message: nextMeta.facturalusaLastError,
                    retryable: classified.retryable
                }
            }));

            throw invoiceError;
        }
    } catch (error) {
        if (error?.code === 'ADMIN_AUTH_REQUIRED' || error?.code === 'ADMIN_UNAUTHORIZED' || error?.code === 'ADMIN_FORBIDDEN' || error?.code === 'ADMIN_AUTH_NOT_CONFIGURED') {
            sendJson(res, error.statusCode || 401, {
                error: error.code,
                message: error.message || 'Acesso admin negado.'
            });
            return;
        }

        const classified = classifyFacturalusaError(error);
        console.error('Erro ao reenviar Facturalusa:', error);
        sendJson(res, 500, {
            error: classified.code || 'FACTURALUSA_REEMIT_FAILED',
            message: classified.message || error?.message || 'Falha ao reenviar documento na Facturalusa.'
        });
    }
};
