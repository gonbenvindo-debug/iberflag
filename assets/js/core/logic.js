// ===== SUPABASE CONFIGURATION =====
const APP_CONFIG = (typeof window !== 'undefined' && window.APP_CONFIG) ? window.APP_CONFIG : {};
const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || 'https://nzwfquivulxkmxrwqalz.supabase.co';
const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56d2ZxdWl2dWx4a214cndxYWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzMzODQsImV4cCI6MjA4OTM0OTM4NH0.pelN5argByWYMij-wE1GRhQ-L8bEFGMDMJliOZrBBXU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== CART MANAGEMENT =====
const CART_STORAGE_KEY = 'iberflag_cart';
const LEGACY_CART_STORAGE_KEYS = ['latinflag_cart', 'cart'];

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

let cart = [];

// ===== DOM ELEMENTS =====
const productsContainer = document.getElementById('products-container');
const cartBtn = document.getElementById('cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const closeCartBtn = document.getElementById('close-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const cartCount = document.getElementById('cart-count');

// ===== INITIAL PRODUCTS (FALLBACK) =====
const initialProducts = [
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
    if (item?.customized && item?.designId) {
        return `/personalizar.html?produto=${item.id}&edit=${index}&design=${encodeURIComponent(item.designId)}`;
    }

    return `/personalizar.html?produto=${item.id}&edit=${index}`;
}

function normalizeCartItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map(normalizeCartItem)
        .filter(Boolean);
}

cart = normalizeCartItems(getStoredCart());

// ===== RENDER PRODUCTS =====
function renderProducts(products) {
    if (!productsContainer) return; // Safety check for pages without products container
    
    if (!products || products.length === 0) {
        productsContainer.innerHTML = '<p class="text-center col-span-full py-10 text-gray-500">Nenhum produto encontrado.</p>';
        return;
    }

    // Filter only featured products for homepage
    const featuredProducts = products.filter(p => p.destaque).slice(0, 3);
    const displayProducts = featuredProducts.length > 0 ? featuredProducts : products.slice(0, 3);

    productsContainer.innerHTML = displayProducts.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="relative h-64 overflow-hidden image-zoom">
                <img src="${product.imagem}" alt="${product.nome}" class="w-full h-full object-cover">
                <div class="product-badge">
                    ${product.preco.toFixed(2)}€
                </div>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="text-xl font-bold mb-2 text-gray-900">${product.nome}</h3>
                <p class="text-gray-600 text-sm mb-6 flex-grow">${product.descricao}</p>
                <a href="/personalizar.html?produto=${product.id}" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                    <i data-lucide="palette" class="w-4 h-4"></i>
                    Personalizar e Comprar
                </a>
            </div>
        </div>
    `).join('');
    
    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===== FETCH PRODUCTS FROM SUPABASE =====
async function fetchProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('destaque', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            renderProducts(data);
        } else {
            renderProducts(initialProducts);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error.message);
        renderProducts(initialProducts);
    }
}

// ===== CART FUNCTIONS =====
function updateCart() {
    cart = normalizeCartItems(cart);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    LEGACY_CART_STORAGE_KEYS.forEach((key) => {
        localStorage.setItem(key, JSON.stringify(cart));
    });
    
    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartCount) {
        if (totalItems > 0) {
            cartCount.textContent = totalItems;
            cartCount.classList.remove('hidden');
        } else {
            cartCount.classList.add('hidden');
        }
    }
    
    // Update mobile cart count
    const cartCountMobile = document.getElementById('cart-count-mobile');
    if (cartCountMobile) {
        if (totalItems > 0) {
            cartCountMobile.textContent = totalItems;
            cartCountMobile.classList.remove('hidden');
        } else {
            cartCountMobile.classList.add('hidden');
        }
    }

    // Update cart items
    if (cartItemsContainer) {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-12">
                    <i data-lucide="shopping-cart" class="w-16 h-16 mx-auto mb-4 text-gray-300"></i>
                    <p>O seu carrinho está vazio</p>
                </div>
            `;
        } else {
            cartItemsContainer.innerHTML = cart.map((item, index) => `
                <div class="flex gap-4 mb-4 pb-4 border-b">
                    <img src="${getCartItemImage(item)}" alt="${item.nome}" class="w-20 h-20 object-cover rounded-lg bg-gray-50 border border-gray-100">
                    <div class="flex-1">
                        <h4 class="font-bold text-sm">${item.nome}</h4>
                        ${item.customized ? '<span class="text-xs text-green-600 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Personalizado</span>' : ''}
                        <p class="text-blue-600 font-bold">${item.preco.toFixed(2)}€</p>
                        <div class="flex items-center gap-2 mt-2">
                            <a href="${getCartItemEditorLink(item, index)}" class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                                <i data-lucide="${item.customized ? 'edit' : 'palette'}" class="w-3 h-3"></i>
                                ${item.customized ? 'Editar' : 'Personalizar'}
                            </a>
                            <button onclick="removeFromCart(${index})" class="ml-auto text-red-500 hover:text-red-700">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Update total
    if (cartTotal) {
        const total = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        cartTotal.textContent = `${total.toFixed(2)}€`;
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

function openCart() {
    if (cartSidebar && cartOverlay) {
        cartSidebar.classList.add('cart-open');
        cartOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeCart() {
    if (cartSidebar && cartOverlay) {
        cartSidebar.classList.remove('cart-open');
        cartOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function injectOrdersTrackingLink() {
    if (!cartSidebar) return;

    const checkoutLink = cartSidebar.querySelector('a[href="/checkout.html"]');
    if (!checkoutLink) return;

    const existingLink = cartSidebar.querySelector('.orders-tracking-link');
    if (existingLink) return;

    const trackLink = document.createElement('a');
    trackLink.href = '/encomendas.html';
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
function toggleMobileMenu() {
    if (mobileMenu) {
        mobileMenu.classList.toggle('hidden');
    }
}

// ===== EVENT LISTENERS =====
if (cartBtn) {
    cartBtn.addEventListener('click', openCart);
}

if (closeCartBtn) {
    closeCartBtn.addEventListener('click', closeCart);
}

if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCart);
}

// ===== MOBILE MENU =====
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const cartBtnMobile = document.getElementById('cart-btn-mobile');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

if (cartBtnMobile) {
    cartBtnMobile.addEventListener('click', openCart);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    updateCart();
    injectOrdersTrackingLink();
    
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
