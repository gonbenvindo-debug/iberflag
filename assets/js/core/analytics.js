(function bootstrapAnalytics(root) {
    const endpoint = '/api/analytics/collect';
    const sessionStorageKey = 'iberflag_analytics_session';

    function generateSessionId() {
        return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function getSessionId() {
        try {
            const existing = sessionStorage.getItem(sessionStorageKey);
            if (existing) {
                return existing;
            }
            const nextValue = generateSessionId();
            sessionStorage.setItem(sessionStorageKey, nextValue);
            return nextValue;
        } catch (error) {
            return generateSessionId();
        }
    }

    async function trackAnalyticsEvent(eventName, payload = {}) {
        const normalizedEvent = String(eventName || '').trim();
        if (!normalizedEvent) {
            return false;
        }

        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                keepalive: true,
                body: JSON.stringify({
                    eventName: normalizedEvent,
                    path: root.location?.pathname || '',
                    sessionId: getSessionId(),
                    productId: payload.productId || null,
                    orderId: payload.orderId || null,
                    countryCode: payload.countryCode || null,
                    metadata: payload.metadata || {}
                })
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    root.trackAnalyticsEvent = trackAnalyticsEvent;

    document.addEventListener('DOMContentLoaded', () => {
        const body = document.body;
        if (body?.dataset?.analyticsEvent) {
            void trackAnalyticsEvent(body.dataset.analyticsEvent, {
                productId: body.dataset.analyticsProductId || null,
                metadata: {
                    categorySlug: body.dataset.analyticsCategorySlug || null
                }
            });
        }

        document.addEventListener('click', (event) => {
            const target = event.target instanceof Element
                ? event.target.closest('[data-analytics-event]')
                : null;

            if (!target) {
                return;
            }

            void trackAnalyticsEvent(target.getAttribute('data-analytics-event'), {
                productId: target.getAttribute('data-analytics-product-id') || null,
                metadata: {
                    categorySlug: target.getAttribute('data-analytics-category-slug') || null
                }
            });
        });
    });
}(window));
