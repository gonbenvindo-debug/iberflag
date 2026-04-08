const {
    buildOrderNotesWithMeta,
    buildStripeLineItem,
    generateOrderNumber,
    normalizePaymentMethodType,
    resolveStripePaymentMethodTypes
} = require('../../lib/server/checkout');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { getStripeClient } = require('../../lib/server/stripe');
const { insertOrderItemsWithFallback } = require('../../lib/server/order-items');
const { readJsonBody, sendJson, getPublicBaseUrl } = require('../../lib/server/http');
const {
    insertWithOptionalColumns,
    updateWithOptionalColumns
} = require('../../lib/server/schema-safe');
const {
    buildCheckoutCustomerSnapshot,
    buildInitialOrderMeta,
    calculateCheckoutTotals,
    findOrCreateCheckoutCustomer,
    resolveCheckoutCart
} = require('../../lib/server/order-flow');

function getCheckoutErrorMessage(error) {
    const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
    const errorCode = String(error?.code || '').toUpperCase();

    if (error?.code === 'INVALID_JSON_BODY') {
        return 'Pedido JSON invalido.';
    }

    if (error?.message === 'REQUEST_BODY_TOO_LARGE') {
        return 'O carrinho enviado para o checkout esta demasiado grande. Volte a guardar o design e tente novamente.';
    }

    if (errorCode === 'SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED' || errorCode.startsWith('SUPABASE_SERVICE_ROLE_KEY_')) {
        return 'Configuracao do Supabase em falta no servidor.';
    }

    if (errorCode === 'SUPABASE_URL_NOT_CONFIGURED' || errorCode.startsWith('SUPABASE_URL_')) {
        return 'Configuracao do URL do Supabase em falta no servidor.';
    }

    if (errorCode === 'STRIPE_SECRET_KEY_NOT_CONFIGURED' || errorCode.startsWith('STRIPE_SECRET_KEY_')) {
        return 'Configuracao do Stripe em falta no servidor.';
    }

    if (errorCode === 'STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED' || errorCode.startsWith('STRIPE_WEBHOOK_SECRET_')) {
        return 'Configuracao do webhook do Stripe em falta no servidor.';
    }

    if (errorCode === 'STRIPE_PUBLISHABLE_KEY_NOT_CONFIGURED' || errorCode.startsWith('STRIPE_PUBLISHABLE_KEY_')) {
        return 'Configuracao publica do Stripe em falta no servidor.';
    }

    if (errorCode === 'FACTURALUSA_API_TOKEN_NOT_CONFIGURED' || errorCode.startsWith('FACTURALUSA_API_TOKEN_')) {
        return 'Configuracao do Facturalusa em falta no servidor.';
    }

    if (errorCode === 'EMAIL_REQUIRED') {
        return 'Introduza um email valido para iniciar o checkout.';
    }

    if (error?.code === 'MISSING_PRODUCT_MAPPING') {
        return 'Existem produtos no carrinho que ja nao existem na base de dados.';
    }

    if (error?.code === 'PRODUCT_INACTIVE') {
        return 'Um dos produtos do carrinho deixou de estar disponivel.';
    }

    if (error?.code === 'BASE_INVALIDA') {
        return 'Uma das bases selecionadas ja nao esta disponivel para o produto.';
    }

    if (raw.includes('itens_encomenda') || raw.includes('encomendas') || raw.includes('clientes')) {
        return 'A base de dados do checkout nao corresponde ao esperado.';
    }

    if (errorCode === '22P02' && raw.includes('bigint')) {
        return 'A base de dados do checkout precisa de alinhamento entre clientes e encomendas.';
    }

    if (errorCode === '23503' && raw.includes('cliente_id')) {
        return 'Nao foi possivel associar a encomenda ao cliente.';
    }

    if (raw.includes('stripe')) {
        return 'O Stripe nao conseguiu criar a sessao de pagamento.';
    }

    return 'Nao foi possivel iniciar o checkout.';
}

async function deleteOrderWithItems(supabase, orderId) {
    if (!orderId) {
        return;
    }

    await supabase.from('itens_encomenda').delete().eq('encomenda_id', orderId);
    await supabase.from('encomendas').delete().eq('id', orderId);
}

