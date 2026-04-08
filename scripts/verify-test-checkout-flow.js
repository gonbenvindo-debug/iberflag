const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({
    path: [
        path.join(rootDir, '.env.local'),
        path.join(rootDir, '.env.vercel.local'),
        path.join(rootDir, '.env.test.local'),
        path.join(rootDir, '.env')
    ],
    override: false
});

const results = [];

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

function record(status, label, detail = '') {
    results.push({ status, label, detail });
}

function requireGroup(label, keys) {
    const value = firstEnv(keys);
    if (!value) {
        record('fail', `Missing ${label}`);
        return '';
    }

    record('pass', `Configured ${label}`);
    return value;
}

function buildSupabaseUrl(pathname) {
    const baseUrl = firstEnv(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']).replace(/\/+$/, '');
    return `${baseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

async function supabaseFetch(pathname, token, options = {}) {
    const response = await fetch(buildSupabaseUrl(pathname), {
        method: options.method || 'GET',
        headers: {
            apikey: token,
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    return { response, payload, text };
}

async function expectServiceSelect(token, table, select) {
    const { response, text } = await supabaseFetch(`/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=0`, token);
    if (response.ok) {
        record('pass', `Schema OK ${table}`, select);
        return;
    }

    record('fail', `Schema missing in ${table}`, text.slice(0, 240));
}

async function verifyAnonPiiRead(anonKey, table, select) {
    const { response, payload, text } = await supabaseFetch(`/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, anonKey);
    if (!response.ok) {
        record('pass', `Anon blocked from ${table}`, String(response.status));
        return;
    }

    const rowCount = Array.isArray(payload) ? payload.length : 0;
    if (rowCount > 0) {
        record('fail', `Anon can read ${table}`, 'PII table returned rows');
        return;
    }

    record('pass', `Anon cannot read rows from ${table}`, 'RLS returned an empty public result');
}

async function verifyCheckoutRpcClosed(anonKey) {
    const { response, text } = await supabaseFetch('/rest/v1/rpc/checkout_upsert_customer', anonKey, {
        method: 'POST',
        body: { p_nome: 'Test', p_email: '' }
    });

    if (response.status === 400 && text.includes('EMAIL_REQUIRED')) {
        record('fail', 'checkout_upsert_customer callable by anon', 'RPC reached function body');
        return;
    }

    record('pass', 'checkout_upsert_customer not callable by anon', String(response.status));
}

function findForbiddenKeys(value, pathPrefix = '') {
    const forbiddenExact = new Set([
        'clientes',
        'cliente',
        'email',
        'telefone',
        'nif',
        'notas',
        'morada',
        'morada_envio',
        'stripe_session_id',
        'stripe_checkout_url',
        'stripe_payment_intent',
        'stripe_payment_method_type',
        'facturalusa_status',
        'facturalusa_last_error',
        'facturalusa_customer_code',
        'facturalusa_document_number',
        'facturalusa_document_url'
    ]);
    const found = [];

    if (Array.isArray(value)) {
        value.forEach((entry, index) => {
            found.push(...findForbiddenKeys(entry, `${pathPrefix}[${index}]`));
        });
        return found;
    }

    if (!value || typeof value !== 'object') {
        return found;
    }

    Object.entries(value).forEach(([key, child]) => {
        const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (forbiddenExact.has(key) || key.startsWith('stripe_') || key.startsWith('facturalusa_')) {
            found.push(childPath);
        }
        found.push(...findForbiddenKeys(child, childPath));
    });

    return found;
}

async function verifyTrackingPayload(serviceKey, anonKey) {
    const latest = await supabaseFetch('/rest/v1/encomendas?select=numero_encomenda&order=id.desc&limit=1', serviceKey);
    const orderCode = Array.isArray(latest.payload) ? latest.payload[0]?.numero_encomenda : '';
    if (!latest.response.ok || !orderCode) {
        record('warn', 'Tracking payload skipped', 'No order code available');
        return;
    }

    const { response, payload, text } = await supabaseFetch('/rest/v1/rpc/get_order_tracking', anonKey, {
        method: 'POST',
        body: { p_code: orderCode }
    });

    if (!response.ok) {
        record('fail', 'get_order_tracking failed for anon', text.slice(0, 240));
        return;
    }

    const forbidden = findForbiddenKeys(payload);
    if (forbidden.length > 0) {
        record('fail', 'get_order_tracking leaks private keys', forbidden.slice(0, 8).join(', '));
        return;
    }

    record('pass', 'get_order_tracking payload sanitized');
}

