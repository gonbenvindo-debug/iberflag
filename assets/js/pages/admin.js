// ===== ADMIN PANEL LOGIC =====

// ── Authentication ──────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin123@iberflag.pt';
let adminWriteSessionLastError = '';
let failedLoginAttempts = 0;
let loginBlockedUntil = 0;

function isAdminSupabaseReady() {
    return Boolean(
        window.supabase &&
        typeof window.supabase.createClient === 'function' &&
        window.APP_CONFIG?.SUPABASE_URL &&
        window.APP_CONFIG?.SUPABASE_ANON_KEY &&
        supabaseClient &&
        typeof supabaseClient.from === 'function' &&
        supabaseClient.auth &&
        typeof supabaseClient.auth.getSession === 'function'
    );
}

function setAdminOverlayStatus(message = '', tone = 'info') {
    const statusEl = document.getElementById('admin-login-status');
    if (!statusEl) return;

    if (!message) {
        statusEl.textContent = '';
        statusEl.className = 'hidden text-sm rounded-xl px-4 py-3 border';
        return;
    }

    const tones = {
        info: 'text-slate-700 bg-slate-50 border-slate-200',
        warning: 'text-amber-800 bg-amber-50 border-amber-200',
        error: 'text-red-700 bg-red-50 border-red-200',
        success: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    };

    statusEl.className = `text-sm rounded-xl px-4 py-3 border ${tones[tone] || tones.info}`;
    statusEl.textContent = message;
}

function setAdminLoginEnabled(enabled) {
    const passwordInput = document.getElementById('admin-password');
    const button = document.getElementById('admin-login-btn');
    if (passwordInput) passwordInput.disabled = !enabled;
    if (button) button.disabled = !enabled;
}

function getAdminSupabaseBootstrapError() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        return 'SDK do Supabase nao foi carregado.';
    }

    if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
        return 'Configuracao do Supabase incompleta em APP_CONFIG.';
    }

    if (!supabaseClient || typeof supabaseClient.from !== 'function') {
        return 'Nao foi possivel inicializar o cliente Supabase.';
    }

    return '';
}

function ensureAdminSupabaseReady() {
    const bootstrapError = getAdminSupabaseBootstrapError();
    if (!bootstrapError) {
        setAdminOverlayStatus('', 'info');
        setAdminLoginEnabled(true);
        return true;
    }

    adminWriteSessionLastError = bootstrapError;
    setAdminOverlayStatus(`Erro tecnico do admin: ${bootstrapError}`, 'error');
    setAdminLoginEnabled(false);
    showLoginOverlay();
    return false;
}

function getSessionEmail(session) {
    return (session?.user?.email || '').trim().toLowerCase();
}

function isAllowedAdminSession(session) {
    return getSessionEmail(session) === ADMIN_EMAIL;
}

function getRemainingLockSeconds() {
    return Math.max(0, Math.ceil((loginBlockedUntil - Date.now()) / 1000));
}

async function ensureAdminWriteSession() {
    adminWriteSessionLastError = '';

    if (!ensureAdminSupabaseReady()) {
        return false;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && isAllowedAdminSession(session)) {
            return true;
        }

        adminWriteSessionLastError = session
            ? 'Sessao autenticada nao pertence ao admin autorizado.'
            : 'Sem sessao autenticada.';

        if (session && !isAllowedAdminSession(session)) {
            await supabaseClient.auth.signOut();
        }

        showLoginOverlay();
        return false;
    } catch (error) {
        adminWriteSessionLastError = error?.message || 'Falha inesperada ao validar sessao.';
        showLoginOverlay();
        return false;
    }
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
    if (!ensureAdminSupabaseReady()) {
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && isAllowedAdminSession(session)) {
            hideLoginOverlay();
            setAdminOverlayStatus('', 'info');
            loadDashboard();
            return;
        }

        if (session && !isAllowedAdminSession(session)) {
            await supabaseClient.auth.signOut();
        }

        showLoginOverlay();
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
            if (!ensureAdminSupabaseReady()) {
                return;
            }
            const password = document.getElementById('admin-password').value;
            const btn = document.getElementById('admin-login-btn');
            const btnText = document.getElementById('admin-login-btn-text');
            const errorEl = document.getElementById('admin-login-error');

            const remainingLockSeconds = getRemainingLockSeconds();
            if (remainingLockSeconds > 0) {
                errorEl.textContent = `Muitas tentativas falhadas. Aguarde ${remainingLockSeconds}s.`;
                errorEl.classList.remove('hidden');
                return;
            }

            btn.disabled = true;
            btnText.textContent = 'A entrar...';
            errorEl.classList.add('hidden');

            const { error } = await supabaseClient.auth.signInWithPassword({
                email: ADMIN_EMAIL,
                password
            });

            if (error) {
                failedLoginAttempts += 1;
                if (failedLoginAttempts >= 5) {
                    loginBlockedUntil = Date.now() + 60_000;
                    failedLoginAttempts = 0;
                }

                errorEl.textContent = 'Credenciais invalidas. Verifique a password do admin.';
                errorEl.classList.remove('hidden');
                btn.disabled = false;
                btnText.textContent = 'Entrar';
                return;
            }

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!isAllowedAdminSession(session)) {
                await supabaseClient.auth.signOut();
                errorEl.textContent = 'Acesso nao autorizado para este utilizador.';
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
        });
    }

    // Logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!ensureAdminSupabaseReady()) {
                return;
            }
            await supabaseClient.auth.signOut();
            showLoginOverlay();
        });
    }
});

