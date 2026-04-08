const { getStripeClient, getStripeWebhookSecret } = require('../../lib/server/stripe');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { readRawBody, sendJson } = require('../../lib/server/http');
const {
    appendWorkflowHistory,
    buildOrderNotesWithMeta,
    splitOrderNotesAndMeta
} = require('../../lib/server/checkout');
const {
    classifyFacturalusaError,
    issueFacturalusaDocumentForOrder
} = require('../../lib/server/facturalusa');
const { updateWithOptionalColumns } = require('../../lib/server/schema-safe');
const { sendOrderEmailNotification } = require('../../lib/server/email-notifications');

async function claimWebhookEvent(supabase, event) {
    const now = new Date().toISOString();
    let existing = null;
    try {
        const { data, error: lookupError } = await supabase
            .from('stripe_webhook_events')
            .select('event_id,status,attempts,last_error,processed_at')
            .eq('event_id', event.id)
            .maybeSingle();

        if (lookupError) {
            throw lookupError;
        }

        existing = data || null;
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST205' || raw.includes('stripe_webhook_events')) {
            return true;
        }
        throw error;
    }

    if (existing?.status === 'processed') {
        return false;
    }

    const nextAttempts = Number(existing?.attempts || 0) + 1;
    const payload = {
        event_id: event.id,
        event_type: event.type,
        payload: event,
        status: 'processing',
        attempts: nextAttempts,
        last_error: null,
        processed_at: now
    };

    if (existing) {
        const { error } = await supabase
            .from('stripe_webhook_events')
            .update({
                event_type: event.type,
                payload: event,
                status: 'processing',
                attempts: nextAttempts,
                last_error: null,
                processed_at: now
            })
            .eq('event_id', event.id);

        if (error) {
            throw error;
        }

        return true;
    }

    const { error } = await supabase
        .from('stripe_webhook_events')
        .insert(payload);

    if (error && error.code === '23505') {
        return false;
    }

    if (error) {
        throw error;
    }

    return true;
}

async function finalizeWebhookEvent(supabase, eventId, status, lastError = null) {
    const updates = {
        status,
        last_error: lastError ? String(lastError).slice(0, 2000) : null,
        processed_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase
            .from('stripe_webhook_events')
            .update(updates)
            .eq('event_id', eventId);

        if (error) {
            throw error;
        }
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST205' || raw.includes('stripe_webhook_events')) {
            return;
        }
        throw error;
    }
}

async function findOrderByStripeSession(supabase, session) {
    const orderCode = String(session?.metadata?.order_code || '').trim();
    if (orderCode) {
        const { data, error } = await supabase
            .from('encomendas')
            .select('*')
            .eq('numero_encomenda', orderCode)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (data) {
            return data;
        }
    }

    const sessionId = String(session?.id || '').trim();
    if (!sessionId) {
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('encomendas')
            .select('*')
            .eq('stripe_session_id', sessionId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST204' || raw.includes('stripe_session_id')) {
            return null;
        }
        throw error;
    }
}

