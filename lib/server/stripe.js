const crypto = require('crypto');

const stripeClients = new Map();

function getPaymentEnvironment() {
    const mode = String(process.env.PAYMENT_ENVIRONMENT || process.env.STRIPE_ENVIRONMENT || 'live').trim().toLowerCase();
    return mode === 'test' ? 'test' : 'live';
}

function getEnvValue(keys) {
    return String(keys
        .map((key) => process.env[key])
        .find((value) => String(value || '').trim()) || '').trim();
}

function requireEnvValue(keys, label, environment) {
    const value = getEnvValue(keys);
    if (!value) {
        const error = new Error(`${label} not configured for ${environment} environment`);
        error.code = `${label}_${environment.toUpperCase()}_NOT_CONFIGURED`;
        throw error;
    }

    return value;
}

function getStripeSecretKey() {
    const mode = getPaymentEnvironment();
    return mode === 'test'
        ? requireEnvValue(['STRIPE_SECRET_KEY_TEST', 'STRIPE_TEST_SECRET_KEY'], 'STRIPE_SECRET_KEY', mode)
        : requireEnvValue(['STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY'], 'STRIPE_SECRET_KEY', mode);
}

function getStripeWebhookSecret() {
    const mode = getPaymentEnvironment();
    return mode === 'test'
        ? requireEnvValue(['STRIPE_WEBHOOK_SECRET_TEST', 'STRIPE_TEST_WEBHOOK_SECRET'], 'STRIPE_WEBHOOK_SECRET', mode)
        : requireEnvValue(['STRIPE_WEBHOOK_SECRET_LIVE', 'STRIPE_WEBHOOK_SECRET'], 'STRIPE_WEBHOOK_SECRET', mode);
}

function getStripePublishableKey() {
    const mode = getPaymentEnvironment();
    return mode === 'test'
        ? requireEnvValue(
            ['STRIPE_PUBLISHABLE_KEY_TEST', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST', 'STRIPE_TEST_PUBLISHABLE_KEY'],
            'STRIPE_PUBLISHABLE_KEY',
            mode
        )
        : requireEnvValue(
            ['STRIPE_PUBLISHABLE_KEY_LIVE', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE', 'STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
            'STRIPE_PUBLISHABLE_KEY',
            mode
        );
}

function appendFormValue(params, key, value) {
    if (value === null || value === undefined || value === '') {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => {
            appendFormValue(params, `${key}[]`, item);
        });
        return;
    }

    if (typeof value === 'object') {
        Object.entries(value).forEach(([childKey, childValue]) => {
            appendFormValue(params, `${key}[${childKey}]`, childValue);
        });
        return;
    }

    params.append(key, String(value));
}

function buildStripeFormBody(payload) {
    const params = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
        appendFormValue(params, key, value);
    });
    return params.toString();
}

function parseStripeJson(text, response) {
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        const error = new Error(text || `Stripe request failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
}

function createStripeError(response, payload) {
    const error = new Error(
        (payload && typeof payload === 'object' && (payload.error?.message || payload.message || payload.detail))
            || payload?.error?.message
            || `Stripe request failed (${response.status})`
    );
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code || response.statusText || 'STRIPE_REQUEST_FAILED';
    error.raw = payload;
    return error;
}

async function stripeRequest(path, { method = 'GET', body = null } = {}) {
    const secretKey = getStripeSecretKey();
    const url = `https://api.stripe.com${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json'
    };

    let requestBody = undefined;
    if (body !== null && body !== undefined) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        requestBody = typeof body === 'string' ? body : buildStripeFormBody(body);
    }

    const response = await fetch(url, {
        method,
        headers,
        body: requestBody
    });

    const rawText = await response.text();
    const payload = parseStripeJson(rawText, response);

    if (!response.ok) {
        throw createStripeError(response, payload);
    }

    return payload;
}

function verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret) {
    const headerParts = String(signatureHeader || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    const timestampPart = headerParts.find((part) => part.startsWith('t='));
    const signatureParts = headerParts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));

    if (!timestampPart || signatureParts.length === 0) {
        const error = new Error('Invalid Stripe signature header');
        error.code = 'STRIPE_SIGNATURE_INVALID';
        throw error;
    }

    const timestamp = timestampPart.slice(2);
    const signedPayload = `${timestamp}.${String(rawBody || '')}`;
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload, 'utf8')
        .digest('hex');

    const signatureValid = signatureParts.some((signature) => {
        try {
            return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
        } catch {
            return false;
        }
    });

    if (!signatureValid) {
        const error = new Error('Invalid Stripe webhook signature');
        error.code = 'STRIPE_SIGNATURE_INVALID';
        throw error;
    }

    return JSON.parse(String(rawBody || '{}'));
}

class StripeRestClient {
    constructor() {
        this.checkout = {
            sessions: {
                create: (payload) => stripeRequest('/v1/checkout/sessions', {
                    method: 'POST',
                    body: payload
                }),
                retrieve: (sessionId) => stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
                    method: 'GET'
                })
            }
        };

        this.webhooks = {
            constructEvent: (rawBody, signatureHeader, webhookSecret) => verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret)
        };
    }
}

function getStripeClient() {
    const mode = getPaymentEnvironment();
    const secretKey = getStripeSecretKey();
    const cacheKey = `${mode}:${secretKey}`;

    if (stripeClients.has(cacheKey)) {
        return stripeClients.get(cacheKey);
    }

    const stripeClient = new StripeRestClient();
    stripeClients.set(cacheKey, stripeClient);
    return stripeClient;
}

module.exports = {
    getPaymentEnvironment,
    getStripePublishableKey,
    getStripeSecretKey,
    getStripeWebhookSecret,
    getStripeClient
};
