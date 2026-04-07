const { getStripeClient } = require('../../lib/server/stripe');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../lib/server/http');
const { splitOrderNotesAndMeta } = require('../../lib/server/checkout');

async function resolveOrderBySession(supabase, session) {
    const orderCode = String(session?.metadata?.order_code || '').trim();
    if (!orderCode) {
        return null;
    }

    const { data, error } = await supabase
        .from('encomendas')
        .select('*')
        .eq('numero_encomenda', orderCode)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

function buildOrderItemsFromSnapshots(splitMeta) {
    const snapshots = Array.isArray(splitMeta?.meta?.itemSnapshots) ? splitMeta.meta.itemSnapshots : [];
    return snapshots.map((snapshot) => ({
        produto_id: snapshot.produtoId || null,
        quantidade: snapshot.quantidade || 1,
        preco_unitario: snapshot.precoUnitario || 0,
        subtotal: (Number(snapshot.precoUnitario || 0) * Number(snapshot.quantidade || 1)),
        produtos: {
            id: snapshot.produtoId || null,
            nome: snapshot.nome || 'Produto',
            imagem: snapshot.imagem || '',
            preco: snapshot.precoUnitario || 0
        }
    }));
}

module.exports = async function checkoutSessionStatusHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
        return;
    }

    try {
        const requestBody = req.method === 'POST' ? await readJsonBody(req) : {};
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const sessionId = String(requestBody.session_id || requestUrl.searchParams.get('session_id') || '').trim();
        const orderCodeFromQuery = String(requestBody.codigo || requestUrl.searchParams.get('codigo') || '').trim();

        if (!sessionId && !orderCodeFromQuery) {
            sendJson(res, 400, {
                error: 'MISSING_SESSION',
                message: 'Missing session_id or order code.'
            });
            return;
        }

        const stripe = getStripeClient();
        const supabase = getSupabaseAdmin();

        let session = null;
        if (sessionId) {
            session = await stripe.checkout.sessions.retrieve(sessionId);
        }

        const order = await resolveOrderBySession(supabase, session || { id: sessionId, metadata: { order_code: orderCodeFromQuery } });
        const splitMeta = splitOrderNotesAndMeta(order?.notas || '');

        sendJson(res, 200, {
            session: session ? {
                id: session.id,
                status: session.status,
                payment_status: session.payment_status,
                customer_email: session.customer_email,
                client_reference_id: session.client_reference_id,
                metadata: session.metadata
            } : null,
            order: order ? {
                id: order.id,
                numero_encomenda: order.numero_encomenda,
                payment_status: splitMeta.meta.paymentStatus || 'pending',
                payment_provider: splitMeta.meta.paymentProvider || 'stripe',
                stripe_session_id: splitMeta.meta.stripeSessionId || null,
                stripe_payment_intent: splitMeta.meta.stripePaymentIntent || null,
                facturalusa_status: splitMeta.meta.facturalusaStatus || (
                    splitMeta.meta.facturalusaDocumentNumber
                        ? 'emitted'
                        : splitMeta.meta.facturalusaLastError
                            ? 'blocked'
                            : (splitMeta.meta.paymentStatus === 'paid' ? 'pending' : null)
                ),
                facturalusa_last_error: splitMeta.meta.facturalusaLastError || null,
                facturalusa_document_number: splitMeta.meta.facturalusaDocumentNumber || null,
                facturalusa_document_url: splitMeta.meta.facturalusaDocumentUrl || null,
                facturalusa_last_attempt_at: splitMeta.meta.facturalusaLastAttemptAt || null
            } : null,
            items: buildOrderItemsFromSnapshots(splitMeta),
            orderCode: order?.numero_encomenda || orderCodeFromQuery || session?.metadata?.order_code || null
        });
    } catch (error) {
        console.error('Falha ao consultar estado da sessao Stripe:', error);
        sendJson(res, 500, {
            error: 'CHECKOUT_SESSION_STATUS_FAILED',
            message: error?.message || 'Falha ao consultar a sessao de pagamento.'
        });
    }
};
