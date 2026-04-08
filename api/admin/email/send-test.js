const { requireAdminRequest } = require('../../../lib/server/admin-auth');
const { getSupabaseAdmin } = require('../../../lib/server/supabase-admin');
const { readJsonBody, sendJson } = require('../../../lib/server/http');
const {
    buildSampleEmailContext,
    normalizeTemplatePayload,
    renderEmailTemplate,
    sanitizeTemplateRow
} = require('../../../lib/server/email-templates');
const { sendTemplateEmail } = require('../../../lib/server/mail-service');

function isAdminAuthError(error) {
    return ['ADMIN_AUTH_REQUIRED', 'ADMIN_UNAUTHORIZED', 'ADMIN_FORBIDDEN', 'ADMIN_AUTH_NOT_CONFIGURED'].includes(error?.code);
}

async function findTemplate(supabase, body) {
    if (body?.template) {
        return normalizeTemplatePayload(body.template);
    }

    const id = String(body?.id || '').trim();
    const key = String(body?.template_key || '').trim();

    if (id) {
        const { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return sanitizeTemplateRow(data);
    }

    if (key) {
        const { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .eq('template_key', key)
            .maybeSingle();

        if (error) throw error;
        return sanitizeTemplateRow(data);
    }

    return null;
}

async function logEmailDelivery(supabase, payload) {
    try {
        await supabase
            .from('email_delivery_logs')
            .insert(payload);
    } catch (error) {
        console.warn('Nao foi possivel registar email_delivery_logs:', error?.message || error);
    }
}

module.exports = async function adminEmailSendTestHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
    }

    try {
        const admin = await requireAdminRequest(req);
        const body = await readJsonBody(req);
        const recipient = String(body?.recipient || admin.email || '').trim();
        const supabase = getSupabaseAdmin();
        const template = await findTemplate(supabase, body);

        if (!template) {
            sendJson(res, 404, {
                error: 'EMAIL_TEMPLATE_NOT_FOUND',
                message: 'Template de email nao encontrado.'
            });
            return;
        }

        const rendered = renderEmailTemplate(template, buildSampleEmailContext(req));

        try {
            const result = await sendTemplateEmail({
                to: recipient,
                subject: rendered.subject,
                preheader: rendered.preheader,
                html: rendered.html,
                text: rendered.text
            });

            await logEmailDelivery(supabase, {
                template_key: template.template_key,
                recipient,
                subject: rendered.subject,
                status: 'sent',
                provider_message_id: result.messageId || null,
                payload: {
                    type: 'admin_test',
                    admin: admin.email
                },
                sent_at: new Date().toISOString()
            });

            sendJson(res, 200, {
                success: true,
                messageId: result.messageId || null,
                accepted: result.accepted || [],
                rejected: result.rejected || []
            });
        } catch (sendError) {
            await logEmailDelivery(supabase, {
                template_key: template.template_key,
                recipient,
                subject: rendered.subject,
                status: 'failed',
                error_message: sendError?.message || 'Falha ao enviar email de teste.',
                payload: {
                    type: 'admin_test',
                    admin: admin.email,
                    code: sendError?.code || 'EMAIL_SEND_FAILED'
                }
            });

            throw sendError;
        }
    } catch (error) {
        if (isAdminAuthError(error)) {
            sendJson(res, error.statusCode || 401, {
                error: error.code,
                message: error.message || 'Acesso admin negado.'
            });
            return;
        }

        console.error('Erro ao enviar email de teste:', error);
        sendJson(res, error?.statusCode || 500, {
            error: error?.code || 'EMAIL_SEND_TEST_FAILED',
            message: error?.message || 'Falha ao enviar email de teste.'
        });
    }
};