module.exports = async function createCheckoutSessionHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    let orderIdForCleanup = null;

    try {
        const body = await readJsonBody(req);
        const customer = body?.customer || {};
        const rawCart = Array.isArray(body?.cart) ? body.cart : [];
        const selectedPaymentMethod = normalizePaymentMethodType(body?.paymentMethod);
        const notes = String(body?.notes || '').trim();

        if (!Array.isArray(rawCart) || rawCart.length === 0) {
            sendJson(res, 400, { error: 'CARRINHO_VAZIO' });
            return;
        }

        if (!String(customer.nome || '').trim() || !String(customer.email || '').trim() || !String(customer.telefone || '').trim()) {
            sendJson(res, 400, { error: 'DADOS_CLIENTE_INVALIDOS' });
            return;
        }

        if (!String(customer.morada || '').trim() || !String(customer.codigo_postal || '').trim() || !String(customer.cidade || '').trim()) {
            sendJson(res, 400, { error: 'MORADA_INVALIDA' });
            return;
        }

        const supabase = getSupabaseAdmin();
        const stripe = getStripeClient();
        const baseUrl = getPublicBaseUrl(req);
        const cart = await resolveCheckoutCart(supabase, rawCart);
        const { subtotal, shipping, total } = calculateCheckoutTotals(cart);

        if (total <= 0) {
            sendJson(res, 400, { error: 'TOTAL_INVALIDO' });
            return;
        }

        const customerSnapshot = buildCheckoutCustomerSnapshot(customer);
        const customerId = await findOrCreateCheckoutCustomer(supabase, customerSnapshot);

        const orderNumber = generateOrderNumber();
        const orderMeta = buildInitialOrderMeta(customerSnapshot, cart, selectedPaymentMethod, notes);

        const { data: order, error: orderError } = await insertWithOptionalColumns(
            supabase,
            'encomendas',
            {
                cliente_id: customerId,
                numero_encomenda: orderNumber,
                status: 'pendente',
                subtotal,
                envio: shipping,
                total,
                notas: buildOrderNotesWithMeta(notes, orderMeta),
                morada_envio: `${customer.morada}, ${customer.codigo_postal} ${customer.cidade}`,
                metodo_pagamento: selectedPaymentMethod
            },
            {
                payment_provider: 'stripe',
                payment_status: 'pending',
                stripe_payment_method_type: selectedPaymentMethod,
                facturalusa_status: 'pending',
                checkout_payload: orderMeta.checkoutSnapshot || {},
                stripe_metadata: {},
                facturalusa_payload: {}
            }
        );

        if (orderError) {
            throw orderError;
        }

        orderIdForCleanup = order.id;

        await insertOrderItemsWithFallback(supabase, order.id, cart);

        const paymentMethodTypes = resolveStripePaymentMethodTypes(selectedPaymentMethod);
        const successUrl = `${baseUrl}/checkout-sucesso.html?session_id={CHECKOUT_SESSION_ID}&codigo=${encodeURIComponent(orderNumber)}`;
        const cancelUrl = `${baseUrl}/checkout.html?cancelled=1`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: paymentMethodTypes,
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: orderNumber,
            customer_email: customer.email,
            metadata: {
                order_code: orderNumber,
                order_id: String(order.id),
                customer_id: String(customerId),
                payment_method: selectedPaymentMethod
            },
            line_items: cart.map(buildStripeLineItem),
            billing_address_collection: 'required'
        });

        const orderNotesWithSession = buildOrderNotesWithMeta(notes, {
            ...orderMeta,
            stripeSessionId: session.id
        });

        const { error: notesUpdateError } = await updateWithOptionalColumns(
            supabase,
            'encomendas',
            'id',
            order.id,
            {
                notas: orderNotesWithSession,
                stripe_session_id: session.id,
                stripe_checkout_url: session.url || '',
                stripe_payment_method_type: selectedPaymentMethod,
                stripe_metadata: {
                    id: session.id,
                    status: session.status || '',
                    payment_status: session.payment_status || '',
                    client_reference_id: session.client_reference_id || '',
                    payment_method_types: paymentMethodTypes
                }
            }
        );

        if (notesUpdateError) {
            console.warn('Nao foi possivel atualizar as notas da encomenda com o stripe_session_id:', notesUpdateError);
        }

        sendJson(res, 200, {
            url: session.url,
            sessionId: session.id,
            orderCode: orderNumber
        });
    } catch (error) {
        console.error('Falha ao criar checkout Stripe:', error);

        try {
            if (orderIdForCleanup) {
                const supabase = getSupabaseAdmin();
                await deleteOrderWithItems(supabase, orderIdForCleanup);
            }
        } catch (cleanupError) {
            console.warn('Falha ao limpar encomenda provisoria:', cleanupError);
        }

        sendJson(res, 500, {
            error: 'CHECKOUT_SESSION_FAILED',
            message: getCheckoutErrorMessage(error)
        });
    }
};
