function isMissingRelationError(error, relationName = '') {
    const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
    const relation = String(relationName || '').toLowerCase();
    return error?.code === 'PGRST205'
        || error?.code === '42P01'
        || (relation && raw.includes(relation));
}

async function safeInsert(table, supabase, payload, relationName) {
    try {
        const { error } = await supabase.from(table).insert(payload);
        if (error) {
            throw error;
        }
        return true;
    } catch (error) {
        if (isMissingRelationError(error, relationName || table)) {
            return false;
        }
        throw error;
    }
}

async function logAnalyticsEvent(supabase, payload = {}) {
    return safeInsert('analytics_events', supabase, [{
        event_name: payload.event_name,
        path: payload.path || null,
        session_id: payload.session_id || null,
        order_id: payload.order_id || null,
        product_id: payload.product_id || null,
        country_code: payload.country_code || null,
        metadata: payload.metadata || {}
    }], 'analytics_events');
}

async function logOperationalEvent(supabase, payload = {}) {
    return safeInsert('operational_logs', supabase, [{
        event_name: payload.event_name,
        level: payload.level || 'info',
        order_id: payload.order_id || null,
        payload: payload.payload || {}
    }], 'operational_logs');
}

async function recordFiscalDecision(supabase, payload = {}) {
    return safeInsert('fiscal_decisions', supabase, [{
        order_id: payload.order_id || null,
        scenario: payload.scenario || '',
        decision_mode: payload.decision_mode || payload.decisionMode || '',
        evidence_status: payload.evidence_status || payload.evidenceStatus || '',
        vat_rate: payload.vat_rate ?? payload.vatRate ?? null,
        vat_exemption: payload.vat_exemption || payload.vatExemption || null,
        reason: payload.reason || '',
        payload: payload.payload || {}
    }], 'fiscal_decisions');
}

async function queueReviewItem(supabase, payload = {}) {
    const queueKey = String(payload.queue_key || '').trim();
    if (!queueKey) {
        return false;
    }

    try {
        const { error } = await supabase
            .from('review_queue')
            .upsert([{
                queue_key: queueKey,
                order_id: payload.order_id || null,
                type: payload.type || 'manual_review',
                status: payload.status || 'open',
                priority: payload.priority || 'normal',
                title: payload.title || 'Item de revisão',
                details: payload.details || null,
                payload: payload.payload || {},
                opened_at: payload.opened_at || new Date().toISOString(),
                resolved_at: payload.resolved_at || null
            }], { onConflict: 'queue_key' });

        if (error) {
            throw error;
        }
        return true;
    } catch (error) {
        if (isMissingRelationError(error, 'review_queue')) {
            return false;
        }
        throw error;
    }
}

async function resolveReviewItem(supabase, queueKey) {
    const normalized = String(queueKey || '').trim();
    if (!normalized) {
        return false;
    }

    try {
        const { error } = await supabase
            .from('review_queue')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString()
            })
            .eq('queue_key', normalized)
            .neq('status', 'resolved');

        if (error) {
            throw error;
        }
        return true;
    } catch (error) {
        if (isMissingRelationError(error, 'review_queue')) {
            return false;
        }
        throw error;
    }
}

async function calculateOrderMarginEstimate(supabase, cartItems = [], total = 0) {
    const items = Array.isArray(cartItems) ? cartItems : [];
    const productIds = [...new Set(items.map((item) => Number(item?.produtoId || item?.id || 0)).filter((value) => Number.isFinite(value) && value > 0))];

    if (productIds.length === 0) {
        return Number(Number(total || 0).toFixed(2));
    }

    try {
        const { data, error } = await supabase
            .from('product_costs')
            .select('product_id,estimated_unit_cost')
            .in('product_id', productIds)
            .eq('active', true);

        if (error) {
            throw error;
        }

        const costByProductId = new Map((data || []).map((row) => [Number(row.product_id), Number(row.estimated_unit_cost || 0)]));
        const estimatedCost = items.reduce((sum, item) => {
            const productId = Number(item?.produtoId || item?.id || 0);
            const quantity = Math.max(1, Number.parseInt(item?.quantidade || item?.quantity || 1, 10) || 1);
            const unitCost = costByProductId.get(productId) || 0;
            return sum + (unitCost * quantity);
        }, 0);

        return Number((Number(total || 0) - estimatedCost).toFixed(2));
    } catch (error) {
        if (isMissingRelationError(error, 'product_costs')) {
            return Number(Number(total || 0).toFixed(2));
        }
        throw error;
    }
}

module.exports = {
    calculateOrderMarginEstimate,
    isMissingRelationError,
    logAnalyticsEvent,
    logOperationalEvent,
    recordFiscalDecision,
    queueReviewItem,
    resolveReviewItem
};
