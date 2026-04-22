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
const orderOpenDocumentBtn = document.getElementById('order-open-document-btn');
const orderContactSupportBtn = document.getElementById('order-contact-support-btn');

let renderedItemPreviews = [];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildWorkflowLabelWithGradeHtml(statusValue) {
    const label = typeof getWorkflowStatusLabel === 'function'
        ? getWorkflowStatusLabel(statusValue)
        : String(statusValue || 'Sem estado');
    return escapeHtml(label);
}

function getOrderProgressSteps(workflowStatus, splitMeta) {
    const defaultSteps = [
        { value: 'em_preparacao', label: 'Em Preparacao' },
        { value: 'em_producao', label: 'Em Produ??o' },
        { value: 'expedido', label: 'Expedido' },
        { value: 'entregue', label: 'Entregue' }
    ];
    const sourceSteps = Array.isArray(window.ORDER_WORKFLOW_STEPS) && window.ORDER_WORKFLOW_STEPS.length > 0
        ? window.ORDER_WORKFLOW_STEPS
        : defaultSteps;

    return sourceSteps.filter((step) => ['em_preparacao', 'em_producao', 'expedido', 'entregue'].includes(step.value));
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

        return `
            <div class="order-progress-step is-${status}" data-progress-step="${escapeHtml(step.value)}">
                <div class="order-progress-marker" aria-hidden="true">${escapeHtml(index + 1)}</div>
                <div class="order-progress-copy">
                    <span class="order-progress-label">${escapeHtml(label)}</span>
                </div>
            </div>
        `;
    }).join('');

    if (summaryEl) {
        const currentStep = steps[currentIndex] || {};
        const currentLabel = currentStep.label || (typeof getWorkflowStatusLabel === 'function'
            ? getWorkflowStatusLabel(normalizedStatus)
            : normalizedStatus || 'Sem estado');
        const updatedAt = order?.updated_at || order?.created_at;
        summaryEl.textContent = `${currentLabel}${updatedAt ? ` · atualizado em ${formatDateTime(updatedAt)}` : ''}`;
    }
}

function formatCurrency(value) {
    const amount = Number(value || 0);
    return `${amount.toFixed(2)}€`;
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-PT');
}

function normalizeOrderCode(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

async function copyTextToClipboard(value, successMessage) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        showToast('Nada para copiar.', 'warning');
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
        showToast('Não foi possível copiar automaticamente.', 'error');
    }
}

function sanitizeFilenameToken(value) {
    return String(value || 'encomenda')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'encomenda';
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
        return 'Sem opcoes registadas';
    }

    if (options.length <= 2) {
        return options.map((option) => `${option.label}: ${option.value}`).join(' | ');
    }

    const preview = options
        .slice(0, 2)
        .map((option) => `${option.label}: ${option.value}`)
        .join(' | ');

    return `${preview} | +${options.length - 2} opcao(oes)`;
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

    // Product store image — last resort fallback only
    const fallbackImage = [item?.imagem_produto, snapshot?.imagem, item?.produtos?.imagem]
        .find((value) => typeof value === 'string' && value.trim()) || '';

    const designDataUrl = (designSvg && typeof buildSvgDataUrl === 'function') ? buildSvgDataUrl(designSvg) : '';

    // Priority: SVG design → explicit preview → product image fallback
    return {
        designSvg,
        previewUrl: designDataUrl || explicitPreview || fallbackImage
    };
}

