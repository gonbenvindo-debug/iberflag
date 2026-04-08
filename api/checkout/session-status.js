const { getStripeClient } = require('../../lib/server/stripe');
const { getSupabaseAdmin } = require('../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../lib/server/http');
const { splitOrderNotesAndMeta } = require('../../lib/server/checkout');
const {
    buildOrderItemsFromSnapshots,
    buildPublicOrderItemsFromRows,
    buildPublicOrderPayload
} = require('../../lib/server/order-flow');

async function resolveOrderBySession(supabase, session, fallbackOrderCode = '') {
    const orderCode = String(session?.metadata?.order_code || fallbackOrderCode || '').trim();
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

async function fetchPublicOrderItems(supabase, orderId) {
    if (!orderId) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('itens_encomenda')
            .select('*, produtos(id,nome,imagem,preco)')
            .eq('encomenda_id', orderId);

        if (error) {
            throw error;
        }

        return buildPublicOrderItemsFromRows(data || []);
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST200' || error?.code === 'PGRST205' || raw.includes('itens_encomenda')) {
            return [];
        }
        throw error;
    }
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

        const supabase = getSupabaseAdmin();

        let session = null;
        if (sessionId) {
            const stripe = getStripeClient();
            session = await stripe.checkout.sessions.retrieve(sessionId);
        }

        const order = await resolveOrderBySession(supabase, session, orderCodeFromQuery);
        const splitMeta = splitOrderNotesAndMeta(order?.notas || '');
        const dbItems = order?.id ? await fetchPublicOrderItems(supabase, order.id) : [];
        const snapshotItems = buildOrderItemsFromSnapshots(splitMeta.meta);

        sendJson(res, 200, {
            session: session ? {
                status: session.status,
                payment_status: session.payment_status,
                client_reference_id: session.client_reference_id
            } : null,
            order: order ? buildPublicOrderPayload(order, splitMeta.meta) : null,
            items: dbItems.length > 0 ? dbItems : snapshotItems,
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
