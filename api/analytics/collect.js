const { applyRateLimit, readJsonBody, sendJson } = require('../../lib/server/http');
const { trackRequestEvent } = require('../../lib/server/analytics-request');

module.exports = async function analyticsCollectHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    if (!applyRateLimit(req, res, {
        key: 'analytics-collect',
        windowMs: 60 * 1000,
        max: 120,
        message: 'Demasiados eventos em pouco tempo.'
    })) {
        return;
    }

    try {
        const body = await readJsonBody(req);
        await trackRequestEvent(body);
        sendJson(res, 200, { ok: true });
    } catch (error) {
        console.warn('Analytics collect falhou:', error);
        sendJson(res, 200, { ok: false });
    }
};
