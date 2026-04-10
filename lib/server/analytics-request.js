const { getSupabaseAdmin } = require('./supabase-admin');
const { logAnalyticsEvent } = require('./ops');

const ALLOWED_EVENTS = new Set([
    'view_category',
    'view_product',
    'start_personalization',
    'add_to_cart',
    'begin_checkout',
    'purchase_completed',
    'invoice_issued',
    'order_delivered'
]);

async function trackRequestEvent(payload = {}) {
    const eventName = String(payload.eventName || payload.event_name || '').trim();
    if (!ALLOWED_EVENTS.has(eventName)) {
        return { tracked: false, reason: 'EVENT_NOT_ALLOWED' };
    }

    const supabase = getSupabaseAdmin();
    await logAnalyticsEvent(supabase, {
        event_name: eventName,
        path: String(payload.path || '').trim() || null,
        session_id: String(payload.sessionId || payload.session_id || '').trim() || null,
        order_id: String(payload.orderId || payload.order_id || '').trim() || null,
        product_id: Number(payload.productId || payload.product_id || 0) || null,
        country_code: String(payload.countryCode || payload.country_code || '').trim().toUpperCase() || null,
        metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    });

    return { tracked: true };
}

module.exports = {
    ALLOWED_EVENTS,
    trackRequestEvent
};