// ── End Authentication ──────────────────────────────────────────────────────
let currentTab = 'dashboard';
let currentProductId = null;
let currentBaseId = null;
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
const baseModal = document.getElementById('base-modal');
const contactModal = document.getElementById('contact-modal');
const orderModal = document.getElementById('order-modal');
const productForm = document.getElementById('product-form');
const baseForm = document.getElementById('base-form');
const addProductBtn = document.getElementById('add-product-btn');
const addBaseBtn = document.getElementById('add-base-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const closeBaseModalBtn = document.getElementById('close-base-modal');
const cancelBaseModalBtn = document.getElementById('cancel-base-modal');
const closeContactModalBtns = document.querySelectorAll('.close-contact-modal');
const closeOrderModalBtns = document.querySelectorAll('.close-order-modal');
const markRespondedBtn = document.getElementById('mark-responded');
const saveOrderBtn = document.getElementById('save-order-btn');
const svgPreviewModal = document.getElementById('svg-preview-modal');
const openSvgPreviewBtn = document.getElementById('open-svg-preview');
const closeSvgPreviewBtns = document.querySelectorAll('.close-svg-preview');
const svgPreviewCanvas = document.getElementById('svg-preview-canvas');
const svgPreviewStatus = document.getElementById('svg-preview-status');
const adminModals = [productModal, baseModal, contactModal, orderModal, svgPreviewModal].filter(Boolean);

const productBasesAssignments = document.getElementById('product-bases-assignments');
let baseCatalogCache = [];

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
    switch (tabName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'produtos':
            await loadProducts();
            await loadBaseCatalog();
            break;
        case 'bases':
            await loadBases();
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

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Nao foi possivel ler o ficheiro.'));
        reader.readAsDataURL(file);
    });
}

function loadImageFromSrc(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Nao foi possivel processar a imagem.'));
        img.src = src;
    });
}

async function convertImageFileToWebPDataUrl(file, options = {}) {
    if (!file || !String(file.type || '').startsWith('image/')) {
        throw new Error('Selecione um ficheiro de imagem valido.');
    }

    const maxDimension = Number(options.maxDimension || 2048);
    const quality = Number(options.quality || 0.9);
    const sourceDataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromSrc(sourceDataUrl);

    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    const largerSide = Math.max(sourceWidth, sourceHeight, 1);
    const scale = largerSide > maxDimension ? (maxDimension / largerSide) : 1;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Nao foi possivel preparar o conversor de imagem.');
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const webpDataUrl = canvas.toDataURL('image/webp', quality);
    if (!webpDataUrl || !webpDataUrl.startsWith('data:image/webp')) {
        throw new Error('Falha ao converter imagem para WebP.');
    }

    return webpDataUrl;
}

function setImagePreview(previewElement, imageValue) {
    if (!previewElement) return;
    const src = String(imageValue || '').trim();
    if (!src) {
        previewElement.removeAttribute('src');
        previewElement.classList.add('hidden');
        return;
    }
    previewElement.src = src;
    previewElement.classList.remove('hidden');
}

function setImageStatus(statusElement, message, tone = 'neutral') {
    if (!statusElement) return;
    const toneClasses = {
        neutral: 'text-gray-500',
        success: 'text-emerald-600',
        loading: 'text-blue-600',
        error: 'text-red-600'
    };

    statusElement.classList.remove('text-gray-500', 'text-emerald-600', 'text-blue-600', 'text-red-600');
    statusElement.classList.add(toneClasses[tone] || toneClasses.neutral);
    statusElement.textContent = message;
}

function setProductImageValue(value = '', statusMessage = 'Carregue uma imagem. O sistema converte automaticamente para WebP.', statusTone = 'neutral') {
    if (productImageHiddenInput) {
        productImageHiddenInput.value = String(value || '').trim();
    }
    setImagePreview(productImagePreview, value);
    setImageStatus(productImageStatus, statusMessage, statusTone);
}

function setBaseImageValue(value = '', statusMessage = 'Carregue uma imagem. O sistema converte automaticamente para WebP.', statusTone = 'neutral') {
    if (baseImageHiddenInput) {
        baseImageHiddenInput.value = String(value || '').trim();
    }
    setImagePreview(baseImagePreview, value);
    setImageStatus(baseImageStatus, statusMessage, statusTone);
}

function bindAdminImageUpload(fileInput, setImageValue, label) {
    if (!fileInput) return;

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setImageValue('', `A converter ${label} para WebP...`, 'loading');
            const webpDataUrl = await convertImageFileToWebPDataUrl(file, { quality: 0.9, maxDimension: 2048 });
            setImageValue(webpDataUrl, `${label} pronta em WebP.`, 'success');
        } catch (error) {
            console.error(`Erro ao converter ${label}:`, error);
            setImageValue('', `Nao foi possivel converter ${label}. Tente outro ficheiro.`, 'error');
            showToast(`Erro ao converter ${label} para WebP`, 'error');
        } finally {
            fileInput.value = '';
        }
    });
}

