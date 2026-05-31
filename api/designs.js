const { getSupabaseAdmin } = require('../lib/server/supabase-admin');
const { applyRateLimit, readJsonBody, sendJson, setSecurityHeaders } = require('../lib/server/http');
const { getMissingColumnFromError } = require('../lib/server/schema-safe');
const {
    buildDesignAssetUrl,
    downloadPrivateDesignSvg,
    generateReadToken,
    getDesignStorageBucket,
    hashReadToken,
    uploadPrivateDesignDocument,
    uploadPrivateDesignSvg,
    verifyReadToken
} = require('../lib/server/design-storage');

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
    'product_id',
    'storage_bucket',
    'masked_svg_path',
    'document_path',
    'asset_manifest',
    'read_token_hash'
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

function isLikelySvg(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.startsWith('<svg') || normalized.includes('<svg');
}

function getReadTokenFromRequest(req, requestUrl) {
    const headerToken = req.headers?.['x-design-read-token'] || req.headers?.['X-Design-Read-Token'];
    return String(headerToken || requestUrl.searchParams.get('token') || '').trim();
}

function canReadSnapshot(row, token) {
    const expectedHash = String(row?.read_token_hash || '').trim();
    if (!expectedHash) {
        return true;
    }
    return verifyReadToken(token, expectedHash);
}

function buildDesignResponse(row, readToken) {
    const designId = normalizeDesignId(row?.design_id);
    const token = String(readToken || '').trim();
    const svgUrl = token ? buildDesignAssetUrl(designId, token, 'svg') : '';

    return {
        design_id: designId,
        designId,
        product_id: row?.product_id ?? null,
        storage_bucket: row?.storage_bucket || getDesignStorageBucket(),
        storageBucket: row?.storage_bucket || getDesignStorageBucket(),
        masked_svg_path: row?.masked_svg_path || '',
        maskedSvgPath: row?.masked_svg_path || '',
        document_path: row?.document_path || '',
        documentPath: row?.document_path || '',
        asset_manifest: row?.asset_manifest || {},
        assetManifest: row?.asset_manifest || {},
        has_read_token: Boolean(row?.read_token_hash),
        hasReadToken: Boolean(row?.read_token_hash),
        readToken: token,
        designReadToken: token,
        svgUrl,
        designSvgUrl: svgUrl,
        design_preview: svgUrl || row?.design_preview || '',
        designPreview: svgUrl || row?.design_preview || '',
        updated_at: row?.updated_at || null,
        created_at: row?.created_at || null
    };
}

function sendSvg(res, svgMarkup) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=30');
    setSecurityHeaders(res);
    res.end(String(svgMarkup || ''));
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
            const readToken = getReadTokenFromRequest(req, requestUrl);
            const asset = String(requestUrl.searchParams.get('asset') || '').trim().toLowerCase();

            if (!designId) {
                sendJson(res, 400, { error: 'MISSING_DESIGN_ID', message: 'designId em falta.' });
                return;
            }

            const { data, error } = await fetchDesignSnapshotById(supabase, designId);
            if (error) {
                throw error;
            }

            if (!data) {
                sendJson(res, 404, { error: 'DESIGN_NOT_FOUND', message: 'Design nao encontrado.' });
                return;
            }

            if (!canReadSnapshot(data, readToken)) {
                sendJson(res, 403, {
                    error: 'DESIGN_TOKEN_INVALID',
                    message: 'Token de leitura do design invalido ou em falta.'
                });
                return;
            }

            if (asset === 'svg') {
                if (data.masked_svg_path) {
                    const svgMarkup = await downloadPrivateDesignSvg(
                        data.storage_bucket || getDesignStorageBucket(),
                        data.masked_svg_path
                    );
                    sendSvg(res, svgMarkup);
                    return;
                }

                if (isLikelySvg(data.design_svg)) {
                    sendSvg(res, data.design_svg);
                    return;
                }

                sendJson(res, 404, { error: 'DESIGN_SVG_NOT_FOUND', message: 'SVG do design nao encontrado.' });
                return;
            }

            sendJson(res, 200, {
                ok: true,
                design: buildDesignResponse(data, readToken)
            });
            return;
        }

        const body = await readJsonBody(req);
        const designId = normalizeDesignId(body.designId || body.design_id);
        const designSvg = normalizeSvg(body.maskedSvg || body.masked_svg || body.design || body.designSvg || body.design_svg);
        const previewField = readOptionalField(body, ['preview', 'designPreview', 'design_preview']);
        const productField = readOptionalField(body, ['productId', 'product_id']);
        const sceneField = readOptionalField(body, ['designSceneV1', 'design_scene_v1', 'designDocument', 'design_document']);
        const manifestField = readOptionalField(body, ['assetManifest', 'asset_manifest']);
        const designPreview = previewField.present
            ? normalizePreview(previewField.value)
            : '';
        const productId = productField.present
            ? normalizeProductId(productField.value)
            : null;
        const designSceneV1 = sceneField.present && sceneField.value && typeof sceneField.value === 'object'
            ? sceneField.value
            : null;
        const assetManifest = manifestField.present && manifestField.value && typeof manifestField.value === 'object'
            ? manifestField.value
            : {};

        if (!designId || !designSvg || !isLikelySvg(designSvg)) {
            sendJson(res, 400, {
                error: 'INVALID_DESIGN_PAYLOAD',
                message: 'designId e SVG mascarado valido sao obrigatorios.'
            });
            return;
        }

        const readToken = generateReadToken();
        const uploadedSvg = await uploadPrivateDesignSvg(designId, designSvg);
        const uploadedDocument = await uploadPrivateDesignDocument(designId, designSceneV1);
        const svgUrl = buildDesignAssetUrl(designId, readToken, 'svg');
        const requiredPayload = {
            design_id: designId,
            design_svg: null,
            updated_at: new Date().toISOString()
        };
        const optionalPayload = {
            design_preview: svgUrl || designPreview || undefined,
            design_document_v3: sceneField.present ? (designSceneV1 || null) : undefined,
            product_id: productField.present && productId !== null ? productId : undefined,
            storage_bucket: uploadedSvg.bucket,
            masked_svg_path: uploadedSvg.path,
            document_path: uploadedDocument?.path || null,
            asset_manifest: assetManifest,
            read_token_hash: hashReadToken(readToken)
        };
        const { data, error } = await upsertDesignSnapshot(supabase, requiredPayload, optionalPayload);

        if (error) {
            throw error;
        }

        sendJson(res, 200, {
            ok: true,
            design: buildDesignResponse({
                ...(data || {}),
                design_id: designId,
                product_id: productId,
                storage_bucket: uploadedSvg.bucket,
                masked_svg_path: uploadedSvg.path,
                document_path: uploadedDocument?.path || '',
                asset_manifest: assetManifest,
                read_token_hash: optionalPayload.read_token_hash,
                design_preview: svgUrl,
                updated_at: data?.updated_at || requiredPayload.updated_at
            }, readToken)
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
