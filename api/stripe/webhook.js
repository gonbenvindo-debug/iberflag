const { getStripeClient, getStripeWebhookSecret } = require('../../lib/server/stripe');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { readRawBody, sendJson } = require('../../lib/server/http');
const {
    appendWorkflowHistory,
    buildOrderNotesWithMeta,
    buildOrderItemSnapshots,
    splitOrderNotesAndMeta
} = require('../../lib/server/checkout');
const { createSaleForOrder, findOrCreateCustomer } = require('../../lib/server/facturalusa');

async function claimWebhookEvent(supabase, event) {
    const now = new Date().toISOString();
    const { data: existing, error: lookupError } = await supabase
        .from('stripe_webhook_events')
        .select('event_id,status,attempts,last_error,processed_at')
        .eq('event_id', event.id)
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
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

    const { error } = await supabase
        .from('stripe_webhook_events')
        .update(updates)
        .eq('event_id', eventId);

    if (error) {
        throw error;
    }
}

async function findOrderByStripeSession(supabase, session) {
    const orderCode = String(session?.metadata?.order_code || '').trim();
    const sessionId = String(session?.id || '').trim();

    let query = supabase.from('encomendas').select('*').limit(1);
    if (sessionId) {
        query = query.eq('stripe_session_id', sessionId);
    } else if (orderCode) {
        query = query.eq('numero_encomenda', orderCode);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
        throw error;
    }

    if (data) {
        return data;
    }

    if (orderCode) {
        const fallback = await supabase
            .from('encomendas')
            .select('*')
            .eq('numero_encomenda', orderCode)
            .limit(1)
            .maybeSingle();

        if (fallback.error) {
            throw fallback.error;
        }

        return fallback.data || null;
    }

    return null;
}

async function updateOrderPaymentStatus(supabase, order, session, paymentStatus, extraUpdates = {}) {
    const split = splitOrderNotesAndMeta(order?.notas || '');
    const alreadyInStatus = String(order?.payment_status || '').toLowerCase() === paymentStatus
        && String(order?.stripe_session_id || '') === String(session?.id || '');
    const meta = alreadyInStatus
        ? split.meta
        : appendWorkflowHistory(split.meta, split.meta.workflowStatus, paymentStatus === 'paid'
            ? 'Pagamento confirmado via Stripe'
            : paymentStatus === 'failed'
                ? 'Pagamento Stripe falhou'
                : 'Pagamento Stripe expirado');

    meta.paymentStatus = paymentStatus;
    meta.paymentProvider = 'stripe';
    meta.paymentMethod = session?.metadata?.payment_method || meta.paymentMethod || '';
    meta.stripeSessionId = session?.id || meta.stripeSessionId || '';
    meta.stripePaymentIntent = session?.payment_intent ? String(session.payment_intent) : meta.stripePaymentIntent || '';

    const updates = {
        payment_status: paymentStatus,
        payment_provider: 'stripe',
        stripe_session_id: session?.id || order?.stripe_session_id || null,
        stripe_payment_intent: session?.payment_intent ? String(session.payment_intent) : order?.stripe_payment_intent || null,
        stripe_payment_method_type: session?.metadata?.payment_method || order?.stripe_payment_method_type || null,
        stripe_metadata: session?.metadata || order?.stripe_metadata || {},
        notas: buildOrderNotesWithMeta(split.publicNotes, meta),
        ...extraUpdates
    };

    if (paymentStatus === 'paid') {
        updates.payment_confirmed_at = new Date().toISOString();
    }

    const { error } = await supabase
        .from('encomendas')
        .update(updates)
        .eq('id', order.id);

    if (error) {
        throw error;
    }
}

