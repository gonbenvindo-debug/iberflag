const { requireAdminRequest } = require('../../../lib/server/admin-auth');
const { getSupabaseAdmin } = require('../../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../../lib/server/http');
const { sendOrderEmailNotification } = require('../../../lib/server/email-notifications');

function isAdminAuthError(error) {
    return ['ADMIN_AUTH_REQUIRED', 'ADMIN_UNAUTHORIZED', 'ADMIN_FORBIDDEN', 'ADMIN_AUTH_NOT_CONFIGURED'].includes(error?.code);
}

async function findOrderById(supabase, orderId) {
    const { data, error } = await supabase
        .from('encomendas')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

module.exports = async function adminSendOrderUpdateEmailHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    try {
        await requireAdminRequest(req);
        const body = await readJsonBody(req);
        const orderId = String(body?.orderId || body?.id || '').trim();
        const status = String(body?.status || '').trim();

        if (!orderId) {
            sendJson(res, 400, {
                error: 'MISSING_ORDER_ID',
                message: 'ID da encomenda obrigatorio.'
            });
            return;
        }

        const supabase = getSupabaseAdmin();
        const order = await findOrderById(supabase, orderId);
        if (!order) {
            sendJson(res, 404, {
                error: 'ORDER_NOT_FOUND',
                message: 'Encomenda nao encontrada.'
            });
            return;
        }

        const result = await sendOrderEmailNotification({
            supabase,
            req,
            order,
            templateKey: 'order_status_update',
            statusOverride: status,
            dedupeKey: `order_status_update:${order.id}:${status || order.status || 'unknown'}`
        });

        sendJson(res, 200, {
            success: true,
            ...result
        });
    } catch (error) {
        if (isAdminAuthError(error)) {
            sendJson(res, error.statusCode || 401, {
                error: error.code,
                message: error.message || 'Acesso admin negado.'
            });
            return;
        }

        console.error('Erro ao enviar email de atualizacao da encomenda:', error);
        sendJson(res, error?.statusCode || 500, {
            error: error?.code || 'ORDER_UPDATE_EMAIL_FAILED',
            message: error?.message || 'Falha ao enviar email de atualizacao.'
        });
    }
};
