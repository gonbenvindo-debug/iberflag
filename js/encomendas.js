const ordersSearchForm = document.getElementById('orders-search-form');
const ordersSearchBtn = document.getElementById('orders-search-btn');
const customerOrdersResults = document.getElementById('customer-orders-results');

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

function getProgressSteps() {
    const allSteps = Array.isArray(window.ORDER_WORKFLOW_STEPS) ? window.ORDER_WORKFLOW_STEPS : [];
    return allSteps.filter((step) => step.value !== 'cancelada');
}

function getStatusIndex(statusValue) {
    const steps = getProgressSteps();
    return steps.findIndex((step) => step.value === statusValue);
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
        previewUrl: preview || (typeof buildSvgDataUrl === 'function' ? buildSvgDataUrl(designSvg) : ''),
        designSvg
    };
}

function buildProgressHtml(currentStatus) {
    if (currentStatus === 'cancelada') {
        return '<div class="mt-3 text-sm text-red-600 font-semibold">Encomenda cancelada</div>';
    }

    const steps = getProgressSteps();
    const currentIndex = Math.max(0, getStatusIndex(currentStatus));

    return `
        <ol class="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            ${steps.map((step, index) => {
                const isDone = index <= currentIndex;
                return `
                    <li class="rounded-md border px-2.5 py-2 ${isDone ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'}">
                        <p class="text-xs font-semibold">${escapeHtml(step.label)}</p>
                    </li>
                `;
            }).join('')}
        </ol>
    `;
}

