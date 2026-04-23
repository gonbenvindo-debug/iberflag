const path = require('path');
const dotenv = require('dotenv');
const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({
    path: [
        path.join(ROOT_DIR, '.env.local'),
        path.join(ROOT_DIR, '.env.vercel.local'),
        path.join(ROOT_DIR, '.env')
    ],
    override: false
});

const ES_CATALOG = require('../data/i18n/es-catalog.json');

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ACCESS_TOKEN = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = (SUPABASE_URL.match(/^https:\/\/([^.]+)\.supabase\.co$/i) || [])[1] || '';

if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL e obrigatorio.');
}

if (!SUPABASE_ACCESS_TOKEN || !PROJECT_REF) {
    throw new Error('SUPABASE_ACCESS_TOKEN e project ref sao obrigatorios para aplicar o schema ES.');
}

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' e ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function normalizeProductSlug(value) {
    const baseSlug = slugify(value);
    if (baseSlug === 'tenda-personalizada-5-x-1-cm') return 'tenda-personalizada-5-x-1-m';
    if (baseSlug === 'tenda-personalizada-3-x-4-cm') return 'tenda-personalizada-3-x-4-m';
    if (baseSlug === 'cubo-publcitario-tamanho-unico') return 'cubo-publicitario-tamanho-unico';
    return baseSlug;
}

async function runManagementQuery(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Management API query failed (${response.status}): ${text}`);
    }

    return text;
}

async function runReadOnlyQuery(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query/read-only`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Management API read-only query failed (${response.status}): ${text}`);
    }

    return text ? JSON.parse(text) : [];
}

function quoteLiteral(value) {
    if (value === null || value === undefined || value === '') {
        return 'null';
    }

    return `'${String(value).replace(/'/g, "''")}'`;
}

async function ensureSchema() {
    await runManagementQuery(`
        alter table if exists public.produtos
            add column if not exists nome_es text,
            add column if not exists descricao_es text;
        notify pgrst, 'reload schema';
    `);
}

async function fetchProducts() {
    const data = await runReadOnlyQuery(`
        select id, slug, nome, nome_es, descricao_es
        from public.produtos
        order by id asc;
    `);
    return Array.isArray(data) ? data : [];
}

function buildTranslationMap() {
    return Object.fromEntries(
        Object.entries(ES_CATALOG?.products || {}).map(([slug, value]) => [normalizeProductSlug(slug), value || {}])
    );
}

async function syncProducts() {
    const translations = buildTranslationMap();
    const products = await fetchProducts();
    const missing = [];
    const rowsToUpdate = [];

    for (const product of products) {
        const slug = normalizeProductSlug(product.slug || product.nome || product.id);
        const translation = translations[slug];
        if (!translation?.name || !translation?.description) {
            missing.push({ id: product.id, slug, nome: product.nome });
            continue;
        }

        const payload = {
            nome_es: String(translation.name || '').trim() || null,
            descricao_es: String(translation.description || '').trim() || null
        };

        const changed = payload.nome_es !== (product.nome_es || null)
            || payload.descricao_es !== (product.descricao_es || null);

        if (!changed) continue;
        rowsToUpdate.push({
            id: Number(product.id),
            nome_es: payload.nome_es,
            descricao_es: payload.descricao_es
        });
    }

    if (rowsToUpdate.length > 0) {
        const valuesClause = rowsToUpdate
            .map((row) => `(${row.id}, ${quoteLiteral(row.nome_es)}, ${quoteLiteral(row.descricao_es)})`)
            .join(',\n                ');

        await runManagementQuery(`
            update public.produtos as produtos
            set
                nome_es = payload.nome_es,
                descricao_es = payload.descricao_es
            from (
                values
                ${valuesClause}
            ) as payload(id, nome_es, descricao_es)
            where produtos.id = payload.id;

            notify pgrst, 'reload schema';
        `);
    }

    return { total: products.length, updated: rowsToUpdate.length, missing };
}

async function main() {
    await ensureSchema();
    const result = await syncProducts();
    console.log(JSON.stringify(result, null, 2));
    if (result.missing.length > 0) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
