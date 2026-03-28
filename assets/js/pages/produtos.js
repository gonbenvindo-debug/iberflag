// ===== PRODUCTS PAGE LOGIC =====

let allProducts = [];
let filteredProducts = [];
let currentCategory = 'all';
let currentSort = 'default';
let priceFilters = [];

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
    console.log('[DEBUG] Iniciando loadAllProducts');
    console.log('[DEBUG] supabaseClient:', typeof supabaseClient);
    console.log('[DEBUG] initialProducts:', typeof initialProducts, initialProducts?.length);

    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('id', { ascending: false });

        console.log('[DEBUG] Query resultado:', { data: data?.length, error });

        if (error) {
            console.error('[DEBUG] Erro Supabase:', error);
            throw error;
        }

        if (data && data.length > 0) {
            console.log('[DEBUG] Produtos carregados do Supabase:', data.length);
            allProducts = data;
        } else {
            console.log('[DEBUG] Sem produtos no Supabase, usando initialProducts');
            allProducts = initialProducts || [];
        }
    } catch (error) {
        console.error('[DEBUG] Erro ao carregar produtos:', error.message);
        console.log('[DEBUG] Usando initialProducts como fallback');
        allProducts = initialProducts || [];
    }

    console.log('[DEBUG] Total de produtos:', allProducts.length);
    applyFilters();
}

// ===== RENDER PRODUCTS =====
function renderProductsGrid(products) {
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
        <div class="product-card page-transition" data-product-id="${product.id}">
            <div class="relative h-64 overflow-hidden image-zoom">
                <img src="${product.imagem}" alt="${product.nome}" class="w-full h-full object-cover">
                <div class="product-badge">
                    ${product.preco.toFixed(2)}€
                </div>
                ${product.destaque ? '<div class="absolute top-4 left-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">Destaque</div>' : ''}
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <div class="mb-2">
                    <span class="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded">${getCategoryName(product.categoria)}</span>
                </div>
                <h3 class="text-xl font-bold mb-2 text-gray-900">${product.nome}</h3>
                <p class="text-gray-600 text-sm mb-4 flex-grow">${product.descricao}</p>
                <div class="mb-4">
                    <div class="price-tag">${product.preco.toFixed(2)}€</div>
                    <p class="text-xs text-gray-500 mt-1">Preço por unidade</p>
                </div>
                <button onclick="openTemplatesModal('${product.id}', '${product.nome.replace(/'/g, "\\'")}')" 
                    class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <i data-lucide="palette" class="w-4 h-4"></i>
                    Personalizar e Comprar
                </button>
            </div>
        </div>
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

// Make functions globally available
window.viewProductDetails = viewProductDetails;

// ===== TEMPLATES MODAL FUNCTIONS =====
let currentProductId = null;
let currentProductName = '';
let allTemplates = [];

function openTemplatesModal(productId, productName) {
    currentProductId = productId;
    currentProductName = productName;

    document.getElementById('modal-product-name').textContent = `Escolha um design para: ${productName}`;
    document.getElementById('templates-modal').classList.remove('hidden');

    loadTemplates();
}

function closeTemplatesModal() {
    document.getElementById('templates-modal').classList.add('hidden');
    currentProductId = null;
    currentProductName = '';
}

function startBlank() {
    if (!currentProductId) return;
    window.location.href = `/pages/personalizar.html?produto_id=${currentProductId}&produto_nome=${encodeURIComponent(currentProductName)}`;
}

function selectTemplate(templateId) {
    if (!currentProductId) return;
    window.location.href = `/pages/personalizar.html?produto_id=${currentProductId}&produto_nome=${encodeURIComponent(currentProductName)}&template_id=${templateId}`;
}

async function loadTemplates() {
    const grid = document.getElementById('templates-modal-grid');
    const emptyState = document.getElementById('templates-empty');

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

    if (!templates || templates.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = templates.map(template => `
        <div class="template-card cursor-pointer group" onclick="selectTemplate('${template.id}')">
            <div class="aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group-hover:border-blue-500 transition-all bg-gray-50">
                <img src="${template.thumbnail_url || template.preview_url || '/favicon.svg'}" 
                     alt="${template.nome}" 
                     class="w-full h-full object-cover"
                     onerror="this.src='/favicon.svg'">
            </div>
            <div class="mt-2">
                <p class="font-semibold text-sm text-gray-900">${template.nome}</p>
                <p class="text-xs text-gray-500">${template.categoria || 'Geral'}</p>
            </div>
        </div>
    `).join('');
}

// Filter buttons event listeners
document.addEventListener('DOMContentLoaded', () => {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            filterBtns.forEach(b => {
                b.classList.remove('active', 'bg-blue-600', 'text-white');
                b.classList.add('bg-white', 'text-gray-600');
            });
            // Add active class to clicked
            btn.classList.add('active', 'bg-blue-600', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-600');

            // Filter templates
            const category = btn.dataset.category;
            if (category === 'all') {
                renderTemplates(allTemplates);
            } else {
                const filtered = allTemplates.filter(t => t.categoria === category);
                renderTemplates(filtered);
            }
        });
    });
});

// Make modal functions globally available
window.openTemplatesModal = openTemplatesModal;
window.closeTemplatesModal = closeTemplatesModal;
window.startBlank = startBlank;
window.selectTemplate = selectTemplate;
