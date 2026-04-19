// ===== SUPABASE CONFIGURATION =====
// Usar var para evitar erro se ja declarado noutro script
var SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || window.SUPABASE_URL || 'https://nzwfquivulxkmxrwqalz.supabase.co';
var SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || 'fallback-key';

var supabaseClient = null;

if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.warn('Falha ao inicializar Supabase:', error);
        supabaseClient = null;
    }
}

// Disponibilizar globalmente
window.supabaseClient = supabaseClient;

// ===== CART MANAGEMENT =====
var CART_STORAGE_KEY = 'iberflag_cart';
var LEGACY_CART_STORAGE_KEYS = ['iberflag_cart', 'cart'];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStoredCart() {
    const storageKeys = [CART_STORAGE_KEY, ...LEGACY_CART_STORAGE_KEYS];

    for (const key of storageKeys) {
        try {
            const stored = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
                return stored;
            }
        } catch (error) {
            console.warn('Falha ao recuperar carrinho:', key, error);
        }
    }

    return [];
}

var cart = [];
var cartDesignHydrationPending = false;

// ===== DOM ELEMENTS =====
var productsContainer = document.getElementById('products-container');
var cartBtn = document.getElementById('cart-btn');
var cartBtnMobile = document.getElementById('cart-btn-mobile');
var cartSidebar = null;
var cartOverlay = null;
var closeCartBtn = null;
var cartItemsContainer = document.getElementById('cart-items');
var cartTotal = document.getElementById('cart-total');
var cartCount = document.getElementById('cart-count');
var cartSidebarCount = null;
var mobileMenuBtn = document.getElementById('mobile-menu-btn');
var mobileMenu = document.getElementById('mobile-menu');
var cartUiListenersReady = false;
var cartPreviewHeightSyncRaf = null;

function refreshCartDomReferences() {
    productsContainer = document.getElementById('products-container');
    cartBtn = document.getElementById('cart-btn');
    cartBtnMobile = document.getElementById('cart-btn-mobile');
    cartItemsContainer = document.getElementById('cart-items');
    cartTotal = document.getElementById('cart-total');
    cartCount = document.getElementById('cart-count');
    mobileMenuBtn = document.getElementById('mobile-menu-btn');
    mobileMenu = document.getElementById('mobile-menu');
}

function buildCartSidebarMarkup() {
    // Keep the cart drawer available for the cart screen.
    return null;
}

