// ===== ADMIN PANEL LOGIC =====

let currentTab = 'dashboard';
let currentProductId = null;
let currentContactId = null;
let currentOrderId = null;
let currentOrderData = null;
let currentOrderMeta = null;
let currentOrderPublicNotes = '';
let ordersCache = new Map();

// ===== DOM ELEMENTS =====
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const productModal = document.getElementById('product-modal');
const contactModal = document.getElementById('contact-modal');
const orderModal = document.getElementById('order-modal');
const productForm = document.getElementById('product-form');
const addProductBtn = document.getElementById('add-product-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const closeContactModalBtns = document.querySelectorAll('.close-contact-modal');
const closeOrderModalBtns = document.querySelectorAll('.close-order-modal');
const markRespondedBtn = document.getElementById('mark-responded');
const saveOrderBtn = document.getElementById('save-order-btn');
const svgPreviewModal = document.getElementById('svg-preview-modal');
const openSvgPreviewBtn = document.getElementById('open-svg-preview');
const closeSvgPreviewBtns = document.querySelectorAll('.close-svg-preview');
const svgPreviewCanvas = document.getElementById('svg-preview-canvas');
const svgPreviewStatus = document.getElementById('svg-preview-status');
const adminModals = [productModal, contactModal, orderModal, svgPreviewModal].filter(Boolean);

function updateModalBodyLock() {
    const hasOpenModal = adminModals.some((modal) => !modal.classList.contains('hidden'));
    document.body.style.overflow = hasOpenModal ? 'hidden' : '';
}

function openModal(modal, options = {}) {
    if (!modal) return;
    const { closeOthers = true } = options;
    if (closeOthers) {
        closeAllModals();
    }
    modal.classList.remove('hidden');
    updateModalBodyLock();
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    updateModalBodyLock();
}

function closeAllModals() {
    adminModals.forEach((modal) => modal.classList.add('hidden'));
    updateModalBodyLock();
}

// ===== TAB NAVIGATION =====
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    currentTab = tabName;
    closeAllModals();
    
    // Update active tab
    navTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active', 'bg-blue-50', 'text-blue-600');
        } else {
            tab.classList.remove('active', 'bg-blue-50', 'text-blue-600');
        }
    });
    
    // Show/hide panels
    tabPanels.forEach(panel => {
        if (panel.id === `${tabName}-tab`) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
    
    // Load data for the tab
    loadTabData(tabName);
}

// ===== LOAD TAB DATA =====
async function loadTabData(tabName) {
    switch(tabName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'produtos':
            await loadProducts();
            break;
        case 'encomendas':
            await loadOrders();
            break;
        case 'clientes':
            await loadClients();
            break;
        case 'contactos':
            await loadContacts();
            break;
    }
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        // Load stats
        const [produtos, encomendas, clientes, contactos] = await Promise.all([
            supabaseClient.from('produtos').select('*', { count: 'exact' }),
            supabaseClient.from('encomendas').select('*', { count: 'exact' }),
            supabaseClient.from('clientes').select('*', { count: 'exact' }),
            supabaseClient.from('contactos').select('*', { count: 'exact' })
        ]);
        
        document.getElementById('stat-produtos').textContent = produtos.count || 0;
        document.getElementById('stat-encomendas').textContent = encomendas.count || 0;
        document.getElementById('stat-clientes').textContent = clientes.count || 0;
        document.getElementById('stat-contactos').textContent = contactos.count || 0;
        
        // Load featured products
        const { data: featured } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('destaque', true)
            .limit(5);
        
        const featuredContainer = document.getElementById('featured-products');
        if (featured && featured.length > 0) {
            featuredContainer.innerHTML = featured.map(p => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img src="${p.imagem}" alt="${p.nome}" class="w-12 h-12 object-cover rounded">
                    <div class="flex-1">
                        <h4 class="font-semibold text-sm">${p.nome}</h4>
                        <p class="text-xs text-gray-600">${p.preco.toFixed(2)}€</p>
                    </div>
                    <span class="badge badge-info">${p.categoria}</span>
                </div>
            `).join('');
        } else {
            featuredContainer.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum produto em destaque</p>';
        }
        
        // Load recent contacts
        const { data: contacts } = await supabaseClient
            .from('contactos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        const contactsContainer = document.getElementById('recent-contacts');
        if (contacts && contacts.length > 0) {
            contactsContainer.innerHTML = contacts.map(c => `
                <div class="p-3 bg-gray-50 rounded-lg">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-semibold text-sm">${c.nome}</h4>
                        <span class="badge ${c.respondido ? 'badge-success' : 'badge-warning'}">${c.respondido ? 'Respondido' : 'Pendente'}</span>
                    </div>
                    <p class="text-xs text-gray-600">${c.assunto}</p>
                    <p class="text-xs text-gray-400 mt-1">${new Date(c.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
            `).join('');
        } else {
            contactsContainer.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum contacto recente</p>';
        }
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showToast('Erro ao carregar dashboard', 'error');
    }
}

// ===== PRODUCTS =====
async function loadProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('products-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.imagem}" alt="${p.nome}" class="w-12 h-12 object-cover rounded"></td>
                    <td class="font-semibold">${p.nome}</td>
                    <td><span class="badge badge-info">${p.categoria}</span></td>
                    <td class="font-bold text-blue-600">${p.preco.toFixed(2)}€</td>
                    <td>${p.stock || 0}</td>
                    <td>${p.destaque ? '<span class="badge badge-warning">Sim</span>' : '<span class="badge">Não</span>'}</td>
                    <td>${p.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                    <td>
                        <div class="flex gap-2">
                            <button onclick="editProduct(${p.id})" class="text-blue-600 hover:text-blue-800" title="Editar">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteProduct(${p.id})" class="text-red-600 hover:text-red-800" title="Eliminar">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">Nenhum produto encontrado</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showToast('Erro ao carregar produtos', 'error');
    }
}

// ===== PRODUCT MODAL =====
if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
        currentProductId = null;
        document.getElementById('modal-title').textContent = 'Adicionar Produto';
        productForm.reset();
        document.getElementById('product-ativo').checked = true;
        resetSvgTemplateState();
        openModal(productModal);
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        closeModal(productModal);
        resetSvgTemplateState();
    });
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', () => {
        closeModal(productModal);
        resetSvgTemplateState();
    });
}

// ===== SVG FILE UPLOAD HANDLER =====
let svgTemplateContent = null;
let svgTemplateFileName = '';
let isReadingSvgTemplate = false;

const svgUpload = document.getElementById('product-svg-upload');
const svgPreview = document.getElementById('svg-preview');
const productSubmitBtn = productForm ? productForm.querySelector('button[type="submit"]') : null;

function setProductSubmitLoadingState(isLoading) {
    isReadingSvgTemplate = isLoading;
    if (!productSubmitBtn) return;

    productSubmitBtn.disabled = isLoading;
    productSubmitBtn.classList.toggle('opacity-60', isLoading);
    productSubmitBtn.classList.toggle('cursor-not-allowed', isLoading);
}

function parseSvgTemplate(svgText) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const parserError = svgDoc.querySelector('parsererror');
    const root = svgDoc.documentElement;

    if (parserError || !root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('Ficheiro SVG invalido');
    }

    svgDoc.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
    return root;
}

function getSvgSourceBounds(root) {
    const viewBoxAttr = root.getAttribute('viewBox');

    if (viewBoxAttr) {
        const parts = viewBoxAttr.trim().split(/\s+/).map(Number);
        if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
            return {
                x: parts[0],
                y: parts[1],
                width: parts[2],
                height: parts[3]
            };
        }
    }

    const width = parseFloat(root.getAttribute('width') || '800');
    const height = parseFloat(root.getAttribute('height') || '600');

    return {
        x: 0,
        y: 0,
        width: Number.isFinite(width) && width > 0 ? width : 800,
        height: Number.isFinite(height) && height > 0 ? height : 600
    };
}

function updateSvgTemplateUI() {
    const hasTemplate = Boolean(svgTemplateContent);

    if (!svgPreview) return;

    svgPreview.classList.toggle('hidden', !hasTemplate);

    if (svgPreviewStatus) {
        svgPreviewStatus.textContent = hasTemplate
            ? (svgTemplateFileName || 'Template SVG pronto para gravar')
            : 'Nenhum template carregado';
    }

    if (openSvgPreviewBtn) {
        openSvgPreviewBtn.disabled = !hasTemplate;
        openSvgPreviewBtn.classList.toggle('opacity-50', !hasTemplate);
        openSvgPreviewBtn.classList.toggle('cursor-not-allowed', !hasTemplate);
    }
}

function resetSvgTemplateState() {
    svgTemplateContent = null;
    svgTemplateFileName = '';
    if (svgUpload) {
        svgUpload.value = '';
    }
    if (svgPreviewCanvas) {
        svgPreviewCanvas.innerHTML = '';
    }
    updateSvgTemplateUI();
}

function setSvgTemplateContent(content, fileName = '') {
    svgTemplateContent = content;
    svgTemplateFileName = fileName;
    updateSvgTemplateUI();
}

function renderSvgTemplatePreview() {
    if (!svgTemplateContent || !svgPreviewCanvas) {
        showToast('Nenhum template SVG carregado', 'warning');
        return;
    }

    try {
        const root = parseSvgTemplate(svgTemplateContent);
        const sourceBounds = getSvgSourceBounds(root);
        const svgNs = 'http://www.w3.org/2000/svg';
        const previewSvg = document.createElementNS(svgNs, 'svg');
        previewSvg.setAttribute('viewBox', '0 0 800 600');
        previewSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        previewSvg.setAttribute('width', '100%');
        previewSvg.setAttribute('height', '100%');

        const printAreaOutline = document.createElementNS(svgNs, 'rect');
        printAreaOutline.setAttribute('x', '50');
        printAreaOutline.setAttribute('y', '50');
        printAreaOutline.setAttribute('width', '700');
        printAreaOutline.setAttribute('height', '500');
        printAreaOutline.setAttribute('fill', 'none');
        printAreaOutline.setAttribute('stroke', '#2563eb');
        printAreaOutline.setAttribute('stroke-width', '2');
        printAreaOutline.setAttribute('stroke-dasharray', '8 4');
        printAreaOutline.setAttribute('opacity', '0.55');

        const imported = document.importNode(root, true);
        imported.setAttribute('x', '50');
        imported.setAttribute('y', '50');
        imported.setAttribute('width', '700');
        imported.setAttribute('height', '500');
        imported.setAttribute('viewBox', `${sourceBounds.x} ${sourceBounds.y} ${sourceBounds.width} ${sourceBounds.height}`);
        imported.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        previewSvg.appendChild(imported);
        previewSvg.appendChild(printAreaOutline);

        svgPreviewCanvas.innerHTML = '';
        svgPreviewCanvas.appendChild(previewSvg);
        openModal(svgPreviewModal, { closeOthers: false });
    } catch (error) {
        console.error('Erro ao renderizar preview SVG:', error);
        showToast('Nao foi possivel gerar o preview do SVG', 'error');
    }
}

if (svgUpload) {
    svgUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.svg')) {
            showToast('Por favor selecione um ficheiro SVG', 'error');
            svgUpload.value = '';
            return;
        }
        
        try {
            setProductSubmitLoadingState(true);
            const text = await file.text();
            parseSvgTemplate(text);
            setSvgTemplateContent(text, file.name);
            
            showToast('SVG carregado com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao ler ficheiro SVG:', error);
            showToast('Erro ao ler ficheiro SVG', 'error');
        } finally {
            setProductSubmitLoadingState(false);
        }
    });
}

if (openSvgPreviewBtn) {
    openSvgPreviewBtn.addEventListener('click', () => renderSvgTemplatePreview());
}

closeSvgPreviewBtns.forEach((button) => {
    button.addEventListener('click', () => closeModal(svgPreviewModal));
});

// ===== PRODUCT FORM SUBMIT =====
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isReadingSvgTemplate) {
            showToast('Aguarde o carregamento do SVG terminar', 'warning');
            return;
        }
        
        const productData = {
            nome: document.getElementById('product-nome').value,
            descricao: document.getElementById('product-descricao').value,
            preco: parseFloat(document.getElementById('product-preco').value),
            categoria: document.getElementById('product-categoria').value,
            imagem: document.getElementById('product-imagem').value,
            svg_template: svgTemplateContent || null,
            stock: parseInt(document.getElementById('product-stock').value) || 0,
            destaque: document.getElementById('product-destaque').checked,
            ativo: document.getElementById('product-ativo').checked
        };
        
        try {
            let result;
            
            if (currentProductId) {
                // Update
                result = await supabaseClient
                    .from('produtos')
                    .update(productData)
                    .eq('id', currentProductId);
            } else {
                // Insert
                result = await supabaseClient
                    .from('produtos')
                    .insert([productData]);
            }
            
            if (result.error) throw result.error;
            
            showToast(currentProductId ? 'Produto atualizado com sucesso!' : 'Produto adicionado com sucesso!', 'success');
            closeModal(productModal);
            resetSvgTemplateState();
            loadProducts();
            
        } catch (error) {
            console.error('Erro ao guardar produto:', error);
            showToast('Erro ao guardar produto', 'error');
        }
    });
}

// ===== EDIT PRODUCT =====
async function editProduct(id) {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        currentProductId = id;
        document.getElementById('modal-title').textContent = 'Editar Produto';
        document.getElementById('product-nome').value = data.nome;
        document.getElementById('product-descricao').value = data.descricao;
        document.getElementById('product-preco').value = data.preco;
        document.getElementById('product-categoria').value = data.categoria;
        document.getElementById('product-imagem').value = data.imagem;
        document.getElementById('product-stock').value = data.stock || 0;
        document.getElementById('product-destaque').checked = data.destaque;
        document.getElementById('product-ativo').checked = data.ativo;
        
        // Load existing SVG template
        if (data.svg_template) {
            setSvgTemplateContent(data.svg_template, 'Template SVG atual');
        } else {
            resetSvgTemplateState();
        }
        
        openModal(productModal);
        
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        showToast('Erro ao carregar produto', 'error');
    }
}

// ===== DELETE PRODUCT =====
async function deleteProduct(id) {
    if (!confirm('Tem a certeza que deseja eliminar este produto?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('produtos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('Produto eliminado com sucesso!', 'success');
        loadProducts();
        
    } catch (error) {
        console.error('Erro ao eliminar produto:', error);
        showToast('Erro ao eliminar produto', 'error');
    }
}

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

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-PT');
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-PT');
}

function sanitizeFilenameToken(value) {
    return String(value || 'encomenda')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'encomenda';
}

function tryParseJson(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
}

function normalizeOptionLabel(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectOptionEntries(entries, value, labelPrefix = '') {
    if (value === null || value === undefined || value === '') {
        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return;
        }

        const primitive = value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry));
        if (primitive) {
            entries.push({
                label: normalizeOptionLabel(labelPrefix || 'Opcao'),
                value: value.map((entry) => String(entry)).join(', ')
            });
            return;
        }

        value.forEach((entry, index) => collectOptionEntries(entries, entry, `${labelPrefix || 'Opcao'} ${index + 1}`));
        return;
    }

    if (typeof value === 'object') {
        Object.entries(value).forEach(([key, nestedValue]) => {
            const nestedLabel = labelPrefix
                ? `${labelPrefix} ${normalizeOptionLabel(key)}`
                : normalizeOptionLabel(key);
            collectOptionEntries(entries, nestedValue, nestedLabel);
        });
        return;
    }

    entries.push({
        label: normalizeOptionLabel(labelPrefix || 'Opcao'),
        value: String(value)
    });
}

function resolveItemOptions(item, snapshot) {
    const entries = [];
    const sources = [item, snapshot].filter(Boolean);

    sources.forEach((source) => {
        ['opcoes_compradas', 'opcoes', 'options', 'variacoes', 'variacao'].forEach((key) => {
            const rawValue = source?.[key];
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                return;
            }

            const parsed = typeof rawValue === 'string' ? tryParseJson(rawValue) : null;
            collectOptionEntries(entries, parsed !== null ? parsed : rawValue, normalizeOptionLabel(key));
        });
    });

    const deduplicated = [];
    const seen = new Set();
    entries.forEach((entry) => {
        const label = String(entry?.label || '').trim();
        const value = String(entry?.value || '').trim();
        if (!label || !value) {
            return;
        }

        const key = `${label}::${value}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        deduplicated.push({ label, value });
    });

    return deduplicated;
}

function resolveItemSnapshot(orderMeta, item, index) {
    const snapshots = Array.isArray(orderMeta?.itemSnapshots) ? orderMeta.itemSnapshots : [];
    const byIndex = snapshots[index];

    if (byIndex) {
        return byIndex;
    }

    return snapshots.find((entry) => Number(entry.produtoId) === Number(item?.produto_id)) || null;
}

function resolveItemPreviewAndDesign(item, snapshot) {
    const previewCandidates = [
        item?.design_preview,
        item?.preview_design,
        item?.imagem_produto,
        snapshot?.designPreview,
        snapshot?.imagem,
        item?.produtos?.imagem
    ];

    const svgCandidates = [
        item?.design_svg,
        item?.design,
        item?.personalizacao_svg,
        snapshot?.design
    ];

    const designSvg = svgCandidates.find((value) => typeof value === 'string' && value.trim()) || '';
    const preview = previewCandidates.find((value) => typeof value === 'string' && value.trim()) || '';
    const previewUrl = preview || (typeof buildSvgDataUrl === 'function' ? buildSvgDataUrl(designSvg) : '');

    return {
        previewUrl,
        designSvg
    };
}

function buildStatusOptionsHtml(activeStatus) {
    const steps = Array.isArray(window.ORDER_WORKFLOW_STEPS) ? window.ORDER_WORKFLOW_STEPS : [];
    return steps.map((step) => {
        const selected = step.value === activeStatus ? 'selected' : '';
        return `<option value="${escapeHtml(step.value)}" ${selected}>${escapeHtml(step.label)}</option>`;
    }).join('');
}

function collectTrackableColumns(orderData) {
    const columns = new Set(Object.keys(orderData || {}));

    return {
        trackingCodeColumn: ['tracking_codigo', 'codigo_tracking', 'tracking_code', 'tracking']
            .find((column) => columns.has(column)) || null,
        trackingUrlColumn: ['tracking_url', 'url_tracking', 'tracking_link']
            .find((column) => columns.has(column)) || null
    };
}

// ===== ORDERS =====
async function loadOrders() {
    try {
        const { data, error } = await supabaseClient
            .from('encomendas')
            .select('*, clientes(*)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('orders-tbody');
        ordersCache = new Map((data || []).map((order) => [String(order.id), order]));
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(o => `
                <tr>
                    <td class="font-semibold">${o.numero_encomenda}</td>
                    <td>${o.clientes?.nome || 'N/A'}</td>
                    <td>${new Date(o.created_at).toLocaleDateString('pt-PT')}</td>
                    <td class="font-bold text-blue-600">${formatCurrency(o.total)}</td>
                    <td>
                        <span class="badge badge-${getStatusColor(deriveWorkflowStatus(o))}">
                            ${escapeHtml(getWorkflowStatusLabel(deriveWorkflowStatus(o)))}
                        </span>
                    </td>
                    <td>
                        <button type="button" class="order-view-btn text-blue-600 hover:text-blue-800" data-order-id="${escapeHtml(String(o.id))}" title="Ver detalhe da encomenda">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            const viewButtons = tbody.querySelectorAll('.order-view-btn');
            viewButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const orderId = button.getAttribute('data-order-id');
                    if (!orderId) {
                        showToast('ID da encomenda invalido', 'warning');
                        return;
                    }

                    viewOrder(orderId);
                });
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Nenhuma encomenda encontrada</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar encomendas:', error);
    }
}

async function viewOrder(id) {
    try {
        const orderId = String(id);
        const cached = ordersCache.get(orderId);

        const { data: orderData, error: orderError } = await supabaseClient
            .from('encomendas')
            .select('*, clientes(*)')
            .eq('id', orderId)
            .maybeSingle();

        if (orderError) throw orderError;

        const order = orderData || cached;
        if (!order) {
            showToast('Encomenda nao encontrada', 'warning');
            return;
        }

        const { data: itemsData, error: itemsError } = await supabaseClient
            .from('itens_encomenda')
            .select('*, produtos(*)')
            .eq('encomenda_id', orderId)
            .order('id', { ascending: true });

        if (itemsError) throw itemsError;

        const split = typeof splitOrderNotesAndMeta === 'function'
            ? splitOrderNotesAndMeta(order.notas)
            : { publicNotes: order.notas || '', meta: null };

        const workflowStatus = typeof deriveWorkflowStatus === 'function'
            ? deriveWorkflowStatus(order)
            : order.status;
        const tracking = typeof getTrackingDetails === 'function'
            ? getTrackingDetails(order)
            : { trackingCode: '', trackingUrl: '' };

        currentOrderId = orderId;
        currentOrderData = order;
        currentOrderMeta = split.meta;
        currentOrderPublicNotes = split.publicNotes || '';

        const summaryBlock = document.getElementById('order-summary-block');
        const customerBlock = document.getElementById('order-customer-block');
        const itemsList = document.getElementById('order-items-list');
        const historyList = document.getElementById('order-history-list');
        const statusSelect = document.getElementById('order-status-select');
        const trackingCodeInput = document.getElementById('order-tracking-code');
        const trackingUrlInput = document.getElementById('order-tracking-url');
        const notesInput = document.getElementById('order-public-notes');
        const statusNoteInput = document.getElementById('order-status-note');

        if (summaryBlock) {
            summaryBlock.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <p class="text-xs text-gray-500">Nº Encomenda</p>
                        <p class="font-bold text-gray-900">${escapeHtml(order.numero_encomenda || 'N/A')}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Data</p>
                        <p class="font-semibold text-gray-900">${formatDateTime(order.created_at)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Total</p>
                        <p class="font-bold text-blue-700">${formatCurrency(order.total)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Estado Atual</p>
                        <span class="badge badge-${getStatusColor(workflowStatus)}">${escapeHtml(getWorkflowStatusLabel(workflowStatus))}</span>
                    </div>
                </div>
            `;
        }

        if (customerBlock) {
            customerBlock.innerHTML = `
                <h3 class="text-lg font-bold mb-3">Cliente</h3>
                <div class="space-y-2 text-sm">
                    <p><span class="text-gray-500">Nome:</span> <span class="font-semibold">${escapeHtml(order.clientes?.nome || 'N/A')}</span></p>
                    <p><span class="text-gray-500">Email:</span> ${escapeHtml(order.clientes?.email || 'N/A')}</p>
                    <p><span class="text-gray-500">Telefone:</span> ${escapeHtml(order.clientes?.telefone || 'N/A')}</p>
                    <p><span class="text-gray-500">Morada:</span> ${escapeHtml(order.morada_envio || 'N/A')}</p>
                </div>
            `;
        }

        if (statusSelect) {
            statusSelect.innerHTML = buildStatusOptionsHtml(workflowStatus);
        }

        if (trackingCodeInput) trackingCodeInput.value = tracking.trackingCode || '';
        if (trackingUrlInput) trackingUrlInput.value = tracking.trackingUrl || '';
        if (notesInput) notesInput.value = currentOrderPublicNotes || '';
        if (statusNoteInput) statusNoteInput.value = '';

        const items = Array.isArray(itemsData) ? itemsData : [];
        const snapshots = Array.isArray(split.meta?.itemSnapshots) ? split.meta.itemSnapshots : [];

        if (itemsList) {
            if (items.length > 0 || snapshots.length > 0) {
                const listSource = items.length > 0 ? items : snapshots.map((snapshot) => ({
                    produto_id: snapshot.produtoId,
                    quantidade: snapshot.quantidade,
                    preco_unitario: snapshot.precoUnitario,
                    subtotal: snapshot.precoUnitario * snapshot.quantidade,
                    produtos: {
                        nome: snapshot.nome,
                        imagem: snapshot.imagem
                    }
                }));

                itemsList.innerHTML = listSource.map((item, index) => {
                    const snapshot = resolveItemSnapshot(split.meta, item, index);
                    const visuals = resolveItemPreviewAndDesign(item, snapshot);
                    const preview = visuals.previewUrl || '/favicon.svg';
                    const designDownload = visuals.designSvg
                        ? (typeof buildSvgDataUrl === 'function' ? buildSvgDataUrl(visuals.designSvg) : '')
                        : '';
                    const productName = item?.produtos?.nome || snapshot?.nome || `Produto #${item.produto_id || index + 1}`;
                    const quantity = Number(item.quantidade || snapshot?.quantidade || 1);
                    const unitPrice = Number(item.preco_unitario || snapshot?.precoUnitario || 0);
                    const lineSubtotal = Number(item.subtotal || (unitPrice * quantity));

                    const itemOptions = resolveItemOptions(item, snapshot);

                    return `
                        <article class="rounded-xl border border-gray-200 p-3 bg-white">
                            <div class="flex items-start justify-between gap-3 mb-2">
                                <h4 class="font-semibold text-sm text-gray-900">${escapeHtml(productName)}</h4>
                                <span class="text-xs text-gray-500">Qtd ${quantity}</span>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div class="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                    <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Design do cliente</p>
                                    <img src="${escapeHtml(preview)}" alt="Design de ${escapeHtml(productName)}" class="w-full h-40 object-contain rounded-md bg-white border border-gray-100">
                                    <div class="flex flex-wrap gap-2 mt-2">
                                        <a href="${escapeHtml(preview)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">
                                            <i data-lucide="expand" class="w-3 h-3"></i>
                                            Ver Design
                                        </a>
                                        ${designDownload ? `<a href="${escapeHtml(designDownload)}" download="design-${sanitizeFilenameToken(order.numero_encomenda || order.id || 'encomenda')}-${index + 1}.svg" class="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"><i data-lucide="download" class="w-3 h-3"></i>Download SVG</a>` : ''}
                                    </div>
                                </div>

                                <div class="rounded-lg border border-gray-200 bg-white p-2.5">
                                    <p class="text-xs text-gray-500">Preco unitario: <span class="font-semibold text-gray-800">${formatCurrency(unitPrice)}</span></p>
                                    <p class="text-xs text-gray-500 mt-1">Subtotal: <span class="font-semibold text-blue-700">${formatCurrency(lineSubtotal)}</span></p>

                                    <div class="mt-2.5 pt-2 border-t border-gray-100">
                                        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Opcoes compradas</p>
                                        ${itemOptions.length > 0
                                            ? `<ul class="space-y-1">${itemOptions.map((option) => `<li class="text-xs text-gray-700"><span class="font-semibold">${escapeHtml(option.label)}:</span> ${escapeHtml(option.value)}</li>`).join('')}</ul>`
                                            : '<p class="text-xs text-gray-400">Sem opcoes registadas neste item.</p>'}
                                    </div>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');
            } else {
                itemsList.innerHTML = '<p class="text-sm text-gray-400">Sem itens associados a esta encomenda.</p>';
            }
        }

        if (historyList) {
            const history = Array.isArray(split.meta?.statusHistory) ? split.meta.statusHistory : [];
            if (history.length > 0) {
                historyList.innerHTML = history
                    .slice()
                    .sort((a, b) => new Date(b.at) - new Date(a.at))
                    .map((entry) => `
                        <div class="rounded-lg border border-gray-200 px-3 py-2 bg-white">
                            <div class="flex justify-between gap-2">
                                <span class="text-sm font-semibold text-gray-800">${escapeHtml(getWorkflowStatusLabel(entry.status))}</span>
                                <span class="text-xs text-gray-500">${formatDateTime(entry.at)}</span>
                            </div>
                            ${entry.note ? `<p class="text-xs text-gray-600 mt-1">${escapeHtml(entry.note)}</p>` : ''}
                        </div>
                    `).join('');
            } else {
                historyList.innerHTML = '<p class="text-sm text-gray-400">Sem historico de atualizacoes.</p>';
            }
        }

        openModal(orderModal);

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Erro ao carregar detalhe da encomenda:', error);
        showToast('Erro ao carregar detalhe da encomenda', 'error');
    }
}

// ===== CLIENTS =====
async function loadClients() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('clients-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td class="font-semibold">${c.nome}</td>
                    <td>${c.email}</td>
                    <td>${c.telefone || 'N/A'}</td>
                    <td>${c.empresa || 'N/A'}</td>
                    <td>${new Date(c.created_at).toLocaleDateString('pt-PT')}</td>
                    <td>
                        <button onclick="viewClient('${c.id}')" class="text-blue-600 hover:text-blue-800">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Nenhum cliente encontrado</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

// ===== CONTACTS =====
async function loadContacts() {
    try {
        const { data, error } = await supabaseClient
            .from('contactos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('contacts-tbody');
        
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td>${new Date(c.created_at).toLocaleDateString('pt-PT')}</td>
                    <td class="font-semibold">${c.nome}</td>
                    <td>${c.email}</td>
                    <td>${c.assunto}</td>
                    <td><span class="badge ${c.respondido ? 'badge-success' : 'badge-warning'}">${c.respondido ? 'Respondido' : 'Pendente'}</span></td>
                    <td>
                        <button onclick="viewContact(${c.id})" class="text-blue-600 hover:text-blue-800">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Nenhum contacto encontrado</td></tr>';
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Erro ao carregar contactos:', error);
    }
}

// ===== VIEW CONTACT =====
async function viewContact(id) {
    try {
        const { data, error } = await supabaseClient
            .from('contactos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        currentContactId = id;
        
        const detailsContainer = document.getElementById('contact-details');
        detailsContainer.innerHTML = `
            <div>
                <label class="form-label">Nome</label>
                <p class="text-gray-900 font-semibold">${data.nome}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Email</label>
                    <p class="text-gray-900">${data.email}</p>
                </div>
                <div>
                    <label class="form-label">Telefone</label>
                    <p class="text-gray-900">${data.telefone || 'N/A'}</p>
                </div>
            </div>
            <div>
                <label class="form-label">Assunto</label>
                <p class="text-gray-900">${data.assunto}</p>
            </div>
            <div>
                <label class="form-label">Mensagem</label>
                <p class="text-gray-900 bg-gray-50 p-4 rounded-lg">${data.mensagem}</p>
            </div>
            <div>
                <label class="form-label">Data</label>
                <p class="text-gray-900">${new Date(data.created_at).toLocaleString('pt-PT')}</p>
            </div>
            <div>
                <label class="form-label">Status</label>
                <p><span class="badge ${data.respondido ? 'badge-success' : 'badge-warning'}">${data.respondido ? 'Respondido' : 'Pendente'}</span></p>
            </div>
        `;
        
        openModal(contactModal);
        
    } catch (error) {
        console.error('Erro ao carregar contacto:', error);
        showToast('Erro ao carregar contacto', 'error');
    }
}

// ===== MARK CONTACT AS RESPONDED =====
if (markRespondedBtn) {
    markRespondedBtn.addEventListener('click', async () => {
        if (!currentContactId) return;
        
        try {
            const { error } = await supabaseClient
                .from('contactos')
                .update({ respondido: true })
                .eq('id', currentContactId);
            
            if (error) throw error;
            
            showToast('Contacto marcado como respondido!', 'success');
            closeModal(contactModal);
            loadContacts();
            
        } catch (error) {
            console.error('Erro ao atualizar contacto:', error);
            showToast('Erro ao atualizar contacto', 'error');
        }
    });
}

// Close contact modal
closeContactModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(contactModal);
    });
});

closeOrderModalBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        closeModal(orderModal);
    });
});

if (saveOrderBtn) {
    saveOrderBtn.addEventListener('click', async () => {
        if (!currentOrderId || !currentOrderData) {
            showToast('Nenhuma encomenda selecionada', 'warning');
            return;
        }

        const statusSelect = document.getElementById('order-status-select');
        const trackingCodeInput = document.getElementById('order-tracking-code');
        const trackingUrlInput = document.getElementById('order-tracking-url');
        const notesInput = document.getElementById('order-public-notes');
        const statusNoteInput = document.getElementById('order-status-note');

        const nextWorkflowStatus = statusSelect?.value || (typeof deriveWorkflowStatus === 'function'
            ? deriveWorkflowStatus(currentOrderData)
            : currentOrderData.status);

        const currentTracking = typeof getTrackingDetails === 'function'
            ? getTrackingDetails(currentOrderData)
            : { trackingCode: '', trackingUrl: '' };

        const trackingCode = trackingCodeInput
            ? (trackingCodeInput.value?.trim() || '')
            : String(currentOrderMeta?.trackingCode || currentTracking.trackingCode || '');

        const trackingUrl = trackingUrlInput
            ? (trackingUrlInput.value?.trim() || '')
            : String(currentOrderMeta?.trackingUrl || currentTracking.trackingUrl || '');

        const publicNotes = notesInput?.value?.trim() || '';
        const statusNote = statusNoteInput?.value?.trim() || '';

        const previousWorkflowStatus = typeof deriveWorkflowStatus === 'function'
            ? deriveWorkflowStatus(currentOrderData)
            : currentOrderData.status;

        let meta = typeof normalizeOrderMeta === 'function'
            ? normalizeOrderMeta(currentOrderMeta)
            : (currentOrderMeta || {});

        const autoStatusNote = nextWorkflowStatus !== previousWorkflowStatus
            ? 'Estado atualizado no painel admin'
            : '';
        const historyNote = statusNote || autoStatusNote;

        if (typeof appendWorkflowHistory === 'function') {
            if (nextWorkflowStatus !== previousWorkflowStatus || historyNote) {
                meta = appendWorkflowHistory(meta, nextWorkflowStatus, historyNote);
            }
        }

        if (meta && typeof meta === 'object') {
            meta.workflowStatus = nextWorkflowStatus;
            meta.trackingCode = trackingCode;
            meta.trackingUrl = trackingUrl;
        }

        const payload = {
            status: typeof getLegacyStatusFromWorkflow === 'function'
                ? getLegacyStatusFromWorkflow(nextWorkflowStatus)
                : nextWorkflowStatus,
            notas: typeof buildOrderNotesWithMeta === 'function'
                ? buildOrderNotesWithMeta(publicNotes, meta)
                : publicNotes
        };

        const trackableColumns = collectTrackableColumns(currentOrderData);
        if (trackableColumns.trackingCodeColumn) {
            payload[trackableColumns.trackingCodeColumn] = trackingCode || null;
        }

        // Only write URL column when the input exists in UI to avoid clearing values accidentally.
        if (trackableColumns.trackingUrlColumn && trackingUrlInput) {
            payload[trackableColumns.trackingUrlColumn] = trackingUrl || null;
        }

        try {
            saveOrderBtn.disabled = true;
            saveOrderBtn.classList.add('opacity-60', 'cursor-not-allowed');

            const { error } = await supabaseClient
                .from('encomendas')
                .update(payload)
                .eq('id', currentOrderId);

            if (error) throw error;

            showToast('Encomenda atualizada com sucesso!', 'success');
            await loadOrders();
            await viewOrder(currentOrderId);
        } catch (error) {
            console.error('Erro ao atualizar encomenda:', error);
            showToast('Erro ao atualizar encomenda', 'error');
        } finally {
            saveOrderBtn.disabled = false;
            saveOrderBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    });
}

adminModals.forEach((modal) => {
    modal.addEventListener('mousedown', (event) => {
        if (event.target === modal) {
            closeModal(modal);
        }
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAllModals();
    }
});

// ===== HELPER FUNCTIONS =====
function getStatusColor(status) {
    if (typeof getWorkflowStatusColor === 'function') {
        return getWorkflowStatusColor(status);
    }

    const fallback = {
        pendente: 'warning',
        processando: 'info',
        concluido: 'success',
        cancelado: 'danger'
    };

    return fallback[status] || 'info';
}

function viewClient(id) {
    showToast('Funcionalidade de visualização de cliente em desenvolvimento', 'info');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    closeAllModals();
    loadDashboard();
});

// Make functions globally available
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewContact = viewContact;
window.viewOrder = viewOrder;
window.viewClient = viewClient;
