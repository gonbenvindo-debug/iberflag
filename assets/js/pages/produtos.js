// ===== PRODUCTS PAGE LOGIC =====

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let allProducts = [];
let filteredProducts = [];
let currentCategory = 'all';
let currentSort = 'default';
let priceFilters = [];

function parseProductPrice(product) {
    const numericPrice = Number(product?.preco);
    return Number.isFinite(numericPrice) ? numericPrice : 0;
}

// ===== DOM ELEMENTS =====
const productsGrid = document.getElementById('products-grid');
const productCount = document.getElementById('product-count');
const emptyState = document.getElementById('empty-state');
const sortSelect = document.getElementById('sort-select');
const clearFiltersBtn = document.getElementById('clear-filters');
const categoryFiltersContainer = document.getElementById('category-filters');
const priceCheckboxes = document.querySelectorAll('.price-filter');
let categoryRadios = [];

// ===== LOAD PRODUCTS =====
async function loadAllProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            allProducts = data;
        } else {
            allProducts = initialProducts || [];
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error?.message || error);
        allProducts = initialProducts || [];
    }

    buildDynamicCategoryFilters();
    applyFilters();
}

// ===== RENDER PRODUCTS =====
function renderProductsGrid(products) {
    if (!productsGrid || !emptyState || !productCount) return;

    if (!products || products.length === 0) {
        productsGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        productCount.textContent = '0';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }

    productsGrid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    productCount.textContent = products.length;

    productsGrid.innerHTML = products.map(product => `
        ${(() => {
            const safeName = escapeHtml(product?.nome || 'Produto sem nome');
            const safeCategory = escapeHtml(getCategoryName(product?.categoria || 'outros'));
            const safeImage = escapeHtml(product?.imagem || '/assets/images/template-placeholder.svg');
            const safePrice = parseProductPrice(product).toFixed(2);
            const safeProductId = escapeHtml(String(product?.id || ''));
            const safeProductNameParam = encodeURIComponent(String(product?.nome || 'Produto sem nome'));
            return `
        <div class="product-card page-transition" data-product-id="${product.id}">
            <div class="product-card-image image-zoom">
                <img src="${safeImage}" alt="${safeName}" class="w-full h-full object-cover" loading="lazy">
                <div class="product-badge">
                    ${safePrice}€
                </div>
                ${product.destaque ? '<div class="absolute top-4 left-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">Destaque</div>' : ''}
            </div>
            <div class="product-card-body">
                <div class="product-card-meta">${safeCategory}</div>
                <h3 class="product-card-title">${safeName}</h3>
                <button
                    type="button"
                    data-open-templates="true"
                    data-product-id="${safeProductId}"
                    data-product-name="${safeProductNameParam}"
                    class="product-card-cta cursor-pointer min-h-[44px]">
                    <i data-lucide="palette" class="w-4 h-4"></i>
                    Personalizar e Comprar
                </button>
            </div>
        </div>
    `;
        })()}
    `).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===== FILTER & SORT =====
function applyFilters() {
    let products = [...allProducts];

    // Category filter
    if (currentCategory !== 'all') {
        products = products.filter((product) => String(product?.categoria || '').trim().toLowerCase() === currentCategory);
    }

    // Price filters
    if (priceFilters.length > 0) {
        products = products.filter(product => {
            return priceFilters.some(filter => {
                return product.preco >= filter.min && product.preco <= filter.max;
            });
        });
    }

    // Sort
    switch (currentSort) {
        case 'price-asc':
            products.sort((a, b) => a.preco - b.preco);
            break;
        case 'price-desc':
            products.sort((a, b) => b.preco - a.preco);
            break;
        case 'name-asc':
            products.sort((a, b) => a.nome.localeCompare(b.nome));
            break;
        case 'name-desc':
            products.sort((a, b) => b.nome.localeCompare(a.nome));
            break;
        default:
            // Default sorting - featured first, then by creation date
            products.sort((a, b) => {
                if (a.destaque && !b.destaque) return -1;
                if (!a.destaque && b.destaque) return 1;
                return 0;
            });
    }

    filteredProducts = products;
    renderProductsGrid(products);
}

// ===== HELPER FUNCTIONS =====
function getCategoryName(categoria) {
    const normalized = String(categoria || '').trim();
    if (!normalized) return 'Sem categoria';

    const knownCategories = {
        'flybanners': 'Flybanners',
        'rollups': 'Roll-ups',
        'lonas': 'Lonas & Banners',
        'fly-banner': 'Fly Banner',
        'mini-fly-banner': 'Mini Fly Banner',
        'x-banner': 'X-Banner',
        'roll-up': 'Roll Up',
        'wall-banner': 'Wall Banner',
        'tenda-publicitaria': 'Tenda Publicitária',
        'photocall': 'Photocall',
        'mastros': 'Mastros',
        'cubo-publicitario': 'Cubo Publicitário',
        'balcao-promocional': 'Balcão Promocional',
        'bandeiras': 'Bandeiras'
    };

    if (knownCategories[normalized]) {
        return knownCategories[normalized];
    }

    return normalized
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildDynamicCategoryFilters() {
    if (!categoryFiltersContainer) return;

    const categoryCounts = new Map();
    allProducts.forEach((product) => {
        const key = String(product?.categoria || '').trim().toLowerCase();
        if (!key) return;
        categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    });

    const categories = Array.from(categoryCounts.entries())
        .map(([value, count]) => ({ value, count, label: getCategoryName(value) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-PT', { sensitivity: 'base' }));

    if (currentCategory !== 'all' && !categoryCounts.has(String(currentCategory).toLowerCase())) {
        currentCategory = 'all';
    }

    categoryFiltersContainer.innerHTML = `
        <label class="flex items-center cursor-pointer">
            <input type="radio" name="category" value="all" class="custom-radio" ${currentCategory === 'all' ? 'checked' : ''}>
            <span class="ml-2 text-sm">Todos os Produtos (${allProducts.length})</span>
        </label>
        ${categories.map((category) => `
            <label class="flex items-center cursor-pointer">
                <input type="radio" name="category" value="${escapeHtml(category.value)}" class="custom-radio" ${String(currentCategory).toLowerCase() === category.value ? 'checked' : ''}>
                <span class="ml-2 text-sm">${escapeHtml(category.label)} (${category.count})</span>
            </label>
        `).join('')}
    `;

    bindCategoryFilterListeners();
}

function bindCategoryFilterListeners() {
    categoryRadios = Array.from(document.querySelectorAll('input[name="category"]'));
    categoryRadios.forEach((radio) => {
        radio.addEventListener('change', (event) => {
            currentCategory = String(event.target.value || 'all').trim().toLowerCase() || 'all';
            applyFilters();
        });
    });
}

function viewProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    // For now, show toast - can be expanded to modal
    showToast(`Visualizar detalhes de: ${product.nome}`, 'info');
}

// ===== EVENT LISTENERS =====
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        applyFilters();
    });
}

if (priceCheckboxes) {
    priceCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const min = parseFloat(e.target.dataset.min);
            const max = parseFloat(e.target.dataset.max);

            if (e.target.checked) {
                priceFilters.push({ min, max });
            } else {
                priceFilters = priceFilters.filter(f => f.min !== min || f.max !== max);
            }

            applyFilters();
        });
    });
}

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        // Reset category
        currentCategory = 'all';
        const allRadio = document.querySelector('input[name="category"][value="all"]');
        if (allRadio) allRadio.checked = true;

        // Reset price filters
        priceFilters = [];
        priceCheckboxes.forEach(checkbox => checkbox.checked = false);

        // Reset sort
        currentSort = 'default';
        if (sortSelect) sortSelect.value = 'default';

        applyFilters();
        showToast('Filtros limpos', 'info');
    });
}