function buildLegacyCartSidebarMarkup() {
    if (cartSidebar && cartSidebar.dataset.cartEnhanced === '1') {
        return;
    }

    const checkoutPath = typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.STATIC_PATHS.checkout
        : '/checkout';

    if (!cartSidebar) {
        const sidebar = document.createElement('div');
        sidebar.id = 'cart-sidebar';
        sidebar.className = 'fixed top-0 right-0 h-full bg-white shadow-2xl transform translate-x-full transition-transform duration-300 z-50';
        sidebar.setAttribute('aria-hidden', 'true');
        sidebar.innerHTML = `
            <div class="flex flex-col h-full">
                <div class="flex items-center justify-between p-6 border-b">
                    <h3 class="text-xl font-bold">Carrinho de Compras</h3>
                    <button id="close-cart" class="text-gray-500 hover:text-gray-700">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>
                <div id="cart-items" class="flex-1 overflow-y-auto p-6">
                    <div class="text-center text-gray-500 py-12">
                        <i data-lucide="shopping-cart" class="w-16 h-16 mx-auto mb-4 text-gray-300"></i>
                        <p>O seu carrinho está vazio</p>
                    </div>
                </div>
                <div class="border-t p-6">
                    <div class="flex justify-between mb-4 text-lg font-bold">
                        <span>Total:</span>
                        <span id="cart-total">0.00€</span>
                    </div>
                    <a href="${checkoutPath}"
                        class="block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                        Finalizar Encomenda
                    </a>
                </div>
            </div>
        `;
        document.body.appendChild(sidebar);
        cartSidebar = sidebar;
    }

    cartSidebar.dataset.cartEnhanced = '1';
    cartSidebar.setAttribute('aria-hidden', 'true');
    cartSidebar.className = 'fixed inset-y-0 right-0 z-50 flex h-full translate-x-full transform border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300';
    cartSidebar.style.zIndex = '9999';
    cartSidebar.style.right = '0';
    cartSidebar.style.left = 'auto';
    cartSidebar.style.top = '0';
    cartSidebar.style.bottom = '0';
    cartSidebar.style.boxShadow = '-24px 0 80px rgba(15, 23, 42, 0.18)';
    cartSidebar.innerHTML = `
        <div class="flex h-full w-full flex-col">
            <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Carrinho</p>
                    <h3 class="text-xl font-bold text-slate-900">Carrinho de Compras</h3>
                </div>
                <div class="flex items-center gap-2">
                    <span id="cart-sidebar-count"
                        class="hidden min-w-8 rounded-full bg-blue-600 px-2.5 py-1 text-center text-xs font-bold text-white">0</span>
                    <button id="close-cart"
                        class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition hover:bg-slate-100 hover:text-gray-800"
                        aria-label="Fechar carrinho">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
            <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
                <span>Itens no carrinho</span>
                <span id="cart-total-items" class="font-semibold text-slate-900">0</span>
            </div>
            <div id="cart-items" class="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-gray-500">
                    <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <i data-lucide="shopping-cart" class="w-7 h-7 text-gray-300"></i>
                    </div>
                    <p class="font-semibold text-slate-700">O seu carrinho está vazio</p>
                    <p class="mt-1 text-sm text-slate-500">Escolha um produto para começar.</p>
                </div>
            </div>
            <div class="border-t border-slate-200 bg-white p-5">
                <div class="mb-4 flex items-center justify-between text-lg font-bold text-slate-900">
                    <span>Total</span>
                    <span id="cart-total">0.00€</span>
                </div>
                <a href="${checkoutPath}"
                    class="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700">
                    Finalizar Encomenda
                </a>
            </div>
        </div>
    `;

    const overlay = document.getElementById('cart-overlay');
    if (!overlay) {
        const nextOverlay = document.createElement('div');
        nextOverlay.id = 'cart-overlay';
        nextOverlay.className = 'fixed inset-0 z-40 hidden bg-slate-950/50 backdrop-blur-sm';
        nextOverlay.style.zIndex = '9998';
        document.body.appendChild(nextOverlay);
        cartOverlay = nextOverlay;
    } else {
        overlay.className = 'fixed inset-0 z-40 hidden bg-slate-950/50 backdrop-blur-sm';
        overlay.style.zIndex = '9998';
        cartOverlay = overlay;
    }

    if (cartSidebar && !cartSidebar.dataset.cartControlsBound) {
        const closeButton = cartSidebar.querySelector('#close-cart');
        if (closeButton) {
            closeButton.addEventListener('click', closeCart);
        }
        cartSidebar.dataset.cartControlsBound = '1';
    }

    if (cartOverlay && !cartOverlay.dataset.cartControlsBound) {
        cartOverlay.addEventListener('click', closeCart);
        cartOverlay.dataset.cartControlsBound = '1';
    }
}

function updateCartCountBadges(totalItems) {
    const value = Number.isFinite(totalItems) ? Math.max(0, totalItems) : 0;
    const hasItems = value > 0;
    const labels = [cartCount, document.getElementById('cart-count-mobile')].filter(Boolean);

    labels.forEach((label) => {
        if (hasItems) {
            label.textContent = String(value);
            label.classList.remove('hidden');
        } else {
            label.textContent = '0';
            label.classList.add('hidden');
        }
    });

    const totalItemsLabel = document.getElementById('cart-total-items');
    if (totalItemsLabel) {
        totalItemsLabel.textContent = String(value);
    }
}

