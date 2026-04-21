// ===== PRODUCTS PAGE LOGIC =====

function escapeHtml(value) {
    return String(value || '')
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
let currentPage = 1;
const PRODUCTS_PER_PAGE = 12;

function parseProductPrice(product) {
    const numericPrice = Number(product?.preco);
    return Number.isFinite(numericPrice) ? numericPrice : 0;
}

function isProductPurchasable(product) {
    return product?.ativo !== false && parseProductPrice(product) > 0;
}

// ===== DOM ELEMENTS =====
const productsGrid = document.getElementById('products-grid');
const productCount = document.getElementById('product-count');
const emptyState = document.getElementById('empty-state');
const paginationContainer = document.getElementById('products-pagination');
const sortSelect = document.getElementById('sort-select');
const categorySelect = document.getElementById('category-select');
const clearFiltersBtn = document.getElementById('clear-filters');
const categoryFiltersContainer = document.getElementById('category-filters');
const priceCheckboxes = document.querySelectorAll('.price-filter');
let categoryRadios = [];
const catalogTwoColumnMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 767px)')
    : null;

function enforceCatalogMobileGrid() {
    if (!productsGrid) return;

    const shouldUseTwoColumns = Boolean(catalogTwoColumnMedia?.matches);

    if (shouldUseTwoColumns) {
        productsGrid.style.setProperty('display', 'grid', 'important');
        productsGrid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
        productsGrid.style.setProperty('gap', '0.85rem', 'important');

        Array.from(productsGrid.children).forEach((item) => {
            item.style.setProperty('width', 'auto', 'important');
            item.style.setProperty('max-width', 'none', 'important');
            item.style.setProperty('min-width', '0', 'important');
            item.style.setProperty('grid-column', 'span 1', 'important');
        });
        return;
    }

    productsGrid.style.removeProperty('display');
    productsGrid.style.removeProperty('grid-template-columns');
    productsGrid.style.removeProperty('gap');

    Array.from(productsGrid.children).forEach((item) => {
        item.style.removeProperty('width');
        item.style.removeProperty('max-width');
        item.style.removeProperty('min-width');
        item.style.removeProperty('grid-column');
    });
}

function getCatalogBasePath() {
    return typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.STATIC_PATHS.products
        : '/produtos';
}

function buildProductDetailsPath(product) {
    return typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.buildProductPath(product)
        : `/produto/${encodeURIComponent(String(product?.id || ''))}`;
}

function buildProductPersonalizerPath(product, params = {}) {
    return typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.buildProductPersonalizerPath(product, params)
        : `/produto/${encodeURIComponent(String(product?.id || ''))}/personalizar`;
}

