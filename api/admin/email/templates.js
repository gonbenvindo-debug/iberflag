const { requireAdminRequest } = require('../../../lib/server/admin-auth');
const { getSupabaseAdmin } = require('../../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../../lib/server/http');
const { getMailConfigStatus } = require('../../../lib/server/mail-config');
const {
    DEFAULT_VARIABLES,
    buildSampleEmailContext,
    normalizeTemplatePayload,
    renderEmailTemplate,
    sanitizeTemplateRow
} = require('../../../lib/server/email-templates');

function isAdminAuthError(error) {
    return ['ADMIN_AUTH_REQUIRED', 'ADMIN_UNAUTHORIZED', 'ADMIN_FORBIDDEN', 'ADMIN_AUTH_NOT_CONFIGURED'].includes(error?.code);
}

async function listTemplates(supabase) {
    const { data, error } = await supabase
        .from('email_templates')
        .select('*');

    if (error) throw error;

    return (data || [])
        .map(sanitizeTemplateRow)
        .filter(Boolean)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt'));
}

async function saveTemplate(supabase, payload) {
    const id = String(payload?.id || '').trim();
    const template = normalizeTemplatePayload(payload);

    if (id) {
        const { data, error } = await supabase
            .from('email_templates')
            .update(template)
            .eq('id', id);

        if (error) throw error;
        const updated = (data || [])[0] || null;
        if (updated) return sanitizeTemplateRow(updated);
    }

    const { data: existing, error: lookupError } = await supabase
        .from('email_templates')
        .select('id')
        .eq('template_key', template.template_key)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing?.id) {
        const { data, error } = await supabase
            .from('email_templates')
            .update(template)
            .eq('id', existing.id);

        if (error) throw error;
        return sanitizeTemplateRow((data || [])[0] || null);
    }

    const { data, error } = await supabase
        .from('email_templates')
        .insert(template);

    if (error) throw error;
    return sanitizeTemplateRow((data || [])[0] || null);
}

module.exports = async function adminEmailTemplatesHandler(req, res) {
    try {
        await requireAdminRequest(req);
        const supabase = getSupabaseAdmin();

        if (req.method === 'GET') {
            const templates = await listTemplates(supabase);
            sendJson(res, 200, {
                success: true,
                templates,
                variables: DEFAULT_VARIABLES,
                sampleContext: buildSampleEmailContext(req),
                mailConfig: getMailConfigStatus()
            });
            return;
        }

        if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
            return;
        }

        const body = await readJsonBody(req);
        const action = String(body?.action || 'save-template').trim();

        if (action === 'render-preview') {
            const template = normalizeTemplatePayload(body?.template || body);
            const rendered = renderEmailTemplate(template, buildSampleEmailContext(req));
            sendJson(res, 200, {
                success: true,
                rendered
            });
            return;
        }

        if (action === 'save-template') {
            const saved = await saveTemplate(supabase, body?.template || body);
            sendJson(res, 200, {
                success: true,
                template: saved
            });
            return;
        }

        sendJson(res, 400, {
            error: 'UNKNOWN_EMAIL_TEMPLATE_ACTION',
            message: 'Acao de template de email desconhecida.'
        });
    } catch (error) {
        if (isAdminAuthError(error)) {
            sendJson(res, error.statusCode || 401, {
                error: error.code,
                message: error.message || 'Acesso admin negado.'
            });
            return;
        }

        console.error('Erro nos templates de email:', error);
        sendJson(res, error?.statusCode || 500, {
            error: error?.code || 'EMAIL_TEMPLATES_FAILED',
            message: error?.message || 'Falha ao gerir templates de email.'
        });
    }
};
