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
const categoryRadios = document.querySelectorAll('input[name="category"]');
const priceCheckboxes = document.querySelectorAll('.price-filter');

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
            const safeDescription = escapeHtml(product?.descricao || 'Sem descrição disponível');
            const safeImage = escapeHtml(product?.imagem || '/assets/images/template-placeholder.svg');
            const safePrice = parseProductPrice(product).toFixed(2);
            const safeProductId = escapeHtml(String(product?.id || ''));
            const safeProductNameParam = encodeURIComponent(String(product?.nome || 'Produto sem nome'));
            return `
        <div class="product-card page-transition" data-product-id="${product.id}">
            <div class="relative h-64 overflow-hidden image-zoom">
                <img src="${safeImage}" alt="${safeName}" class="w-full h-full object-cover" loading="lazy">
                <div class="product-badge">
                    ${safePrice}€
                </div>
                ${product.destaque ? '<div class="absolute top-4 left-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">Destaque</div>' : ''}
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <div class="mb-2">
                    <span class="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded">${safeCategory}</span>
                </div>
                <h3 class="text-xl font-bold mb-2 text-gray-900">${safeName}</h3>
                <p class="text-gray-600 text-sm mb-4 flex-grow">${safeDescription}</p>
                <div class="mb-4">
                    <div class="price-tag">${safePrice}€</div>
                    <p class="text-xs text-gray-500 mt-1">Preço por unidade</p>
                </div>
                <button
                    type="button"
                    data-open-templates="true"
                    data-product-id="${safeProductId}"
                    data-product-name="${safeProductNameParam}"
                    class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]">
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
        products = products.filter(p => p.categoria === currentCategory);
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
    const categories = {
        'flybanners': 'Flybanners',
        'rollups': 'Roll-ups',
        'lonas': 'Lonas & Banners'
    };
    return categories[categoria] || categoria;
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

if (categoryRadios) {
    categoryRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            applyFilters();
        });
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
        currentCategory = categoria;
        const radio = document.querySelector(`input[name="category"][value="${categoria}"]`);
        if (radio) {
            radio.checked = true;
        }
    }
}

// ===== INITIALIZATION =====
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
let currentProductName = '';
let allTemplates = [];

async function openTemplatesModal(productId, productName) {
    currentProductId = productId;
    currentProductName = productName;
    const modalProductName = document.getElementById('modal-product-name');
    const modal = document.getElementById('templates-modal');

    if (!modalProductName || !modal) {
        window.location.href = `/pages/personalizar.html?produto=${productId}`;
        return;
    }

    try {
        const { data: associations, error } = await supabaseClient
            .from('produto_templates')
            .select('template_id, templates(*)')
            .eq('produto_id', productId)
            .order('ordem', { ascending: true });

        if (!error && associations) {
            const designs = associations.map(a => a.templates).filter(t => t && t.ativo);
            if (designs.length === 0) {
                window.location.href = `/pages/personalizar.html?produto=${productId}`;
                return;
            }
        }
    } catch (err) {
        console.warn('Erro ao verificar designs:', err);
    }

    modalProductName.textContent = `Escolha um design para: ${productName}`;
    modal.classList.remove('hidden');

    loadTemplates();
}

function closeTemplatesModal() {
    const modal = document.getElementById('templates-modal');
    if (modal) modal.classList.add('hidden');
    currentProductId = null;
    currentProductName = '';
}

function startBlank() {
    if (!currentProductId) return;
    window.location.href = `/pages/personalizar.html?produto=${currentProductId}`;
}

function selectTemplate(templateId) {
    if (!currentProductId) return;
    window.location.href = `/pages/personalizar.html?produto=${currentProductId}&template=${templateId}`;
}

async function loadTemplates() {
    const grid = document.getElementById('templates-modal-grid');
    const emptyState = document.getElementById('templates-empty');

    if (!grid || !emptyState) return;

    grid.innerHTML = '<div class="col-span-full text-center py-8"><div class="spinner mx-auto mb-2"></div>A carregar templates...</div>';
    emptyState.classList.add('hidden');

    try {
        // Carregar templates especificos do produto
        const { data: associations, error: assocError } = await supabaseClient
            .from('produto_templates')
            .select('template_id, templates(*)')
            .eq('produto_id', currentProductId)
            .order('ordem', { ascending: true });

        if (assocError) throw assocError;

        // Extrair templates das associacoes
        let templates = [];
        if (associations && associations.length > 0) {
            templates = associations.map(a => a.templates).filter(t => t && t.ativo);
        }

        // Se nao houver templates especificos, carregar todos os templates genericos
        if (templates.length === 0) {
            const { data: allTemplates, error } = await supabaseClient
                .from('templates')
                .select('*')
                .eq('ativo', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            templates = allTemplates || [];
        }

        allTemplates = templates;
        renderTemplates(allTemplates);
    } catch (err) {
        console.error('Erro ao carregar templates:', err);
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
    }
}

function renderTemplates(templates) {
    const grid = document.getElementById('templates-modal-grid');
    const emptyState = document.getElementById('templates-empty');

    if (!grid || !emptyState) return;

    if (!templates || templates.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    const blankCard = `
        <div class="group cursor-pointer" onclick="startBlank()">
            <div class="aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-300 group-hover:border-blue-500 group-hover:bg-blue-50/50 transition-all duration-300 bg-gray-50/80 flex flex-col items-center justify-center gap-3">
                <div class="w-14 h-14 rounded-2xl bg-white shadow-sm border border-gray-200 group-hover:shadow-md group-hover:border-blue-300 flex items-center justify-center transition-all duration-300">
                    <i data-lucide="plus" class="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-colors"></i>
                </div>
                <div class="text-center">
                    <p class="text-sm font-semibold text-gray-600 group-hover:text-blue-700 transition-colors">Em Branco</p>
                    <p class="text-[11px] text-gray-400">Criar do zero</p>
                </div>
            </div>
        </div>
    `;

    grid.innerHTML = blankCard + templates.map(template => {
        const previewUrl = template.preview_url || template.thumbnail_url || '/assets/images/template-placeholder.svg';
        return `
        <div class="group cursor-pointer" onclick="selectTemplate('${template.id}')">
            <div class="aspect-[4/3] rounded-2xl overflow-hidden border-2 border-gray-200 group-hover:border-blue-500 transition-all duration-300 bg-gray-100 relative shadow-sm group-hover:shadow-lg">
                <img src="${previewUrl}" 
                     alt="${escapeHtml(template.nome)}" 
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     onerror="this.src='/assets/images/template-placeholder.svg'; this.onerror=null;">
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div class="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <span class="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
                        <i data-lucide="mouse-pointer-click" class="w-3 h-3"></i>
                        Usar este design
                    </span>
                </div>
            </div>
            <div class="mt-2.5 px-1">
                <p class="font-semibold text-sm text-gray-900 truncate">${escapeHtml(template.nome)}</p>
            </div>
        </div>
    `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Make modal functions globally available
window.openTemplatesModal = openTemplatesModal;
window.closeTemplatesModal = closeTemplatesModal;
window.startBlank = startBlank;
window.selectTemplate = selectTemplate;