function renderCartItemsList() {
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-12 px-6">
                <div class="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <i data-lucide="shopping-cart" class="w-8 h-8 text-gray-300"></i>
                </div>
                <p class="font-semibold text-gray-700">O seu carrinho está vazio</p>
                <p class="text-sm text-gray-500 mt-1">Adicione produtos para continuar.</p>
            </div>
        `;
        return;
    }

    cartItemsContainer.innerHTML = cart.map((item, index) => `
        <article class="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md" data-cart-item-index="${index}">
            <div class="flex items-start gap-3">
                <a href="${getCartItemEditorLink(item, index)}" class="flex w-16 shrink-0 self-start" data-cart-preview-link="${index}" aria-label="Abrir personalizador do item">
                    <div id="cart-item-preview-${index}" data-cart-preview="${index}" class="cart-item-preview-frame">
                        <img src="${getCartItemImage(item)}" alt="${item.nome}" class="cart-item-preview-image">
                    </div>
                </a>
                <div id="cart-item-details-${index}" data-cart-details="${index}" class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <h4 class="truncate font-bold text-sm text-gray-900">${escapeHtml(item.nome)}</h4>
                            <p class="mt-1 text-sm font-semibold text-blue-600">${Number(item.preco || 0).toFixed(2)}€</p>
                        </div>
                        <button type="button" data-cart-action="remove" data-cart-index="${index}" class="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Remover item">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="mt-2 flex items-center gap-2">
                        ${item.quantity > 1 ? `<span class="text-xs text-gray-500">Qtd. ${item.quantity}</span>` : ''}
                    </div>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <a href="${getCartItemEditorLink(item, index)}" class="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
                            <i data-lucide="${item.customized ? 'edit-3' : 'palette'}" class="w-3.5 h-3.5"></i>
                            ${item.customized ? 'Editar' : 'Personalizar'}
                        </a>
                        <div class="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                            <button type="button" data-cart-action="decrease" data-cart-index="${index}" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 transition hover:bg-white hover:shadow-sm" aria-label="Diminuir quantidade">
                                <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                            </button>
                            <span class="min-w-8 px-2 text-center text-sm font-semibold text-gray-900">${item.quantity}</span>
                            <button type="button" data-cart-action="increase" data-cart-index="${index}" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 transition hover:bg-white hover:shadow-sm" aria-label="Aumentar quantidade">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `).join('');
}

function syncCartItemPreviewHeights() {
    if (!cartItemsContainer) return;

    const cards = cartItemsContainer.querySelectorAll('[data-cart-item-index]');
    cards.forEach((card) => {
        const details = card.querySelector('[data-cart-details]');
        const previewLink = card.querySelector('[data-cart-preview-link]');
        if (!(details instanceof Element) || !(previewLink instanceof HTMLElement)) {
            return;
        }

        const detailsHeight = Math.ceil(details.getBoundingClientRect().height);
        if (!detailsHeight || detailsHeight < 1) {
            return;
        }

        previewLink.style.height = `${detailsHeight}px`;
        previewLink.style.minHeight = `${detailsHeight}px`;
    });
}

function scheduleCartItemPreviewHeightSync() {
    if (cartPreviewHeightSyncRaf) {
        cancelAnimationFrame(cartPreviewHeightSyncRaf);
    }

    cartPreviewHeightSyncRaf = requestAnimationFrame(() => {
        cartPreviewHeightSyncRaf = requestAnimationFrame(() => {
            cartPreviewHeightSyncRaf = null;
            syncCartItemPreviewHeights();
        });
    });
}

function handleCartItemsClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-cart-action]') : null;
    if (!target || !cartItemsContainer?.contains(target)) {
        return;
    }

    const action = target.getAttribute('data-cart-action');
    const index = Number(target.getAttribute('data-cart-index'));
    if (!Number.isInteger(index) || index < 0 || index >= cart.length) {
        return;
    }

    if (action === 'remove') {
        removeFromCart(index);
        return;
    }

    if (action === 'increase') {
        updateQuantity(index, (cart[index]?.quantity || 1) + 1);
        return;
    }

    if (action === 'decrease') {
        updateQuantity(index, (cart[index]?.quantity || 1) - 1);
    }
}

function initPageUiInteractions() {
    refreshCartDomReferences();

    if (!cartUiListenersReady) {
        if (cartBtn) {
            cartBtn.addEventListener('click', openCart);
        }

        if (cartBtnMobile) {
            cartBtnMobile.addEventListener('click', openCart);
        }

        window.addEventListener('resize', scheduleCartItemPreviewHeightSync);

        if (cartItemsContainer) {
            cartItemsContainer.addEventListener('click', handleCartItemsClick);
        }

        document.addEventListener('keydown', handleCartEscape);

        if (mobileMenuBtn && mobileMenu) {
            mobileMenu.setAttribute('aria-hidden', mobileMenu.classList.contains('hidden') ? 'true' : 'false');
            mobileMenuBtn.setAttribute('aria-expanded', mobileMenu.classList.contains('mobile-menu-open') ? 'true' : 'false');
            mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        }

        cartUiListenersReady = true;
    }

    updateCart();
    injectOrdersTrackingLink();
}

