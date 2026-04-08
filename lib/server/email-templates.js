const DEFAULT_VARIABLES = [
    { key: 'customer.name', label: 'Nome do cliente', group: 'Cliente', sample: 'Joao Silva' },
    { key: 'customer.email', label: 'Email do cliente', group: 'Cliente', sample: 'cliente@example.com' },
    { key: 'order.code', label: 'Numero da encomenda', group: 'Encomenda', sample: 'IBF1234567890' },
    { key: 'order.total', label: 'Total formatado', group: 'Encomenda', sample: '91.50 EUR' },
    { key: 'order.status', label: 'Estado tecnico', group: 'Encomenda', sample: 'em_producao' },
    { key: 'order.status_label', label: 'Estado visivel', group: 'Encomenda', sample: 'Em Producao' },
    { key: 'order.tracking_code', label: 'Codigo de tracking', group: 'Tracking', sample: 'IBF1234567890' },
    { key: 'order.tracking_url', label: 'Link de acompanhamento', group: 'Tracking', sample: 'https://iberflag.vercel.app/encomenda.html?codigo=IBF1234567890' },
    { key: 'invoice.status', label: 'Estado fiscal tecnico', group: 'Faturacao', sample: 'pending' },
    { key: 'invoice.status_label', label: 'Estado fiscal visivel', group: 'Faturacao', sample: 'A emitir' },
    { key: 'company.name', label: 'Nome da empresa', group: 'Empresa', sample: 'IberFlag' },
    { key: 'support.email', label: 'Email de suporte', group: 'Empresa', sample: 'suporte@iberflag.com' }
];

const STATUS_LABELS = {
    em_preparacao: 'Em Preparacao',
    em_producao: 'Em Producao',
    expedido: 'Expedido',
    entregue: 'Entregue'
};

const INVOICE_STATUS_LABELS = {
    pending: 'A emitir',
    emitted: 'Emitido',
    error: 'Erro de faturacao',
    blocked: 'Bloqueado'
};

function getPublicBaseUrl(req) {
    const configured = String(process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || '').trim();
    if (configured) {
        return configured.startsWith('http')
            ? configured.replace(/\/+$/, '')
            : `https://${configured.replace(/\/+$/, '')}`;
    }

    const host = String(req?.headers?.host || 'iberflag.vercel.app').trim();
    return `https://${host}`.replace(/\/+$/, '');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getPathValue(source, path) {
    return String(path || '')
        .split('.')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            if (acc === null || acc === undefined) return undefined;
            return acc[part];
        }, source);
}

function renderTemplateString(template, context, options = {}) {
    const { html = false } = options;
    return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, path) => {
        const value = getPathValue(context, path);
        if (value === undefined || value === null) {
            return '';
        }

        return html ? escapeHtml(value) : String(value);
    });
}

function formatCurrency(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) {
        return '0.00 EUR';
    }

    return `${amount.toFixed(2)} EUR`;
}

function normalizeTrackingCode(order) {
    return String(
        order?.tracking_codigo ||
        order?.codigo_tracking ||
        order?.tracking_code ||
        order?.numero_encomenda ||
        ''
    ).trim();
}

