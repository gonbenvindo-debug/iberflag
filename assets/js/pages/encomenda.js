const orderLoading = document.getElementById('order-loading');
const orderNotFound = document.getElementById('order-not-found');
const orderError = document.getElementById('order-error');
const orderErrorMessage = document.getElementById('order-error-message');
const orderDetail = document.getElementById('order-detail');
const itemPreviewModal = document.getElementById('item-preview-modal');
const itemPreviewCloseBtn = document.getElementById('item-preview-close');
const itemPreviewTitle = document.getElementById('item-preview-title');
const itemPreviewImage = document.getElementById('item-preview-image');
const itemPreviewOptions = document.getElementById('item-preview-options');
const itemPreviewDownload = document.getElementById('item-preview-download');
const orderCopyCodeBtn = document.getElementById('order-copy-code-btn');
const orderCopyTrackingBtn = document.getElementById('order-copy-tracking-btn');

let renderedItemPreviews = [];
const ES_TEXT = {
    'Sem estado': 'Sin estado',
    'Em Preparacao': 'En preparacion',
    'Em Producao': 'En produccion',
    'Expedido': 'Expedido',
    'Entregue': 'Entregado',
    'atualizado em': 'actualizado el',
    'Criada em': 'Creada el',
    'Nada para copiar.': 'Nada que copiar.',
    'Nao foi possivel copiar automaticamente.': 'No fue posible copiar automaticamente.',
    'Faturacao': 'Facturacion',
    'Ainda nao disponivel': 'Todavia no disponible',
    'Disponivel no email de confirmacao': 'Disponible en el email de confirmacion',
    'Em emissao': 'En emision',
    'Apos pagamento': 'Tras el pago',
    'A emitir automaticamente': 'Emision automatica en curso',
    'Documento': 'Documento',
    'Qtd': 'Ud.',
    '/ un.': '/ ud.',
    'Sem opcoes registadas': 'Sin opciones registradas',
    'opcoes adicionais': 'opciones adicionales',
    'Sem produtos associados a esta encomenda.': 'Sin productos asociados a este pedido.',
    'Sem notas adicionais.': 'Sin notas adicionales.',
    'Emissao pendente. A nossa equipa esta a validar.': 'Emision pendiente. Nuestro equipo la esta validando.',
    'A aguardar emissao automatica': 'Esperando la emision automatica',
    'Disponivel apos confirmacao do pagamento': 'Disponible tras la confirmacion del pago',
    'O pagamento ainda nao foi confirmado. Assim que entrar, a equipa pode avancar para a validacao do pedido.': 'El pago aun no ha sido confirmado. En cuanto entre, el equipo podra avanzar con la validacion del pedido.',
    'Pagamento confirmado. A encomenda ja esta em fila operacional e pode ser atualizada pela equipa em tempo real.': 'Pago confirmado. El pedido ya esta en cola operativa y puede actualizarse por el equipo en tiempo real.',
    'A fatura ja foi emitida e pode ser aberta diretamente a partir desta pagina.': 'La factura ya ha sido emitida y puede abrirse directamente desde esta pagina.',
    'A emissao fiscal esta a ser tratada automaticamente. Se houver atraso, a equipa consegue reemitir manualmente no painel.': 'La emision fiscal se esta tramitando automaticamente. Si hubiera retraso, el equipo puede reemitirla manualmente desde el panel.',
    'Estamos a validar ficheiros e a preparar a producao do teu material.': 'Estamos validando archivos y preparando la produccion de su material.',
    'A encomenda ja esta em producao. O proximo passo normal e expedicao.': 'El pedido ya esta en produccion. El siguiente paso habitual es la expedicion.',
    'A encomenda ja saiu para entrega. Use o tracking': 'El pedido ya ha salido para entrega. Use el seguimiento',
    'para acompanhar o percurso.': 'para seguir el recorrido.',
    'A encomenda ja foi expedida. O tracking ficara visivel assim que estiver disponivel.': 'El pedido ya ha sido expedido. El seguimiento sera visible en cuanto este disponible.',
    'A encomenda aparece como entregue. Se precisar de apoio, use o botao de contacto e responda com o codigo IBF.': 'El pedido figura como entregado. Si necesita ayuda, use el boton de contacto y responda con el codigo IBF.',
    'Sem passos adicionais para mostrar neste momento.': 'No hay pasos adicionales que mostrar en este momento.',
    'Codigo da encomenda copiado.': 'Codigo del pedido copiado.',
    'Codigo de tracking copiado.': 'Codigo de seguimiento copiado.',
    'Apoio a encomenda': 'Ayuda con el pedido',
    'Documento fiscal indisponivel.': 'Documento fiscal no disponible.',
    'O PDF da fatura ainda esta a ser preparado.': 'El PDF de la factura aun se esta preparando.',
    'Nao foi possivel consultar o estado da encomenda neste momento.': 'No fue posible consultar el estado del pedido en este momento.',
    'Ocorreu um problema tecnico ao consultar esta encomenda. Tente novamente dentro de momentos.': 'Se produjo un problema tecnico al consultar este pedido. Intentelo de nuevo dentro de unos instantes.',
    'Encomenda registada': 'Pedido registrado',
    'Pagamento confirmado': 'Pago confirmado',
    'Pagamento em processamento': 'Pago en procesamiento',
    'A aguardar pagamento': 'Esperando pago',
    'Pagamento falhou': 'El pago ha fallado',
    'Sessao expirada': 'Sesion expirada',
    'Pagamento online': 'Pago online',
    'Abrir fatura': 'Abrir factura',
    'PDF em emissao': 'PDF en emision'
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function i18nText(value) {
    const locale = window.IberFlagI18n?.getLocale?.()
        || (typeof SiteRoutes !== 'undefined' && typeof SiteRoutes.getLocaleFromPathname === 'function'
            ? SiteRoutes.getLocaleFromPathname(window.location.pathname)
            : (window.location.pathname === '/es' || window.location.pathname.startsWith('/es/') ? 'es' : 'pt'));

    if (locale === 'es' && Object.prototype.hasOwnProperty.call(ES_TEXT, value)) {
        return ES_TEXT[value];
    }

    return window.IberFlagI18n?.translateText
        ? window.IberFlagI18n.translateText(value)
        : value;
}

function getCurrentLocaleTag() {
    return window.IberFlagI18n?.getLocale?.() === 'es' ? 'es-ES' : 'pt-PT';
}

function buildWorkflowLabelWithGradeHtml(statusValue) {
    const label = typeof getWorkflowStatusLabel === 'function'
        ? getWorkflowStatusLabel(statusValue)
        : i18nText(String(statusValue || 'Sem estado'));
    return escapeHtml(label);
}

function getOrderProgressSteps(workflowStatus, splitMeta) {
    const defaultSteps = [
        { value: 'em_preparacao', label: i18nText('Em Preparacao') },
        { value: 'em_producao', label: i18nText('Em Producao') },
        { value: 'expedido', label: i18nText('Expedido') },
        { value: 'entregue', label: i18nText('Entregue') }
    ];
    const sourceSteps = Array.isArray(window.ORDER_WORKFLOW_STEPS) && window.ORDER_WORKFLOW_STEPS.length > 0
        ? window.ORDER_WORKFLOW_STEPS
        : defaultSteps;

    return sourceSteps.filter((step) => ['em_preparacao', 'em_producao', 'expedido', 'entregue'].includes(step.value));
}

function getOrderStepDateMap(splitMeta) {
    const history = Array.isArray(splitMeta?.meta?.statusHistory) ? splitMeta.meta.statusHistory : [];
    const map = new Map();

    history.forEach((entry) => {
        const normalizedStatus = typeof normalizeWorkflowStatusValue === 'function'
            ? normalizeWorkflowStatusValue(entry?.status)
            : String(entry?.status || '').trim().toLowerCase();
        const rawDate = entry?.at || entry?.date || entry?.created_at || null;

        if (!normalizedStatus || !rawDate) {
            return;
        }

        const existing = map.get(normalizedStatus);
        if (!existing || new Date(rawDate) > new Date(existing)) {
            map.set(normalizedStatus, rawDate);
        }
    });

    return map;
}

function renderOrderProgress(order, workflowStatus, splitMeta) {
    const progressEl = document.getElementById('order-progressbar');
    const summaryEl = document.getElementById('order-progress-summary');
    const normalizedStatus = typeof normalizeWorkflowStatusValue === 'function'
        ? normalizeWorkflowStatusValue(workflowStatus)
        : String(workflowStatus || '').trim();

    if (!progressEl) {
        return;
    }

    const steps = getOrderProgressSteps(normalizedStatus, splitMeta);
    const stepDateMap = getOrderStepDateMap(splitMeta);
    let currentIndex = steps.findIndex((step) => step.value === normalizedStatus);
    if (currentIndex === -1) {
        currentIndex = Math.max(0, steps.findIndex((step) => step.value === 'em_preparacao'));
    }

    const progressPercent = steps.length <= 1
        ? 100
        : Math.max(0, Math.min(100, (currentIndex / (steps.length - 1)) * 100));

    progressEl.style.setProperty('--order-progress-count', String(steps.length));
    progressEl.style.setProperty('--order-progress-width', `${progressPercent}%`);
    progressEl.style.setProperty('--order-progress-min-width', `${Math.max(360, steps.length * 96)}px`);
    progressEl.setAttribute('aria-valuemin', '0');
    progressEl.setAttribute('aria-valuemax', String(Math.max(0, steps.length - 1)));
    progressEl.setAttribute('aria-valuenow', String(currentIndex));
    progressEl.setAttribute('aria-valuetext', typeof getWorkflowStatusLabel === 'function'
        ? getWorkflowStatusLabel(normalizedStatus)
        : normalizedStatus);
    progressEl.innerHTML = steps.map((step, index) => {
        const status = index < currentIndex
            ? 'complete'
            : index === currentIndex
                ? 'current'
                : 'upcoming';
        const label = step.label || (typeof getWorkflowStatusLabel === 'function' ? getWorkflowStatusLabel(step.value) : step.value);
        const stepDate = stepDateMap.get(step.value);
        const stepDateLabel = stepDate ? formatDateTime(stepDate) : '-';

        return `
            <div class="order-progress-step is-${status}" data-progress-step="${escapeHtml(step.value)}">
                <div class="order-progress-marker" aria-hidden="true">${escapeHtml(index + 1)}</div>
                <div class="order-progress-copy">
                    <span class="order-progress-label">${escapeHtml(label)}</span>
                    <span class="order-progress-date">${escapeHtml(stepDateLabel)}</span>
                </div>
            </div>
        `;
    }).join('');

    if (summaryEl) {
        const currentStep = steps[currentIndex] || {};
        const currentLabel = currentStep.label || (typeof getWorkflowStatusLabel === 'function'
            ? getWorkflowStatusLabel(normalizedStatus)
            : normalizedStatus || i18nText('Sem estado'));
        const updatedAt = order?.updated_at || order?.created_at;
        summaryEl.textContent = `${currentLabel}${updatedAt ? ` • ${i18nText('atualizado em')} ${formatDateTime(updatedAt)}` : ''}`;
    }
}

function formatCurrency(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat(getCurrentLocaleTag(), {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString(getCurrentLocaleTag());
}

function normalizeOrderCode(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

async function copyTextToClipboard(value, successMessage) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        showToast(i18nText('Nada para copiar.'), 'warning');
        return;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(normalized);
        } else {
            const helper = document.createElement('textarea');
            helper.value = normalized;
            helper.setAttribute('readonly', '');
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            document.execCommand('copy');
            helper.remove();
        }

        showToast(successMessage, 'success');
    } catch (error) {
        console.error('Falha ao copiar texto:', error);
        showToast(i18nText('Nao foi possivel copiar automaticamente.'), 'error');
    }
}

function sanitizeFilenameToken(value) {
    return String(value || 'encomenda')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'encomenda';
}

function normalizeExternalUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '#') {
        return '';
    }

    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }

    if (raw.startsWith('//')) {
        return `https:${raw}`;
    }

    if (raw.startsWith('www.')) {
        return `https://${raw}`;
    }

    if (raw.startsWith('/')) {
        return raw;
    }

    return `https://${raw}`;
}