function syncCategoryUrl() {
    if (typeof window === 'undefined' || typeof history === 'undefined' || !history.replaceState) {
        return;
    }

    const nextPath = currentCategory !== 'all' && typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.buildCategoryPath(currentCategory)
        : getCatalogBasePath();

    const url = new URL(window.location.href);
    if (currentPage > 1) {
        url.searchParams.set('page', String(currentPage));
    } else {
        url.searchParams.delete('page');
    }

    const nextUrl = `${nextPath}${url.search ? url.search : ''}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        history.replaceState({}, '', nextUrl);
    }
}

function getTotalPages(totalItems) {
    return Math.max(1, Math.ceil(Number(totalItems || 0) / PRODUCTS_PER_PAGE));
}

function clampCurrentPage(totalItems) {
    currentPage = Math.min(Math.max(1, currentPage), getTotalPages(totalItems));
}

function buildPaginationRange(totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const normalized = Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);
    const result = [];

    normalized.forEach((page, index) => {
        if (index > 0 && page - normalized[index - 1] > 1) {
            result.push('ellipsis');
        }
        result.push(page);
    });

    return result;
}

function renderPagination(totalItems) {
    if (!paginationContainer) return;

    const totalPages = getTotalPages(totalItems);
    if (totalItems <= PRODUCTS_PER_PAGE) {
        paginationContainer.classList.add('hidden');
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.classList.remove('hidden');
    const paginationItems = buildPaginationRange(totalPages);

    paginationContainer.innerHTML = `
        <button type="button" class="page-btn" data-page-nav="prev" ${currentPage === 1 ? 'disabled aria-disabled="true"' : ''}>
            Anterior
        </button>
        ${paginationItems.map((item) => {
            if (item === 'ellipsis') {
                return '<span class="page-btn pointer-events-none opacity-60" aria-hidden="true">...</span>';
            }

            return `
                <button
                    type="button"
                    class="page-btn ${item === currentPage ? 'active' : ''}"
                    data-page="${item}"
                    aria-label="Ir para a p?gina ${item}"
                    ${item === currentPage ? 'aria-current="page"' : ''}>
                    ${item}
                </button>
            `;
        }).join('')}
        <button type="button" class="page-btn" data-page-nav="next" ${currentPage === totalPages ? 'disabled aria-disabled="true"' : ''}>
            Seguinte
        </button>
    `;
}

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
        if (paginationContainer) {
            paginationContainer.classList.add('hidden');
            paginationContainer.innerHTML = '';
        }
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }

    clampCurrentPage(products.length);
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const paginatedProducts = products.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

    productsGrid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    productCount.textContent = products.length;

    productsGrid.innerHTML = paginatedProducts.map(product => `
        ${(() => {
            const safeName = escapeHtml(product?.nome || 'Produto sem nome');
            const safeCategory = escapeHtml(getCategoryName(product?.categoria || 'outros'));
            const safeImage = escapeHtml(product?.imagem || '/assets/images/template-placeholder.svg');
            const price = parseProductPrice(product);
            const purchasable = isProductPurchasable(product);
            const safePrice = price.toFixed(2);
            const safeProductId = escapeHtml(String(product?.id || ''));
            const safeProductNameParam = encodeURIComponent(String(product?.nome || 'Produto sem nome'));
            const safeProductCategory = escapeHtml(String(product?.categoria || ''));
            return `
        <div class="product-card page-transition" data-product-id="${product.id}">
            <div class="product-card-image image-zoom" tabindex="0" aria-label="Imagem do produto ${safeName}">
                <img src="${safeImage}" alt="${safeName}" class="w-full h-full object-contain" loading="lazy">
                ${product.destaque ? '<div class="absolute top-4 left-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">Destaque</div>' : ''}
            </div>
            <div class="product-card-body">
                <div class="product-card-content">
                    <div class="product-card-meta">${safeCategory}</div>
                    <h3 class="product-card-title">${safeName}</h3>
                </div>
                <div class="product-card-footer">
                    <span class="text-sm font-semibold text-white sm:text-base">${purchasable ? `${safePrice}€` : 'Sob consulta'}</span>
                    <a
                        href="${purchasable ? buildProductDetailsPath(product) : '#'}"
                        data-product-id="${safeProductId}"
                        data-product-name="${safeProductNameParam}"
                        data-product-category="${safeProductCategory}"
                        ${purchasable ? '' : 'aria-disabled="true" tabindex="-1"'}
                        aria-label="${purchasable ? `Ver produto ${safeName}` : `${safeName} indisponível para checkout`}"
                        class="product-card-cta cursor-pointer min-h-[44px] ${purchasable ? '' : 'opacity-60 pointer-events-none'}">
                        <i data-lucide="arrow-right" class="w-4 h-4 product-card-cta-icon" aria-hidden="true"></i>
                        <span class="product-card-cta-label">${purchasable ? 'Ver produto' : 'Indisponível para checkout'}</span>
                    </a>
                </div>
            </div>
        </div>
    `;
        })()}
    `).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    enforceCatalogMobileGrid();
    renderPagination(products.length);
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
    clampCurrentPage(products.length);
    renderProductsGrid(products);
    syncCategoryUrl();
}

function setPage(page) {
    const parsed = Number.parseInt(String(page || '1'), 10);
    currentPage = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
    renderProductsGrid(filteredProducts);
    syncCategoryUrl();
    if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        'tenda-publicit?ria': 'Tenda Publicitária',
        'photocall': 'Photocall',
        'mastros': 'Mastros',
        'cubo-publicit?rio': 'Cubo Publicitário',
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

    if (categorySelect) {
        categorySelect.innerHTML = `
            <option value="all">Todas as categorias (${allProducts.length})</option>
            ${categories.map((category) => `
                <option value="${escapeHtml(category.value)}">${escapeHtml(category.label)} (${category.count})</option>
            `).join('')}
        `;
        categorySelect.value = currentCategory;
    }

    if (categoryFiltersContainer) {
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
    }

    bindCategoryFilterListeners();
}

function bindCategoryFilterListeners() {
    if (categorySelect) {
        categorySelect.onchange = (event) => {
            currentCategory = String(event.target.value || 'all').trim().toLowerCase() || 'all';
            currentPage = 1;
            applyFilters();
        };
    }

    categoryRadios = Array.from(document.querySelectorAll('input[name="category"]'));
    categoryRadios.forEach((radio) => {
        radio.addEventListener('change', (event) => {
            currentCategory = String(event.target.value || 'all').trim().toLowerCase() || 'all';
            currentPage = 1;
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
        currentPage = 1;
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

            currentPage = 1;
            applyFilters();
        });
    });
}

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        // Reset category
        currentCategory = 'all';
        if (categorySelect) categorySelect.value = 'all';
        const allRadio = document.querySelector('input[name="category"][value="all"]');
        if (allRadio) allRadio.checked = true;

        // Reset price filters
        priceFilters = [];
        priceCheckboxes.forEach(checkbox => checkbox.checked = false);

        // Reset sort
        currentSort = 'default';
        currentPage = 1;
        if (sortSelect) sortSelect.value = 'default';

        applyFilters();
        showToast('Filtros limpos', 'info');
    });
}

if (catalogTwoColumnMedia && typeof catalogTwoColumnMedia.addEventListener === 'function') {
    catalogTwoColumnMedia.addEventListener('change', enforceCatalogMobileGrid);
}

// ===== CHECK URL PARAMETERS =====
function checkUrlParams() {
    const locationState = typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.parseLocationPath(window.location.pathname)
        : { categorySlug: '' };
    const urlParams = new URLSearchParams(window.location.search);
    const categoria = urlParams.get('categoria');
    const page = Number.parseInt(urlParams.get('page') || '1', 10);

    currentPage = Number.isFinite(page) && page > 0 ? page : 1;

    if (locationState.categorySlug) {
        currentCategory = String(locationState.categorySlug).trim().toLowerCase();
    } else if (categoria) {
        currentCategory = String(categoria).trim().toLowerCase();
        if (categorySelect) {
            categorySelect.value = currentCategory;
        }
        const radio = document.querySelector(`input[name="category"][value="${currentCategory}"]`);
        if (radio) {
            radio.checked = true;
        }
        if (typeof SiteRoutes !== 'undefined') {
            window.location.replace(SiteRoutes.buildCategoryPath(currentCategory));
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

    if (paginationContainer) {
        paginationContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const pageButton = target.closest('[data-page]');
            if (pageButton) {
                setPage(pageButton.getAttribute('data-page'));
                return;
            }

            const navButton = target.closest('[data-page-nav]');
            if (!navButton) return;

            const direction = navButton.getAttribute('data-page-nav');
            if (direction === 'prev' && currentPage > 1) {
                setPage(currentPage - 1);
            }
            if (direction === 'next' && currentPage < getTotalPages(filteredProducts.length)) {
                setPage(currentPage + 1);
            }
        });
    }
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
    if (!isProductPurchasable(currentProduct)) {
        showToast('Este produto ainda não tem preço válido para checkout.', 'error');
        currentProductId = null;
        currentProduct = null;
        return;
    }

    const modalProductName = document.getElementById('modal-product-name');
    const modal = document.getElementById('templates-modal');

    if (!modalProductName || !modal) {
        window.location.href = buildProductDetailsPath(currentProduct);
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
    window.location.href = buildProductPersonalizerPath(currentProduct || { id: currentProductId });
}

function selectTemplate(templateId) {
    if (!currentProductId) return;
    window.location.href = buildProductPersonalizerPath(currentProduct || { id: currentProductId }, { template: templateId });
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

// Make modal functions globally available
window.openTemplatesModal = openTemplatesModal;
window.closeTemplatesModal = closeTemplatesModal;
window.startBlank = startBlank;
window.selectTemplate = selectTemplate;