async function verifyCatalog(serviceKey) {
    const { response, payload, text } = await supabaseFetch('/rest/v1/produtos?select=id,preco,ativo,destaque', serviceKey);
    if (!response.ok || !Array.isArray(payload)) {
        record('fail', 'Catalog check failed', text.slice(0, 240));
        return;
    }

    const active = payload.filter((product) => product.ativo !== false);
    const valid = active.filter((product) => Number(product.preco) > 0);
    const invalid = active.length - valid.length;

    if (valid.length === 0) {
        record('fail', 'No active product has a valid price');
        return;
    }

    record('pass', 'Catalog has purchasable test products', `${valid.length} active products with valid price`);
    if (invalid > 0) {
        record('warn', 'Catalog has products blocked from checkout', `${invalid} active products without valid price`);
    }
}

async function main() {
    const mode = normalizeMode(process.env.PAYMENT_ENVIRONMENT || process.env.STRIPE_ENVIRONMENT);
    if (mode !== 'test') {
        record('fail', 'Payment environment must be test', mode);
    } else {
        record('pass', 'Payment environment is test');
    }

    const supabaseUrl = requireGroup('SUPABASE_URL', ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
    const serviceKey = requireGroup('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SERVICE_ROLE_KEY']);
    const anonKey = requireGroup('SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    requireGroup('STRIPE_SECRET_KEY_TEST', ['STRIPE_SECRET_KEY_TEST', 'STRIPE_TEST_SECRET_KEY']);
    requireGroup('STRIPE_WEBHOOK_SECRET_TEST', ['STRIPE_WEBHOOK_SECRET_TEST', 'STRIPE_TEST_WEBHOOK_SECRET']);
    requireGroup('STRIPE_PUBLISHABLE_KEY_TEST', ['STRIPE_PUBLISHABLE_KEY_TEST', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST', 'STRIPE_TEST_PUBLISHABLE_KEY']);
    requireGroup('FACTURALUSA_API_TOKEN_TEST', ['FACTURALUSA_API_TOKEN_TEST', 'FACTURALUSA_BEARER_TOKEN_TEST']);
    requireGroup('FACTURALUSA_BASE_URL_TEST', ['FACTURALUSA_BASE_URL_TEST']);
    requireGroup('FACTURALUSA_SERIE_ID_TEST', ['FACTURALUSA_SERIE_ID_TEST']);
    requireGroup('PUBLIC_SITE_URL', ['PUBLIC_SITE_URL', 'NEXT_PUBLIC_SITE_URL']);

    if (!supabaseUrl || !serviceKey || !anonKey) {
        return;
    }

    await expectServiceSelect(
        serviceKey,
        'encomendas',
        'payment_provider,payment_status,stripe_session_id,stripe_checkout_url,stripe_payment_intent,stripe_payment_method_type,payment_confirmed_at,facturalusa_status,facturalusa_last_error,facturalusa_customer_code,facturalusa_document_number,facturalusa_document_url,checkout_payload,stripe_metadata,facturalusa_payload'
    );
    await expectServiceSelect(
        serviceKey,
        'itens_encomenda',
        'design_id,design_svg,design_preview,nome_produto,imagem_produto,base_id,base_nome,base_preco_extra'
    );
    await expectServiceSelect(serviceKey, 'stripe_webhook_events', 'event_id,event_type,status,attempts,last_error,processed_at');

    await verifyAnonPiiRead(anonKey, 'clientes', 'nome,email,telefone,nif,morada,cidade');
    await verifyAnonPiiRead(anonKey, 'contactos', 'nome,email,telefone,mensagem');
    await verifyAnonPiiRead(anonKey, 'encomendas', 'cliente_id,morada_envio,notas,total');
    await verifyAnonPiiRead(anonKey, 'itens_encomenda', 'encomenda_id,produto_id,quantidade,preco_unitario');
    await verifyCheckoutRpcClosed(anonKey);
    await verifyTrackingPayload(serviceKey, anonKey);
    await verifyCatalog(serviceKey);
}

main()
    .catch((error) => {
        record('fail', 'Verification crashed', error?.message || String(error));
    })
    .finally(() => {
        const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
        results.forEach((entry) => {
            console.log(`[${icon[entry.status]}] ${entry.label}${entry.detail ? ` - ${entry.detail}` : ''}`);
        });

        const failed = results.some((entry) => entry.status === 'fail');
        process.exitCode = failed ? 1 : 0;
    });
