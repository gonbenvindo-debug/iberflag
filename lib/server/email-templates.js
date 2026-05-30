const SiteRoutes = require('../../assets/js/core/site-routes.js');

const DEFAULT_VARIABLES = [
    { key: 'customer.name', label: 'Nome do cliente', group: 'Cliente', sample: 'Joao Silva' },
    { key: 'customer.email', label: 'Email do cliente', group: 'Cliente', sample: 'cliente@example.com' },
    { key: 'customer.phone', label: 'Telefone', group: 'Cliente', sample: '+351912345678' },
    { key: 'customer.tax_id', label: 'NIF', group: 'Cliente', sample: '123456789' },
    { key: 'customer.address_line_1', label: 'Morada', group: 'Cliente', sample: 'Rua Central 10' },
    { key: 'customer.address_line_2', label: 'Codigo postal e cidade', group: 'Cliente', sample: '1000-100 Lisboa, PT' },
    { key: 'order.code', label: 'Numero da encomenda', group: 'Encomenda', sample: 'IBF1234567890' },
    { key: 'order.date_short', label: 'Data curta', group: 'Encomenda', sample: '25/05/2026' },
    { key: 'order.total', label: 'Total formatado', group: 'Encomenda', sample: '91,50 €' },
    { key: 'order.subtotal', label: 'Subtotal formatado', group: 'Encomenda', sample: '91,50 €' },
    { key: 'order.shipping', label: 'Portes formatados', group: 'Encomenda', sample: '0,00 €' },
    { key: 'order.status', label: 'Estado tecnico', group: 'Encomenda', sample: 'em_producao' },
    { key: 'order.status_label', label: 'Estado visivel', group: 'Encomenda', sample: 'Em Producao' },
    { key: 'order.tracking_code', label: 'Codigo de tracking', group: 'Tracking', sample: 'IBF1234567890' },
    { key: 'order.tracking_url', label: 'Link de acompanhamento', group: 'Tracking', sample: 'https://iberflag.com/encomenda/IBF1234567890' },
    { key: 'order.items_text', label: 'Linhas da encomenda em texto', group: 'Encomenda', sample: '- Bandeira x1 - 91,50 €' },
    { key: 'order.items_table_html', label: 'Tabela HTML das linhas', group: 'Encomenda', sample: '<table>...</table>' },
    { key: 'order.summary_table_html', label: 'Tabela HTML dos totais', group: 'Encomenda', sample: '<table>...</table>' },
    { key: 'invoice.status', label: 'Estado fiscal tecnico', group: 'Faturacao', sample: 'pending' },
    { key: 'invoice.status_label', label: 'Estado fiscal visivel', group: 'Faturacao', sample: 'A emitir' },
    { key: 'invoice.document_number', label: 'Numero do documento fiscal', group: 'Faturacao', sample: 'FR TESTE/1' },
    { key: 'company.name', label: 'Nome da empresa', group: 'Empresa', sample: 'IberFlag' },
    { key: 'company.website', label: 'Site', group: 'Empresa', sample: 'https://iberflag.com' },
    { key: 'brand.logo_url', label: 'URL do logo', group: 'Empresa', sample: 'https://iberflag.com/assets/logos/logo-completo.svg' },
    { key: 'support.email', label: 'Email de suporte', group: 'Empresa', sample: 'suporte@iberflag.com' },
    { key: 'support.phone', label: 'Telefone de suporte', group: 'Empresa', sample: '+351 000 000 000' }
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

function normalizeText(value) {
    return String(value ?? '').trim();
}

function getPublicBaseUrl(req) {
    const configured = normalizeText(process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL);
    if (configured) {
        return configured.startsWith('http')
            ? configured.replace(/\/+$/, '')
            : `https://${configured.replace(/\/+$/, '')}`;
    }

    const host = String(req?.headers?.host || 'iberflag.com').trim();
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

function getRawHtmlVariableValue(path, context) {
    const value = getPathValue(context, path);
    if (value === undefined || value === null) {
        return '';
    }

    const lastSegment = String(path || '').split('.').pop() || '';
    if (/_html$/i.test(lastSegment)) {
        return String(value);
    }

    return escapeHtml(value);
}

function renderTemplateString(template, context, options = {}) {
    const { html = false } = options;
    return String(template || '')
        .replace(/\{\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}\}/g, (match, path) => {
            if (!html) {
                const value = getPathValue(context, path);
                return value === undefined || value === null ? '' : String(value);
            }
            return getRawHtmlVariableValue(path, context);
        })
        .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, path) => {
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
        return '0,00 €';
    }

    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatDateShort(value) {
    const safeValue = value ? new Date(value) : new Date();
    if (Number.isNaN(safeValue.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(safeValue);
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

function normalizeCountryCode(value) {
    return normalizeText(value).toUpperCase();
}

function buildAddressLines(address, postalCode, city, countryCode = '') {
    const line1 = normalizeText(address);
    const line2Parts = [
        normalizeText(postalCode),
        normalizeText(city)
    ].filter(Boolean);
    const line2 = line2Parts.join(' ');
    const line3 = normalizeCountryCode(countryCode);
    return {
        line1,
        line2: [line2, line3].filter(Boolean).join(', '),
        compact: [line1, [line2, line3].filter(Boolean).join(', ')].filter(Boolean).join(' | ')
    };
}

function resolveEmailMeta(order = {}) {
    const meta = order?.email_meta;
    return meta && typeof meta === 'object' ? meta : {};
}

function resolveEmailCustomer(order = {}, customer = {}) {
    const meta = resolveEmailMeta(order);
    const checkoutCustomer = meta.checkoutCustomer && typeof meta.checkoutCustomer === 'object'
        ? meta.checkoutCustomer
        : {};
    const source = {
        ...checkoutCustomer,
        ...customer
    };
    const country = source.country || source.countryCode || source.country_code || 'PT';
    const billing = buildAddressLines(source.morada || source.address, source.codigo_postal || source.postal_code, source.cidade || source.city, country);
    const shipping = buildAddressLines(
        source.shipping_address || source.morada || source.address,
        source.shipping_postal_code || source.codigo_postal || source.postal_code,
        source.shipping_city || source.cidade || source.city,
        source.shipping_country || country
    );

    return {
        name: normalizeText(source.nome || source.name || 'Cliente'),
        email: normalizeText(source.email),
        phone: normalizeText(source.telefone || source.phone),
        taxId: normalizeText(source.nif || source.tax_id || source.vat_number),
        company: normalizeText(source.empresa || source.company),
        type: normalizeText(source.tipo_cliente || source.customerType || source.type) || 'particular',
        billing,
        shipping
    };
}

function resolveOrderItems(order = {}) {
    const meta = resolveEmailMeta(order);
    if (Array.isArray(meta.itemSnapshots) && meta.itemSnapshots.length > 0) {
        return meta.itemSnapshots;
    }
    if (Array.isArray(order?.checkout_payload?.itemSnapshots) && order.checkout_payload.itemSnapshots.length > 0) {
        return order.checkout_payload.itemSnapshots;
    }
    if (Array.isArray(meta?.checkoutSnapshot?.cart) && meta.checkoutSnapshot.cart.length > 0) {
        return meta.checkoutSnapshot.cart;
    }
    return [];
}

function buildItemReference(item = {}, index = 0) {
    const productId = Number(item?.produtoId || item?.produto_id || item?.id || 0);
    if (Number.isFinite(productId) && productId > 0) {
        return `IBF-${productId}`;
    }

    const serviceType = normalizeText(item?.serviceType || item?.service_type).toUpperCase();
    if (serviceType) {
        return serviceType.replace(/[^A-Z0-9]+/g, '-');
    }

    return `ITEM-${index + 1}`;
}

function normalizeOrderItems(order = {}) {
    return resolveOrderItems(order).map((item, index) => {
        const quantity = Math.max(1, Number.parseInt(item?.quantidade || item?.quantity || 1, 10) || 1);
        const unitPrice = Number(item?.precoUnitario ?? item?.preco ?? 0);
        const subtotal = Number.isFinite(Number(item?.subtotal))
            ? Number(item.subtotal)
            : quantity * unitPrice;

        return {
            name: normalizeText(item?.nome || item?.description || 'Produto'),
            reference: buildItemReference(item, index),
            quantity,
            unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
            subtotal: Number.isFinite(subtotal) ? subtotal : 0,
            details: normalizeText(item?.details),
            baseName: normalizeText(item?.baseNome || item?.base_nome),
            custom: Boolean(item?.customized)
        };
    });
}

function buildOrderTotals(order = {}, items = []) {
    const computedSubtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const subtotal = Number.isFinite(Number(order?.subtotal)) ? Number(order.subtotal) : computedSubtotal;
    const shipping = Number.isFinite(Number(order?.envio)) ? Number(order.envio) : 0;
    const total = Number.isFinite(Number(order?.total)) ? Number(order.total) : subtotal + shipping;
    return {
        subtotal,
        shipping,
        total
    };
}

function renderOrderItemsText(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
        return '- Sem linhas registadas';
    }

    return items.map((item) => {
        const parts = [
            `${item.name} (${item.reference})`,
            `Qtd: ${item.quantity}`,
            `Unit.: ${formatCurrency(item.unitPrice)}`,
            `Subtotal: ${formatCurrency(item.subtotal)}`
        ];
        return `- ${parts.join(' | ')}`;
    }).join('\n');
}

function renderOrderItemsTableHtml(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<p style="margin:0;font-size:14px;line-height:22px;color:#5b6570;">Sem linhas registadas para esta encomenda.</p>';
    }

    const rows = items.map((item, index) => {
        const background = index % 2 === 0 ? '#f6fafc' : '#ffffff';
        const detailParts = [
            item.details,
            item.baseName ? `Base: ${item.baseName}` : ''
        ].filter(Boolean);

        return `
          <tr>
            <td style="padding:11px 10px;background:${background};border-bottom:1px solid #dfeaf0;font-size:12px;line-height:18px;color:#183642;font-weight:700;">${escapeHtml(item.name)}</td>
            <td style="padding:11px 8px;background:${background};border-bottom:1px solid #dfeaf0;font-size:11px;line-height:18px;color:#45606b;text-align:center;">${escapeHtml(item.reference)}</td>
            <td style="padding:11px 8px;background:${background};border-bottom:1px solid #dfeaf0;font-size:11px;line-height:18px;color:#183642;text-align:center;">${item.quantity}</td>
            <td style="padding:11px 8px;background:${background};border-bottom:1px solid #dfeaf0;font-size:11px;line-height:18px;color:#183642;text-align:right;white-space:nowrap;">${escapeHtml(formatCurrency(item.unitPrice))}</td>
            <td style="padding:11px 10px;background:${background};border-bottom:1px solid #dfeaf0;font-size:11px;line-height:18px;color:#45606b;text-align:right;white-space:nowrap;">${escapeHtml(formatCurrency(item.subtotal))}</td>
          </tr>
          ${detailParts.length ? `<tr><td colspan="5" style="padding:0 10px 12px;background:${background};border-bottom:1px solid #dfeaf0;font-size:11px;line-height:17px;color:#697983;">${escapeHtml(detailParts.join(' | '))}</td></tr>` : ''}
        `;
    }).join('');

    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #dfeaf0;">
        <thead>
          <tr>
            <th align="left" style="padding:12px 10px;background:#35bfd6;color:#ffffff;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;">Item</th>
            <th align="center" style="padding:12px 8px;background:#35bfd6;color:#ffffff;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;">Ref</th>
            <th align="center" style="padding:12px 8px;background:#35bfd6;color:#ffffff;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;">Qtd</th>
            <th align="right" style="padding:12px 8px;background:#35bfd6;color:#ffffff;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;">Preco unit.</th>
            <th align="right" style="padding:12px 10px;background:#35bfd6;color:#ffffff;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
}

function renderOrderSummaryTableHtml(totals = {}) {
    const rows = [
        ['Subtotal', formatCurrency(totals.subtotal)],
        ['Portes', formatCurrency(totals.shipping)],
        ['Total', formatCurrency(totals.total), true]
    ];

    return `
      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;min-width:240px;margin-left:auto;">
        ${rows.map(([label, value, highlight]) => `
          <tr>
            <td style="padding:10px 14px;border:1px solid #dfeaf0;background:${highlight ? '#35bfd6' : '#f7fbfc'};font-size:12px;line-height:18px;color:${highlight ? '#ffffff' : '#3f5661'};font-weight:${highlight ? '700' : '600'};text-transform:${highlight ? 'uppercase' : 'none'};">${escapeHtml(label)}</td>
            <td style="padding:10px 14px;border:1px solid #dfeaf0;background:${highlight ? '#d9f4f9' : '#ffffff'};font-size:12px;line-height:18px;color:#183642;font-weight:700;text-align:right;white-space:nowrap;">${escapeHtml(value)}</td>
          </tr>
        `).join('')}
      </table>
    `;
}

function renderOrderSummaryText(totals = {}) {
    return [
        `Subtotal: ${formatCurrency(totals.subtotal)}`,
        `Portes: ${formatCurrency(totals.shipping)}`,
        `Total: ${formatCurrency(totals.total)}`
    ].join('\n');
}

function buildOrderEmailContext({ req = null, order = null, customer = null, overrides = {} } = {}) {
    const baseUrl = getPublicBaseUrl(req);
    const normalizedOrder = order || {};
    const orderCode = String(normalizedOrder?.numero_encomenda || normalizedOrder?.code || overrides?.order?.code || 'IBF1234567890').trim();
    const trackingCode = normalizeTrackingCode(order) || orderCode;
    const status = String(normalizedOrder?.status || overrides?.order?.status || 'em_preparacao').trim();
    const invoiceStatus = String(normalizedOrder?.facturalusa_status || overrides?.invoice?.status || 'pending').trim();
    const trackingPath = SiteRoutes.buildOrderPath(trackingCode || orderCode);
    const trackingUrl = `${baseUrl}${trackingPath}`;
    const resolvedCustomer = resolveEmailCustomer(normalizedOrder, customer || overrides?.customer || {});
    const items = normalizeOrderItems(normalizedOrder);
    const totals = buildOrderTotals(normalizedOrder, items);
    const createdAt = normalizedOrder?.created_at || overrides?.order?.created_at || new Date().toISOString();
    const invoiceDocumentNumber = normalizeText(
        normalizedOrder?.facturalusa_document_number || overrides?.invoice?.document_number || ''
    );

    return {
        customer: {
            name: resolvedCustomer.name,
            email: resolvedCustomer.email,
            phone: resolvedCustomer.phone,
            tax_id: resolvedCustomer.taxId,
            company: resolvedCustomer.company,
            type_label: resolvedCustomer.type === 'empresa' ? 'Empresa' : 'Particular',
            address_line_1: resolvedCustomer.billing.line1,
            address_line_2: resolvedCustomer.billing.line2,
            address_compact: resolvedCustomer.billing.compact,
            shipping_address_line_1: resolvedCustomer.shipping.line1,
            shipping_address_line_2: resolvedCustomer.shipping.line2,
            shipping_address_compact: resolvedCustomer.shipping.compact
        },
        order: {
            code: orderCode,
            date_short: formatDateShort(createdAt),
            total: formatCurrency(totals.total),
            subtotal: formatCurrency(totals.subtotal),
            shipping: formatCurrency(totals.shipping),
            status,
            status_label: STATUS_LABELS[status] || status || 'Em Preparacao',
            tracking_code: trackingCode,
            tracking_url: trackingUrl,
            item_count: items.length,
            items_table_html: renderOrderItemsTableHtml(items),
            items_text: renderOrderItemsText(items),
            summary_table_html: renderOrderSummaryTableHtml(totals),
            summary_text: renderOrderSummaryText(totals)
        },
        invoice: {
            status: invoiceStatus,
            status_label: INVOICE_STATUS_LABELS[invoiceStatus] || invoiceStatus || 'A emitir',
            document_number: invoiceDocumentNumber
        },
        company: {
            name: String(process.env.MAIL_COMPANY_NAME || 'IberFlag'),
            website: baseUrl
        },
        brand: {
            logo_url: `${baseUrl}/assets/logos/logo-completo.svg`
        },
        support: {
            email: String(
                process.env.SUPPORT_EMAIL
                || process.env.RESEND_REPLY_TO
                || process.env.RESEND_FROM_EMAIL
                || process.env.SMTP_REPLY_TO
                || process.env.SMTP_FROM_EMAIL
                || 'geral@iberflag.com'
            ),
            phone: String(process.env.SUPPORT_PHONE || process.env.CONTACT_PHONE || '').trim()
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