function resolveInvoiceDocumentDetails(order, splitMeta) {
    const meta = splitMeta?.meta || {};
    const metaPayload = meta?.facturalusaPayload && typeof meta.facturalusaPayload === 'object'
        ? meta.facturalusaPayload
        : {};
    const rowPayload = order?.facturalusa_payload && typeof order.facturalusa_payload === 'object'
        ? order.facturalusa_payload
        : {};

    const invoiceUrl = [
        order?.facturalusa_document_url,
        meta?.facturalusaDocumentUrl,
        metaPayload?.url_file,
        metaPayload?.url,
        rowPayload?.url_file,
        rowPayload?.url
    ]
        .map((candidate) => normalizeExternalUrl(candidate))
        .find(Boolean) || '';

    const documentNumber = String(
        order?.facturalusa_document_number
        || meta?.facturalusaDocumentNumber
        || metaPayload?.document_full_number
        || metaPayload?.number
        || metaPayload?.reference
        || rowPayload?.document_full_number
        || rowPayload?.number
        || rowPayload?.reference
        || ''
    ).trim();

    return { invoiceUrl, documentNumber };
}

function resolveOrderItemSnapshot(orderMeta, item, index) {
    const snapshots = Array.isArray(orderMeta?.itemSnapshots) ? orderMeta.itemSnapshots : [];
    const byIndex = snapshots[index];
    if (byIndex) {
        return byIndex;
    }

    const itemDesignId = String(item?.design_id || item?.designId || '').trim();
    if (itemDesignId) {
        const byDesignId = snapshots.find((entry) => String(entry?.designId || '').trim() === itemDesignId);
        if (byDesignId) {
            return byDesignId;
        }
    }

    return snapshots.find((entry) => Number(entry.produtoId) === Number(item?.produto_id)) || null;
}

