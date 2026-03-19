const orderLoading = document.getElementById('order-loading');
const orderNotFound = document.getElementById('order-not-found');
const orderDetail = document.getElementById('order-detail');

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

function resolveOrderItemSnapshot(orderMeta, item, index) {
    const snapshots = Array.isArray(orderMeta?.itemSnapshots) ? orderMeta.itemSnapshots : [];
    return snapshots[index] || snapshots.find((entry) => Number(entry.produtoId) === Number(item?.produto_id)) || null;
}

function resolveOrderItemVisual(item, snapshot) {
    const previewCandidates = [
        item?.design_preview,
        item?.preview_design,
        item?.imagem_produto,
        snapshot?.designPreview,
        snapshot?.imagem,
        item?.produtos?.imagem
    ];

    const designCandidates = [
        item?.design_svg,
        item?.design,
        item?.personalizacao_svg,
        snapshot?.design
    ];

    const designSvg = designCandidates.find((value) => typeof value === 'string' && value.trim()) || '';
    const preview = previewCandidates.find((value) => typeof value === 'string' && value.trim()) || '';

    return {
        designSvg,
        previewUrl: preview || (typeof buildSvgDataUrl === 'function' ? buildSvgDataUrl(designSvg) : '')
    };
}

function getProgressSteps() {
    const allSteps = Array.isArray(window.ORDER_WORKFLOW_STEPS) ? window.ORDER_WORKFLOW_STEPS : [];
    return allSteps.filter((step) => step.value !== 'cancelada');
}

function buildProgressHtml(workflowStatus) {
    if (workflowStatus === 'cancelada') {
        return '<div class="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm font-semibold">Encomenda cancelada</div>';
    }

    const steps = getProgressSteps();
    const currentIndex = Math.max(0, steps.findIndex((step) => step.value === workflowStatus));

    return steps.map((step, index) => {
        const isDone = index <= currentIndex;
        return `
            <div class="rounded-lg border px-2.5 py-2 ${isDone ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'}">
                <p class="text-xs font-semibold">${escapeHtml(step.label)}</p>
            </div>
        `;
    }).join('');
}

function renderOrderHeader(order, workflowStatus) {
    const statusLabel = typeof getWorkflowStatusLabel === 'function' ? getWorkflowStatusLabel(workflowStatus) : workflowStatus;

    document.getElementById('order-number').textContent = order.numero_encomenda || `#${order.id}`;
    document.getElementById('order-created-at').textContent = `Criada em ${formatDateTime(order.created_at)}`;
    document.getElementById('order-total').textContent = formatCurrency(order.total);
    document.getElementById('order-status-badge').textContent = statusLabel;
    document.getElementById('order-progress').innerHTML = buildProgressHtml(workflowStatus);
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

function renderOrderItems(order, items, splitMeta) {
    const orderItemsEl = document.getElementById('order-items');

    if (!Array.isArray(items) || items.length === 0) {
        orderItemsEl.innerHTML = '<div class="admin-card p-6 text-sm text-gray-400">Sem produtos associados a esta encomenda.</div>';
        return;
    }

    orderItemsEl.innerHTML = items.map((item, index) => {
        const snapshot = resolveOrderItemSnapshot(splitMeta.meta, item, index);
        const visuals = resolveOrderItemVisual(item, snapshot);
        const productName = item?.produtos?.nome || snapshot?.nome || `Produto #${item.produto_id || index + 1}`;
        const quantity = Number(item.quantidade || snapshot?.quantidade || 1);
        const unitPrice = Number(item.preco_unitario || snapshot?.precoUnitario || 0);
        const lineSubtotal = Number(item.subtotal || (quantity * unitPrice));
        const previewUrl = visuals.previewUrl || '/favicon.svg';
        const designDownloadUrl = visuals.designSvg && typeof buildSvgDataUrl === 'function'
            ? buildSvgDataUrl(visuals.designSvg)
            : '';

        return `
            <article class="admin-card overflow-hidden">
                <div class="p-4 md:p-5 flex flex-col md:flex-row gap-4">
                    <div class="w-full md:w-48 lg:w-56 shrink-0">
                        <div class="rounded-xl border border-gray-200 bg-white p-2">
                            <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(productName)}" class="w-full aspect-square object-cover rounded-lg bg-gray-50">
                        </div>
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap gap-2 items-center justify-between">
                            <h3 class="text-lg font-bold text-gray-900 truncate">${escapeHtml(productName)}</h3>
                            <span class="text-sm font-bold text-blue-700">${formatCurrency(lineSubtotal)}</span>
                        </div>

                        <p class="text-sm text-gray-600 mt-2">Quantidade: <strong>${quantity}</strong> • Preco unitario: <strong>${formatCurrency(unitPrice)}</strong></p>

                        <div class="mt-4 flex flex-wrap gap-2">
                            ${designDownloadUrl ? `<a href="${escapeHtml(designDownloadUrl)}" download="design-${escapeHtml(order.numero_encomenda || order.id || 'encomenda')}-${index + 1}.svg" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"><i data-lucide="download" class="w-3 h-3"></i>Download design SVG</a>` : '<span class="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold">Design SVG nao disponivel</span>'}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
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
    initOrderPage();
});