async function updateOrderPaymentStatus(supabase, order, session, paymentStatus) {
    const split = splitOrderNotesAndMeta(order?.notas || '');
    const meta = appendWorkflowHistory(split.meta, split.meta.workflowStatus, paymentStatus === 'paid'
        ? 'Pagamento confirmado via Stripe'
        : paymentStatus === 'failed'
            ? 'Pagamento Stripe falhou'
            : 'Pagamento Stripe expirado');

    meta.paymentStatus = paymentStatus;
    meta.paymentProvider = 'stripe';
    meta.paymentMethod = session?.metadata?.payment_method || meta.paymentMethod || '';
    meta.stripeSessionId = session?.id || meta.stripeSessionId || '';
    meta.stripePaymentIntent = session?.payment_intent ? String(session.payment_intent) : meta.stripePaymentIntent || '';
    meta.facturalusaStatus = meta.facturalusaStatus || (paymentStatus === 'paid' ? 'pending' : '');
    const nextNotes = buildOrderNotesWithMeta(split.publicNotes, meta);
    const updates = {
        notas: nextNotes,
        payment_provider: 'stripe',
        payment_status: paymentStatus,
        stripe_session_id: session?.id || null,
        stripe_payment_intent: session?.payment_intent ? String(session.payment_intent) : null,
        stripe_payment_method_type: session?.metadata?.payment_method || meta.paymentMethod || '',
        payment_confirmed_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
        facturalusa_status: meta.facturalusaStatus || null,
        stripe_metadata: session || {}
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

    return {
        ...order,
        ...updates
    };
}

async function emitFacturalusaDocument(supabase, order, session) {
    const split = splitOrderNotesAndMeta(order?.notas || '');
    if (order?.facturalusa_status === 'emitted' || split.meta.facturalusaDocumentNumber) {
        return { emitted: false, skipped: true, order };
    }

    const invoiceResult = await issueFacturalusaDocumentForOrder({
        supabase,
        order,
        session
    });

    const sale = invoiceResult.sale;
    const customer = invoiceResult.customer;
    const facturalusaDocumentNumber = sale?.document_full_number || sale?.number || sale?.reference || null;
    const facturalusaDocumentUrl = sale?.url_file || sale?.url || null;
    const facturalusaCustomerCode = customer?.code || customer?.id || null;

    const nextMeta = appendWorkflowHistory(split.meta, split.meta.workflowStatus, 'Documento fiscal emitido no Facturalusa');
    nextMeta.paymentStatus = 'paid';
    nextMeta.paymentProvider = 'stripe';
    nextMeta.paymentMethod = session?.metadata?.payment_method || order?.metodo_pagamento || 'card';
    nextMeta.stripeSessionId = session?.id || nextMeta.stripeSessionId || '';
    nextMeta.stripePaymentIntent = session?.payment_intent ? String(session.payment_intent) : nextMeta.stripePaymentIntent || '';
    nextMeta.facturalusaCustomerCode = facturalusaCustomerCode ? String(facturalusaCustomerCode) : nextMeta.facturalusaCustomerCode || '';
    nextMeta.facturalusaDocumentNumber = facturalusaDocumentNumber ? String(facturalusaDocumentNumber) : nextMeta.facturalusaDocumentNumber || '';
    nextMeta.facturalusaDocumentUrl = facturalusaDocumentUrl ? String(facturalusaDocumentUrl) : nextMeta.facturalusaDocumentUrl || '';
    nextMeta.facturalusaLastError = '';
    nextMeta.facturalusaStatus = 'emitted';
    nextMeta.facturalusaLastAttemptAt = new Date().toISOString();

    const updates = {
        notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta),
        payment_provider: 'stripe',
        payment_status: 'paid',
        stripe_session_id: session?.id || null,
        stripe_payment_intent: session?.payment_intent ? String(session.payment_intent) : null,
        stripe_payment_method_type: session?.metadata?.payment_method || order?.metodo_pagamento || 'card',
        payment_confirmed_at: order?.payment_confirmed_at || new Date().toISOString(),
        facturalusa_customer_code: facturalusaCustomerCode ? String(facturalusaCustomerCode) : null,
        facturalusa_document_number: facturalusaDocumentNumber ? String(facturalusaDocumentNumber) : null,
        facturalusa_document_url: facturalusaDocumentUrl ? String(facturalusaDocumentUrl) : null,
        facturalusa_last_error: null,
        facturalusa_status: 'emitted',
        facturalusa_payload: sale || {}
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

    return {
        emitted: true,
        order: {
            ...order,
            ...updates
        }
    };
}

async function markOrderFailed(supabase, order, session, paymentStatus) {
    const split = splitOrderNotesAndMeta(order?.notas || '');
    const meta = appendWorkflowHistory(split.meta, split.meta.workflowStatus, paymentStatus === 'failed'
        ? 'Pagamento Stripe falhou'
        : 'Pagamento Stripe expirado');

    meta.paymentStatus = paymentStatus;
    meta.paymentProvider = 'stripe';
    meta.paymentMethod = session?.metadata?.payment_method || meta.paymentMethod || '';
    meta.stripeSessionId = session?.id || meta.stripeSessionId || '';
    meta.stripePaymentIntent = session?.payment_intent ? String(session.payment_intent) : meta.stripePaymentIntent || '';

    const { error } = await updateWithOptionalColumns(
        supabase,
        'encomendas',
        'id',
        order.id,
        {
            notas: buildOrderNotesWithMeta(split.publicNotes, meta),
            payment_provider: 'stripe',
            payment_status: paymentStatus,
            stripe_session_id: session?.id || null,
            stripe_payment_intent: session?.payment_intent ? String(session.payment_intent) : null,
            stripe_payment_method_type: session?.metadata?.payment_method || meta.paymentMethod || ''
        }
    );

    if (error) {
        throw error;
    }
}

module.exports = async function stripeWebhookHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    try {
        const rawBody = await readRawBody(req);
        const signature = String(req.headers['stripe-signature'] || '').trim();

        if (!signature) {
            sendJson(res, 400, { error: 'Missing Stripe signature' });
            return;
        }

        const stripe = getStripeClient();
        const webhookSecret = getStripeWebhookSecret();
        if (!webhookSecret) {
            sendJson(res, 500, { error: 'STRIPE_WEBHOOK_SECRET not configured' });
            return;
        }

        const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        const supabase = getSupabaseAdmin();

        const claimed = await claimWebhookEvent(supabase, event);
        if (!claimed) {
            sendJson(res, 200, { received: true, duplicated: true });
            return;
        }

        try {
            if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
                const session = event.data.object;
                const order = await findOrderByStripeSession(supabase, session);

                if (order) {
                    const paidOrder = await updateOrderPaymentStatus(supabase, order, session, 'paid');

                    try {
                        const invoiceResult = await emitFacturalusaDocument(supabase, paidOrder, session);
                        if (invoiceResult?.emitted && invoiceResult.order) {
                            await sendOrderEmailNotification({
                                supabase,
                                req,
                                order: invoiceResult.order,
                                templateKey: 'invoice_document_ready',
                                dedupeKey: `invoice_document_ready:${invoiceResult.order.id}`
                            });
                        }
                    } catch (facturalusaError) {
                        const split = splitOrderNotesAndMeta(paidOrder?.notas || order?.notas || '');
                        const meta = appendWorkflowHistory(split.meta, split.meta.workflowStatus, 'Falha ao emitir documento no Facturalusa');
                        const classified = classifyFacturalusaError(facturalusaError);
                        meta.paymentStatus = 'paid';
                        meta.paymentProvider = 'stripe';
                        meta.paymentMethod = session?.metadata?.payment_method || paidOrder?.metodo_pagamento || order?.metodo_pagamento || 'card';
                        meta.stripeSessionId = session?.id || meta.stripeSessionId || '';
                        meta.stripePaymentIntent = session?.payment_intent ? String(session.payment_intent) : meta.stripePaymentIntent || '';
                        meta.facturalusaLastError = classified.message || facturalusaError?.message || 'Falha ao emitir documento no Facturalusa';
                        meta.facturalusaStatus = classified.retryable ? 'error' : 'blocked';
                        meta.facturalusaLastAttemptAt = new Date().toISOString();

                        const { error: facturalusaUpdateError } = await updateWithOptionalColumns(
                            supabase,
                            'encomendas',
                            'id',
                            order.id,
                            {
                                notas: buildOrderNotesWithMeta(split.publicNotes, meta),
                                payment_provider: 'stripe',
                                payment_status: 'paid',
                                stripe_session_id: session?.id || null,
                                stripe_payment_intent: session?.payment_intent ? String(session.payment_intent) : null,
                                stripe_payment_method_type: session?.metadata?.payment_method || paidOrder?.metodo_pagamento || order?.metodo_pagamento || 'card',
                                payment_confirmed_at: paidOrder?.payment_confirmed_at || order?.payment_confirmed_at || new Date().toISOString(),
                                facturalusa_last_error: meta.facturalusaLastError,
                                facturalusa_status: meta.facturalusaStatus
                            }
                        );

                        if (facturalusaUpdateError) {
                            throw facturalusaUpdateError;
                        }

                        console.warn('Facturalusa nao conseguiu emitir o documento, mas o pagamento ficou concluido:', facturalusaError);
                    }

                    const emailResult = await sendOrderEmailNotification({
                        supabase,
                        req,
                        order: paidOrder,
                        templateKey: 'order_confirmation',
                        dedupeKey: `order_confirmation:${paidOrder.id}`
                    });

                    if (!emailResult.sent && emailResult.reason !== 'DUPLICATE_EMAIL') {
                        console.warn('Email de confirmacao nao enviado:', emailResult.reason || emailResult.message || emailResult);
                    }
                }
            }

            if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
                const session = event.data.object;
                const order = await findOrderByStripeSession(supabase, session);

                if (order) {
                    await markOrderFailed(
                        supabase,
                        order,
                        session,
                        event.type === 'checkout.session.expired' ? 'expired' : 'failed'
                    );
                }
            }

            await finalizeWebhookEvent(supabase, event.id, 'processed', null);
            sendJson(res, 200, { received: true });
        } catch (processingError) {
            await finalizeWebhookEvent(supabase, event.id, 'failed', processingError?.message || 'Webhook processing failed');
            throw processingError;
        }
    } catch (error) {
        console.error('Stripe webhook error:', error);
        sendJson(res, 400, {
            error: 'WEBHOOK_ERROR',
            message: error?.message || 'Invalid webhook event'
        });
    }
};
