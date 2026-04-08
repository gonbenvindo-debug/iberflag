const { splitOrderNotesAndMeta } = require('./checkout');
const {
    buildOrderEmailContext,
    renderEmailTemplate,
    sanitizeTemplateRow
} = require('./email-templates');
const { sendTemplateEmail } = require('./mail-service');

async function optionalLogDelivery(supabase, payload) {
    try {
        await supabase
            .from('email_delivery_logs')
            .insert(payload);
    } catch (error) {
        console.warn('Nao foi possivel registar email_delivery_logs:', error?.message || error);
    }
}

async function findTemplate(supabase, templateKey) {
    const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('active', true)
        .maybeSingle();

    if (error) throw error;
    return sanitizeTemplateRow(data);
}

async function hasSentDedupe(supabase, dedupeKey) {
    if (!dedupeKey) return false;

    try {
        const { data, error } = await supabase
            .from('email_delivery_logs')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .eq('status', 'sent')
            .maybeSingle();

        if (error) throw error;
        return Boolean(data?.id);
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST205' || raw.includes('email_delivery_logs') || raw.includes('dedupe_key')) {
            return false;
        }
        throw error;
    }
}

async function findOrderCustomer(supabase, order, meta) {
    if (order?.cliente_id) {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', order.cliente_id)
                .maybeSingle();

            if (error) throw error;
            if (data) return data;
        } catch (error) {
            console.warn('Nao foi possivel carregar cliente para email:', error?.message || error);
        }
    }

    const checkoutCustomer = meta?.checkoutCustomer || order?.checkout_payload?.customer || order?.checkout_payload?.checkoutCustomer || {};
    return {
        nome: checkoutCustomer.nome || checkoutCustomer.name || 'Cliente',
        email: checkoutCustomer.email || ''
    };
}

function buildNotificationOrder(order, meta, statusOverride = '') {
    const workflowStatus = statusOverride || meta?.workflowStatus || order?.status || 'em_preparacao';
    return {
        ...order,
        status: workflowStatus,
        tracking_codigo: meta?.trackingCode || order?.tracking_codigo || order?.codigo_tracking || order?.numero_encomenda || '',
        tracking_url: meta?.trackingUrl || order?.tracking_url || ''
    };
}

async function sendOrderEmailNotification({
    supabase,
    req = null,
    order,
    templateKey,
    statusOverride = '',
    dedupeKey = '',
    throwOnError = false
}) {
    if (!order?.id || !templateKey) {
        return { sent: false, skipped: true, reason: 'MISSING_ORDER_OR_TEMPLATE' };
    }

    try {
        const alreadySent = await hasSentDedupe(supabase, dedupeKey);
        if (alreadySent) {
            return { sent: false, skipped: true, reason: 'DUPLICATE_EMAIL' };
        }

        const template = await findTemplate(supabase, templateKey);
        if (!template) {
            return { sent: false, skipped: true, reason: 'EMAIL_TEMPLATE_INACTIVE_OR_MISSING' };
        }

        const split = splitOrderNotesAndMeta(order.notas || '');
        const customer = await findOrderCustomer(supabase, order, split.meta);
        const recipient = String(customer?.email || '').trim();
        if (!recipient) {
            return { sent: false, skipped: true, reason: 'ORDER_EMAIL_MISSING' };
        }

        const context = buildOrderEmailContext({
            req,
            order: buildNotificationOrder(order, split.meta, statusOverride),
            customer
        });
        const rendered = renderEmailTemplate(template, context);

        try {
            const result = await sendTemplateEmail({
                to: recipient,
                subject: rendered.subject,
                preheader: rendered.preheader,
                html: rendered.html,
                text: rendered.text
            });

            await optionalLogDelivery(supabase, {
                template_key: template.template_key,
                order_id: order.id,
                recipient,
                subject: rendered.subject,
                dedupe_key: dedupeKey || null,
                status: 'sent',
                provider_message_id: result.messageId || null,
                payload: {
                    type: templateKey,
                    status: context.order.status
                },
                sent_at: new Date().toISOString()
            });

            return { sent: true, recipient, messageId: result.messageId || null };
        } catch (sendError) {
            await optionalLogDelivery(supabase, {
                template_key: template.template_key,
                order_id: order.id,
                recipient,
                subject: rendered.subject,
                dedupe_key: dedupeKey || null,
                status: 'failed',
                error_message: sendError?.message || 'Falha ao enviar email.',
                payload: {
                    type: templateKey,
                    status: context.order.status,
                    code: sendError?.code || 'EMAIL_SEND_FAILED'
                }
            });

            if (throwOnError) throw sendError;
            return {
                sent: false,
                skipped: true,
                reason: sendError?.code || 'EMAIL_SEND_FAILED',
                message: sendError?.message || 'Falha ao enviar email.'
            };
        }
    } catch (error) {
        if (throwOnError) throw error;
        console.warn('Email de encomenda nao enviado:', error?.message || error);
        return {
            sent: false,
            skipped: true,
            reason: error?.code || 'EMAIL_NOTIFICATION_FAILED',
            message: error?.message || 'Falha ao enviar notificacao por email.'
        };
    }
}

module.exports = {
    sendOrderEmailNotification
};
