const { getSupabaseAdmin } = require('../lib/server/supabase-admin');
const { applyRateLimit, readJsonBody, sendJson } = require('../lib/server/http');

const MAX_ID_LENGTH = 120;
const MAX_SVG_LENGTH = 2_000_000;
const MAX_PREVIEW_LENGTH = 1_500_000;

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

            const { data, error } = await supabase
                .from('design_snapshots')
                .select('design_id, design_svg, design_preview, design_document_v3, design_document_v2, product_id, created_at, updated_at')
                .eq('design_id', designId)
                .maybeSingle();

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
        const designPreview = normalizePreview(body.preview || body.designPreview || body.design_preview);
        const productId = normalizeProductId(body.productId || body.product_id);
        const designSceneV1 = body.designSceneV1 && typeof body.designSceneV1 === 'object'
            ? body.designSceneV1
            : (body.design_scene_v1 && typeof body.design_scene_v1 === 'object' ? body.design_scene_v1 : null);

        if (!designId || !designSvg) {
            sendJson(res, 400, {
                error: 'INVALID_DESIGN_PAYLOAD',
                message: 'designId e design SVG são obrigatórios.'
            });
            return;
        }

        const payload = {
            design_id: designId,
            design_svg: designSvg,
            design_preview: designPreview || null,
            design_document_v3: designSceneV1 || null,
            design_document_v2: null,
            product_id: productId,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('design_snapshots')
            .upsert(payload, { onConflict: 'design_id' })
            .select('design_id, updated_at')
            .maybeSingle();

        if (error) {
            throw error;
        }

        sendJson(res, 200, {
            ok: true,
            design: data || { design_id: designId }
        });
    } catch (error) {
        console.error('Falha na API de designs:', error);
        sendJson(res, 500, {
            error: 'DESIGNS_API_FAILED',
            message: error?.message || 'Falha ao guardar/ler design.'
        });
    }
};