function buildOrderEmailContext({ req = null, order = null, customer = null, overrides = {} } = {}) {
    const baseUrl = getPublicBaseUrl(req);
    const orderCode = String(order?.numero_encomenda || order?.code || overrides?.order?.code || 'IBF1234567890').trim();
    const trackingCode = normalizeTrackingCode(order) || orderCode;
    const status = String(order?.status || overrides?.order?.status || 'em_preparacao').trim();
    const invoiceStatus = String(order?.facturalusa_status || overrides?.invoice?.status || 'pending').trim();
    const trackingUrl = `${baseUrl}/encomenda.html?codigo=${encodeURIComponent(trackingCode || orderCode)}`;

    return {
        customer: {
            name: String(customer?.nome || customer?.name || overrides?.customer?.name || 'Cliente').trim(),
            email: String(customer?.email || overrides?.customer?.email || '').trim()
        },
        order: {
            code: orderCode,
            total: formatCurrency(order?.total ?? overrides?.order?.total ?? 0),
            status,
            status_label: STATUS_LABELS[status] || status || 'Em Preparacao',
            tracking_code: trackingCode,
            tracking_url: trackingUrl
        },
        invoice: {
            status: invoiceStatus,
            status_label: INVOICE_STATUS_LABELS[invoiceStatus] || invoiceStatus || 'A emitir'
        },
        company: {
            name: String(process.env.MAIL_COMPANY_NAME || 'IberFlag')
        },
        support: {
            email: String(
                process.env.SUPPORT_EMAIL
                || process.env.RESEND_REPLY_TO
                || process.env.RESEND_FROM_EMAIL
                || process.env.SMTP_REPLY_TO
                || process.env.SMTP_FROM_EMAIL
                || 'geral@iberflag.com'
            )
        }
    };
}

function buildSampleEmailContext(req = null) {
    return buildOrderEmailContext({
        req,
        order: {
            numero_encomenda: 'IBF1234567890',
            total: 91.5,
            status: 'em_producao',
            facturalusa_status: 'pending'
        },
        customer: {
            nome: 'Joao Silva',
            email: 'cliente@example.com'
        }
    });
}

function renderEmailTemplate(template, context, options = {}) {
    const renderedContext = context || buildSampleEmailContext(options.req || null);
    return {
        subject: renderTemplateString(template?.subject || '', renderedContext),
        preheader: renderTemplateString(template?.preheader || '', renderedContext),
        html: renderTemplateString(template?.html_body || '', renderedContext, { html: true }),
        text: renderTemplateString(template?.text_body || '', renderedContext)
    };
}

function normalizeVariables(variables) {
    if (Array.isArray(variables) && variables.length > 0) {
        return variables;
    }

    return DEFAULT_VARIABLES;
}

function sanitizeTemplateRow(row) {
    if (!row) return null;

    return {
        id: row.id,
        template_key: row.template_key,
        name: row.name,
        description: row.description || '',
        event_type: row.event_type,
        subject: row.subject || '',
        preheader: row.preheader || '',
        html_body: row.html_body || '',
        text_body: row.text_body || '',
        variables: normalizeVariables(row.variables),
        active: row.active !== false,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
    };
}

function normalizeTemplatePayload(payload) {
    const templateKey = String(payload?.template_key || '').trim();
    const name = String(payload?.name || '').trim();
    const eventType = String(payload?.event_type || templateKey).trim();
    const subject = String(payload?.subject || '').trim();
    const htmlBody = String(payload?.html_body || '').trim();

    if (!templateKey || !/^[a-z0-9_.:-]+$/i.test(templateKey)) {
        const error = new Error('Chave de template invalida.');
        error.code = 'INVALID_TEMPLATE_KEY';
        throw error;
    }

    if (!name) {
        const error = new Error('O nome do template e obrigatorio.');
        error.code = 'MISSING_TEMPLATE_NAME';
        throw error;
    }

    if (!subject) {
        const error = new Error('O assunto do email e obrigatorio.');
        error.code = 'MISSING_TEMPLATE_SUBJECT';
        throw error;
    }

    if (!htmlBody) {
        const error = new Error('O HTML do email e obrigatorio.');
        error.code = 'MISSING_TEMPLATE_HTML';
        throw error;
    }

    return {
        template_key: templateKey,
        name,
        description: String(payload?.description || '').trim(),
        event_type: eventType,
        subject,
        preheader: String(payload?.preheader || '').trim(),
        html_body: htmlBody,
        text_body: String(payload?.text_body || '').trim(),
        variables: normalizeVariables(payload?.variables),
        active: payload?.active !== false
    };
}

module.exports = {
    DEFAULT_VARIABLES,
    buildOrderEmailContext,
    buildSampleEmailContext,
    renderEmailTemplate,
    renderTemplateString,
    sanitizeTemplateRow,
    normalizeTemplatePayload
};
