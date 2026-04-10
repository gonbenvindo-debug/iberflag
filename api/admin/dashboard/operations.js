const { requireAdminRequest } = require('../../../lib/server/admin-auth');
const { sendJson } = require('../../../lib/server/http');
const { getSupabaseAdmin } = require('../../../lib/server/supabase-admin');
const { isMissingRelationError } = require('../../../lib/server/ops');

async function safeSelect(queryFactory, relationName, fallback) {
    try {
        const { data, error, count } = await queryFactory();
        if (error) {
            throw error;
        }
        return { data: data || fallback, count: count || 0 };
    } catch (error) {
        if (isMissingRelationError(error, relationName)) {
            return { data: fallback, count: 0 };
        }
        throw error;
    }
}

async function loadIncompleteProducts(supabase) {
    try {
        const [{ data: products, error: productsError }, { data: costs, error: costsError }] = await Promise.all([
            supabase
                .from('produtos')
                .select('id,nome,price_floor,price_recommended,sla_profile_id,core_offer,ativo')
                .order('id', { ascending: true }),
            supabase
                .from('product_costs')
                .select('product_id,active')
                .eq('active', true)
        ]);

        if (productsError) {
            throw productsError;
        }
        if (costsError) {
            throw costsError;
        }

        const activeCostProductIds = new Set((costs || []).map((row) => String(row.product_id)));
        const incompleteProducts = (products || [])
            .filter((product) => product?.ativo !== false)
            .map((product) => {
                const missing = [];
                if (!activeCostProductIds.has(String(product.id))) {
                    missing.push('custo');
                }
                if (product.price_floor == null) {
                    missing.push('preço mínimo');
                }
                if (product.price_recommended == null) {
                    missing.push('preço recomendado');
                }
                if (!product.sla_profile_id) {
                    missing.push('SLA');
                }

                return {
                    ...product,
                    missing
                };
            })
            .filter((product) => product.missing.length > 0);

        return {
            data: incompleteProducts.slice(0, 12),
            count: incompleteProducts.length
        };
    } catch (error) {
        if (isMissingRelationError(error, 'product_costs') || isMissingRelationError(error, 'produtos')) {
            return { data: [], count: 0 };
        }
        throw error;
    }
}

module.exports = async function adminOperationsDashboardHandler(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        return;
    }

    try {
        await requireAdminRequest(req);
        const supabase = getSupabaseAdmin();

        const [reviewQueue, failedEmails, incompleteProducts, slaBreaches] = await Promise.all([
            safeSelect(() => supabase
                .from('review_queue')
                .select('*', { count: 'exact' })
                .eq('status', 'open')
                .order('opened_at', { ascending: false })
                .limit(8), 'review_queue', []),
            safeSelect(() => supabase
                .from('email_delivery_logs')
                .select('id,recipient,subject,error_message,created_at,order_id', { count: 'exact' })
                .eq('status', 'failed')
                .order('created_at', { ascending: false })
                .limit(8), 'email_delivery_logs', []),
            loadIncompleteProducts(supabase),
            safeSelect(() => supabase
                .from('encomendas')
                .select('id,numero_encomenda,sla_target_at,status,payment_status,invoice_state,margin_estimate,clientes(nome,email)', { count: 'exact' })
                .not('sla_target_at', 'is', null)
                .lt('sla_target_at', new Date().toISOString())
                .neq('status', 'entregue')
                .order('sla_target_at', { ascending: true })
                .limit(8), 'encomendas', [])
        ]);

        sendJson(res, 200, {
            metrics: {
                reviewQueueOpen: reviewQueue.count || 0,
                failedEmails: failedEmails.count || 0,
                incompleteProducts: incompleteProducts.count || 0,
                slaBreaches: slaBreaches.count || 0
            },
            reviewQueue: reviewQueue.data || [],
            failedEmails: failedEmails.data || [],
            incompleteProducts: incompleteProducts.data || [],
            slaBreaches: slaBreaches.data || []
        });
    } catch (error) {
        if (error?.statusCode) {
            sendJson(res, error.statusCode, {
                error: error.code,
                message: error.message
            });
            return;
        }

        console.error('Erro no dashboard operacional:', error);
        sendJson(res, 500, {
            error: 'ADMIN_DASHBOARD_OPERATIONS_FAILED',
            message: 'Nao foi possivel carregar o dashboard operacional.'
        });
    }
};