function isMissingBasesSchema(error) {
    const msg = String(error?.message || error?.details || '').toLowerCase();
    return msg.includes('bases_fixacao') || msg.includes('produto_bases_fixacao');
}

function ensureProductCategoryOption(value) {
    const select = document.getElementById('product-categoria');
    const categoryValue = String(value || '').trim();
    if (!select || !categoryValue) return;

    const hasOption = Array.from(select.options).some(
        (option) => String(option.value || '').trim().toLowerCase() === categoryValue.toLowerCase()
    );

    if (hasOption) return;

    const option = document.createElement('option');
    option.value = categoryValue;
    option.textContent = categoryValue
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    select.appendChild(option);
}

async function loadBaseCatalog(force = false) {
    if (!force && Array.isArray(baseCatalogCache) && baseCatalogCache.length > 0) {
        return baseCatalogCache;
    }

    const { data, error } = await supabaseClient
        .from('bases_fixacao')
        .select('*')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true });

    if (error) {
        if (isMissingBasesSchema(error)) {
            console.warn('Schema de bases ainda nÃ£o aplicado:', error.message);
            baseCatalogCache = [];
            return [];
        }
        throw error;
    }

    baseCatalogCache = data || [];
    return baseCatalogCache;
}

function renderProductBaseAssignments(assignedBaseIds = [], defaultBaseId = null) {
    if (!productBasesAssignments) return;

    const assignedSet = new Set((assignedBaseIds || []).map((id) => Number(id)));
    const allBases = Array.isArray(baseCatalogCache) ? baseCatalogCache : [];

    if (allBases.length === 0) {
        productBasesAssignments.innerHTML = '<p class="text-sm text-gray-500">Sem bases disponÃ­veis. Crie bases no separador "Bases".</p>';
        return;
    }

    productBasesAssignments.innerHTML = allBases.map((base) => {
        const checked = assignedSet.has(Number(base.id));
        const defaultChecked = checked && Number(base.id) === Number(defaultBaseId);

        return `
            <div class="rounded-lg border border-gray-200 bg-white p-3">
                <div class="flex items-start justify-between gap-3">
                    <label class="flex items-start gap-2 cursor-pointer flex-1">
                        <input type="checkbox" class="product-base-checkbox mt-1" value="${base.id}" ${checked ? 'checked' : ''}>
                        <div>
                            <p class="text-sm font-semibold text-gray-900">${escapeHtml(base.nome)}</p>
                            <p class="text-xs text-gray-500">+${formatCurrency(base.preco_extra || 0)}${base.ativo ? '' : ' • Inativa'}</p>
                        </div>
                    </label>
                    <label class="text-xs text-gray-600 flex items-center gap-1.5">
                        <input type="radio" name="product-base-default" class="product-base-default-radio" value="${base.id}" ${defaultChecked ? 'checked' : ''} ${checked ? '' : 'disabled'}>
                        Default
                    </label>
                </div>
            </div>
        `;
    }).join('');

    productBasesAssignments.querySelectorAll('.product-base-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const baseId = checkbox.value;
            const defaultRadio = productBasesAssignments.querySelector(`.product-base-default-radio[value="${CSS.escape(baseId)}"]`);
            if (!defaultRadio) return;

            if (checkbox.checked) {
                defaultRadio.disabled = false;
            } else {
                defaultRadio.checked = false;
                defaultRadio.disabled = true;
                const firstEnabled = productBasesAssignments.querySelector('.product-base-default-radio:not(:disabled)');
                if (firstEnabled) {
                    firstEnabled.checked = true;
                }
            }
        });
    });
}

async function loadProductBaseAssignments(productId) {
    const { data, error } = await supabaseClient
        .from('produto_bases_fixacao')
        .select('base_id, is_default')
        .eq('produto_id', productId)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

    if (error) {
        if (isMissingBasesSchema(error)) {
            return { ids: [], defaultId: null };
        }
        throw error;
    }

    const rows = data || [];
    const ids = rows.map((row) => Number(row.base_id));
    const defaultRow = rows.find((row) => row.is_default);

    return {
        ids,
        defaultId: defaultRow ? Number(defaultRow.base_id) : null
    };
}

function collectSelectedProductBaseAssignments() {
    if (!productBasesAssignments) {
        return { selectedIds: [], defaultId: null };
    }

    const selectedIds = Array.from(productBasesAssignments.querySelectorAll('.product-base-checkbox:checked'))
        .map((checkbox) => Number(checkbox.value))
        .filter(Number.isFinite);

    const defaultSelected = productBasesAssignments.querySelector('.product-base-default-radio:checked');
    const defaultId = defaultSelected ? Number(defaultSelected.value) : null;

    return {
        selectedIds,
        defaultId: selectedIds.includes(defaultId) ? defaultId : null
    };
}

