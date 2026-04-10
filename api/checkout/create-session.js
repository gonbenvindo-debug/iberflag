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
const {
    applyRateLimit,
    readJsonBody,
    sendJson,
    getPublicBaseUrl
} = require('../../lib/server/http');
const {
    insertWithOptionalColumns,
    updateWithOptionalColumns
} = require('../../lib/server/schema-safe');
const {
    buildCheckoutCustomerSnapshot,
    buildInitialOrderMeta,
    calculateCheckoutTotals,
    findOrCreateCheckoutCustomer,
    resolveCheckoutCart,
    validateCheckoutCustomerEmail,
    validateCheckoutCustomerPhone,
    validateCheckoutCustomerType,
    validateCheckoutPostalCode,
    validateCheckoutCustomerTaxId
} = require('../../lib/server/order-flow');
const { buildOrderFiscalFields, resolveCheckoutCountryCode } = require('../../lib/server/fiscal-engine');
const {
    calculateOrderMarginEstimate,
    logAnalyticsEvent,
    logOperationalEvent,
    recordFiscalDecision
} = require('../../lib/server/ops');
const SiteRoutes = require('../../assets/js/core/site-routes.js');

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

    if (errorCode === 'EMAIL_INVALIDO') {
        return error?.message || 'Introduza um email valido para iniciar o checkout.';
    }

    if (errorCode === 'NIF_INVALIDO') {
        return error?.message || 'NIF invalido. Verifique o numero fiscal antes de continuar.';
    }

    if (errorCode === 'NIF_REQUIRED') {
        return error?.message || 'Para faturacao empresarial o NIF e obrigatorio.';
    }

    if (errorCode === 'CUSTOMER_IDENTITY_CONFLICT') {
        return error?.message || 'Ja existe um cliente com este NIF associado a outro contacto. Confirme o email e o nome fiscal antes de continuar.';
    }

    if (errorCode === 'EMPRESA_REQUIRED') {
        return error?.message || 'Indique o nome fiscal da empresa para emitir a fatura.';
    }

    if (errorCode === 'TELEFONE_INVALIDO') {
        return error?.message || 'Introduza um numero de contacto valido.';
    }

    if (errorCode === 'TIPO_CLIENTE_INVALIDO') {
        return error?.message || 'Escolha se a faturacao e para particular ou empresa.';
    }

    if (errorCode === 'CODIGO_POSTAL_INVALIDO') {
        return error?.message || 'Introduza um codigo postal valido.';
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

function getCheckoutErrorStatus(error) {
    const errorCode = String(error?.code || '').toUpperCase();
    const errorMessage = String(error?.message || '').toUpperCase();

    if (errorMessage === 'REQUEST_BODY_TOO_LARGE') {
        return 413;
    }

    if (errorCode === 'INVALID_JSON_BODY' || errorMessage === 'INVALID_JSON_BODY') {
        return 400;
    }

    if ([
        'CARRINHO_VAZIO',
        'DADOS_CLIENTE_INVALIDOS',
        'MORADA_INVALIDA',
        'TOTAL_INVALIDO',
        'EMAIL_REQUIRED',
        'EMAIL_INVALIDO',
        'NIF_INVALIDO',
        'NIF_REQUIRED',
        'EMPRESA_REQUIRED',
        'TELEFONE_INVALIDO',
        'TIPO_CLIENTE_INVALIDO',
        'CODIGO_POSTAL_INVALIDO',
        'BASE_INVALIDA',
        'CUSTOMER_IDENTITY_CONFLICT'
    ].includes(errorCode)) {
        return 400;
    }

    if ([
        'MISSING_PRODUCT_MAPPING',
        'PRODUCT_INACTIVE'
    ].includes(errorCode)) {
        return 409;
    }

    return 500;
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

    if (!applyRateLimit(req, res, {
        key: 'checkout-create-session',
        windowMs: 5 * 60 * 1000,
        max: 18,
        message: 'Demasiadas tentativas de checkout. Aguarde um pouco e volte a tentar.'
    })) {
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

        const customerSnapshot = buildCheckoutCustomerSnapshot(customer);
        const customerTypeValidation = validateCheckoutCustomerType(customerSnapshot);
        if (!customerTypeValidation.valid) {
            sendJson(res, 400, {
                error: 'TIPO_CLIENTE_INVALIDO',
                message: customerTypeValidation.message,
                field: 'tipo_cliente'
            });
            return;
        }

        const emailValidation = validateCheckoutCustomerEmail(customerSnapshot.email);
        if (!emailValidation.valid) {
            sendJson(res, 400, {
                error: 'EMAIL_INVALIDO',
                message: emailValidation.message,
                field: 'email',
                suggestion: emailValidation.suggestion || null
            });
            return;
        }

        const phoneValidation = validateCheckoutCustomerPhone(customerSnapshot);
        if (!phoneValidation.valid) {
            sendJson(res, 400, {
                error: 'TELEFONE_INVALIDO',
                message: phoneValidation.message,
                field: 'telefone'
            });
            return;
        }
        customerSnapshot.telefone = phoneValidation.normalized;

        const postalCodeValidation = validateCheckoutPostalCode(customerSnapshot);
        if (!postalCodeValidation.valid) {
            sendJson(res, 400, {
                error: 'CODIGO_POSTAL_INVALIDO',
                message: postalCodeValidation.message,
                field: 'codigo_postal'
            });
            return;
        }
        customerSnapshot.codigo_postal = postalCodeValidation.normalized;

        const taxIdValidation = validateCheckoutCustomerTaxId(customerSnapshot);
        if (!taxIdValidation.valid) {
            sendJson(res, 400, {
                error: 'NIF_INVALIDO',
                message: taxIdValidation.message,
                field: 'nif'
            });
            return;
        }
        customerSnapshot.nif = taxIdValidation.normalized;

        if (customerSnapshot.tipo_cliente === 'empresa') {
            if (!String(customerSnapshot.empresa || '').trim()) {
                sendJson(res, 400, {
                    error: 'EMPRESA_REQUIRED',
                    message: 'Indique o nome fiscal da empresa para emitir a fatura.',
                    field: 'empresa'
                });
                return;
            }

            if (!String(customerSnapshot.nif || '').trim()) {
                sendJson(res, 400, {
                    error: 'NIF_REQUIRED',
                    message: 'Para faturacao empresarial o NIF e obrigatorio.',
                    field: 'nif'
                });
                return;
            }
        }

        const supabase = getSupabaseAdmin();
        const stripe = getStripeClient();
        const baseUrl = getPublicBaseUrl(req);
        const cart = await resolveCheckoutCart(supabase, rawCart);
        const { subtotal, shipping, total } = calculateCheckoutTotals(cart);
        const fiscalFields = buildOrderFiscalFields({
            customer: customerSnapshot,
            paymentStatus: 'pending',
            referenceDate: new Date()
        });
        const marginEstimate = await calculateOrderMarginEstimate(supabase, cart, total);

        if (total <= 0) {
            sendJson(res, 400, { error: 'TOTAL_INVALIDO' });
            return;
        }

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
                morada_envio: `${customerSnapshot.morada}, ${customerSnapshot.codigo_postal} ${customerSnapshot.cidade}`,
                metodo_pagamento: selectedPaymentMethod
            },
            {
                payment_provider: 'stripe',
                payment_status: 'pending',
                stripe_payment_method_type: selectedPaymentMethod,
                facturalusa_status: 'pending',
                ...fiscalFields,
                margin_estimate: marginEstimate,
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
        await logAnalyticsEvent(supabase, {
            event_name: 'begin_checkout',
            order_id: order.id,
            country_code: resolveCheckoutCountryCode(customerSnapshot),
            metadata: {
                orderCode: orderNumber,
                itemCount: cart.length,
                total
            }
        });
        await logOperationalEvent(supabase, {
            event_name: 'checkout_session_created',
            level: 'info',
            order_id: order.id,
            payload: {
                orderCode: orderNumber,
                fiscalScenario: fiscalFields.fiscal_scenario,
                fiscalDecisionMode: fiscalFields.fiscal_decision_mode,
                shippingZoneCode: fiscalFields.shipping_zone_code,
                marginEstimate
            }
        });
        await recordFiscalDecision(supabase, {
            order_id: order.id,
            scenario: fiscalFields.fiscal_scenario,
            decision_mode: fiscalFields.fiscal_decision_mode,
            evidence_status: fiscalFields.fiscal_evidence_status,
            vat_rate: fiscalFields.vat_rate_applied,
            vat_exemption: fiscalFields.vat_exemption_applied,
            reason: fiscalFields.fiscal_decision_reason,
            payload: {
                orderCode: orderNumber,
                phase: 'checkout_created',
                paymentStatus: 'pending',
                shippingZoneCode: fiscalFields.shipping_zone_code,
                countryCode: resolveCheckoutCountryCode(customerSnapshot)
            }
        });

        const paymentMethodTypes = resolveStripePaymentMethodTypes(selectedPaymentMethod);
        const successUrl = `${baseUrl}${SiteRoutes.buildCheckoutSuccessPath({
            session_id: '{CHECKOUT_SESSION_ID}',
            codigo: orderNumber
        })}`;
        const cancelUrl = `${baseUrl}${SiteRoutes.withQuery(SiteRoutes.STATIC_PATHS.checkout, { cancelled: 1 })}`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: paymentMethodTypes,
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: orderNumber,
            customer_email: customerSnapshot.email,
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

        const statusCode = getCheckoutErrorStatus(error);
        sendJson(res, statusCode, {
            error: statusCode >= 500 ? 'CHECKOUT_SESSION_FAILED' : (error?.code || 'CHECKOUT_SESSION_FAILED'),
            message: getCheckoutErrorMessage(error)
        });
    }
};