// ===== INITIAL PRODUCTS (FALLBACK) =====
var initialProducts = [
    {
        id: 1,
        nome: "Flybanner Gota 2.5m",
        descricao: "Bandeira publicitária em formato gota, ideal para eventos outdoor. Inclui estrutura e base.",
        preco: 45.00,
        categoria: "flybanners",
        imagem: "https://images.unsplash.com/photo-1596435707700-6264292b919d?auto=format&fit=crop&q=80",
        destaque: true
    },
    {
        id: 2,
        nome: "Flybanner Vela 3m",
        descricao: "Bandeira em formato vela, máxima visibilidade. Estrutura em fibra de vidro.",
        preco: 52.00,
        categoria: "flybanners",
        imagem: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80",
        destaque: true
    },
    {
        id: 3,
        nome: "Roll-up Premium 85x200cm",
        descricao: "Expositor vertical auto-enrolável com impressão de alta qualidade e maleta de transporte.",
        preco: 65.00,
        categoria: "rollups",
        imagem: "https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80",
        destaque: true
    },
    {
        id: 4,
        nome: "Lona PVC 440g/m²",
        descricao: "Lona PVC de alta resistência com ilhós para fixação. Impressão digital de alta resolução.",
        preco: 25.00,
        categoria: "lonas",
        imagem: "https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?auto=format&fit=crop&q=80",
        destaque: false
    },
    {
        id: 5,
        nome: "Flybanner Retangular 2m",
        descricao: "Bandeira retangular para máxima área de impressão. Base com água ou areia.",
        preco: 48.00,
        categoria: "flybanners",
        imagem: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80",
        destaque: false
    },
    {
        id: 6,
        nome: "Roll-up Económico 80x200cm",
        descricao: "Solução económica para eventos. Estrutura leve e fácil montagem.",
        preco: 45.00,
        categoria: "rollups",
        imagem: "https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80",
        destaque: false
    }
];

function normalizeCategoryKey(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function categoryMatches(productCategory, targetCategory, productName = '', productDescription = '') {
    const productKey = normalizeCategoryKey(productCategory);
    const targetKey = normalizeCategoryKey(targetCategory);
    const searchableProductText = [
        normalizeCategoryKey(productName),
        normalizeCategoryKey(productDescription)
    ].filter(Boolean).join(' ');

    if (!productKey || !targetKey) {
        if (!targetKey) return false;
    }

    if (productKey && productKey === targetKey) {
        return true;
    }

    const aliasMap = {
        flybanners: ['flybanner', 'flybanners', 'beachflag', 'beachflags', 'bandeira', 'bandeiras', 'mastro', 'mastros', 'teardrop', 'feather'],
        rollups: ['rollup', 'rollups', 'rollupbanner', 'rollupbanners', 'xbanner', 'xbanner', 'wallbanner', 'photocall', 'backdrop'],
        lonas: ['lona', 'lonas', 'banner', 'banners', 'pvc', 'wallbanner', 'tendapublicitaria', 'vinil', 'mesh']
    };

    const aliases = aliasMap[targetKey] || [targetKey];
    return aliases.some((alias) => {
        const normalizedAlias = normalizeCategoryKey(alias);
        if (!normalizedAlias) return false;

        return (
            (productKey && (productKey.includes(normalizedAlias) || normalizedAlias.includes(productKey)))
            || searchableProductText.includes(normalizedAlias)
        );
    });
}

function parseCatalogPrice(product) {
    const price = Number(product?.preco);
    return Number.isFinite(price) ? price : 0;
}

function isCatalogProductPurchasable(product) {
    return product?.ativo !== false && parseCatalogPrice(product) > 0;
}

function pickRandomItem(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex] || null;
}

