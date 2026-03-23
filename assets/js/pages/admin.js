// ===== ADMIN PANEL LOGIC =====

// ── Authentication ──────────────────────────────────────────────────────────

const adminUsernameMeta = document.querySelector('meta[name="iberflag-admin-username"]');
const adminEmailMeta = document.querySelector('meta[name="iberflag-admin-email"]');
const allowedAdminUsername = (adminUsernameMeta?.content || '').trim().toLowerCase();
const allowedAdminEmail = (adminEmailMeta?.content || '').trim().toLowerCase();
let failedLoginAttempts = 0;
let loginBlockedUntil = 0;

function getSessionEmail(session) {
    return (session?.user?.email || '').trim().toLowerCase();
}

function isAllowedAdminSession(session) {
    if (!allowedAdminEmail) return false;
    return getSessionEmail(session) === allowedAdminEmail;
}

function getRemainingLockSeconds() {
    return Math.max(0, Math.ceil((loginBlockedUntil - Date.now()) / 1000));
}

function showLoginOverlay() {
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideLoginOverlay() {
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
}

async function checkAdminAuth() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && isAllowedAdminSession(session)) {
            hideLoginOverlay();
            loadDashboard();
        } else {
            if (session && !isAllowedAdminSession(session)) {
                await supabaseClient.auth.signOut();
            }
            showLoginOverlay();
        }
    } catch {
        showLoginOverlay();
    }
}

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value.trim().toLowerCase();
            const password = document.getElementById('admin-password').value;
            const btn      = document.getElementById('admin-login-btn');
            const btnText  = document.getElementById('admin-login-btn-text');
            const errorEl  = document.getElementById('admin-login-error');

            if (!allowedAdminUsername || !allowedAdminEmail) {
                errorEl.textContent = 'Admin não configurado. Defina utilizador e email no head de pages/admin.html.';
                errorEl.classList.remove('hidden');
                return;
            }

            if (username !== allowedAdminUsername) {
                errorEl.textContent = 'Utilizador inválido.';
                errorEl.classList.remove('hidden');
                return;
            }

            const remainingLockSeconds = getRemainingLockSeconds();
            if (remainingLockSeconds > 0) {
                errorEl.textContent = `Muitas tentativas falhadas. Aguarde ${remainingLockSeconds}s.`;
                errorEl.classList.remove('hidden');
                return;
            }

            btn.disabled = true;
            btnText.textContent = 'A entrar…';
            errorEl.classList.add('hidden');

            const { error } = await supabaseClient.auth.signInWithPassword({
                email: allowedAdminEmail,
                password
            });

            if (error) {
                failedLoginAttempts += 1;
                if (failedLoginAttempts >= 5) {
                    loginBlockedUntil = Date.now() + 60_000;
                    failedLoginAttempts = 0;
                }

                errorEl.textContent = 'Credenciais inválidas. Verifique o utilizador e password.';
                errorEl.classList.remove('hidden');
                btn.disabled = false;
                btnText.textContent = 'Entrar';
            } else {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!isAllowedAdminSession(session)) {
                    await supabaseClient.auth.signOut();
                    errorEl.textContent = 'Acesso não autorizado para este utilizador.';
                    errorEl.classList.remove('hidden');
                    btn.disabled = false;
                    btnText.textContent = 'Entrar';
                    showLoginOverlay();
                    return;
                }

                failedLoginAttempts = 0;
                loginBlockedUntil = 0;
                hideLoginOverlay();
                loadDashboard();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }

    // Logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            showLoginOverlay();
        });
    }
});

// ── End Authentication ──────────────────────────────────────────────────────

let currentTab = 'dashboard';
let currentProductId = null;
let currentContactId = null;
let currentOrderId = null;
let currentOrderData = null;
let currentOrderMeta = null;
let currentOrderPublicNotes = '';
let ordersCache = new Map();
const adminDesignCache = new Map();

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

    const itemDesignId = String(item?.design_id || item?.designId || '').trim();
    if (itemDesignId) {
        const byDesignId = snapshots.find((entry) => String(entry?.designId || '').trim() === itemDesignId);
        if (byDesignId) {
            return byDesignId;
        }
    }

    return snapshots.find((entry) => Number(entry.produtoId) === Number(item?.produto_id)) || null;
}