// ===== CHECK URL PARAMETERS =====
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const categoria = urlParams.get('categoria');

    if (categoria) {
        currentCategory = String(categoria).trim().toLowerCase();
        const radio = document.querySelector(`input[name="category"][value="${currentCategory}"]`);
        if (radio) {
            radio.checked = true;
        }
    }
}

// ===== INITIALIZATION =====
const TEMPLATE_CATEGORY_LABELS = {
    promocoes: 'Promoções',
    eventos: 'Eventos',
    corporativo: 'Corporativo',
    festas: 'Festas',
    varejo: 'Varejo'
};

const TEMPLATE_PREVIEW_FALLBACK = '/assets/images/template-placeholder.svg';

function getTemplateCategoryLabel(category) {
    return TEMPLATE_CATEGORY_LABELS[String(category || '').toLowerCase()] || 'Design';
}

function getCurrentProductPreviewRatio(fallback = 4 / 3) {
    const source = currentProduct?.svg_template || '';
    return Math.max(
        0.2,
        Number(window.DesignSvgStore?.getSvgAspectRatio?.(source, fallback)) || fallback
    );
}

function buildBlankTemplatePreviewMarkup() {
    const blankSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="#ffffff"/></svg>';
    const previewMarkup = window.DesignSvgStore?.buildPreviewSvgMarkup?.(
        blankSvg,
        currentProduct?.svg_template || null,
        { backgroundColor: 'transparent' }
    );

    if (previewMarkup) {
        return `<span class="template-gallery-card__preview-content">${previewMarkup}</span>`;
    }

    return `<div class="template-gallery-card__blank-fallback"></div>`;
}