function parseJsonSafe(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            return JSON.parse(trimmed);
        } catch (error) {
            return null;
        }
    }

    return null;
}

function normalizeOptionLabel(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pushOptionEntries(entries, key, value) {
    if (value === null || value === undefined) {
        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return;
        }

        const arePrimitiveValues = value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry));
        if (arePrimitiveValues) {
            entries.push({
                label: normalizeOptionLabel(key || 'Opcoes'),
                value: value.map((entry) => String(entry)).join(', ')
            });
            return;
        }

        value.forEach((entry, index) => {
            pushOptionEntries(entries, `${key || 'Opcao'} ${index + 1}`, entry);
        });
        return;
    }

    if (typeof value === 'object') {
        Object.entries(value).forEach(([entryKey, entryValue]) => {
            const baseLabel = key ? `${key} ${normalizeOptionLabel(entryKey)}` : normalizeOptionLabel(entryKey);
            pushOptionEntries(entries, baseLabel, entryValue);
        });
        return;
    }

    const normalizedValue = String(value).trim();
    if (!normalizedValue) {
        return;
    }

    entries.push({
        label: normalizeOptionLabel(key || 'Opcao'),
        value: normalizedValue
    });
}

function extractOrderItemOptions(item, snapshot) {
    const entries = [];

    const directCandidates = [
        item?.opcoes_compradas,
        item?.opcoes,
        item?.options,
        item?.variacoes,
        item?.variacao,
        snapshot?.opcoes_compradas,
        snapshot?.opcoes,
        snapshot?.options,
        snapshot?.variacoes,
        snapshot?.variacao
    ];

    directCandidates.forEach((candidate) => {
        if (candidate === null || candidate === undefined || candidate === '') {
            return;
        }

        if (typeof candidate === 'string') {
            const parsed = parseJsonSafe(candidate);
            if (parsed !== null) {
                pushOptionEntries(entries, 'Opcao', parsed);
                return;
            }

            entries.push({ label: 'Detalhe', value: candidate.trim() });
            return;
        }

        pushOptionEntries(entries, 'Opcao', candidate);
    });

    if (entries.length > 0) {
        return deduplicateOptions(entries);
    }

    const ignoredFields = new Set([
        'id',
        'encomenda_id',
        'produto_id',
        'produtos',
        'quantidade',
        'preco_unitario',
        'subtotal',
        'created_at',
        'updated_at',
        'design_svg',
        'design_preview',
        'preview_design',
        'personalizacao_svg',
        'design',
        'nome_produto',
        'imagem_produto',
        'produtoId',
        'nome',
        'precoUnitario',
        'imagem',
        'designPreview'
    ]);

    [item, snapshot].forEach((source) => {
        if (!source || typeof source !== 'object') {
            return;
        }

        Object.entries(source).forEach(([key, rawValue]) => {
            if (ignoredFields.has(key)) {
                return;
            }

            if (rawValue === null || rawValue === undefined || rawValue === '') {
                return;
            }

            const parsed = typeof rawValue === 'string' ? parseJsonSafe(rawValue) : null;
            if (parsed !== null) {
                pushOptionEntries(entries, key, parsed);
                return;
            }

            if (typeof rawValue === 'object') {
                pushOptionEntries(entries, key, rawValue);
                return;
            }

            pushOptionEntries(entries, key, rawValue);
        });
    });

    return deduplicateOptions(entries);
}

