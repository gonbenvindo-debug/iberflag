const Stripe = require('stripe');

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

function getStripeClient() {
    const mode = getPaymentEnvironment();
    const secretKey = getStripeSecretKey();
    const cacheKey = `${mode}:${secretKey}`;

    if (stripeClients.has(cacheKey)) {
        return stripeClients.get(cacheKey);
    }

    const stripeClient = new Stripe(secretKey, {
        apiVersion: '2026-02-25.clover'
    });

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