function renderOrderHeader(order, workflowStatus) {
    const statusLabel = typeof getWorkflowStatusLabel === 'function' ? getWorkflowStatusLabel(workflowStatus) : workflowStatus;
    const paymentStatus = String(order.payment_status || '').toLowerCase();
    const paymentBadge = document.getElementById('order-payment-badge');
    const facturalusaBadge = document.getElementById('order-facturalusa-badge');
    const facturalusaStatus = typeof getFacturalusaStatus === 'function'
        ? getFacturalusaStatus(order)
        : (order.facturalusa_document_number ? 'emitted' : (paymentStatus === 'paid' ? 'pending' : 'not_required'));
    const paymentLabelMap = {
        paid: 'Pagamento confirmado',
        processing: 'Pagamento em processamento',
        pending: 'A aguardar pagamento',
        failed: 'Pagamento falhou',
        expired: 'Sessao expirada'
    };
    const paymentClassMap = {
        paid: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        processing: 'bg-amber-50 border-amber-200 text-amber-700',
        pending: 'bg-slate-100 border-slate-200 text-slate-700',
        failed: 'bg-red-50 border-red-200 text-red-700',
        expired: 'bg-red-50 border-red-200 text-red-700'
    };
    const facturalusaClassMap = {
        emitted: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        pending: 'bg-amber-50 border-amber-200 text-amber-700',
        blocked: 'bg-red-50 border-red-200 text-red-700',
        error: 'bg-red-50 border-red-200 text-red-700',
        not_required: 'bg-slate-100 border-slate-200 text-slate-700'
    };

    document.getElementById('order-number').textContent = order.numero_encomenda || `#${order.id}`;
    document.getElementById('order-created-at').textContent = `Criada em ${formatDateTime(order.created_at)}`;
    document.getElementById('order-total').textContent = formatCurrency(order.total);
    const statusBadgeEl = document.getElementById('order-status-badge');
    if (statusBadgeEl) {
        statusBadgeEl.className = 'inline-flex items-center gap-2 mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-700';
        statusBadgeEl.innerHTML = buildWorkflowLabelWithGradeHtml(workflowStatus || statusLabel);
    }
    if (paymentBadge) {
        paymentBadge.className = `inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentClassMap[paymentStatus] || 'bg-gray-100 border-gray-200 text-gray-700'}`;
        paymentBadge.textContent = paymentLabelMap[paymentStatus] || 'Pagamento online';
    }
    if (facturalusaBadge) {
        facturalusaBadge.className = `inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${facturalusaClassMap[facturalusaStatus] || 'bg-gray-100 border-gray-200 text-gray-700'}`;
        facturalusaBadge.textContent = typeof getFacturalusaStatusLabel === 'function'
            ? getFacturalusaStatusLabel(facturalusaStatus)
            : 'Faturação';
    }
}

function renderOrderSidebar(order, splitMeta) {
    const tracking = typeof getTrackingDetails === 'function'
        ? getTrackingDetails(order)
        : { trackingCode: '', trackingUrl: '' };

    const trackingCodeEl = document.getElementById('order-tracking-code');
    const trackingLinkEl = document.getElementById('order-tracking-link');
    const shippingEl = document.getElementById('order-shipping');
    const notesEl = document.getElementById('order-notes');
    const nifEl = document.getElementById('order-nif');
    const facturalusaStatusEl = document.getElementById('order-facturalusa-status');
    const facturalusaNumberEl = document.getElementById('order-facturalusa-number');
    const facturalusaLinkEl = document.getElementById('order-facturalusa-link');
    const facturalusaStatus = typeof getFacturalusaStatus === 'function'
        ? getFacturalusaStatus(order)
        : ((order.facturalusa_document_number || splitMeta.meta.facturalusaDocumentNumber) ? 'emitted' : ((order.payment_status || splitMeta.meta.paymentStatus) === 'paid' ? 'pending' : 'not_required'));

    if (trackingCodeEl) {
        trackingCodeEl.textContent = tracking.trackingCode || 'Ainda nao disponivel';
    }

    if (trackingLinkEl) {
        if (tracking.trackingUrl) {
            trackingLinkEl.href = tracking.trackingUrl;
            trackingLinkEl.classList.remove('hidden');
        } else {
            trackingLinkEl.classList.add('hidden');
            trackingLinkEl.removeAttribute('href');
        }
    }

    if (shippingEl) {
        shippingEl.textContent = order.morada_envio || 'Disponivel no email de confirmacao';
    }
    if (notesEl) {
        notesEl.textContent = splitMeta.publicNotes || 'Sem notas adicionais.';
    }

    if (nifEl) {
        nifEl.textContent = order.clientes?.nif || 'Disponivel no email de confirmacao';
    }
    if (facturalusaStatusEl) {
        facturalusaStatusEl.textContent = typeof getFacturalusaStatusLabel === 'function'
            ? getFacturalusaStatusLabel(facturalusaStatus)
            : facturalusaStatus;
    }
    if (facturalusaNumberEl) {
        const documentNumber = order.facturalusa_document_number || splitMeta.meta.facturalusaDocumentNumber || '';
        facturalusaNumberEl.textContent = documentNumber
            ? `Nº ${documentNumber}`
            : facturalusaStatus === 'blocked' || facturalusaStatus === 'error'
                ? 'Emissão pendente. A nossa equipa está a validar.'
                : facturalusaStatus === 'pending'
                    ? 'A aguardar emissão automática'
                    : 'Disponível após confirmação do pagamento';
    }
    if (facturalusaLinkEl) {
        const url = String(order.facturalusa_document_url || splitMeta.meta.facturalusaDocumentUrl || '').trim();
        if (url) {
            facturalusaLinkEl.href = url;
            facturalusaLinkEl.classList.remove('hidden');
        } else {
            facturalusaLinkEl.classList.add('hidden');
            facturalusaLinkEl.removeAttribute('href');
        }
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
        steps.push('O pagamento ainda não foi confirmado. Assim que entrar, a equipa pode avançar para a validação do pedido.');
    } else {
        steps.push('Pagamento confirmado. A encomenda já está em fila operacional e pode ser atualizada pela equipa em tempo real.');
    }

    if (fiscalStatus === 'emitted') {
        steps.push('A fatura já foi emitida e pode ser aberta diretamente a partir desta página.');
    } else if (paymentStatus === 'paid') {
        steps.push('A emissão fiscal está a ser tratada automaticamente. Se houver atras?, a equipa consegue reemitir manualmente no painel.');
    }

    if (workflowStatus === 'em_preparacao') {
        steps.push('Estamos a validar ficheiros e a preparar a produção do teu material.');
    } else if (workflowStatus === 'em_producao') {
        steps.push('A encomenda já está em produção. O próximo pass? normal é expedição.');
    } else if (workflowStatus === 'expedido') {
        steps.push(tracking.trackingCode
            ? `A encomenda já saiu para entrega. Usa o tracking ${tracking.trackingCode} para acompanhar o percurs?.`
            : 'A encomenda já foi expedida. O tracking ficará visível assim que estiver disponível.');
    } else if (workflowStatus === 'entregue') {
        steps.push('A encomenda aparece como entregue. Se precisares de apoio, usa o botão de contacto e responde com o código IBF.');
    }

    return steps.slice(0, 4);
}