async function saveProductBaseAssignments(productId) {
    const { selectedIds, defaultId } = collectSelectedProductBaseAssignments();

    const { error: deleteError } = await supabaseClient
        .from('produto_bases_fixacao')
        .delete()
        .eq('produto_id', productId);

    if (deleteError) {
        if (isMissingBasesSchema(deleteError)) return;
        throw deleteError;
    }

    if (selectedIds.length === 0) {
        return;
    }

    const rows = selectedIds.map((baseId, index) => ({
        produto_id: productId,
        base_id: baseId,
        ativo: true,
        ordem: index + 1,
        is_default: defaultId ? Number(baseId) === Number(defaultId) : index === 0
    }));

    const { error: insertError } = await supabaseClient
        .from('produto_bases_fixacao')
        .insert(rows);

    if (insertError) {
        if (isMissingBasesSchema(insertError)) return;
        throw insertError;
    }
}

// ===== DASHBOARD =====
async function loadDashboard() {
    if (!await ensureAdminWriteSession()) {
        return;
    }

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
        setAdminOverlayStatus(`Falha ao carregar dados do admin: ${error?.message || 'erro desconhecido'}`, 'error');
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
                    <td>${p.destaque ? '<span class="badge badge-warning">Sim</span>' : '<span class="badge">NÃ£o</span>'}</td>
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
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-400">Nenhum produto encontrado</td></tr>';
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
    addProductBtn.addEventListener('click', async () => {
        currentProductId = null;
        document.getElementById('modal-title').textContent = 'Adicionar Produto';
        productForm.reset();
        document.getElementById('product-ativo').checked = true;
        setProductImageValue('');
        resetSvgTemplateState();
        const createDesignBtn = document.getElementById('create-design-btn');
        if (createDesignBtn) {
            createDesignBtn.disabled = true;
            createDesignBtn.title = 'Guarde o produto primeiro para criar designs';
        }
        try {
            await loadBaseCatalog(true);
            renderProductBaseAssignments([], null);
        } catch (error) {
            console.error('Erro ao carregar bases para produto:', error);
            renderProductBaseAssignments([], null);
        }
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

document.addEventListener('click', (e) => {
    const btn = e.target.closest('#create-design-btn');
    if (!btn || btn.disabled) return;
    if (!currentProductId) {
        showToast('Guarde o produto primeiro', 'warning');
        return;
    }
    window.open(`/personalizar.html?produto=${currentProductId}&admin=true`, '_blank');
});

// ===== SVG FILE UPLOAD HANDLER =====
let svgTemplateContent = null;
let svgTemplateFileName = '';
let isReadingSvgTemplate = false;

const svgUpload = document.getElementById('product-svg-upload');
const svgPreview = document.getElementById('svg-preview');
const productSubmitBtn = productForm ? productForm.querySelector('button[type="submit"]') : null;
const productImageUploadInput = document.getElementById('product-imagem-upload');
const productImageHiddenInput = document.getElementById('product-imagem');
const productImagePreview = document.getElementById('product-imagem-preview');
const productImageStatus = document.getElementById('product-imagem-status');
const baseImageUploadInput = document.getElementById('base-imagem-upload');
const baseImageHiddenInput = document.getElementById('base-imagem');
const baseImagePreview = document.getElementById('base-imagem-preview');
const baseImageStatus = document.getElementById('base-imagem-status');

bindAdminImageUpload(productImageUploadInput, setProductImageValue, 'a imagem do produto');
bindAdminImageUpload(baseImageUploadInput, setBaseImageValue, 'a imagem da base');

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
        const padX = Math.max(sourceBounds.width * 0.06, 8);
        const padY = Math.max(sourceBounds.height * 0.06, 8);
        const viewBoxX = sourceBounds.x - padX;
        const viewBoxY = sourceBounds.y - padY;
        const viewBoxWidth = sourceBounds.width + (padX * 2);
        const viewBoxHeight = sourceBounds.height + (padY * 2);
        const previewSvg = document.createElementNS(svgNs, 'svg');
        previewSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
        previewSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        previewSvg.setAttribute('width', '100%');
        previewSvg.setAttribute('height', '100%');

        const printAreaOutline = document.createElementNS(svgNs, 'rect');
        printAreaOutline.setAttribute('x', String(sourceBounds.x));
        printAreaOutline.setAttribute('y', String(sourceBounds.y));
        printAreaOutline.setAttribute('width', String(sourceBounds.width));
        printAreaOutline.setAttribute('height', String(sourceBounds.height));
        printAreaOutline.setAttribute('fill', 'none');
        printAreaOutline.setAttribute('stroke', '#2563eb');
        printAreaOutline.setAttribute('stroke-width', '2');
        printAreaOutline.setAttribute('stroke-dasharray', '8 4');
        printAreaOutline.setAttribute('opacity', '0.55');

        const imported = document.importNode(root, true);
        imported.setAttribute('x', String(sourceBounds.x));
        imported.setAttribute('y', String(sourceBounds.y));
        imported.setAttribute('width', String(sourceBounds.width));
        imported.setAttribute('height', String(sourceBounds.height));
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

        const productImageValue = (productImageHiddenInput?.value || '').trim();
        if (!productImageValue) {
            showToast('Carregue a imagem do produto antes de guardar.', 'warning');
            return;
        }

        const productData = {
            nome: document.getElementById('product-nome').value,
            descricao: document.getElementById('product-descricao').value,
            preco: parseFloat(document.getElementById('product-preco').value),
            categoria: document.getElementById('product-categoria').value,
            imagem: productImageValue,
            svg_template: svgTemplateContent || null,
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

            if (currentProductId) {
                await saveProductBaseAssignments(currentProductId);
                await saveProductTemplates(currentProductId);
            } else {
                const insertedProductId = Array.isArray(result.data) && result.data[0]?.id
                    ? Number(result.data[0].id)
                    : null;
                if (insertedProductId) {
                    await saveProductBaseAssignments(insertedProductId);
                    await saveProductTemplates(insertedProductId);
                }
            }

            showToast(currentProductId ? 'Produto atualizado com sucesso!' : 'Produto adicionado com sucesso!', 'success');
            closeModal(productModal);
            resetSvgTemplateState();
            loadProducts();

        } catch (error) {
            console.error('Erro ao guardar produto:', error);
            if (isMissingBasesSchema(error)) {
                showToast('Produto guardado, mas falta aplicar o schema SQL das bases.', 'warning');
            } else {
                showToast('Erro ao guardar produto', 'error');
            }
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

        const el = (elId) => document.getElementById(elId);

        const modalTitle = el('modal-title');
        if (modalTitle) modalTitle.textContent = 'Editar Produto';

        const productNome = el('product-nome');
        if (productNome) productNome.value = data.nome || '';

        const productDescricao = el('product-descricao');
        if (productDescricao) productDescricao.value = data.descricao || '';

        const productPreco = el('product-preco');
        if (productPreco) productPreco.value = data.preco || '';

        const productCategoria = el('product-categoria');
        ensureProductCategoryOption(data.categoria || '');
        if (productCategoria) productCategoria.value = data.categoria || '';

        setProductImageValue(data.imagem || '', data.imagem ? 'Imagem atual carregada.' : 'Carregue uma imagem. O sistema converte automaticamente para WebP.', data.imagem ? 'success' : 'neutral');

        const productDestaque = el('product-destaque');
        if (productDestaque) productDestaque.checked = data.destaque || false;

        const productAtivo = el('product-ativo');
        if (productAtivo) productAtivo.checked = data.ativo !== false;

        if (data.svg_template) {
            setSvgTemplateContent(data.svg_template, 'Template SVG atual');
        } else {
            resetSvgTemplateState();
        }

        const modal = el('product-modal');
        if (modal) {
            openModal(modal);
        } else {
            console.error('Modal product-modal nao encontrado no DOM');
        }

        renderProductBaseAssignments([], null);
        currentProductTemplates = [];
        renderProductTemplatesAssignments();
        renderAvailableTemplatesSelect();

        await loadBaseCatalog(true).then(async () => {
            const baseAssignments = await loadProductBaseAssignments(id);
            renderProductBaseAssignments(baseAssignments.ids, baseAssignments.defaultId);
        }).catch((error) => {
            console.error('Erro ao carregar bases do produto:', error);
            renderProductBaseAssignments([], null);
        });

        await loadTemplatesCatalog().then(async () => {
            currentProductTemplates = await loadProductTemplates(id);
            renderProductTemplatesAssignments();
            renderAvailableTemplatesSelect();
        }).catch((error) => {
            console.error('Erro ao carregar templates do produto:', error);
            currentProductTemplates = [];
            renderProductTemplatesAssignments();
            renderAvailableTemplatesSelect();
        });

        const createDesignBtn = el('create-design-btn');
        if (createDesignBtn) {
            createDesignBtn.disabled = false;
            createDesignBtn.title = 'Abrir editor para criar design';
        }

    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        showToast('Erro ao carregar produto', 'error');
    }
}

// ===== BASES =====
async function loadBases() {
    try {
        const bases = await loadBaseCatalog(true);
        const tbody = document.getElementById('bases-tbody');
        if (!tbody) return;

        if (!bases.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">Nenhuma base encontrada</td></tr>';
            return;
        }

        tbody.innerHTML = bases.map((base) => `
            <tr>
                <td>${base.id}</td>
                <td><img src="${escapeHtml(base.imagem)}" alt="${escapeHtml(base.nome)}" class="w-12 h-12 object-cover rounded"></td>
                <td class="font-semibold">${escapeHtml(base.nome)}</td>
                <td class="font-bold text-blue-600">+${formatCurrency(base.preco_extra || 0)}</td>
                <td>${base.ordem || 0}</td>
                <td>${base.ativo ? '<span class="badge badge-success">Ativa</span>' : '<span class="badge badge-danger">Inativa</span>'}</td>
                <td>
                    <div class="flex gap-2">
                        <button onclick="editBase(${base.id})" class="text-blue-600 hover:text-blue-800" title="Editar">
                            <i data-lucide="edit" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteBase(${base.id})" class="text-red-600 hover:text-red-800" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Erro ao carregar bases:', error);
        if (isMissingBasesSchema(error)) {
            showToast('Aplique os SQL de variantes para ativar as bases.', 'warning');
        } else {
            showToast('Erro ao carregar bases', 'error');
        }
    }
}

if (addBaseBtn) {
    addBaseBtn.addEventListener('click', () => {
        currentBaseId = null;
        document.getElementById('base-modal-title').textContent = 'Adicionar Base';
        if (baseForm) baseForm.reset();
        setBaseImageValue('');
        document.getElementById('base-preco-extra').value = '0';
        document.getElementById('base-ordem').value = '0';
        document.getElementById('base-ativo').checked = true;
        openModal(baseModal);
    });
}

if (closeBaseModalBtn) {
    closeBaseModalBtn.addEventListener('click', () => closeModal(baseModal));
}

if (cancelBaseModalBtn) {
    cancelBaseModalBtn.addEventListener('click', () => closeModal(baseModal));
}

if (baseForm) {
    baseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('base-nome').value.trim();
        const baseImageValue = (baseImageHiddenInput?.value || '').trim();
        if (!baseImageValue) {
            showToast('Carregue a imagem da base antes de guardar.', 'warning');
            return;
        }

        const baseData = {
            nome,
            slug: slugify(nome),
            descricao: document.getElementById('base-descricao').value.trim() || null,
            imagem: baseImageValue,
            preco_extra: parseFloat(document.getElementById('base-preco-extra').value || '0') || 0,
            ordem: parseInt(document.getElementById('base-ordem').value || '0', 10) || 0,
            ativo: document.getElementById('base-ativo').checked
        };

        try {
            let result;
            if (currentBaseId) {
                result = await supabaseClient
                    .from('bases_fixacao')
                    .update(baseData)
                    .eq('id', currentBaseId);
            } else {
                result = await supabaseClient
                    .from('bases_fixacao')
                    .insert([baseData]);
            }

            if (result.error) throw result.error;

            showToast(currentBaseId ? 'Base atualizada com sucesso!' : 'Base adicionada com sucesso!', 'success');
            closeModal(baseModal);
            await loadBases();
            await loadBaseCatalog(true);
        } catch (error) {
            console.error('Erro ao guardar base:', error);
            if (isMissingBasesSchema(error)) {
                showToast('Aplique os SQL de variantes antes de criar bases.', 'warning');
            } else {
                showToast('Erro ao guardar base', 'error');
            }
        }
    });
}

async function editBase(id) {
    try {
        const { data, error } = await supabaseClient
            .from('bases_fixacao')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentBaseId = id;
        document.getElementById('base-modal-title').textContent = 'Editar Base';
        document.getElementById('base-nome').value = data.nome || '';
        document.getElementById('base-descricao').value = data.descricao || '';
        setBaseImageValue(data.imagem || '', data.imagem ? 'Imagem atual carregada.' : 'Carregue uma imagem. O sistema converte automaticamente para WebP.', data.imagem ? 'success' : 'neutral');
        document.getElementById('base-preco-extra').value = data.preco_extra ?? 0;
        document.getElementById('base-ordem').value = data.ordem ?? 0;
        document.getElementById('base-ativo').checked = Boolean(data.ativo);

        openModal(baseModal);
    } catch (error) {
        console.error('Erro ao carregar base:', error);
        showToast('Erro ao carregar base', 'error');
    }
}

async function deleteBase(id) {
    if (!confirm('Tem a certeza que deseja eliminar esta base?')) return;

    try {
        const { error } = await supabaseClient
            .from('bases_fixacao')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Base eliminada com sucesso!', 'success');
        await loadBases();
        await loadBaseCatalog(true);
    } catch (error) {
        console.error('Erro ao eliminar base:', error);
        showToast('Erro ao eliminar base', 'error');
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
        const cached = ordersCache.get(orderId) || null;
        let order = cached;

        if (!order) {
            const { data: orderData, error: orderError } = await supabaseClient
                .from('encomendas')
                .select('*, clientes(*)')
                .eq('id', orderId)
                .maybeSingle();

            if (orderError) throw orderError;
            order = orderData || null;
        } else {
            supabaseClient
                .from('encomendas')
                .select('*, clientes(*)')
                .eq('id', orderId)
                .maybeSingle()
                .then(({ data: freshOrder }) => {
                    if (!freshOrder) return;
                    ordersCache.set(orderId, freshOrder);
                })
                .catch(() => {
                    // Sem bloquear a abertura do modal quando o refresh falha
                });
        }

        if (!order) {
            showToast('Encomenda nao encontrada', 'warning');
            return;
        }

        let itemsData = [];
        const { data: fetchedItems, error: itemsError } = await supabaseClient
            .from('itens_encomenda')
            .select('*, produtos(*)')
            .eq('encomenda_id', orderId)
            .order('id', { ascending: true });

        if (itemsError) {
            console.warn('Erro ao carregar itens da encomenda:', itemsError.message);
        } else {
            itemsData = Array.isArray(fetchedItems) ? fetchedItems : [];
        }

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
        if (metaEl) metaEl.textContent = `${escapeHtml(order.numero_encomenda || '')} Â· ${formatDateTime(order.created_at)}`;

        if (summaryBlock) {
            summaryBlock.innerHTML = `
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:1.5rem;">
                    <div>
                        <p style="font-size:0.6875rem;color:#6b7280;margin:0 0 0.125rem;">NÂº Encomenda</p>
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
            const nif = escapeHtml(order.clientes?.nif || '—');
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
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;">
                        <span style="color:#9ca3af;flex-shrink:0;">NIF</span>
                        <span style="color:#374151;text-align:right;font-family:monospace;">${nif}</span>
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
                        : `<p style="font-size:0.75rem;color:#9ca3af;margin:0.2rem 0 0;">Sem opÃ§Ãµes</p>`;

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
                                <th style="padding:0 0.75rem 0.625rem 0;font-size:0.625rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;text-align:left;">Produto / OpÃ§Ãµes</th>
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
                historyList.innerHTML = '<p style="font-size:0.875rem;color:#9ca3af;">Sem histÃ³rico de atualizaÃ§Ãµes.</p>';
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

document.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('.order-view-btn');
    if (!viewBtn) return;

    const orderId = viewBtn.getAttribute('data-order-id');
    if (!orderId) {
        showToast('ID da encomenda invalido', 'warning');
        return;
    }

    viewOrder(orderId);
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
window.editBase = editBase;
window.deleteBase = deleteBase;
window.viewContact = viewContact;
window.viewOrder = viewOrder;
window.viewClient = viewClient;

// Fluxo antigo de aba/templates removido.

// ===== TEMPLATES MANAGEMENT FOR PRODUCTS =====
let templatesCatalogCache = [];
let currentProductTemplates = [];

async function loadTemplatesCatalog(force = false) {
    if (!force && Array.isArray(templatesCatalogCache) && templatesCatalogCache.length > 0) {
        return templatesCatalogCache;
    }

    const { data, error } = await supabaseClient
        .from('templates')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        console.warn('Erro ao carregar templates:', error.message);
        templatesCatalogCache = [];
        return [];
    }

    templatesCatalogCache = data || [];
    return templatesCatalogCache;
}

function updateTemplatesCounter() {
    const counter = document.getElementById('templates-counter');
    if (counter) {
        const count = templatesCatalogCache.length;
        counter.textContent = `${count} design${count !== 1 ? 's' : ''}`;
        counter.className = count > 0
            ? 'text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full'
            : 'text-xs font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full';
    }
}

function openTemplateInCustomizerFromCard(templateId) {
    if (!templateId) return;

    // Tentar obter o ID do produto do select ou do currentProductId
    const produtoSelect = document.getElementById('produto-select');
    const productId = produtoSelect?.value || currentProductId;

    if (!productId) {
        showToast('Selecione um produto primeiro para continuar a editar o design', 'warning');
        return;
    }

    const customizerUrl = `/personalizar.html?produto=${encodeURIComponent(String(productId))}&admin=true&editTemplate=${encodeURIComponent(String(templateId))}`;
    window.open(customizerUrl, '_blank', 'noopener,noreferrer');
}

function confirmTemplateDeleteCard(templateName = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-6">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">Apagar template</h3>
                        <p class="text-sm text-gray-600 mt-1">Esta aÃ§Ã£o remove o template <strong>${escapeHtml(templateName || 'sem nome')}</strong> e nÃ£o pode ser desfeita.</p>
                    </div>
                </div>
                <div class="mt-5 flex flex-col-reverse sm:flex-row gap-3 justify-end">
                    <button type="button" data-action="cancel" class="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition min-h-[44px]">Cancelar</button>
                    <button type="button" data-action="confirm" class="px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition min-h-[44px] inline-flex items-center justify-center gap-2">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                        Apagar Template
                    </button>
                </div>
            </div>
        `;

        const cleanup = (result) => {
            overlay.remove();
            document.removeEventListener('keydown', onEsc);
            resolve(result);
        };

        const onEsc = (event) => {
            if (event.key === 'Escape') {
                cleanup(false);
            }
        };

        overlay.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target === overlay) {
                cleanup(false);
                return;
            }

            const button = target.closest('[data-action]');
            if (!button) return;

            const action = button.getAttribute('data-action');
            cleanup(action === 'confirm');
        });

        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    });
}

async function deleteTemplateFromCard(templateId) {
    if (!templateId) {
        console.error('ID de template inválido:', templateId);
        return;
    }

    console.log('A apagar template:', templateId);
    const template = templatesCatalogCache.find((item) => item.id === templateId) || null;
    const confirmed = await confirmTemplateDeleteCard(template?.nome || 'Template');
    if (!confirmed) {
        console.log('Usuário cancelou a exclusÃ£o');
        return;
    }

    const hasWriteSession = await ensureAdminWriteSession();
    if (!hasWriteSession) {
        const authMsg = adminWriteSessionLastError
            ? `Sem sessÃ£o de escrita no Supabase: ${adminWriteSessionLastError}`
            : 'Sem sessÃ£o de escrita no Supabase. Inicie sessÃ£o admin real para apagar templates.';
        showToast(authMsg, 'error');
        return;
    }

    try {
        const { error: deleteLinksError } = await supabaseClient
            .from('produto_templates')
            .delete()
            .eq('template_id', templateId);

        if (deleteLinksError) {
            console.warn('Erro ao remover vÃ­nculos do template:', deleteLinksError.message);
        }

        const { error: deleteTemplateError } = await supabaseClient
            .from('templates')
            .delete()
            .eq('id', templateId);

        if (deleteTemplateError) throw deleteTemplateError;

        showToast('Template apagado com sucesso', 'success');
        await loadTemplatesCatalog(true);
        renderProductTemplatesGrid();
    } catch (error) {
        console.error('Erro ao apagar template:', error);
        const detail = [error?.message, error?.details, error?.hint]
            .filter(Boolean)
            .join(' | ');
        showToast(detail || 'Erro ao apagar template', 'error');
    }
}

function renderProductTemplatesGrid() {
    const grid = document.getElementById('product-templates-grid');
    if (!grid) {
        console.error('Grid de templates nÃ£o encontrado');
        return;
    }

    console.log('Renderizando grid de templates...');
    console.log('Templates disponÃ­veis:', templatesCatalogCache.length);

    // Log para debug dos IDs
    if (templatesCatalogCache.length > 0) {
        console.log('Primeiro template ID:', templatesCatalogCache[0].id, typeof templatesCatalogCache[0].id);
    }

    const allTemplates = Array.isArray(templatesCatalogCache) ? templatesCatalogCache : [];

    if (allTemplates.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i data-lucide="layout-template" class="w-10 h-10 mx-auto text-gray-300 mb-2"></i>
                <p class="text-sm text-gray-400">Nenhum template disponivel</p>
            </div>`;
        updateTemplatesCounter();
        lucide.createIcons();
        return;
    }

    grid.innerHTML = allTemplates.map(t => {
        const previewUrl = t.preview_url || t.thumbnail_url || '/assets/images/template-placeholder.svg';
        const safeName = escapeHtml(t.nome);
        const previewMarkup = window.DesignSvgStore?.buildPreviewSvgMarkup?.(
            previewUrl,
            null,
            { backgroundColor: '#f8fafc' }
        );
        return `
            <div class="template-toggle-card group relative rounded-xl border-2 bg-white overflow-hidden transition-all duration-200 border-gray-200 hover:border-gray-300 hover:shadow-sm"
                data-template-id="${t.id}">
                <div class="template-toggle-preview relative bg-gray-50">
                    ${previewMarkup
                        ? `<span class="template-preview-svg-wrap">${previewMarkup}</span>`
                        : `<img src="${previewUrl}" 
                            alt="${safeName}" 
                            class="template-preview-img transition-transform duration-300 group-hover:scale-[1.02]"
                            onerror="this.src='/assets/images/template-placeholder.svg'; this.onerror=null;">`}
                    <button type="button" class="template-edit-btn absolute top-1 right-1 w-7 h-7 rounded-full bg-white/95 border border-gray-300 text-red-600 hover:text-red-700 hover:bg-white flex items-center justify-center transition-all duration-200" data-template-id="${t.id}" title="Continuar a editar template">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <div class="px-2 py-2 border-t border-gray-100 bg-white">
                    <h4 class="font-semibold text-xs text-gray-900 truncate text-center leading-tight" title="${safeName}">${safeName}</h4>
                </div>
            </div>`;
    }).join('');

    // Limpar listeners anteriores se existir
    const newGrid = grid.cloneNode(true);
    grid.parentNode.replaceChild(newGrid, grid);

    newGrid.addEventListener('click', (event) => {
        const target = event.target;

        // BotÃ£o de lixo
        const deleteBtn = target.closest('.template-edit-btn');
        if (deleteBtn) {
            event.preventDefault();
            event.stopPropagation();
            console.log('BotÃ£o apagar clicado:', deleteBtn.dataset.templateId);
            deleteTemplateFromCard(deleteBtn.dataset.templateId);
            return;
        }

        // Clique no card (mas nÃ£o no botÃ£o)
        const card = target.closest('.template-toggle-card');
        if (card) {
            console.log('Card clicado:', card.dataset.templateId);
            openTemplateInCustomizerFromCard(card.dataset.templateId);
        }
    });

    updateTemplatesCounter();
    lucide.createIcons();
}

function renderAvailableTemplatesSelect() {
    renderProductTemplatesGrid();
}

function renderProductTemplatesAssignments() {
    renderProductTemplatesGrid();
}

async function loadProductTemplates(productId) {
    const { data, error } = await supabaseClient
        .from('produto_templates')
        .select('*, templates(*)')
        .eq('produto_id', productId)
        .order('ordem', { ascending: true });

    if (error) {
        console.warn('Erro ao carregar templates do produto:', error.message);
        return [];
    }

    return (data || []).map(d => ({ template_id: String(d.template_id), ordem: d.ordem }));
}

async function saveProductTemplates(productId) {
    const { error: deleteError } = await supabaseClient
        .from('produto_templates')
        .delete()
        .eq('produto_id', productId);

    if (deleteError) {
        console.warn('Erro ao remover templates antigos:', deleteError.message);
    }

    if (currentProductTemplates.length === 0) {
        return;
    }

    const rows = currentProductTemplates.map((pt, index) => ({
        produto_id: productId,
        template_id: String(pt.template_id),
        ordem: index + 1
    }));

    const { error: insertError } = await supabaseClient
        .from('produto_templates')
        .insert(rows);

    if (insertError) {
        console.warn('Erro ao guardar templates:', insertError.message);
    }
}

// Expor funcoes necessarias ao escopo global para botoes onclick
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
