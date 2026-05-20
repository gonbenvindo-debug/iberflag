const { splitOrderNotesAndMeta } = require('./checkout');
const {
    buildOrderEmailContext,
    renderEmailTemplate,
    sanitizeTemplateRow
} = require('./email-templates');
const { sendTemplateEmail } = require('./mail-service');

function normalizeText(value) {
    return String(value ?? '').trim();
}

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

const TEMPLATE_FALLBACK_KEYS = {
    order_confirmation_preparacao: ['order_confirmation'],
    invoice_issued_with_attachment: ['invoice_document_ready'],
    order_status_expedido: ['order_status_update'],
    order_status_entregue: ['order_status_update']
};

async function resolveTemplateWithFallback(supabase, templateKey) {
    const orderedKeys = [templateKey, ...(TEMPLATE_FALLBACK_KEYS[templateKey] || [])]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    for (const key of orderedKeys) {
        const template = await findTemplate(supabase, key);
        if (template) {
            return {
                template,
                resolvedTemplateKey: key
            };
        }
    }

    return {
        template: null,
        resolvedTemplateKey: ''
    };
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

function resolveInvoiceDocument(order, meta) {
    return {
        documentNumber: normalizeText(order?.facturalusa_document_number) || normalizeText(meta?.facturalusaDocumentNumber),
        documentUrl: normalizeText(order?.facturalusa_document_url) || normalizeText(meta?.facturalusaDocumentUrl)
    };
}

function buildInvoiceAttachmentFilename(orderCode, documentNumber) {
    const baseCode = normalizeText(documentNumber) || normalizeText(orderCode) || 'documento';
    const safeToken = baseCode.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'documento';
    return `Fatura-${safeToken}.pdf`;
}

function isPdfBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
    return buffer.subarray(0, 4).toString('utf8') === '%PDF';
}

async function fetchInvoiceAttachmentOrThrow(order, meta) {
    const invoice = resolveInvoiceDocument(order, meta);
    if (!invoice.documentUrl) {
        const error = new Error('Documento fiscal sem URL de PDF.');
        error.code = 'INVOICE_ATTACHMENT_URL_MISSING';
        throw error;
    }

    let response;
    try {
        response = await fetch(invoice.documentUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/pdf'
            }
        });
    } catch (error) {
        const nextError = new Error('Falha ao descarregar PDF da fatura.');
        nextError.code = 'INVOICE_ATTACHMENT_FETCH_FAILED';
        nextError.cause = error;
        throw nextError;
    }

    if (!response.ok) {
        const error = new Error(`Falha ao descarregar PDF da fatura (HTTP ${response.status}).`);
        error.code = 'INVOICE_ATTACHMENT_FETCH_BAD_STATUS';
        throw error;
    }

    const contentType = normalizeText(response.headers.get('content-type')).toLowerCase();
    const content = Buffer.from(await response.arrayBuffer());
    if (!content.length) {
        const error = new Error('PDF da fatura vazio.');
        error.code = 'INVOICE_ATTACHMENT_EMPTY';
        throw error;
    }

    if (!contentType.includes('pdf') && !isPdfBuffer(content)) {
        const error = new Error('URL da fatura nao devolveu um PDF valido.');
        error.code = 'INVOICE_ATTACHMENT_INVALID_CONTENT';
        throw error;
    }

    return [{
        filename: buildInvoiceAttachmentFilename(order?.numero_encomenda, invoice.documentNumber),
        content,
        contentType: 'application/pdf'
    }];
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
    requireInvoiceAttachment = false,
    attachments = [],
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

        const { template, resolvedTemplateKey } = await resolveTemplateWithFallback(supabase, templateKey);
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
        let finalAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
        if (requireInvoiceAttachment) {
            try {
                finalAttachments = await fetchInvoiceAttachmentOrThrow(order, split.meta);
            } catch (attachmentError) {
                await optionalLogDelivery(supabase, {
                    template_key: template.template_key,
                    order_id: order.id,
                    recipient,
                    subject: rendered.subject,
                    dedupe_key: dedupeKey || null,
                    status: 'failed',
                    error_message: attachmentError?.message || 'Falha ao preparar anexo da fatura.',
                payload: {
                    type: templateKey,
                    resolvedTemplateKey: resolvedTemplateKey || template.template_key,
                    status: context.order.status,
                    code: attachmentError?.code || 'INVOICE_ATTACHMENT_FAILED'
                }
                });
                return {
                    sent: false,
                    skipped: true,
                    reason: attachmentError?.code || 'INVOICE_ATTACHMENT_FAILED',
                    message: attachmentError?.message || 'Falha ao preparar anexo da fatura.'
                };
            }
        }

        try {
            const result = await sendTemplateEmail({
                to: recipient,
                subject: rendered.subject,
                preheader: rendered.preheader,
                html: rendered.html,
                text: rendered.text,
                attachments: finalAttachments
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
                    resolvedTemplateKey: resolvedTemplateKey || template.template_key,
                    status: context.order.status,
                    sentCopy: result.sentCopy || null
                },
                sent_at: new Date().toISOString()
            });

            return {
                sent: true,
                recipient,
                messageId: result.messageId || null,
                sentCopy: result.sentCopy || null
            };
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
                    resolvedTemplateKey: resolvedTemplateKey || template.template_key,
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