function deduplicateOptions(entries) {
    const seen = new Set();
    return entries.filter((entry) => {
        const label = String(entry?.label || '').trim();
        const value = String(entry?.value || '').trim();

        if (!label || !value) {
            return false;
        }

        const key = `${label}::${value}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function buildOptionsSummary(options) {
    if (!Array.isArray(options) || options.length === 0) {
        return i18nText('Sem opcoes registadas');
    }

    if (options.length <= 2) {
        return options.map((option) => `${option.label}: ${option.value}`).join(' | ');
    }

    const preview = options
        .slice(0, 2)
        .map((option) => `${option.label}: ${option.value}`)
        .join(' | ');

    return `${preview} | +${options.length - 2} ${i18nText('opcoes adicionais')}`;
}

function resolveOrderItemVisual(item, snapshot) {
    const designCandidates = [
        item?.design_svg,
        item?.design,
        item?.personalizacao_svg,
        snapshot?.design
    ];

    const designSvg = designCandidates.find((value) => typeof value === 'string' && value.trim()) || '';

    // Explicit raster preview (actual design render, not product image)
    const explicitPreview = [item?.design_preview, item?.preview_design, snapshot?.designPreview]
        .find((value) => typeof value === 'string' && value.trim()) || '';

    // Product store image as a final fallback only.
    const fallbackImage = [item?.imagem_produto, snapshot?.imagem, item?.produtos?.imagem]
        .find((value) => typeof value === 'string' && value.trim()) || '';

    const productSvgTemplate = [
        item?.produtos?.svg_template,
        snapshot?.svgTemplate,
        snapshot?.svg_template
    ].find((value) => typeof value === 'string' && value.trim()) || '';

    const normalizedPreviewUrl = (
        designSvg
        && productSvgTemplate
        && window.DesignSvgStore?.buildNormalizedProductPreviewDataUrl
    )
        ? window.DesignSvgStore.buildNormalizedProductPreviewDataUrl({
            designSvg,
            productSvg: productSvgTemplate,
            fillRatio: 0.9,
            includeOutline: true,
            backgroundColor: 'transparent'
        })
        : '';

    const designDataUrl = normalizedPreviewUrl || ((designSvg && typeof buildSvgDataUrl === 'function') ? buildSvgDataUrl(designSvg) : '');
    const hasDesign = Boolean(designSvg || explicitPreview);

    // Priority: SVG design -> explicit preview -> product image fallback.
    return {
        designSvg,
        previewUrl: designDataUrl || explicitPreview || fallbackImage,
        hasDesign
    };
}

function renderOrderHeader(order, workflowStatus) {
    const statusLabel = typeof getWorkflowStatusLabel === 'function' ? getWorkflowStatusLabel(workflowStatus) : workflowStatus;

    document.getElementById('order-number').textContent = order.numero_encomenda || `#${order.id}`;
    document.getElementById('order-created-at').textContent = `${i18nText('Criada em')} ${formatDateTime(order.created_at)}`;
    document.getElementById('order-total').textContent = formatCurrency(order.total);
    const statusBadgeEl = document.getElementById('order-status-badge');
    if (statusBadgeEl) {
        statusBadgeEl.className = 'inline-flex items-center gap-2 mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-700';
        statusBadgeEl.innerHTML = buildWorkflowLabelWithGradeHtml(workflowStatus || statusLabel);
    }
}

function buildOrderNextSteps(order, workflowStatus, splitMeta) {
    const paymentStatus = String(order?.payment_status || splitMeta?.meta?.paymentStatus || '').toLowerCase();
    const fiscalStatus = typeof getFacturalusaStatus === 'function'
        ? getFacturalusaStatus(order)
        : 'not_required';
    const tracking = typeof getTrackingDetails === 'function'
        ? getTrackingDetails(order)
        : { trackingCode: '', trackingUrl: '' };
    const steps = [];

    if (paymentStatus !== 'paid') {
        steps.push(i18nText('O pagamento ainda nao foi confirmado. Assim que entrar, a equipa pode avancar para a validacao do pedido.'));
    } else {
        steps.push(i18nText('Pagamento confirmado. A encomenda ja esta em fila operacional e pode ser atualizada pela equipa em tempo real.'));
    }

    if (fiscalStatus === 'emitted') {
        steps.push(i18nText('A fatura ja foi emitida e pode ser aberta diretamente a partir desta pagina.'));
    } else if (paymentStatus === 'paid') {
        steps.push(i18nText('A emissao fiscal esta a ser tratada automaticamente. Se houver atraso, a equipa consegue reemitir manualmente no painel.'));
    }

    if (workflowStatus === 'em_preparacao') {
        steps.push(i18nText('Estamos a validar ficheiros e a preparar a producao do teu material.'));
    } else if (workflowStatus === 'em_producao') {
        steps.push(i18nText('A encomenda ja esta em producao. O proximo passo normal e expedicao.'));
    } else if (workflowStatus === 'expedido') {
        steps.push(tracking.trackingCode
            ? `${i18nText('A encomenda ja saiu para entrega. Use o tracking')} ${tracking.trackingCode} ${i18nText('para acompanhar o percurso.')}`
            : i18nText('A encomenda ja foi expedida. O tracking ficara visivel assim que estiver disponivel.'));
    } else if (workflowStatus === 'entregue') {
        steps.push(i18nText('A encomenda aparece como entregue. Se precisar de apoio, use o botao de contacto e responda com o codigo IBF.'));
    }

    return steps.slice(0, 4);
}

function renderOrderOperationalPanels(order, workflowStatus, splitMeta) {
    const tracking = typeof getTrackingDetails === 'function'
        ? getTrackingDetails(order)
        : { trackingCode: '', trackingUrl: '' };
    const orderCode = String(order?.numero_encomenda || '').trim();
    const trackingCodeEl = document.getElementById('order-tracking-code-inline');
    if (trackingCodeEl) {
        trackingCodeEl.textContent = tracking.trackingCode || i18nText('Ainda nao disponivel');
    }

    if (orderCopyCodeBtn) {
        orderCopyCodeBtn.onclick = () => copyTextToClipboard(orderCode, i18nText('Codigo da encomenda copiado.'));
        orderCopyCodeBtn.disabled = !orderCode;
    }

    if (orderCopyTrackingBtn) {
        const hasTracking = Boolean(tracking.trackingCode);
        orderCopyTrackingBtn.onclick = () => copyTextToClipboard(tracking.trackingCode, i18nText('Codigo de tracking copiado.'));
        orderCopyTrackingBtn.disabled = !hasTracking;
        orderCopyTrackingBtn.classList.toggle('opacity-50', !hasTracking);
        orderCopyTrackingBtn.classList.toggle('cursor-not-allowed', !hasTracking);
        orderCopyTrackingBtn.setAttribute('aria-disabled', String(!hasTracking));
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderStatusTable(order, workflowStatus, splitMeta) {
    const statusTableBody = document.getElementById('order-status-table-body');
    if (!statusTableBody) {
        return;
    }
    const history = Array.isArray(splitMeta?.meta?.statusHistory)
        ? splitMeta.meta.statusHistory
        : [];

    const rows = history.length > 0
        ? history
            .slice()
            .sort((a, b) => new Date(b.at) - new Date(a.at))
            .map((entry) => ({
                status: entry.status,
                at: entry.at,
                note: entry.note || ''
            }))
        : [
            {
                status: workflowStatus,
                at: order.created_at,
                note: i18nText('Encomenda registada')
            }
        ];

    statusTableBody.innerHTML = rows.map((row) => `
        <tr>
            <td class="text-sm font-semibold text-gray-800">
                <span class="inline-flex items-center gap-2">${buildWorkflowLabelWithGradeHtml(row.status)}</span>
            </td>
            <td class="text-sm text-gray-600">${escapeHtml(formatDateTime(row.at))}</td>
            <td class="text-sm text-gray-600">${escapeHtml(row.note || '-')}</td>
        </tr>
    `).join('');
}

function renderOrderItems(order, items, splitMeta) {
    const orderItemsEl = document.getElementById('order-items');
    const snapshots = Array.isArray(splitMeta?.meta?.itemSnapshots) ? splitMeta.meta.itemSnapshots : [];

    const listSource = Array.isArray(items) && items.length > 0
        ? items
        : snapshots.map((snapshot) => ({
            produto_id: snapshot.produtoId,
            quantidade: snapshot.quantidade,
            preco_unitario: snapshot.precoUnitario,
            subtotal: snapshot.precoUnitario * snapshot.quantidade,
            produtos: {
                nome: snapshot.nome,
                imagem: snapshot.imagem
            }
        }));

    renderedItemPreviews = [];

    if (!Array.isArray(listSource) || listSource.length === 0) {
        orderItemsEl.innerHTML = `
            <div class="order-info-block">
                <div class="order-info-value text-gray-500">${escapeHtml(i18nText('Sem produtos associados a esta encomenda.'))}</div>
            </div>
        `;
        return;
    }

    const rowsHtml = listSource.map((item, index) => {
        const snapshot = resolveOrderItemSnapshot(splitMeta.meta, item, index);
        const productName = item?.produtos?.nome || snapshot?.nome || `Produto #${item.produto_id || index + 1}`;
        const quantity = Number(item.quantidade || snapshot?.quantidade || 1);
        const unitPrice = Number(item.preco_unitario || snapshot?.precoUnitario || 0);
        const lineSubtotal = Number(item.subtotal || (quantity * unitPrice));
        return `
            <tr>
                <td class="order-summary-product">${escapeHtml(productName)}</td>
                <td class="order-summary-qty">${escapeHtml(quantity)}</td>
                <td class="order-summary-unit">${escapeHtml(formatCurrency(unitPrice))}</td>
                <td class="order-summary-line">${escapeHtml(formatCurrency(lineSubtotal))}</td>
            </tr>
        `;
    }).join('');

    const listTotal = listSource.reduce((sum, item) => {
        const quantity = Number(item.quantidade || 1);
        const unitPrice = Number(item.preco_unitario || 0);
        const lineSubtotal = Number(item.subtotal || (quantity * unitPrice));
        return sum + (Number.isFinite(lineSubtotal) ? lineSubtotal : 0);
    }, 0);
    const finalTotal = Number.isFinite(listTotal)
        ? listTotal
        : Number(order?.total || 0);

    orderItemsEl.innerHTML = `
        <div class="order-summary-table-wrap">
            <table class="order-summary-table">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3">Total</td>
                        <td>${escapeHtml(formatCurrency(finalTotal))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

function renderItemPreviewOptions(options) {
    if (!itemPreviewOptions) {
        return;
    }

    if (!Array.isArray(options) || options.length === 0) {
        itemPreviewOptions.innerHTML = `<p class="text-sm text-gray-500">${escapeHtml(i18nText('Sem opcoes registadas'))}</p>`;
        return;
    }

    itemPreviewOptions.innerHTML = options.map((entry) => `
        <div class="flex flex-wrap gap-1.5 text-sm">
            <span class="font-semibold text-gray-700">${escapeHtml(entry.label)}:</span>
            <span class="text-gray-600 break-all">${escapeHtml(entry.value)}</span>
        </div>
    `).join('');
}

function openItemPreview(index) {
    const data = renderedItemPreviews[index];
    if (!data || !itemPreviewModal || !itemPreviewTitle || !itemPreviewImage) {
        return;
    }

    itemPreviewTitle.textContent = data.productName || 'Produto';
    itemPreviewImage.src = data.previewUrl || '/favicon.svg';
    itemPreviewImage.alt = data.productName || 'Preview';
    itemPreviewImage.classList.toggle('design-preview-surface', Boolean(data.hasDesign));
    if (itemPreviewOptions) {
        renderItemPreviewOptions(data.options);
        itemPreviewOptions.classList.remove('hidden');
    }

    if (itemPreviewDownload) {
        itemPreviewDownload.classList.add('hidden');
        itemPreviewDownload.removeAttribute('href');
    }

    itemPreviewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeItemPreview() {
    if (!itemPreviewModal) {
        return;
    }

    itemPreviewModal.classList.add('hidden');
    document.body.style.overflow = '';
}

async function loadOrderByCode(orderCode) {
    try {
        const response = await fetch(`/api/checkout/session-status?codigo=${encodeURIComponent(orderCode)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const payload = await response.json().catch(() => ({}));
            if (payload?.order) {
                return {
                    order: {
                        ...payload.order,
                        notas: payload.order.notas || ''
                    },
                    items: Array.isArray(payload.items) ? payload.items : []
                };
            }

            return null;
        }

        throw new Error(`ORDER_STATUS_API_${response.status}`);
    } catch (apiError) {
        console.warn('Falha ao carregar encomenda via API de sessao:', apiError);
        throw apiError;
    }
}

function showNotFound() {
    orderLoading.classList.add('hidden');
    orderDetail.classList.add('hidden');
    orderError?.classList.add('hidden');
    orderNotFound.classList.remove('hidden');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function showOrderError(message) {
    orderLoading.classList.add('hidden');
    orderDetail.classList.add('hidden');
    orderNotFound.classList.add('hidden');
    if (orderErrorMessage) {
        orderErrorMessage.textContent = message;
    }
    orderError?.classList.remove('hidden');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getOrderLoadErrorMessage(error) {
    const rawMessage = String(error?.message || error?.details || error?.hint || '').toLowerCase();

    if (rawMessage.includes('session-status') || rawMessage.includes('checkout/session-status')) {
        return i18nText('Nao foi possivel consultar o estado da encomenda neste momento.');
    }

    return i18nText('Ocorreu um problema tecnico ao consultar esta encomenda. Tente novamente dentro de momentos.');
}

async function initOrderPage() {
    const params = new URLSearchParams(window.location.search);
    const routeMatch = typeof SiteRoutes !== 'undefined' && typeof SiteRoutes.parseLocationPath === 'function'
        ? SiteRoutes.parseLocationPath(window.location.pathname)
        : null;
    const code = normalizeOrderCode(routeMatch?.orderCode || params.get('codigo'));

    if (!code) {
        showNotFound();
        return;
    }

    if (routeMatch?.orderCode && window.location.search) {
        const cleanPath = typeof SiteRoutes !== 'undefined' && typeof SiteRoutes.buildOrderPath === 'function'
            ? SiteRoutes.buildOrderPath(code)
            : `/encomenda/${encodeURIComponent(code)}`;
        window.history.replaceState({}, '', cleanPath);
    }

    try {
        const result = await loadOrderByCode(code);

        if (!result?.order) {
            showNotFound();
            return;
        }

        const splitMeta = typeof splitOrderNotesAndMeta === 'function'
            ? splitOrderNotesAndMeta(result.order.notas)
            : { publicNotes: result.order.notas || '', meta: {} };

        const workflowStatus = typeof deriveWorkflowStatus === 'function'
            ? deriveWorkflowStatus(result.order)
            : result.order.status;

        renderOrderHeader(result.order, workflowStatus);
        renderOrderProgress(result.order, workflowStatus, splitMeta);
        renderOrderOperationalPanels(result.order, workflowStatus, splitMeta);
        renderOrderItems(result.order, result.items, splitMeta);

        orderLoading.classList.add('hidden');
        orderNotFound.classList.add('hidden');
        orderError?.classList.add('hidden');
        orderDetail.classList.remove('hidden');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Erro ao carregar encomenda:', error);
        const message = getOrderLoadErrorMessage(error);
        showToast(message, 'error');
        showOrderError(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const orderItemsContainer = document.getElementById('order-items');

    if (orderItemsContainer) {
        orderItemsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('[data-preview-index]');
            if (!button) {
                return;
            }

            openItemPreview(Number(button.getAttribute('data-preview-index')));
        });
    }

    if (itemPreviewCloseBtn) {
        itemPreviewCloseBtn.addEventListener('click', closeItemPreview);
    }

    if (itemPreviewModal) {
        itemPreviewModal.addEventListener('click', (event) => {
            if (event.target === itemPreviewModal) {
                closeItemPreview();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && itemPreviewModal && !itemPreviewModal.classList.contains('hidden')) {
            closeItemPreview();
        }
    });

    initOrderPage();
});


