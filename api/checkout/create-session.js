const {
    buildServiceOptionItems,
    buildOrderNotesWithMeta,
    buildStripeLineItem,
    buildStripeSessionSummary,
    generateOrderNumber,
    normalizeCheckoutServiceOptions,
    normalizePaymentMethodType,
    resolveStripePaymentMethodTypes
} = require('../../lib/server/checkout');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { getStripeClient, getStripePublishableKey } = require('../../lib/server/stripe');
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
    validateCheckoutPostalCode
} = require('../../lib/server/order-flow');
const {
    buildFiscalSnapshot,
    buildOrderFiscalFields,
    resolveCheckoutCountryCode
} = require('../../lib/server/fiscal-engine');
const {
    calculateOrderMarginEstimate,
    logAnalyticsEvent,
    logOperationalEvent,
    recordFiscalDecision
} = require('../../lib/server/ops');
const { runNonBlockingAction } = require('../../lib/server/resilience');
const { hashReadToken } = require('../../lib/server/design-storage');
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

    if (errorCode === 'COUNTRY_REQUIRED') {
        return error?.message || 'Escolha o país fiscal antes de continuar.';
    }

    if (errorCode === 'COUNTRY_INVALIDO') {
        return error?.message || 'Apenas Portugal e Espanha estão disponíveis no checkout.';
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

    if (error?.code === 'BASE_REQUIRED') {
        return 'Falta selecionar a base de fixacao de um Fly Banner.';
    }

    if (error?.code === 'BASE_CONFIG_MISSING') {
        return 'Um Fly Banner do carrinho nao tem bases de fixacao configuradas no admin.';
    }

    if (error?.code === 'BASE_UNAVAILABLE') {
        return 'Um Fly Banner do carrinho nao tem bases de fixacao disponiveis neste momento.';
    }

    if (errorCode === 'DESIGN_SNAPSHOT_REQUIRED') {
        return error?.message || 'Existe um design personalizado sem snapshot remoto valido. Reabra o personalizador e confirme o design novamente.';
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

    if (errorCode === 'STRIPE_EMBEDDED_CLIENT_SECRET_MISSING') {
        return 'O Stripe nao conseguiu preparar o checkout embebido.';
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
        'COUNTRY_INVALIDO',
        'BASE_INVALIDA',
        'BASE_REQUIRED',
        'CUSTOMER_IDENTITY_CONFLICT'
    ].includes(errorCode)) {
        return 400;
    }

    if ([
        'MISSING_PRODUCT_MAPPING',
        'PRODUCT_INACTIVE',
        'BASE_CONFIG_MISSING',
        'BASE_UNAVAILABLE',
        'DESIGN_SNAPSHOT_REQUIRED'
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

function normalizeBooleanFlag(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on', 'sim'].includes(normalized);
}

const ALLOWED_CHECKOUT_COUNTRIES = new Set(['PT', 'ES']);

function normalizeAllowedCheckoutCountry(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return ALLOWED_CHECKOUT_COUNTRIES.has(normalized) ? normalized : '';
}

function normalizeCheckoutText(value) {
    return String(value || '').trim();
}

function collectCustomizedDesignRequirements(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    return items
        .map((item, index) => {
            const designId = normalizeCheckoutText(item?.designId || item?.design_id);
            const customized = Boolean(item?.customized) || Boolean(designId);
            if (!customized) {
                return null;
            }

            return {
                index,
                designId,
                designReadToken: normalizeCheckoutText(item?.designReadToken || item?.design_read_token),
                productId: item?.id ?? item?.produtoId ?? item?.produto_id ?? null,
                productName: normalizeCheckoutText(item?.nome || item?.name || 'Produto personalizado') || 'Produto personalizado'
            };
        })
        .filter(Boolean);
}

function isDesignSnapshotStorageUnavailable(error) {
    const errorCode = String(error?.code || '').trim().toUpperCase();
    const raw = [error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' | ')
        .toLowerCase();

    if (errorCode === 'PGRST205' || errorCode === '42P01') {
        return true;
    }

    const referencesDesignSnapshots = raw.includes('design_snapshots') || raw.includes('design snapshot');
    const referencesSchemaOrAvailability =
        raw.includes('schema cache')
        || raw.includes('does not exist')
        || raw.includes('relation')
        || raw.includes('not available')
        || raw.includes('nao esta disponivel');

    return referencesDesignSnapshots && referencesSchemaOrAvailability;
}

async function assertRemoteDesignSnapshotsReady(supabase, checkoutItems = []) {
    const requirements = collectCustomizedDesignRequirements(checkoutItems);
    if (requirements.length === 0) {
        return;
    }

    const missingDesignIdItems = requirements
        .filter((entry) => !entry.designId || !entry.designReadToken)
        .map((entry) => ({
            ...entry,
            reason: !entry.designId ? 'MISSING_DESIGN_ID' : 'MISSING_DESIGN_READ_TOKEN'
        }));

    if (missingDesignIdItems.length > 0) {
        const error = new Error('Existe um design personalizado sem designId/token valido. Reabra o personalizador e confirme o design novamente.');
        error.code = 'DESIGN_SNAPSHOT_REQUIRED';
        error.details = missingDesignIdItems;
        throw error;
    }

    const designIds = [...new Set(requirements.map((entry) => entry.designId).filter(Boolean))];
    const snapshotsById = new Map();

    if (designIds.length > 0) {
        const { data, error } = await supabase
            .from('design_snapshots')
            .select('design_id, storage_bucket, masked_svg_path, read_token_hash')
            .in('design_id', designIds);

        if (error) {
            if (isDesignSnapshotStorageUnavailable(error)) {
                console.warn('Checkout: validacao remota de design indisponivel, a continuar com fallback local.', {
                    code: error?.code || '',
                    message: error?.message || ''
                });
                return;
            }
            throw error;
        }

        (Array.isArray(data) ? data : []).forEach((row) => {
            const id = normalizeCheckoutText(row?.design_id);
            if (!id) return;

            snapshotsById.set(id, {
                designId: id,
                storageBucket: normalizeCheckoutText(row?.storage_bucket),
                maskedSvgPath: normalizeCheckoutText(row?.masked_svg_path),
                readTokenHash: normalizeCheckoutText(row?.read_token_hash)
            });
        });
    }

    const missingItems = requirements
        .map((entry) => {
            const snapshot = snapshotsById.get(entry.designId);
            if (!snapshot) {
                return {
                    ...entry,
                    reason: 'SNAPSHOT_NOT_FOUND'
                };
            }

            if (!snapshot.maskedSvgPath || !snapshot.readTokenHash) {
                return {
                    ...entry,
                    reason: !snapshot.maskedSvgPath ? 'SNAPSHOT_STORAGE_PATH_MISSING' : 'SNAPSHOT_TOKEN_HASH_MISSING'
                };
            }

            if (hashReadToken(entry.designReadToken) !== snapshot.readTokenHash) {
                return {
                    ...entry,
                    reason: 'SNAPSHOT_TOKEN_INVALID'
                };
            }

            return null;
        })
        .filter(Boolean);

    if (missingItems.length > 0) {
        const error = new Error('Existe um design personalizado sem snapshot remoto valido. Reabra o personalizador e confirme o design novamente.');
        error.code = 'DESIGN_SNAPSHOT_REQUIRED';
        error.details = missingItems;
        throw error;
    }
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
        const selectedPaymentMethod = String(body?.paymentMethod || '').trim()
            ? normalizePaymentMethodType(body?.paymentMethod)
            : 'dynamic';
        const notes = String(body?.notes || '').trim();
        const serviceOptions = normalizeCheckoutServiceOptions({
            ...(body?.serviceOptions || {}),
            designReview: normalizeBooleanFlag(
                body?.designReviewSelected
                ?? body?.design_review_selected
                ?? body?.serviceOptions?.designReview
                ?? body?.serviceOptions?.design_review
            )
        });

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

        const fiscalCountryRaw = String(
            customer.country
            || customer.countryCode
            || customer.country_code
            || customer.pais
            || body?.country
            || body?.countryCode
            || body?.country_code
            || body?.pais
            || ''
        ).trim();
        const shippingCountryRaw = String(
            body?.pais_entrega
            || body?.shippingCountry
            || body?.shipping_country
            || customer.pais_entrega
            || customer.shippingCountry
            || customer.shipping_country
            || ''
        ).trim();

        if (!String(customer.country || customer.countryCode || customer.country_code || customer.pais || '').trim()) {
            sendJson(res, 400, {
                error: 'COUNTRY_REQUIRED',
                message: 'Escolha o país fiscal antes de continuar.',
                field: 'country'
            });
            return;
        }

        const fiscalCountry = normalizeAllowedCheckoutCountry(fiscalCountryRaw || customer.country || customer.countryCode || customer.country_code || customer.pais || '');
        if (!fiscalCountry) {
            sendJson(res, 400, {
                error: 'COUNTRY_INVALIDO',
                message: 'Apenas Portugal e Espanha estão disponíveis no checkout.',
                field: 'country'
            });
            return;
        }

        const shippingCountry = shippingCountryRaw
            ? normalizeAllowedCheckoutCountry(shippingCountryRaw)
            : fiscalCountry;
        if (!shippingCountry) {
            sendJson(res, 400, {
                error: 'COUNTRY_INVALIDO',
                message: 'Apenas Portugal e Espanha estão disponíveis no checkout.',
                field: 'pais_entrega'
            });
            return;
        }

        customer.country = fiscalCountry;
        customer.countryCode = fiscalCountry;
        customer.country_code = fiscalCountry;
        customer.pais = fiscalCountry;
        customer.pais_fiscal = fiscalCountry;
        customer.pais_entrega = shippingCountry;
        customer.shippingCountry = shippingCountry;

        const customerSnapshot = buildCheckoutCustomerSnapshot(customer);
        if (!ALLOWED_CHECKOUT_COUNTRIES.has(customerSnapshot.country)) {
            sendJson(res, 400, {
                error: 'COUNTRY_INVALIDO',
                message: 'Apenas Portugal e Espanha estão disponíveis no checkout.',
                field: 'country'
            });
            return;
        }
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

        if (customerSnapshot.tipo_cliente === 'empresa') {
            if (!String(customerSnapshot.empresa || '').trim()) {
                sendJson(res, 400, {
                    error: 'EMPRESA_REQUIRED',
                    message: 'Indique o nome fiscal da empresa para emitir a fatura.',
                    field: 'empresa'
                });
                return;
            }
        }

        const supabase = getSupabaseAdmin();
        const stripe = getStripeClient();
        const publishableKey = getStripePublishableKey();
        const baseUrl = getPublicBaseUrl(req);
        const cart = await resolveCheckoutCart(supabase, rawCart);
        await assertRemoteDesignSnapshotsReady(supabase, cart);
        const chargeableItems = [...cart, ...buildServiceOptionItems(serviceOptions)];
        const { subtotal, shipping, total } = calculateCheckoutTotals(chargeableItems);
        const vatValidation = {
            status: 'not_required',
            source: 'checkout',
            message: ''
        };
        const fiscalSnapshot = buildFiscalSnapshot({
            customer: customerSnapshot,
            paymentStatus: 'pending',
            referenceDate: new Date(),
            vatValidation
        });
        const fiscalFields = buildOrderFiscalFields({
            fiscalSnapshot,
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
        const orderMeta = buildInitialOrderMeta(customerSnapshot, cart, selectedPaymentMethod, notes, serviceOptions);
        orderMeta.fiscalSnapshot = fiscalSnapshot;
        orderMeta.vatValidation = vatValidation;
        orderMeta.checkoutSnapshot = {
            ...(orderMeta.checkoutSnapshot || {}),
            fiscalSnapshot,
            vatValidation
        };

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
                facturalusa_payload: {},
                vat_validation_source: vatValidation.source || 'none',
                vat_validation_checked_at: vatValidation.checkedAt || null,
                vat_validation_payload: vatValidation.raw || {}
            }
        );

        if (orderError) {
            throw orderError;
        }

        orderIdForCleanup = order.id;

        await insertOrderItemsWithFallback(supabase, order.id, cart);
        await runNonBlockingAction('Nao foi possivel registar analytics de begin_checkout', () => logAnalyticsEvent(supabase, {
            event_name: 'begin_checkout',
            order_id: order.id,
            country_code: resolveCheckoutCountryCode(customerSnapshot),
            metadata: {
                orderCode: orderNumber,
                itemCount: cart.length,
                total,
                designReviewSelected: serviceOptions.designReview
            }
        }));
        await runNonBlockingAction('Nao foi possivel registar operational log de checkout_session_created', () => logOperationalEvent(supabase, {
            event_name: 'checkout_session_created',
            level: 'info',
            order_id: order.id,
            payload: {
                orderCode: orderNumber,
                fiscalScenario: fiscalFields.fiscal_scenario,
                fiscalDecisionMode: fiscalFields.fiscal_decision_mode,
                shippingZoneCode: fiscalFields.shipping_zone_code,
                marginEstimate,
                taxProfile: fiscalFields.tax_profile,
                vatValidationStatus: fiscalFields.vat_validation_status,
                designReviewSelected: serviceOptions.designReview
            }
        }));
        await runNonBlockingAction('Nao foi possivel registar fiscal decision do checkout', () => recordFiscalDecision(supabase, {
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
                countryCode: resolveCheckoutCountryCode(customerSnapshot),
                taxProfile: fiscalFields.tax_profile,
                documentType: fiscalFields.document_type_resolved,
                vatRegimeCode: fiscalFields.vat_regime_code,
                vatValidationStatus: fiscalFields.vat_validation_status,
                vatValidationSource: vatValidation.source || 'none',
                designReviewSelected: serviceOptions.designReview
            }
        }));

        const returnUrl = `${baseUrl}${SiteRoutes.buildCheckoutSuccessPath({
            session_id: '{CHECKOUT_SESSION_ID}',
            codigo: orderNumber
        })}`;

        const checkoutCountryCode = resolveCheckoutCountryCode(customerSnapshot);
        const stripePaymentMethodTypes = resolveStripePaymentMethodTypes(
            selectedPaymentMethod,
            checkoutCountryCode
        );

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            ui_mode: 'embedded',
            redirect_on_completion: 'if_required',
            return_url: returnUrl,
            client_reference_id: orderNumber,
            customer_email: customerSnapshot.email,
            payment_method_types: stripePaymentMethodTypes,
            metadata: {
                order_code: orderNumber,
                payment_method: selectedPaymentMethod
            },
            line_items: chargeableItems.map(buildStripeLineItem),
            billing_address_collection: 'auto'
        });

        if (!String(session?.client_secret || '').trim()) {
            const embeddedError = new Error('Stripe did not return an embedded checkout client secret.');
            embeddedError.code = 'STRIPE_EMBEDDED_CLIENT_SECRET_MISSING';
            throw embeddedError;
        }

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
                stripe_metadata: buildStripeSessionSummary(session)
            }
        );

        if (notesUpdateError) {
            console.warn('Nao foi possivel atualizar as notas da encomenda com o stripe_session_id:', notesUpdateError);
        }

        sendJson(res, 200, {
            sessionId: session.id,
            clientSecret: session.client_secret,
            publishableKey,
            orderCode: orderNumber,
            checkoutMode: 'embedded',
            fiscalSummary: {
                scenario: fiscalSnapshot.fiscal_scenario,
                invoiceState: fiscalSnapshot.invoice_state,
                documentType: fiscalSnapshot.document_type_resolved,
                vatRegimeCode: fiscalSnapshot.vat_regime_code,
                vatValidationStatus: fiscalSnapshot.vat_validation_status,
                warning: vatValidation.status === 'invalid' || vatValidation.status === 'unavailable'
                    ? vatValidation.message
                    : ''
            }
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
            message: getCheckoutErrorMessage(error),
            items: Array.isArray(error?.details) ? error.details : []
        });
    }
};