function renderOrderOperationalPanels(order, workflowStatus, splitMeta) {
    const nextStepsEl = document.getElementById('order-next-steps');
    const tracking = typeof getTrackingDetails === 'function'
        ? getTrackingDetails(order)
        : { trackingCode: '', trackingUrl: '' };
    const orderCode = String(order?.numero_encomenda || '').trim();
    const invoiceUrl = String(order?.facturalusa_document_url || splitMeta?.meta?.facturalusaDocumentUrl || '').trim();

    if (nextStepsEl) {
        const steps = buildOrderNextSteps(order, workflowStatus, splitMeta);
        nextStepsEl.innerHTML = steps.length > 0
            ? steps.map((step) => `
                <div class="flex items-start gap-2">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold flex-shrink-0 mt-0.5">+</span>
                    <p>${escapeHtml(step)}</p>
                </div>
            `).join('')
            : '<p>Sem pass?s adicionais para mostrar neste momento.</p>';
    }

    if (orderCopyCodeBtn) {
        orderCopyCodeBtn.onclick = () => copyTextToClipboard(orderCode, 'Código da encomenda copiado.');
        orderCopyCodeBtn.disabled = !orderCode;
    }

    if (orderCopyTrackingBtn) {
        const hasTracking = Boolean(tracking.trackingCode);
        orderCopyTrackingBtn.onclick = () => copyTextToClipboard(tracking.trackingCode, 'Código de tracking copiado.');
        orderCopyTrackingBtn.disabled = !hasTracking;
        orderCopyTrackingBtn.classList.toggle('opacity-50', !hasTracking);
        orderCopyTrackingBtn.classList.toggle('cursor-not-allowed', !hasTracking);
    }

    if (orderOpenDocumentBtn) {
        if (invoiceUrl) {
            orderOpenDocumentBtn.href = invoiceUrl;
            orderOpenDocumentBtn.classList.remove('hidden');
        } else {
            orderOpenDocumentBtn.classList.add('hidden');
            orderOpenDocumentBtn.removeAttribute('href');
        }
    }

    if (orderContactSupportBtn) {
        const params = new URLSearchParams();
        if (orderCode) params.set('codigo', orderCode);
        params.set('assunto', 'Apoio a encomenda');
        orderContactSupportBtn.href = `/contacto?${params.toString()}`;
    }
}