function updateHomepageCategoryCards(products) {
    const categoryCards = document.querySelectorAll('[data-category-card]');
    if (!categoryCards.length) {
        return;
    }

    const validProducts = (Array.isArray(products) ? products : []).filter(isCatalogProductPurchasable);
    const sourceProducts = validProducts.length > 0 ? validProducts : initialProducts;

    categoryCards.forEach((card) => {
        const categoryKey = card.getAttribute('data-category');
        const imageElement = card.querySelector('[data-category-image]');
        if (!categoryKey || !(imageElement instanceof HTMLImageElement)) {
            return;
        }

        const matches = sourceProducts.filter((product) =>
            categoryMatches(product?.categoria, categoryKey, product?.nome, product?.descricao)
            && typeof product?.imagem === 'string'
            && product.imagem.trim().length > 0
        );

        const fallbackMatches = initialProducts.filter((product) =>
            categoryMatches(product?.categoria, categoryKey, product?.nome, product?.descricao)
            && typeof product?.imagem === 'string'
            && product.imagem.trim().length > 0
        );

        const selectedProduct = pickRandomItem(matches.length > 0 ? matches : fallbackMatches);
        if (!selectedProduct) {
            return;
        }

        imageElement.src = selectedProduct.imagem;
        if (selectedProduct.nome) {
            imageElement.alt = selectedProduct.nome;
        }
    });
}

function normalizeCartItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const fallbackProduct = initialProducts.find((product) => product.id === Number(item.id));
    const preco = Number(item.preco ?? fallbackProduct?.preco);
    const quantity = Math.max(1, Number.parseInt(item.quantity ?? 1, 10) || 1);

    if (!Number.isFinite(preco)) {
        return null;
    }

    const designId = (typeof item.designId === 'string' && item.designId.trim())
        ? item.designId.trim()
        : (typeof item.design_id === 'string' && item.design_id.trim())
            ? item.design_id.trim()
            : (Boolean(item.customized) ? `dsg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null);

    return {
        ...item,
        id: Number(item.id ?? fallbackProduct?.id ?? Date.now()),
        nome: item.nome || fallbackProduct?.nome || 'Produto sem nome',
        imagem: item.imagem || fallbackProduct?.imagem || '',
        preco,
        quantity,
        customized: Boolean(item.customized),
        designId,
        design: item.design || null,
        designPreview: item.designPreview || null
    };
}

function buildSvgDataUrl(svgMarkup) {
    if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
        return null;
    }

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

function getCartItemImage(item) {
    if (!item || typeof item !== 'object') {
        return '';
    }

    if (item.designPreview) {
        return item.designPreview;
    }

    if (item.customized && item.design) {
        return buildSvgDataUrl(item.design) || item.imagem || '';
    }

    return item.imagem || '';
}

function getCartItemEditorLink(item, index) {
    const productPath = typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.buildProductPersonalizerPath(item, {
            edit: index,
            design: item?.designId || undefined
        })
        : null;

    if (item?.customized && item?.designId) {
        return productPath || `/produto/${encodeURIComponent(item.id)}/personalizar?edit=${index}&design=${encodeURIComponent(item.designId)}`;
    }

    return productPath || `/produto/${encodeURIComponent(item.id)}/personalizar?edit=${index}`;
}

function buildProductCustomizeUrl(product) {
    if (typeof SiteRoutes !== 'undefined') {
        return SiteRoutes.buildProductPersonalizerPath(product);
    }

    const productId = typeof product === 'object' ? product?.id : product;
    return `/produto/${encodeURIComponent(productId)}/personalizar`;
}

function buildProductDetailsUrl(product) {
    if (typeof SiteRoutes !== 'undefined') {
        return SiteRoutes.buildProductPath(product);
    }

    const productId = typeof product === 'object' ? product?.id : product;
    return `/produto/${encodeURIComponent(productId)}`;
}

function closeCustomizationChoiceModal() {
    const modal = document.getElementById('customization-choice-modal');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
}

function openProductCustomizationChoice(productData = {}) {
    const productId = Number(productData.id);
    if (!Number.isFinite(productId)) {
        return false;
    }

    const currentCart = normalizeCartItems(getStoredCart());
    const matchingItems = currentCart
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => Number(item.id) === productId);

    if (matchingItems.length === 0) {
        window.location.href = buildProductCustomizeUrl(productData);
        return false;
    }

    closeCustomizationChoiceModal();

    const modal = document.createElement('div');
    modal.id = 'customization-choice-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4';

    const productLabel = productData.nome ? String(productData.nome) : 'este produto';
    const editButtons = matchingItems.map(({ item, index }, position) => {
        const link = getCartItemEditorLink(item, index);
        const status = item.customized ? 'Personalizado' : 'Base';
        const designLabel = item.designId ? ` • ${String(item.designId).slice(-6).toUpperCase()}` : '';

        return `
                <a href="${link}" class="choice-edit-item block w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition">
                <span class="block text-sm font-semibold text-gray-900">Editar item ${position + 1}</span>
                <span class="block text-xs text-gray-500">${status}${designLabel}</span>
            </a>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-lg font-bold text-gray-900">Produto já existe no carrinho</h3>
                    <p class="text-sm text-gray-600 mt-1">Escolha se quer criar uma nova personalização ou editar uma existente para ${productLabel}.</p>
                </div>
                <button type="button" data-action="close" class="text-gray-500 hover:text-gray-800 text-xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-4">
                <a href="${buildProductCustomizeUrl(productId)}" class="block w-full text-center bg-gray-900 text-white rounded-lg px-4 py-3 font-semibold hover:bg-gray-900 transition">
                    Adicionar nova personalização
                </a>
                <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Editar item existente</p>
                    ${editButtons}
                </div>
            </div>
            <div class="px-5 py-3 border-t border-gray-200 text-right">
                <button type="button" data-action="close" class="text-sm font-semibold text-gray-700 hover:text-black">Cancelar</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        if (target === modal || target.closest('[data-action="close"]')) {
            closeCustomizationChoiceModal();
        }
    });

    document.addEventListener('keydown', function onEscape(event) {
        if (event.key !== 'Escape') return;
        closeCustomizationChoiceModal();
        document.removeEventListener('keydown', onEscape);
    });

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    return false;
}

function normalizeCartItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map(normalizeCartItem)
        .filter(Boolean);
}

function compactCartItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map((item) => {
        return {
            id: Number(item?.id ?? 0) || 0,
            nome: String(item?.nome || '').trim(),
            preco: Number(item?.preco || 0),
            imagem: String(item?.imagem || '').trim(),
            quantity: Math.max(1, Number.parseInt(item?.quantity ?? 1, 10) || 1),
            customized: Boolean(item?.customized),
            designId: item?.designId ? String(item.designId).trim() : null,
            baseId: item?.baseId ?? item?.base_id ?? null,
            baseNome: item?.baseNome ? String(item.baseNome).trim() : null,
            baseImagem: item?.baseImagem ? String(item.baseImagem).trim() : null,
            basePrecoExtra: Number(item?.basePrecoExtra || 0)
        };
    });
}

function isQuotaExceededError(error) {
    const name = String(error?.name || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return name.includes('quota') || message.includes('quota');
}

async function hydrateCartDesignAssets() {
    if (cartDesignHydrationPending) {
        return;
    }

    if (!window.CartAssetStore?.hydrateCartItems) {
        updateCart();
        return;
    }

    cartDesignHydrationPending = true;

    try {
        if (window.CartAssetStore?.migrateLegacyCartItems) {
            cart = await window.CartAssetStore.migrateLegacyCartItems(cart);
        }

        cart = await window.CartAssetStore.hydrateCartItems(cart);
        updateCart();
    } catch (error) {
        console.warn('Falha ao hidratar os designs do carrinho:', error);
        updateCart();
    } finally {
        cartDesignHydrationPending = false;
    }
}

cart = normalizeCartItems(getStoredCart());
window.cartHydrationPromise = hydrateCartDesignAssets();

const productCardPreviewTouchQuery = window.matchMedia('(hover: none), (pointer: coarse)');

function clearProductCardPreviewState() {
    document.querySelectorAll('.product-card.is-preview-active, .product-card-image.is-preview-active').forEach((element) => {
        element.classList.remove('is-preview-active');
    });
}

if (!window.__productCardPreviewTouchInteractionBound) {
    window.__productCardPreviewTouchInteractionBound = true;

    document.addEventListener('click', (event) => {
        if (!productCardPreviewTouchQuery.matches) {
            return;
        }

        const card = event.target.closest?.('.product-card');
        if (!card) {
            return;
        }

        if (event.target.closest?.('a, button, input, select, textarea, label')) {
            return;
        }

        const image = card.querySelector('.product-card-image');
        if (!image) {
            return;
        }

        const nextActive = !card.classList.contains('is-preview-active');
        clearProductCardPreviewState();

        if (nextActive) {
            card.classList.add('is-preview-active');
            image.classList.add('is-preview-active');
        }
    });
}

// ===== RENDER PRODUCTS =====
function renderProducts(products) {
    if (!productsContainer) return; // Safety check for pages without products container

    if (!products || products.length === 0) {
        productsContainer.innerHTML = '<p class="text-center col-span-full py-10 text-gray-500">Nenhum produto encontrado.</p>';
        return;
    }

    // Filter only featured products for homepage
    const purchasableProducts = products.filter(isCatalogProductPurchasable);
    const displaySource = purchasableProducts.length > 0 ? purchasableProducts : products;
    const featuredProducts = displaySource.filter(p => p.destaque).slice(0, 3);
    const displayProducts = featuredProducts.length > 0 ? featuredProducts : displaySource.slice(0, 3);

    productsContainer.innerHTML = displayProducts.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-card-image image-zoom" tabindex="0" aria-label="Imagem do produto ${escapeHtml(String(product.nome || 'Produto sem nome'))}">
                <img src="${product.imagem}" alt="${product.nome}" class="w-full h-full object-cover">
                <div class="product-badge">
                    ${isCatalogProductPurchasable(product) ? `${parseCatalogPrice(product).toFixed(2)}€` : 'Sob consulta'}
                </div>
            </div>
            <div class="product-card-body">
                <h3 class="product-card-title">${product.nome}</h3>
                <a href="${buildProductDetailsUrl(product)}"
                    data-product-id="${product.id}"
                    data-product-name="${encodeURIComponent(String(product.nome || 'Produto sem nome'))}"
                    data-product-category="${escapeHtml(String(product.categoria || ''))}"
                    class="product-card-cta">
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    Ver produto
                </a>
            </div>
        </div>
    `).join('');

    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    scheduleCartItemPreviewHeightSync();
}

// ===== FETCH PRODUCTS FROM SUPABASE =====
async function fetchProducts() {
    if (!supabaseClient || typeof supabaseClient.from !== 'function') {
        renderProducts(initialProducts);
        updateHomepageCategoryCards(initialProducts);
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('destaque', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            renderProducts(data);
            updateHomepageCategoryCards(data);
        } else {
            renderProducts(initialProducts);
            updateHomepageCategoryCards(initialProducts);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error.message);
        renderProducts(initialProducts);
        updateHomepageCategoryCards(initialProducts);
    }
}

// ===== CART FUNCTIONS =====
function updateCart() {
    refreshCartDomReferences();
    cart = normalizeCartItems(cart);
    const persistedCart = compactCartItems(cart);
    const serializedCart = JSON.stringify(persistedCart);

    try {
        localStorage.setItem(CART_STORAGE_KEY, serializedCart);
        LEGACY_CART_STORAGE_KEYS.forEach((key) => {
            localStorage.setItem(key, serializedCart);
        });
    } catch (error) {
        if (!isQuotaExceededError(error)) {
            throw error;
        }

        const minimalCart = JSON.stringify(persistedCart.map((item) => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantity: item.quantity,
            customized: item.customized,
            designId: item.designId,
            baseId: item.baseId,
            baseNome: item.baseNome,
            basePrecoExtra: item.basePrecoExtra
        })));

        localStorage.removeItem(CART_STORAGE_KEY);
        LEGACY_CART_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        localStorage.setItem(CART_STORAGE_KEY, minimalCart);
        LEGACY_CART_STORAGE_KEYS.forEach((key) => {
            localStorage.setItem(key, minimalCart);
        });
    }

    if (window.CartAssetStore?.cleanupUnusedDesigns) {
        const activeDesignIds = cart
            .map((item) => String(item?.designId || item?.design_id || '').trim())
            .filter(Boolean);

        window.CartAssetStore.cleanupUnusedDesigns(activeDesignIds).catch((error) => {
            console.warn('Falha ao limpar designs antigos do carrinho:', error);
        });
    }

    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    updateCartCountBadges(totalItems);
    renderCartItemsList();
    if (cartTotal) {
        const total = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        cartTotal.textContent = `${total.toFixed(2)}€`;
    }
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function addToCart(productId) {
    // Find product in initial products or fetch from Supabase
    const product = initialProducts.find(p => p.id === productId);

    if (!product) {
        showToast('Produto não encontrado', 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            nome: product.nome,
            preco: product.preco,
            imagem: product.imagem,
            quantity: 1
        });
    }

    updateCart();
    if (typeof window.trackAnalyticsEvent === 'function') {
        window.trackAnalyticsEvent('add_to_cart', {
            productId,
            metadata: {
                sourcePath: window.location.pathname
            }
        });
    }
    showToast('Produto adicionado ao carrinho!', 'success');
    openCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
    showToast('Produto removido do carrinho', 'info');
}

function updateQuantity(index, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(index);
        return;
    }

    if (cart[index]) {
        cart[index].quantity = newQuantity;
        updateCart();
    }
}

function openCart(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    buildLegacyCartSidebarMarkup();
    refreshCartDomReferences();
    updateCart();

    if (!cartSidebar) return;

    cartSidebar.classList.remove('translate-x-full');
    cartSidebar.setAttribute('aria-hidden', 'false');

    if (cartOverlay) {
        cartOverlay.classList.remove('hidden');
    }

    if (cartBtn) cartBtn.setAttribute('aria-expanded', 'true');
    if (cartBtnMobile) cartBtnMobile.setAttribute('aria-expanded', 'true');

    document.body.style.overflow = 'hidden';
}

function closeCart() {
    if (cartSidebar) {
        cartSidebar.classList.add('translate-x-full');
        cartSidebar.setAttribute('aria-hidden', 'true');
    }

    if (cartOverlay) {
        cartOverlay.classList.add('hidden');
    }

    if (cartBtn) cartBtn.setAttribute('aria-expanded', 'false');
    if (cartBtnMobile) cartBtnMobile.setAttribute('aria-expanded', 'false');

    document.body.style.overflow = '';
}

function handleCartEscape(event) {
    if (event.key !== 'Escape') return;
    if (!cartSidebar || cartSidebar.getAttribute('aria-hidden') === 'true') return;
    closeCart();
}

function injectOrdersTrackingLink() {
    if (!cartSidebar) return;

    const checkoutHref = typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.STATIC_PATHS.checkout
        : '/checkout';
    const checkoutLink = cartSidebar.querySelector(`a[href="${checkoutHref}"]`);
    if (!checkoutLink) return;

    const existingLink = cartSidebar.querySelector('.orders-tracking-link');
    if (existingLink) return;

    const trackLink = document.createElement('a');
    trackLink.href = typeof SiteRoutes !== 'undefined'
        ? SiteRoutes.STATIC_PATHS.orders
        : '/encomendas';
    trackLink.className = 'orders-tracking-link block w-full mt-2 border border-blue-200 text-blue-700 text-center py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition';
    trackLink.innerHTML = '<i data-lucide="package-search" class="w-4 h-4 inline-block mr-1"></i> Acompanhar Encomendas';

    checkoutLink.insertAdjacentElement('afterend', trackLink);
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== QUICK VIEW =====
function quickView(productId) {
    const product = initialProducts.find(p => p.id === productId);
    if (!product) return;

    showToast('Funcionalidade de visualização rápida em desenvolvimento', 'info');
}

// ===== MOBILE MENU =====
function toggleMobileMenu(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    if (mobileMenu) {
        const willOpen = !mobileMenu.classList.contains('mobile-menu-open');
        mobileMenu.classList.remove('hidden');
        mobileMenu.classList.toggle('mobile-menu-open', willOpen);
        mobileMenu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        if (mobileMenuBtn) {
            mobileMenuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        }
        if (!willOpen) {
            window.setTimeout(() => {
                if (!mobileMenu.classList.contains('mobile-menu-open')) {
                    mobileMenu.classList.add('hidden');
                }
            }, 220);
        }
    }
}

// ===== EVENT LISTENERS =====
if (cartBtn) {
    cartBtn.addEventListener('click', openCart);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    initPageUiInteractions();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// Make functions globally available
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.getCartItemImage = getCartItemImage;
window.quickView = quickView;
window.openProductCustomizationChoice = openProductCustomizationChoice;
