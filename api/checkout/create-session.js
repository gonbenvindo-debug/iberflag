const {
    buildCheckoutPayloadSnapshot,
    buildOrderItemSnapshots,
    buildOrderNotesWithMeta,
    generateOrderNumber,
    normalizePaymentMethodType,
    resolveStripePaymentMethodTypes
} = require('../../lib/server/checkout');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { getStripeClient } = require('../../lib/server/stripe');
const { insertOrderItemsWithFallback } = require('../../lib/server/order-items');
const { readJsonBody, sendJson, getPublicBaseUrl } = require('../../lib/server/http');

// Checkout flow version bump to force a fresh production deploy.
function buildCheckoutCustomerSnapshot(customer = {}) {
    return {
        nome: String(customer.nome || '').trim(),
        email: String(customer.email || '').trim().toLowerCase(),
        telefone: String(customer.telefone || '').trim(),
        empresa: String(customer.empresa || '').trim(),
        nif: String(customer.nif || '').trim(),
        morada: String(customer.morada || '').trim(),
        codigo_postal: String(customer.codigo_postal || '').trim(),
        cidade: String(customer.cidade || '').trim()
    };
}

async function findOrCreateCheckoutCustomer(supabase, customer) {
    const customerSnapshot = buildCheckoutCustomerSnapshot(customer);
    if (!customerSnapshot.email) {
        const error = new Error('EMAIL_REQUIRED');
        error.code = 'EMAIL_REQUIRED';
        throw error;
    }

    const { data: existingCustomer, error: lookupError } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', customerSnapshot.email)
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
    }

    if (existingCustomer?.id) {
        return existingCustomer.id;
    }

    const { data: createdCustomer, error: createError } = await supabase
        .from('clientes')
        .insert([customerSnapshot])
        .select('id')
        .single();

    if (createError) {
        throw createError;
    }

    return createdCustomer?.id || null;
}

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
        const cart = Array.isArray(body?.cart) ? body.cart : [];
        const selectedPaymentMethod = normalizePaymentMethodType(body?.paymentMethod);
        const notes = String(body?.notes || '').trim();

        if (!Array.isArray(cart) || cart.length === 0) {
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
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.preco || 0) * Number(item.quantity || 1)), 0);
        const shipping = 0;
        const total = subtotal + shipping;

        if (total <= 0) {
            sendJson(res, 400, { error: 'TOTAL_INVALIDO' });
            return;
        }

        const customerSnapshot = buildCheckoutCustomerSnapshot(customer);
        const customerId = await findOrCreateCheckoutCustomer(supabase, customerSnapshot);

        const orderNumber = generateOrderNumber();
        const itemSnapshots = buildOrderItemSnapshots(cart);
        const orderMeta = {
            workflowStatus: 'pendente_confirmacao',
            paymentStatus: 'pending',
            paymentProvider: 'stripe',
            paymentMethod: selectedPaymentMethod,
            trackingCode: '',
            trackingUrl: '',
            stripeSessionId: '',
            stripePaymentIntent: '',
            facturalusaCustomerCode: '',
            facturalusaDocumentNumber: '',
            facturalusaDocumentUrl: '',
            facturalusaLastError: '',
            facturalusaStatus: 'pending',
            facturalusaLastAttemptAt: '',
            statusHistory: [
                {
                    status: 'pendente_confirmacao',
                    at: new Date().toISOString(),
                    note: 'Encomenda criada no checkout'
                }
            ],
            itemSnapshots,
            checkoutCustomer: customerSnapshot,
            checkoutSnapshot: buildCheckoutPayloadSnapshot(customerSnapshot, cart, selectedPaymentMethod, notes)
        };

        const { data: order, error: orderError } = await supabase
            .from('encomendas')
            .insert([{
                cliente_id: customerId,
                numero_encomenda: orderNumber,
                status: 'pendente',
                subtotal,
                envio: shipping,
                total,
                notas: buildOrderNotesWithMeta(notes, orderMeta),
                morada_envio: `${customer.morada}, ${customer.codigo_postal} ${customer.cidade}`,
                metodo_pagamento: selectedPaymentMethod
            }])
            .select('*')
            .single();

        if (orderError) {
            throw orderError;
        }

        orderIdForCleanup = order.id;

        try {
            await insertOrderItemsWithFallback(supabase, order.id, cart);
        } catch (itemError) {
            console.warn('Falha ao gravar itens da encomenda:', itemError);
        }

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
            line_items: cart.map((item) => ({
                quantity: Math.max(1, Number(item.quantity || 1)),
                price_data: {
                    currency: 'eur',
                    unit_amount: Math.max(0, Math.round(Number(item.preco || 0) * 100)),
                    product_data: {
                        name: String(item.nome || 'Produto').trim(),
                        description: [item.baseNome, item.customized ? 'Personalizado' : '', item.designId ? `Design ${item.designId}` : '']
                            .filter(Boolean)
                            .join(' | ') || undefined,
                        images: String(item.imagem || '').trim() ? [String(item.imagem).trim()] : undefined
                    }
                }
            })),
            billing_address_collection: 'required'
        });

        const orderNotesWithSession = buildOrderNotesWithMeta(notes, {
            ...orderMeta,
            stripeSessionId: session.id
        });

        const { error: notesUpdateError } = await supabase
            .from('encomendas')
            .update({
                notas: orderNotesWithSession
            })
            .eq('id', order.id);

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
