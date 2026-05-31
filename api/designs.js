const { getSupabaseAdmin } = require('../lib/server/supabase-admin');
const { applyRateLimit, readJsonBody, sendJson } = require('../lib/server/http');
const { getMissingColumnFromError } = require('../lib/server/schema-safe');

const MAX_ID_LENGTH = 120;
const MAX_SVG_LENGTH = 2_000_000;
const MAX_PREVIEW_LENGTH = 1_500_000;
const DESIGN_SELECT_REQUIRED_COLUMNS = [
    'design_id',
    'design_svg',
    'design_preview',
    'created_at',
    'updated_at'
];
const DESIGN_SELECT_OPTIONAL_COLUMNS = [
    'design_document_v3',
    'design_document_v2',
    'product_id'
];

function normalizeDesignId(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, MAX_ID_LENGTH);
}

function normalizeSvg(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, MAX_SVG_LENGTH);
}

function normalizePreview(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, MAX_PREVIEW_LENGTH);
}

function normalizeProductId(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return Math.round(parsed);
}

function hasOwn(source, key) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function readOptionalField(source, keys = []) {
    for (const key of keys) {
        if (hasOwn(source, key)) {
            return {
                present: true,
                value: source[key]
            };
        }
    }

    return {
        present: false,
        value: undefined
    };
}

function buildDesignSelectColumns(optionalColumns = []) {
    return [...DESIGN_SELECT_REQUIRED_COLUMNS, ...optionalColumns].join(', ');
}

async function fetchDesignSnapshotById(supabase, designId) {
    let optionalColumns = [...DESIGN_SELECT_OPTIONAL_COLUMNS];

    while (true) {
        try {
            return await supabase
                .from('design_snapshots')
                .select(buildDesignSelectColumns(optionalColumns))
                .eq('design_id', designId)
                .maybeSingle();
        } catch (error) {
            const missingColumn = getMissingColumnFromError(error, 'design_snapshots');
            if (!missingColumn || !optionalColumns.includes(missingColumn)) {
                throw error;
            }

            optionalColumns = optionalColumns.filter((column) => column !== missingColumn);
        }
    }
}

async function upsertDesignSnapshot(supabase, requiredPayload, optionalPayload = {}) {
    let optionalEntries = Object.entries(optionalPayload)
        .filter(([, value]) => value !== undefined);

    while (true) {
        const payload = {
            ...requiredPayload,
            ...Object.fromEntries(optionalEntries)
        };

        try {
            return await supabase
                .from('design_snapshots')
                .upsert(payload, { onConflict: 'design_id' })
                .select('design_id, updated_at')
                .maybeSingle();
        } catch (error) {
            const missingColumn = getMissingColumnFromError(error, 'design_snapshots');
            if (!missingColumn) {
                throw error;
            }

            const nextEntries = optionalEntries.filter(([columnName]) => columnName !== missingColumn);
            if (nextEntries.length === optionalEntries.length) {
                throw error;
            }

            optionalEntries = nextEntries;
        }
    }
}

module.exports = async function designsHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
        return;
    }

    if (!applyRateLimit(req, res, {
        key: 'designs-api',
        windowMs: 60 * 1000,
        max: 90,
        message: 'Demasiados pedidos de designs em pouco tempo.'
    })) {
        return;
    }

    try {
        const supabase = getSupabaseAdmin();

        if (req.method === 'GET') {
            const requestUrl = new URL(req.url || '/', 'http://localhost');
            const designId = normalizeDesignId(requestUrl.searchParams.get('designId'));
            if (!designId) {
                sendJson(res, 400, { error: 'MISSING_DESIGN_ID', message: 'designId em falta.' });
                return;
            }

            const { data, error } = await fetchDesignSnapshotById(supabase, designId);

            if (error) {
                throw error;
            }

            sendJson(res, 200, {
                ok: true,
                design: data || null
            });
            return;
        }

        const body = await readJsonBody(req);
        const designId = normalizeDesignId(body.designId || body.design_id);
        const designSvg = normalizeSvg(body.design || body.designSvg || body.design_svg);
        const previewField = readOptionalField(body, ['preview', 'designPreview', 'design_preview']);
        const productField = readOptionalField(body, ['productId', 'product_id']);
        const sceneField = readOptionalField(body, ['designSceneV1', 'design_scene_v1']);
        const designPreview = previewField.present
            ? normalizePreview(previewField.value)
            : '';
        const productId = productField.present
            ? normalizeProductId(productField.value)
            : null;
        const designSceneV1 = sceneField.present && sceneField.value && typeof sceneField.value === 'object'
            ? sceneField.value
            : null;

        if (!designId || !designSvg) {
            sendJson(res, 400, {
                error: 'INVALID_DESIGN_PAYLOAD',
                message: 'designId e design SVG são obrigatórios.'
            });
            return;
        }

        const requiredPayload = {
            design_id: designId,
            design_svg: designSvg,
            updated_at: new Date().toISOString()
        };
        const optionalPayload = {
            design_preview: previewField.present ? (designPreview || null) : undefined,
            design_document_v3: sceneField.present ? (designSceneV1 || null) : undefined,
            product_id: productField.present && productId !== null ? productId : undefined
        };
        const { data, error } = await upsertDesignSnapshot(supabase, requiredPayload, optionalPayload);

        if (error) {
            throw error;
        }

        sendJson(res, 200, {
            ok: true,
            design: data || { design_id: designId }
        });
    } catch (error) {
        console.error('Falha na API de designs:', error);
        const errorCode = String(error?.code || '').toUpperCase();
        if (errorCode === 'PGRST205') {
            sendJson(res, 503, {
                error: 'DESIGNS_TABLE_UNAVAILABLE',
                message: 'A tabela design_snapshots nao esta disponivel no ambiente atual.'
            });
            return;
        }

        sendJson(res, 500, {
            error: 'DESIGNS_API_FAILED',
            message: error?.message || 'Falha ao guardar/ler design.'
        });
    }
};