function buildTemplatePreviewMarkup(template) {
    const previewUrl = template.preview_url || template.thumbnail_url || TEMPLATE_PREVIEW_FALLBACK;
    const previewMarkup = window.DesignSvgStore?.buildPreviewSvgMarkup?.(
        previewUrl,
        currentProduct?.svg_template || null,
        { backgroundColor: '#f8fafc' }
    );

    if (previewMarkup) {
        return `<span class="template-gallery-card__preview-content">${previewMarkup}</span>`;
    }

    return `
        <img
            src="${escapeHtml(previewUrl)}"
            alt="${escapeHtml(template.nome)}"
            loading="lazy"
            class="template-gallery-card__preview-image"
            onerror="this.src='${TEMPLATE_PREVIEW_FALLBACK}';this.onerror=null;"
        >
    `;
}

function buildTemplateLoadingCard() {
    return `
        <div class="template-gallery-card template-gallery-card--loading" aria-hidden="true" style="--template-preview-ratio: ${getCurrentProductPreviewRatio()};">
            <div class="template-gallery-card__preview">
                <div class="template-gallery-card__skeleton template-gallery-card__skeleton--preview"></div>
            </div>
            <div class="template-gallery-card__info">
                <div class="template-gallery-card__skeleton template-gallery-card__skeleton--title"></div>
                <div class="template-gallery-card__skeleton template-gallery-card__skeleton--meta"></div>
            </div>
        </div>
    `;
}

function buildTemplateGalleryCard({ action, title, meta = '', previewMarkup, templateId = '' }) {
    const ariaLabel = action === 'blank'
        ? 'Come?ar em branco'
        : `Selecionar template ${title}`;

    return `
        <button
            type="button"
            class="template-gallery-card group"
            data-gallery-action="${action}"
            ${templateId ? `data-template-id="${escapeHtml(templateId)}"` : ''}
            aria-label="${escapeHtml(ariaLabel)}"
        >
            <span class="template-gallery-card__preview">
                <span class="template-gallery-card__preview-surface ${action === 'blank' ? 'template-gallery-card__preview-surface--blank' : ''}">
                    ${previewMarkup}
                </span>
            </span>
            <span class="template-gallery-card__info">
                <span class="template-gallery-card__title">${escapeHtml(title)}</span>
                ${meta ? `<span class="template-gallery-card__meta">${escapeHtml(meta)}</span>` : ''}
            </span>
        </button>
    `;
}

function buildBlankTemplateCard() {
    return buildTemplateGalleryCard({
        action: 'blank',
        title: 'Em branco',
        meta: 'Formato do produto',
        previewMarkup: buildBlankTemplatePreviewMarkup()
    });
}

document.addEventListener('DOMContentLoaded', () => {
    checkUrlParams();
    loadAllProducts();
});

document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest('[data-open-templates="true"]');
    if (!trigger) return;

    const productId = Number(trigger.getAttribute('data-product-id'));
    const productNameParam = trigger.getAttribute('data-product-name') || '';
    const productName = decodeURIComponent(productNameParam || '');
    if (!Number.isFinite(productId)) return;

    openTemplatesModal(productId, productName);
});

// Make functions globally available
window.viewProductDetails = viewProductDetails;

// ===== TEMPLATES MODAL FUNCTIONS =====
let currentProductId = null;
let currentProduct = null;
let allTemplates = [];
let templatesCatalogCache = null;
let templatesCatalogPromise = null;
let templatesByProductCache = new Map();
let templatesLoadToken = 0;

async function openTemplatesModal(productId, productName) {
    currentProductId = productId;
    currentProduct = allProducts.find((product) => Number(product?.id) === Number(productId)) || null;
    const modalProductName = document.getElementById('modal-product-name');
    const modal = document.getElementById('templates-modal');

    if (!modalProductName || !modal) {
        window.location.href = `/personalizar.html?produto=${productId}`;
        return;
    }

    modalProductName.textContent = `Escolha um design para: ${productName}`;
    modal.classList.remove('hidden');
    renderTemplatesLoading();

    requestAnimationFrame(() => {
        void loadTemplates(productId);
    });
}

function closeTemplatesModal() {
    const modal = document.getElementById('templates-modal');
    if (modal) modal.classList.add('hidden');
    currentProductId = null;
    currentProduct = null;
}

function startBlank() {
    if (!currentProductId) return;
    window.location.href = `/personalizar.html?produto=${currentProductId}`;
}

function selectTemplate(templateId) {
    if (!currentProductId) return;
    window.location.href = `/personalizar.html?produto=${currentProductId}&template=${templateId}`;
}

function renderTemplatesLoading(message = 'A carregar templates...') {
    const grid = document.getElementById('templates-modal-grid');
    const emptyState = document.getElementById('templates-empty');

    if (!grid || !emptyState) return;

    grid.style.setProperty('--template-preview-ratio', String(getCurrentProductPreviewRatio()));

    grid.innerHTML = `
        ${Array.from({ length: 4 }).map(() => buildTemplateLoadingCard()).join('')}
        <div class="col-span-full text-center py-2 text-sm text-gray-500">${message}</div>
    `;
    emptyState.classList.add('hidden');
}