async function emitFacturalusaDocument(supabase, order, session) {
    const split = splitOrderNotesAndMeta(order?.notas || '');
    if (order?.facturalusa_status === 'emitted' || split.meta.facturalusaDocumentNumber) {
        return;
    }

    const checkoutPayload = order?.checkout_payload && typeof order.checkout_payload === 'object'
        ? order.checkout_payload
        : {};
    const checkoutCustomer = checkoutPayload?.customer && typeof checkoutPayload.customer === 'object'
        ? checkoutPayload.customer
        : {};

    const customerData = {
        nome: checkoutCustomer.nome || 'Cliente IberFlag',
        email: checkoutCustomer.email || session?.customer_email || '',
        telefone: checkoutCustomer.telefone || '',
        empresa: checkoutCustomer.empresa || '',
        nif: checkoutCustomer.nif || '',
        morada: checkoutCustomer.morada || '',
        codigo_postal: checkoutCustomer.codigo_postal || '',
        cidade: checkoutCustomer.cidade || '',
        country: checkoutCustomer.country || ''
    };

    const snapshots = Array.isArray(split.meta.itemSnapshots) && split.meta.itemSnapshots.length > 0
        ? split.meta.itemSnapshots
        : buildOrderItemSnapshots([]);

    const customer = await findOrCreateCustomer(customerData, {
        paymentMethod: session?.metadata?.payment_method || order?.metodo_pagamento || 'card'
    });

    const sale = await createSaleForOrder({
        customer,
        order: {
            ...order,
            stripe_session_id: session?.id || order?.stripe_session_id || null
        },
        cartItems: snapshots,
        paymentMethod: session?.metadata?.payment_method || order?.metodo_pagamento || 'card',
        sourceCustomer: customerData
    });

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

    const { error } = await supabase
        .from('encomendas')
        .update({
            facturalusa_status: 'emitted',
            facturalusa_customer_code: facturalusaCustomerCode || null,
            facturalusa_document_number: facturalusaDocumentNumber,
            facturalusa_document_url: facturalusaDocumentUrl,
            facturalusa_payload: sale,
            facturalusa_last_error: null,
            stripe_metadata: session?.metadata || order?.stripe_metadata || {},
            notas: buildOrderNotesWithMeta(split.publicNotes, nextMeta)
        })
        .eq('id', order.id);

    if (error) {
        throw error;
    }
}

async function markOrderFailed(supabase, order, session, paymentStatus) {
    const split = splitOrderNotesAndMeta(order?.notas || '');
    const alreadyInStatus = String(order?.payment_status || '').toLowerCase() === paymentStatus
        && String(order?.stripe_session_id || '') === String(session?.id || '');
    const meta = alreadyInStatus
        ? split.meta
        : appendWorkflowHistory(split.meta, split.meta.workflowStatus, paymentStatus === 'failed'
            ? 'Pagamento Stripe falhou'
            : 'Pagamento Stripe expirado');

    meta.paymentStatus = paymentStatus;
    meta.paymentProvider = 'stripe';
    meta.paymentMethod = session?.metadata?.payment_method || meta.paymentMethod || '';
    meta.stripeSessionId = session?.id || meta.stripeSessionId || '';
    meta.stripePaymentIntent = session?.payment_intent ? String(session.payment_intent) : meta.stripePaymentIntent || '';

    const { error } = await supabase
        .from('encomendas')
        .update({
            payment_status: paymentStatus,
            payment_provider: 'stripe',
            stripe_session_id: session?.id || order?.stripe_session_id || null,
            stripe_payment_intent: session?.payment_intent ? String(session.payment_intent) : order?.stripe_payment_intent || null,
            stripe_payment_method_type: session?.metadata?.payment_method || order?.stripe_payment_method_type || null,
            stripe_metadata: session?.metadata || order?.stripe_metadata || {},
            notas: buildOrderNotesWithMeta(split.publicNotes, meta)
        })
        .eq('id', order.id);

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
                    await updateOrderPaymentStatus(supabase, order, session, 'paid', {
                        payment_confirmed_at: new Date().toISOString()
                    });

                    try {
                        await emitFacturalusaDocument(supabase, order, session);
                    } catch (facturalusaError) {
                        await supabase
                            .from('encomendas')
                            .update({
                                facturalusa_status: 'error',
                                facturalusa_last_error: facturalusaError?.message || 'Falha ao emitir documento no Facturalusa'
                            })
                            .eq('id', order.id);

                        throw facturalusaError;
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
