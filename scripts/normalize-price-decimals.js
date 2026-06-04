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

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.');
}

const WRITE_MODE = process.argv.includes('--write');

const TABLE_SPECS = [
    {
        table: 'produtos',
        idColumn: 'id',
        select: 'id,preco,price_floor,price_recommended',
        columns: ['preco', 'price_floor', 'price_recommended']
    },
    {
        table: 'bases_fixacao',
        idColumn: 'id',
        select: 'id,preco_extra',
        columns: ['preco_extra']
    },
    {
        table: 'produto_bases_fixacao',
        idColumn: 'id',
        select: 'id,preco_extra_override',
        columns: ['preco_extra_override']
    },
    {
        table: 'encomendas',
        idColumn: 'id',
        select: 'id,subtotal,total,envio,margin_estimate,vat_rate_applied,checkout_payload,stripe_metadata,facturalusa_payload',
        columns: ['subtotal', 'total', 'envio', 'margin_estimate', 'vat_rate_applied'],
        jsonColumns: ['checkout_payload', 'stripe_metadata', 'facturalusa_payload']
    },
    {
        table: 'itens_encomenda',
        idColumn: 'id',
        select: 'id,preco_unitario,subtotal,base_preco_extra',
        columns: ['preco_unitario', 'subtotal', 'base_preco_extra']
    },
    {
        table: 'product_costs',
        idColumn: 'id',
        select: 'id,estimated_unit_cost',
        columns: ['estimated_unit_cost']
    },
    {
        table: 'product_pricing_rules',
        idColumn: 'id',
        select: 'id,margin_min_percent,discount_max_percent,price_floor,price_recommended',
        columns: ['margin_min_percent', 'discount_max_percent', 'price_floor', 'price_recommended']
    }
];

function isNumericCommaString(value) {
    return typeof value === 'string' && /^-?\d+,\d+$/.test(value.trim());
}

function toNormalizedNumber(value) {
    return Number(String(value).trim().replace(',', '.'));
}

function normalizeJsonValue(value, path = '$', changes = []) {
    if (Array.isArray(value)) {
        let changed = false;
        const next = value.map((entry, index) => {
            const result = normalizeJsonValue(entry, `${path}[${index}]`, changes);
            changed = changed || result.changed;
            return result.value;
        });
        return { value: changed ? next : value, changed };
    }

    if (value && typeof value === 'object') {
        let changed = false;
        const next = {};
        for (const [key, entry] of Object.entries(value)) {
            const result = normalizeJsonValue(entry, `${path}.${key}`, changes);
            next[key] = result.value;
            changed = changed || result.changed;
        }
        return { value: changed ? next : value, changed };
    }

    if (isNumericCommaString(value)) {
        const normalized = toNormalizedNumber(value);
        if (Number.isFinite(normalized)) {
            changes.push({ path, from: value, to: normalized });
            return { value: normalized, changed: true };
        }
    }

    return { value, changed: false };
}

async function supabaseFetch(endpoint, init = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        ...init,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            ...(init.headers || {})
        }
    });

    if (!response.ok) {
        throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function patchRow(table, idColumn, rowId, payload) {
    const encodedId = encodeURIComponent(`eq.${rowId}`);
    await supabaseFetch(`${table}?${idColumn}=${encodedId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
    });
}

async function processTable(spec) {
    const rows = await supabaseFetch(`${spec.table}?select=${encodeURIComponent(spec.select)}&limit=1000`);
    const updates = [];

    for (const row of Array.isArray(rows) ? rows : []) {
        const payload = {};
        const changes = [];

        for (const column of spec.columns || []) {
            const value = row[column];
            if (!isNumericCommaString(value)) {
                continue;
            }

            const normalized = toNormalizedNumber(value);
            if (!Number.isFinite(normalized)) {
                continue;
            }

            payload[column] = normalized;
            changes.push({ column, from: value, to: normalized });
        }

        for (const jsonColumn of spec.jsonColumns || []) {
            const source = row[jsonColumn];
            if (!source || typeof source !== 'object') {
                continue;
            }

            const jsonChanges = [];
            const result = normalizeJsonValue(source, `$${jsonColumn}`, jsonChanges);
            if (result.changed) {
                payload[jsonColumn] = result.value;
                changes.push(...jsonChanges.map((entry) => ({
                    column: jsonColumn,
                    path: entry.path,
                    from: entry.from,
                    to: entry.to
                })));
            }
        }

        if (changes.length === 0) {
            continue;
        }

        updates.push({
            id: row[spec.idColumn],
            payload,
            changes
        });
    }

    if (WRITE_MODE) {
        for (const update of updates) {
            await patchRow(spec.table, spec.idColumn, update.id, update.payload);
        }
    }

    return {
        table: spec.table,
        scannedRows: Array.isArray(rows) ? rows.length : 0,
        updates
    };
}

async function main() {
    const results = [];
    for (const spec of TABLE_SPECS) {
        results.push(await processTable(spec));
    }

    const summary = {
        writeMode: WRITE_MODE,
        tables: results.map((result) => ({
            table: result.table,
            scannedRows: result.scannedRows,
            updates: result.updates.length
        })),
        updates: results.flatMap((result) => result.updates.map((update) => ({
            table: result.table,
            id: update.id,
            changes: update.changes
        })))
    };

    console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
