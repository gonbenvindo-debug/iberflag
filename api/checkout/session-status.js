const { getStripeClient } = require('../../lib/server/stripe');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../lib/server/http');

async function resolveOrderBySession(supabase, session) {
    const orderCode = String(session?.metadata?.order_code || '').trim();
    const sessionId = String(session?.id || '').trim();

    if (!sessionId && !orderCode) {
        return null;
    }

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
        const byCode = await supabase
            .from('encomendas')
            .select('*')
            .eq('numero_encomenda', orderCode)
            .limit(1)
            .maybeSingle();

        if (byCode.error) {
            throw byCode.error;
        }

        return byCode.data || null;
    }

    return null;
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
                payment_status: order.payment_status || 'pending',
                payment_provider: order.payment_provider || 'stripe',
                stripe_session_id: order.stripe_session_id || null,
                stripe_payment_intent: order.stripe_payment_intent || null,
                facturalusa_status: order.facturalusa_status || null,
                facturalusa_document_number: order.facturalusa_document_number || null,
                facturalusa_document_url: order.facturalusa_document_url || null
            } : null,
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