function renderEmptyResult(message) {
    customerOrdersResults.innerHTML = `
        <div class="admin-card p-8 text-center text-gray-500">
            <i data-lucide="package-search" class="w-10 h-10 mx-auto mb-3 text-gray-300"></i>
            ${escapeHtml(message)}
        </div>
    `;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderOrders(orders, itemsByOrderId) {
    if (!Array.isArray(orders) || orders.length === 0) {
        renderEmptyResult('Nao encontramos encomendas para os dados indicados.');
        return;
    }

    customerOrdersResults.innerHTML = orders.map((order) => {
        const split = typeof splitOrderNotesAndMeta === 'function'
            ? splitOrderNotesAndMeta(order.notas)
            : { publicNotes: order.notas || '', meta: null };
        const meta = split.meta || {};
        const workflowStatus = typeof deriveWorkflowStatus === 'function' ? deriveWorkflowStatus(order) : order.status;
        const statusLabel = typeof getWorkflowStatusLabel === 'function' ? getWorkflowStatusLabel(workflowStatus) : workflowStatus;
        const statusColor = typeof getWorkflowStatusColor === 'function' ? getWorkflowStatusColor(workflowStatus) : 'info';
        const tracking = typeof getTrackingDetails === 'function' ? getTrackingDetails(order) : { trackingCode: '', trackingUrl: '' };
        const orderItems = itemsByOrderId.get(String(order.id)) || [];

        const itemsHtml = orderItems.length > 0
            ? orderItems.map((item, index) => {
                const snapshot = resolveOrderItemSnapshot(meta, item, index);
                const visuals = resolveOrderItemVisual(item, snapshot);
                const itemName = item?.produtos?.nome || snapshot?.nome || `Produto #${item.produto_id || index + 1}`;
                const quantity = Number(item.quantidade || snapshot?.quantidade || 1);
                const unitPrice = Number(item.preco_unitario || snapshot?.precoUnitario || 0);

                return `
                    <div class="flex gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                        <img src="${escapeHtml(visuals.previewUrl || '/favicon.svg')}" alt="${escapeHtml(itemName)}" class="w-14 h-14 rounded-md object-cover bg-gray-50 border border-gray-100">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm text-gray-900 truncate">${escapeHtml(itemName)}</p>
                            <p class="text-xs text-gray-500 mt-1">Qtd: ${quantity} • ${formatCurrency(unitPrice)} / un.</p>
                        </div>
                    </div>
                `;
            }).join('')
            : '<p class="text-sm text-gray-400">Sem itens associados.</p>';

        return `
            <article class="admin-card">
                <div class="p-5 border-b border-gray-100">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 class="text-xl font-bold text-gray-900">${escapeHtml(order.numero_encomenda || `#${order.id}`)}</h2>
                            <p class="text-sm text-gray-500 mt-1">Criada em ${formatDateTime(order.created_at)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-bold text-blue-700">${formatCurrency(order.total)}</p>
                            <span class="badge badge-${statusColor}">${escapeHtml(statusLabel)}</span>
                        </div>
                    </div>
                    ${buildProgressHtml(workflowStatus)}
                </div>

                <div class="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div class="lg:col-span-2">
                        <h3 class="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2">Produtos</h3>
                        <div class="space-y-2">
                            ${itemsHtml}
                        </div>
                    </div>

                    <aside class="space-y-3">
                        <div class="rounded-lg border border-gray-200 p-3 bg-gray-50">
                            <h3 class="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2">Tracking</h3>
                            <p class="text-sm text-gray-800"><strong>Codigo:</strong> ${escapeHtml(tracking.trackingCode || 'Ainda nao disponivel')}</p>
                            ${tracking.trackingUrl ? `<a href="${escapeHtml(tracking.trackingUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-2 text-sm text-blue-700 hover:text-blue-800"><i data-lucide="external-link" class="w-3 h-3"></i>Ver tracking</a>` : ''}
                        </div>

                        <div class="rounded-lg border border-gray-200 p-3 bg-gray-50">
                            <h3 class="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2">Notas</h3>
                            <p class="text-sm text-gray-700 whitespace-pre-line">${escapeHtml(split.publicNotes || 'Sem notas adicionais.')}</p>
                        </div>
                    </aside>
                </div>
            </article>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function searchCustomerOrders(email, orderNumber) {
    const normalizedEmail = String(email || '').trim();
    const normalizedOrderNumber = String(orderNumber || '').trim();

    const { data: customers, error: customerError } = await supabaseClient
        .from('clientes')
        .select('id, nome, email')
        .ilike('email', normalizedEmail);

    if (customerError) throw customerError;

    if (!customers || customers.length === 0) {
        return { orders: [], itemsByOrderId: new Map() };
    }

    const customerIds = customers.map((customer) => customer.id);

    let orderQuery = supabaseClient
        .from('encomendas')
        .select('*, clientes(*)')
        .in('cliente_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(20);

    if (normalizedOrderNumber) {
        orderQuery = orderQuery.eq('numero_encomenda', normalizedOrderNumber);
    }

    const { data: orders, error: ordersError } = await orderQuery;
    if (ordersError) throw ordersError;

    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length === 0) {
        return { orders: [], itemsByOrderId: new Map() };
    }

    const { data: orderItems, error: itemsError } = await supabaseClient
        .from('itens_encomenda')
        .select('*, produtos(*)')
        .in('encomenda_id', orderIds)
        .order('id', { ascending: true });

    if (itemsError) throw itemsError;

    const itemsByOrderId = new Map();
    (orderItems || []).forEach((item) => {
        const key = String(item.encomenda_id);
        const list = itemsByOrderId.get(key) || [];
        list.push(item);
        itemsByOrderId.set(key, list);
    });

    return {
        orders: orders || [],
        itemsByOrderId
    };
}

if (ordersSearchForm) {
    ordersSearchForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(ordersSearchForm);
        const email = String(formData.get('email') || '').trim();
        const orderNumber = String(formData.get('orderNumber') || '').trim();

        if (!email) {
            showToast('Introduza o email usado na encomenda', 'warning');
            return;
        }

        try {
            ordersSearchBtn.disabled = true;
            ordersSearchBtn.innerHTML = '<div class="spinner mx-auto"></div>';

            const result = await searchCustomerOrders(email, orderNumber);
            renderOrders(result.orders, result.itemsByOrderId);
        } catch (error) {
            console.error('Erro ao consultar encomendas:', error);
            showToast('Erro ao consultar encomendas. Tente novamente.', 'error');
            renderEmptyResult('Nao foi possivel carregar as encomendas neste momento.');
        } finally {
            ordersSearchBtn.disabled = false;
            ordersSearchBtn.textContent = 'Procurar Encomendas';
        }
    });
}