function resolveItemPreviewAndDesign(item, snapshot) {
    const svgCandidates = [
        item?.design_svg,
        item?.design,
        item?.personalizacao_svg,
        snapshot?.design
    ];

    const designSvg = svgCandidates.find((value) => typeof value === 'string' && value.trim()) || '';

    // Only data: URIs are genuine design previews. Regular https/relative URLs are product images.
    const isDataUri = (v) => typeof v === 'string' && v.startsWith('data:');
    const designPreviewUrl = [item?.design_preview, item?.preview_design, snapshot?.designPreview]
        .find(isDataUri) || '';

    // Also accept any https preview that isn't the same as the product image (e.g. server-rendered raster)
    const productImageUrls = new Set(
        [item?.imagem_produto, snapshot?.imagem, item?.produtos?.imagem]
            .filter((v) => typeof v === 'string' && v.trim())
    );
    const httpPreview = [item?.design_preview, item?.preview_design, snapshot?.designPreview]
        .find((v) => typeof v === 'string' && v.trim() && !isDataUri(v) && !productImageUrls.has(v)) || '';

    // Product store image — last resort fallback only
    const fallbackImage = [item?.imagem_produto, snapshot?.imagem, item?.produtos?.imagem]
        .find((value) => typeof value === 'string' && value.trim()) || '';

    const designDataUrl = designSvg
        ? (typeof buildSvgDataUrl === 'function' ? (buildSvgDataUrl(designSvg) || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(designSvg)}`) : '')
        : '';

    const previewUrl = designDataUrl || designPreviewUrl || httpPreview || fallbackImage;
    // Treat any non-product preview or raw SVG as valid design signal.
    const hasDesign = Boolean(designSvg || designPreviewUrl || httpPreview || previewUrl);

    return {
        previewUrl,
        designSvg,
        hasDesign
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

        const metaEl = document.getElementById('order-modal-meta');
        if (metaEl) metaEl.textContent = `${escapeHtml(order.numero_encomenda || '')} · ${formatDateTime(order.created_at)}`;

        if (summaryBlock) {
            summaryBlock.innerHTML = `
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:1.5rem;">
                    <div>
                        <p style="font-size:0.6875rem;color:#6b7280;margin:0 0 0.125rem;">Nº Encomenda</p>
                        <p style="font-size:0.875rem;font-weight:700;color:#111827;margin:0;">${escapeHtml(order.numero_encomenda || 'N/A')}</p>
                    </div>
                    <div>
                        <p style="font-size:0.6875rem;color:#6b7280;margin:0 0 0.125rem;">Data</p>
                        <p style="font-size:0.8125rem;font-weight:600;color:#374151;margin:0;">${formatDateTime(order.created_at)}</p>
                    </div>
                    <div>
                        <p style="font-size:0.6875rem;color:#6b7280;margin:0 0 0.125rem;">Total</p>
                        <p style="font-size:1rem;font-weight:700;color:#1d4ed8;margin:0;">${formatCurrency(order.total)}</p>
                    </div>
                    <div>
                        <p style="font-size:0.6875rem;color:#6b7280;margin:0 0 0.25rem;">Estado</p>
                        <span class="badge badge-${getStatusColor(workflowStatus)}">${escapeHtml(getWorkflowStatusLabel(workflowStatus))}</span>
                    </div>
                    ${tracking.trackingCode ? `<div>
                        <p style="font-size:0.6875rem;color:#6b7280;margin:0 0 0.125rem;">Tracking</p>
                        <p style="font-size:0.8125rem;font-weight:600;color:#374151;margin:0;font-family:monospace;">${escapeHtml(tracking.trackingCode)}</p>
                    </div>` : ''}
                </div>
            `;
        }

        if (customerBlock) {
            const nome = escapeHtml(order.clientes?.nome || 'N/A');
            const email = escapeHtml(order.clientes?.email || '—');
            const tel = escapeHtml(order.clientes?.telefone || '—');
            const morada = escapeHtml(order.morada_envio || '');
            customerBlock.innerHTML = `
                <p style="font-size:0.625rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin:0 0 0.75rem;">Cliente</p>
                <div style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.8125rem;">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;">
                        <span style="color:#9ca3af;flex-shrink:0;">Nome</span>
                        <span style="font-weight:600;color:#111827;text-align:right;">${nome}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;">
                        <span style="color:#9ca3af;flex-shrink:0;">Email</span>
                        <span style="color:#374151;text-align:right;font-size:0.75rem;word-break:break-all;">${email}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;">
                        <span style="color:#9ca3af;flex-shrink:0;">Tel.</span>
                        <span style="color:#374151;text-align:right;">${tel}</span>
                    </div>
                    ${morada ? `<div style="padding-top:0.5rem;border-top:1px solid #f3f4f6;margin-top:0.125rem;">
                        <p style="font-size:0.6875rem;color:#9ca3af;margin:0 0 0.2rem;">Morada de envio</p>
                        <p style="font-size:0.75rem;color:#374151;margin:0;">${morada}</p>
                    </div>` : ''}
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

                // Clear cached designs for this order
                adminDesignCache.forEach((_, k) => { if (k.startsWith(String(orderId) + '-')) adminDesignCache.delete(k); });

                const rows = listSource.map((item, index) => {
                    const snapshot = resolveItemSnapshot(split.meta, item, index);
                    const visuals = resolveItemPreviewAndDesign(item, snapshot);
                    const productName = item?.produtos?.nome || snapshot?.nome || `Produto #${item.produto_id || index + 1}`;
                    const quantity = Number(item.quantidade || snapshot?.quantidade || 1);
                    const unitPrice = Number(item.preco_unitario || snapshot?.precoUnitario || 0);
                    const lineSubtotal = Number(item.subtotal || (unitPrice * quantity));
                    const itemOptions = resolveItemOptions(item, snapshot);
                    const svgDataUrl = visuals.designSvg && typeof buildSvgDataUrl === 'function'
                        ? buildSvgDataUrl(visuals.designSvg) : '';
                    const designKey = `${String(orderId)}-${index}`;
                    adminDesignCache.set(designKey, { previewUrl: visuals.previewUrl, svgDataUrl, name: productName });

                    const designCell = visuals.hasDesign
                        ? `<div style="width:3.5rem;height:3.5rem;border-radius:0.5rem;border:1px solid #e5e7eb;background:#f9fafb;overflow:hidden;margin-bottom:0.35rem;cursor:pointer;" class="order-design-view-btn" data-design-key="${escapeHtml(designKey)}">
                               <img src="${escapeHtml(visuals.previewUrl)}" alt="Design" style="width:100%;height:100%;object-fit:contain;">
                           </div>
                           <button type="button" class="order-design-view-btn" data-design-key="${escapeHtml(designKey)}" style="font-size:0.6875rem;color:#2563eb;background:none;border:none;cursor:pointer;padding:0;display:block;text-align:left;">Ver design</button>`
                        : `<div style="width:3.5rem;height:3.5rem;border-radius:0.5rem;border:1.5px dashed #d1d5db;background:#f9fafb;display:flex;align-items:center;justify-content:center;margin-bottom:0.2rem;">
                               <i data-lucide="image-off" style="width:1.125rem;height:1.125rem;color:#d1d5db;"></i>
                           </div>
                           <p style="font-size:0.625rem;color:#9ca3af;width:3.5rem;text-align:center;margin:0;">Sem design</p>`;

                    const optionsHtml = itemOptions.length > 0
                        ? `<ul style="margin:0.25rem 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:0.2rem;">${itemOptions.map((o) => `<li style="font-size:0.75rem;color:#6b7280;"><span style="font-weight:500;color:#374151;">${escapeHtml(o.label)}:</span> ${escapeHtml(o.value)}</li>`).join('')}</ul>`
                        : `<p style="font-size:0.75rem;color:#9ca3af;margin:0.2rem 0 0;">Sem opções</p>`;

                    return `<tr style="border-bottom:1px solid #f9fafb;">
                        <td style="padding:0.75rem 0.75rem 0.75rem 0;vertical-align:top;width:5rem;">${designCell}</td>
                        <td style="padding:0.75rem 0.75rem 0.75rem 0;vertical-align:top;">
                            <p style="font-size:0.8125rem;font-weight:600;color:#111827;margin:0;">${escapeHtml(productName)}</p>
                            ${optionsHtml}
                        </td>
                        <td style="padding:0.75rem 0.75rem 0.75rem 0;vertical-align:top;text-align:right;font-size:0.8125rem;color:#374151;">${quantity}</td>
                        <td style="padding:0.75rem 0.75rem 0.75rem 0;vertical-align:top;text-align:right;font-size:0.8125rem;color:#6b7280;">${formatCurrency(unitPrice)}</td>
                        <td style="padding:0.75rem 0 0.75rem 0;vertical-align:top;text-align:right;font-size:0.8125rem;font-weight:600;color:#1d4ed8;">${formatCurrency(lineSubtotal)}</td>
                    </tr>`;
                }).join('');

                itemsList.innerHTML = `<div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;min-width:440px;">
                        <thead>
                            <tr style="border-bottom:1px solid #e5e7eb;">
                                <th style="padding:0 0.75rem 0.625rem 0;font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;text-align:left;width:5rem;">Design</th>
                                <th style="padding:0 0.75rem 0.625rem 0;font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;text-align:left;">Produto / Opções</th>
                                <th style="padding:0 0.75rem 0.625rem 0;font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;text-align:right;width:2.5rem;">Qtd</th>
                                <th style="padding:0 0.75rem 0.625rem 0;font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;text-align:right;width:5rem;">P. Unit.</th>
                                <th style="padding:0 0 0.625rem 0;font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;text-align:right;width:5rem;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr style="border-top:2px solid #e5e7eb;">
                                <td colspan="4" style="padding-top:0.625rem;text-align:right;padding-right:0.75rem;font-size:0.75rem;font-weight:600;color:#6b7280;">Total da encomenda</td>
                                <td style="padding-top:0.625rem;text-align:right;font-weight:700;color:#1d4ed8;font-size:0.875rem;">${formatCurrency(order.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>`;
            } else {
                itemsList.innerHTML = '<p style="font-size:0.875rem;color:#9ca3af;">Sem itens associados a esta encomenda.</p>';
            }
        }

        if (historyList) {
            const history = Array.isArray(split.meta?.statusHistory) ? split.meta.statusHistory : [];
            if (history.length > 0) {
                const historyRows = history
                    .slice()
                    .sort((a, b) => new Date(b.at) - new Date(a.at))
                    .map((entry) => {
                        const noteHtml = entry.note ? `<p style="font-size:0.75rem;color:#6b7280;margin:0.2rem 0 0 1rem;">${escapeHtml(entry.note)}</p>` : '';
                        return `<tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:0.5rem 0.75rem 0.5rem 0;vertical-align:top;">
                                <div style="display:flex;align-items:center;gap:0.5rem;">
                                    <span class="badge badge-${getStatusColor(entry.status)}" style="font-size:0.75rem;">${escapeHtml(getWorkflowStatusLabel(entry.status))}</span>
                                </div>
                                ${noteHtml}
                            </td>
                            <td style="padding:0.5rem 0;text-align:right;font-size:0.75rem;color:#9ca3af;white-space:nowrap;vertical-align:top;">${formatDateTime(entry.at)}</td>
                        </tr>`;
                    }).join('');
                historyList.innerHTML = `<table style="width:100%;border-collapse:collapse;"><tbody>${historyRows}</tbody></table>`;
            } else {
                historyList.innerHTML = '<p style="font-size:0.875rem;color:#9ca3af;">Sem histórico de atualizações.</p>';
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

// Design viewer modal
function openAdminDesignViewer(designKey) {
    const entry = adminDesignCache.get(designKey);
    if (!entry) return;
    const modal = document.getElementById('design-viewer-modal');
    const img = document.getElementById('design-viewer-img');
    const title = document.getElementById('design-viewer-title');
    const downloadBtn = document.getElementById('design-viewer-download');
    if (!modal || !img) return;
    img.src = entry.previewUrl || '';
    if (title) title.textContent = `Design — ${entry.name || 'Produto'}`;
    if (downloadBtn) {
        if (entry.svgDataUrl) {
            downloadBtn.href = entry.svgDataUrl;
            downloadBtn.download = `design-${sanitizeFilenameToken(entry.name || 'produto')}.svg`;
            downloadBtn.style.display = 'inline-flex';
        } else {
            downloadBtn.style.display = 'none';
        }
    }
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.order-design-view-btn');
    if (btn && btn.dataset.designKey) {
        openAdminDesignViewer(btn.dataset.designKey);
    }
});

document.getElementById('close-design-viewer')?.addEventListener('click', () => {
    document.getElementById('design-viewer-modal')?.classList.add('hidden');
});
document.getElementById('close-design-viewer-2')?.addEventListener('click', () => {
    document.getElementById('design-viewer-modal')?.classList.add('hidden');
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
    checkAdminAuth();
});

// Make functions globally available
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewContact = viewContact;
window.viewOrder = viewOrder;
window.viewClient = viewClient;
