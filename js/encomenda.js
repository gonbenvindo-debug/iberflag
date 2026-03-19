const orderLoading = document.getElementById('order-loading');
const orderNotFound = document.getElementById('order-not-found');
const orderDetail = document.getElementById('order-detail');
const itemPreviewModal = document.getElementById('item-preview-modal');
const itemPreviewCloseBtn = document.getElementById('item-preview-close');
const itemPreviewTitle = document.getElementById('item-preview-title');
const itemPreviewImage = document.getElementById('item-preview-image');
const itemPreviewOptions = document.getElementById('item-preview-options');
const itemPreviewDownload = document.getElementById('item-preview-download');

let renderedItemPreviews = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function sanitizeFilenameToken(value) {
    return String(value || 'encomenda')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'encomenda';
}

function resolveOrderItemSnapshot(orderMeta, item, index) {
    const snapshots = Array.isArray(orderMeta?.itemSnapshots) ? orderMeta.itemSnapshots : [];
    return snapshots[index] || snapshots.find((entry) => Number(entry.produtoId) === Number(item?.produto_id)) || null;
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

    document.getElementById('order-number').textContent = order.numero_encomenda || `#${order.id}`;
    document.getElementById('order-created-at').textContent = `Criada em ${formatDateTime(order.created_at)}`;
    document.getElementById('order-total').textContent = formatCurrency(order.total);
    document.getElementById('order-status-badge').textContent = statusLabel;
}

function renderOrderSidebar(order, splitMeta) {
    const tracking = typeof getTrackingDetails === 'function'
        ? getTrackingDetails(order)
        : { trackingCode: '', trackingUrl: '' };

    const trackingCodeEl = document.getElementById('order-tracking-code');
    const trackingLinkEl = document.getElementById('order-tracking-link');
    const shippingEl = document.getElementById('order-shipping');
    const notesEl = document.getElementById('order-notes');

    trackingCodeEl.textContent = tracking.trackingCode || 'Ainda nao disponivel';

    if (tracking.trackingUrl) {
        trackingLinkEl.href = tracking.trackingUrl;
        trackingLinkEl.classList.remove('hidden');
    } else {
        trackingLinkEl.classList.add('hidden');
        trackingLinkEl.removeAttribute('href');
    }

    shippingEl.textContent = order.morada_envio || 'Morada nao disponivel';
    notesEl.textContent = splitMeta.publicNotes || 'Sem notas adicionais.';
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
            <td class="text-sm font-semibold text-gray-800">${escapeHtml(typeof getWorkflowStatusLabel === 'function' ? getWorkflowStatusLabel(row.status) : row.status)}</td>
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
        const designDownloadUrl = visuals.designSvg && typeof buildSvgDataUrl === 'function'
            ? buildSvgDataUrl(visuals.designSvg)
            : '';

        renderedItemPreviews.push({
            productName,
            previewUrl,
            options: itemOptions,
            designDownloadUrl,
            downloadFilename: `design-${sanitizeFilenameToken(order.numero_encomenda || order.id || 'encomenda')}-${index + 1}.svg`
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
    if (!data || !itemPreviewModal || !itemPreviewTitle || !itemPreviewImage || !itemPreviewDownload) {
        return;
    }

    itemPreviewTitle.textContent = data.productName || 'Produto';
    itemPreviewImage.src = data.previewUrl || '/favicon.svg';
    itemPreviewImage.alt = data.productName || 'Preview';
    renderItemPreviewOptions(data.options || []);

    if (data.designDownloadUrl) {
        itemPreviewDownload.href = data.designDownloadUrl;
        itemPreviewDownload.download = data.downloadFilename || 'design.svg';
        itemPreviewDownload.classList.remove('hidden');
    } else {
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
    const { data: order, error: orderError } = await supabaseClient
        .from('encomendas')
        .select('*, clientes(*)')
        .eq('numero_encomenda', orderCode)
        .maybeSingle();

    if (orderError) {
        throw orderError;
    }

    if (!order) {
        return null;
    }

    const { data: items, error: itemsError } = await supabaseClient
        .from('itens_encomenda')
        .select('*, produtos(*)')
        .eq('encomenda_id', order.id)
        .order('id', { ascending: true });

    if (itemsError) {
        throw itemsError;
    }

    return {
        order,
        items: items || []
    };
}

function showNotFound() {
    orderLoading.classList.add('hidden');
    orderDetail.classList.add('hidden');
    orderNotFound.classList.remove('hidden');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function initOrderPage() {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeOrderCode(params.get('codigo'));

    if (!code) {
        showNotFound();
        return;
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
        renderOrderSidebar(result.order, splitMeta);
        renderStatusTable(result.order, workflowStatus, splitMeta);
        renderOrderItems(result.order, result.items, splitMeta);

        orderLoading.classList.add('hidden');
        orderNotFound.classList.add('hidden');
        orderDetail.classList.remove('hidden');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Erro ao carregar encomenda:', error);
        showToast('Erro ao carregar a encomenda. Tente novamente.', 'error');
        showNotFound();
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