function renderStatusTable(order, workflowStatus, splitMeta) {
    const statusTableBody = document.getElementById('order-status-table-body');
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
                note: 'Encomenda registada'
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
            <table>
                <tbody>
                    <tr>
                        <td class="text-sm text-gray-400">Sem produtos associados a esta encomenda.</td>
                    </tr>
                </tbody>
            </table>
        `;
        return;
    }

    const rowsHtml = listSource.map((item, index) => {
        const snapshot = resolveOrderItemSnapshot(splitMeta.meta, item, index);
        const visuals = resolveOrderItemVisual(item, snapshot);
        const productName = item?.produtos?.nome || snapshot?.nome || `Produto #${item.produto_id || index + 1}`;
        const quantity = Number(item.quantidade || snapshot?.quantidade || 1);
        const unitPrice = Number(item.preco_unitario || snapshot?.precoUnitario || 0);
        const lineSubtotal = Number(item.subtotal || (quantity * unitPrice));
        const previewUrl = visuals.previewUrl || '/favicon.svg';
        const itemOptions = extractOrderItemOptions(item, snapshot);
        const optionsSummary = buildOptionsSummary(itemOptions);
        renderedItemPreviews.push({
            productName,
            previewUrl,
            options: itemOptions
        });

        return `
            <tr>
                <td class="align-top">
                    <div class="flex items-center gap-2 min-w-[160px]">
                        <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(productName)}" class="w-12 h-12 object-cover rounded-md border border-gray-200 bg-gray-50">
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-gray-900 truncate">${escapeHtml(productName)}</p>
                            <p class="text-xs text-gray-500">${formatCurrency(unitPrice)} / unidade</p>
                        </div>
                    </div>
                </td>
                <td class="text-xs text-gray-700">${quantity}</td>
                <td class="text-xs font-semibold text-gray-800">${formatCurrency(lineSubtotal)}</td>
                <td>
                    <button type="button" data-preview-index="${index}" class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        <i data-lucide="eye" class="w-3 h-3"></i>
                        Ver
                    </button>
                </td>
                <td class="text-xs text-gray-600 max-w-[220px]">${escapeHtml(optionsSummary)}</td>
            </tr>
        `;
    }).join('');

    orderItemsEl.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Subtotal</th>
                    <th>Personalizacao</th>
                    <th>Opcoes compradas</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
}

function renderItemPreviewOptions(options) {
    if (!itemPreviewOptions) {
        return;
    }

    if (!Array.isArray(options) || options.length === 0) {
        itemPreviewOptions.innerHTML = '<p class="text-sm text-gray-500">Sem opcoes registadas para este produto.</p>';
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
    if (itemPreviewOptions) {
        itemPreviewOptions.innerHTML = '';
        itemPreviewOptions.classList.add('hidden');
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
        }
    } catch (apiError) {
        console.warn('Falha ao carregar encomenda via API de sessao:', apiError);
    }

    if (!supabaseClient || typeof supabaseClient.rpc !== 'function') {
        throw new Error('SUPABASE_NOT_READY');
    }

    // Uses SECURITY DEFINER RPC – anon cannot query encomendas/itens_encomenda directly (RLS)
    const { data, error } = await supabaseClient
        .rpc('get_order_tracking', { p_code: orderCode });

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    return {
        order: data,
        items: Array.isArray(data.items) ? data.items : []
    };
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

    if (!supabaseClient || typeof supabaseClient.rpc !== 'function') {
        return 'Ligacao ao backend indisponivel. Verifique a configuracao do Supabase.';
    }

    if (rawMessage.includes('session-status') || rawMessage.includes('checkout/session-status')) {
        return 'Nao foi possivel consultar o estado da encomenda neste momento.';
    }

    if (rawMessage.includes('get_order_tracking')) {
        return 'O contrato publico de tracking do Supabase nao esta ativo (`get_order_tracking`).';
    }

    if (rawMessage.includes('permission denied') || rawMessage.includes('row-level security') || rawMessage.includes('rls')) {
        return 'O tracking publico foi bloqueado por permiss?es do Supabase.';
    }

    return 'Ocorreu um problema tecnico ao consultar esta encomenda. Tente novamente dentro de momentos.';
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
        renderOrderSidebar(result.order, splitMeta);
        renderOrderOperationalPanels(result.order, workflowStatus, splitMeta);
        renderStatusTable(result.order, workflowStatus, splitMeta);
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

