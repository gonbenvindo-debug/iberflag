const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.res?lve(__dirname, '..');
dotenv.config({
    path: [
        path.join(rootDir, '.env.local'),
        path.join(rootDir, '.env.vercel.local'),
        path.join(rootDir, '.env.test.local'),
        path.join(rootDir, '.env')
    ],
    override: false
});

function normalizeMode(value) {
    const mode = String(value || 'test').trim().toLowerCase();
    if (mode === 'live' && String(process.env.PAYMENT_LIVE_ENABLED || '').trim().toLowerCase() === 'true') {
        return 'live';
    }
    return 'test';
}

function firstEnv(keys) {
    return String(keys.map((key) => process.env[key]).find((value) => String(value || '').trim()) || '').trim();
}

function collectMissing(mode, groups) {
    const missing = [];

    groups.forEach((group) => {
        const value = firstEnv(group.keys);
        if (!value) {
            missing.push(group.label);
        }
    });

    return missing;
}

const mode = normalizeMode(process.env.PAYMENT_ENVIRONMENT || process.env.STRIPE_ENVIRONMENT);
const stripeGroups = mode === 'test'
    ? [
        { label: 'STRIPE_SECRET_KEY_TEST', keys: ['STRIPE_SECRET_KEY_TEST', 'STRIPE_TEST_SECRET_KEY'] },
        { label: 'STRIPE_WEBHOOK_SECRET_TEST', keys: ['STRIPE_WEBHOOK_SECRET_TEST', 'STRIPE_TEST_WEBHOOK_SECRET'] },
        { label: 'STRIPE_PUBLISHABLE_KEY_TEST', keys: ['STRIPE_PUBLISHABLE_KEY_TEST', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST', 'STRIPE_TEST_PUBLISHABLE_KEY'] }
    ]
    : [
        { label: 'STRIPE_SECRET_KEY_LIVE or STRIPE_SECRET_KEY', keys: ['STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY'] },
        { label: 'STRIPE_WEBHOOK_SECRET_LIVE or STRIPE_WEBHOOK_SECRET', keys: ['STRIPE_WEBHOOK_SECRET_LIVE', 'STRIPE_WEBHOOK_SECRET'] },
        { label: 'STRIPE_PUBLISHABLE_KEY_LIVE or STRIPE_PUBLISHABLE_KEY', keys: ['STRIPE_PUBLISHABLE_KEY_LIVE', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE', 'STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] }
    ];

const facturalusaGroups = mode === 'test'
    ? [
        { label: 'FACTURALUSA_API_TOKEN_TEST', keys: ['FACTURALUSA_API_TOKEN_TEST', 'FACTURALUSA_BEARER_TOKEN_TEST'] },
        { label: 'FACTURALUSA_BASE_URL_TEST', keys: ['FACTURALUSA_BASE_URL_TEST'] },
        { label: 'FACTURALUSA_SERIE_ID_TEST', keys: ['FACTURALUSA_SERIE_ID_TEST'] }
    ]
    : [
        { label: 'FACTURALUSA_API_TOKEN_LIVE or FACTURALUSA_API_TOKEN', keys: ['FACTURALUSA_API_TOKEN_LIVE', 'FACTURALUSA_BEARER_TOKEN_LIVE', 'FACTURALUSA_API_TOKEN', 'FACTURALUSA_BEARER_TOKEN'] }
    ];

const commonGroups = [
    { label: 'SUPABASE_URL', keys: ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] },
    { label: 'SUPABASE_SERVICE_ROLE_KEY', keys: ['SUPABASE_SERVICE_ROLE_KEY'] },
    { label: 'PUBLIC_SITE_URL', keys: ['PUBLIC_SITE_URL', 'NEXT_PUBLIC_SITE_URL'] }
];

const missing = [
    ...collectMissing(mode, commonGroups),
    ...collectMissing(mode, stripeGroups),
    ...collectMissing(mode, facturalusaGroups)
];

console.log(`Payments environment: ${mode}`);

if (mode === 'test') {
    console.log('Recommended for test: FACTURALUSA_FORCE_SEND_EMAIL=false');
    console.log('Live payment variables are ignored unless PAYMENT_LIVE_ENABLED=true and PAYMENT_ENVIRONMENT=live.');
}

if (missing.length > 0) {
    console.error('Missing environment variables:');
    missing.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
} else {
    console.log('All required payment environment variables are present.');
}