async function getTemplatesCatalog() {
    if (Array.isArray(templatesCatalogCache) && templatesCatalogCache.length > 0) {
        return templatesCatalogCache;
    }

    if (templatesCatalogPromise) {
        return templatesCatalogPromise;
    }

    templatesCatalogPromise = (async () => {
        const { data, error } = await supabaseClient
            .from('templates')
            .select('id, nome, categoria, preview_url, thumbnail_url, ativo, created_at')
            .eq('ativo', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        templatesCatalogCache = data || [];
        return templatesCatalogCache;
    })();

    try {
        return await templatesCatalogPromise;
    } finally {
        templatesCatalogPromise = null;
    }
}

async function getProductTemplates(productId) {
    const numericProductId = Number(productId);
    if (!Number.isFinite(numericProductId)) {
        return [];
    }

    const cached = templatesByProductCache.get(numericProductId);
    if (Array.isArray(cached)) {
        return cached;
    }

    if (cached && typeof cached.then === 'function') {
        return cached;
    }

    const promise = (async () => {
        const associationsResult = await supabaseClient
            .from('produto_templates')
            .select('template_id, templates(id, nome, categoria, preview_url, thumbnail_url, ativo)')
            .eq('produto_id', numericProductId)
            .order('ordem', { ascending: true });

        const { data: associations, error: assocError } = associationsResult;
        if (assocError) throw assocError;

        if (associations && associations.length > 0) {
            const templates = associations
                .map((association) => association.templates)
                .filter((template) => template && template.ativo);
            if (templates.length > 0) {
                return templates;
            }
        }

        return getTemplatesCatalog();
    })();

    templatesByProductCache.set(numericProductId, promise);

    try {
        const templates = await promise;
        templatesByProductCache.set(numericProductId, templates);
        return templates;
    } catch (error) {
        templatesByProductCache.delete(numericProductId);
        throw error;
    }
}

async function loadTemplates(productId = currentProductId) {
    const grid = document.getElementById('templates-modal-grid');
    const emptyState = document.getElementById('templates-empty');

    if (!grid || !emptyState) return;

    const numericProductId = Number(productId);
    if (!Number.isFinite(numericProductId)) return;

    const loadToken = ++templatesLoadToken;

    try {
        const templates = await getProductTemplates(numericProductId);

        if (loadToken !== templatesLoadToken || numericProductId !== Number(currentProductId)) {
            return;
        }

        allTemplates = templates;
        renderTemplates(allTemplates);
    } catch (err) {
        if (loadToken !== templatesLoadToken) return;
        console.error('Erro ao carregar templates:', err);
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
    }
}

function preloadTemplatesData(productId) {
    const numericProductId = Number(productId);
    if (!Number.isFinite(numericProductId)) return;

    void getProductTemplates(numericProductId).catch(() => {
        // Preload falhou, mas nao bloqueia o fluxo principal.
    });
}

function renderTemplates(templates) {
    const grid = document.getElementById('templates-modal-grid');
    const emptyState = document.getElementById('templates-empty');

    if (!grid || !emptyState) return;

    grid.style.setProperty('--template-preview-ratio', String(getCurrentProductPreviewRatio()));

    const cards = [buildBlankTemplateCard()];

    if (Array.isArray(templates) && templates.length > 0) {
        templates.forEach((template) => {
            cards.push(buildTemplateGalleryCard({
                action: 'template',
                title: template.nome,
                meta: getTemplateCategoryLabel(template.categoria),
                previewMarkup: buildTemplatePreviewMarkup(template),
                templateId: template.id
            }));
        });
    }

    grid.innerHTML = cards.join('');
    emptyState.classList.add('hidden');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handleTemplatesGridClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const card = target.closest('[data-gallery-action]');
    if (!card) return;

    const action = card.getAttribute('data-gallery-action');
    if (action === 'blank') {
        startBlank();
        return;
    }

    if (action === 'template') {
        const templateId = card.getAttribute('data-template-id');
        if (templateId) {
            selectTemplate(templateId);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('templates-modal-grid');
    if (grid) {
        grid.addEventListener('click', handleTemplatesGridClick);
    }
    void getTemplatesCatalog().catch(() => {});
});

document.addEventListener('pointerover', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest('[data-open-templates="true"]');
    if (!trigger) return;

    const productId = Number(trigger.getAttribute('data-product-id'));
    preloadTemplatesData(productId);
}, { passive: true });

// Make modal functions globally available
window.openTemplatesModal = openTemplatesModal;
window.closeTemplatesModal = closeTemplatesModal;
window.startBlank = startBlank;
window.selectTemplate = selectTemplate;
