// ===== CHECKOUT PAGE LOGIC =====

const FREE_SHIPPING_THRESHOLD = 0;
const SHIPPING_COST = 0;

// ===== DOM ELEMENTS =====
const checkoutForm = document.getElementById('checkout-form');
const orderItems = document.getElementById('order-items');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const totalEl = document.getElementById('total');
const remainingEl = document.getElementById('remaining');
const freeShippingMsg = document.getElementById('free-shipping-msg');
const placeOrderBtn = document.getElementById('place-order-btn');
const termsCheckbox = document.getElementById('terms-checkbox');
const checkoutFeedback = document.getElementById('checkout-feedback');

const PLACE_ORDER_DEFAULT_LABEL = '<i data-lucide="lock" class="w-5 h-5"></i> Finalizar Encomenda';

function isSupabaseReady() {
    return Boolean(supabaseClient && typeof supabaseClient.from === 'function' && typeof supabaseClient.rpc === 'function');
}

function setCheckoutFeedback(message, type = 'error') {
    if (!checkoutFeedback) return;

    const palette = {
        error: 'border-red-200 bg-red-50 text-red-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-slate-200 bg-slate-50 text-slate-700'
    };

    checkoutFeedback.className = `rounded-xl border px-4 py-3 text-sm font-medium ${palette[type] || palette.error}`;
    checkoutFeedback.textContent = message;
    checkoutFeedback.classList.remove('hidden');
}

function clearCheckoutFeedback() {
    if (!checkoutFeedback) return;
    checkoutFeedback.classList.add('hidden');
    checkoutFeedback.textContent = '';
}

function setPlaceOrderLoading(isLoading) {
    if (!placeOrderBtn) return;
    placeOrderBtn.disabled = isLoading;
    placeOrderBtn.innerHTML = isLoading
        ? '<div class="spinner mx-auto"></div>'
        : PLACE_ORDER_DEFAULT_LABEL;

    if (!isLoading && typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getCheckoutErrorMessage(error) {
    const rawMessage = String(error?.message || error?.details || error?.hint || '').toLowerCase();

    if (error?.code === 'MISSING_PRODUCT_MAPPING') {
        return 'Existem produtos no carrinho que ja nao existem na base de dados. Atualize o carrinho e tente novamente.';
    }

    if (error?.code === '23503') {
        return 'Um produto do carrinho deixou de existir. Reabra o produto e adicione novamente ao carrinho.';
    }

    if (error?.code === 'CARRINHO_VAZIO') {
        return 'O carrinho esta vazio.';
    }

    if (error?.code === 'DADOS_CLIENTE_INVALIDOS') {
        return 'Preencha nome, email e telefone.';
    }

    if (error?.code === 'MORADA_INVALIDA') {
        return 'Preencha morada, codigo postal e cidade.';
    }

    if (error?.code === 'TOTAL_INVALIDO') {
        return 'O total da encomenda nao e valido.';
    }

    if (error?.code === 'CHECKOUT_SESSION_FAILED') {
        return error?.message || 'Nao foi possivel iniciar a sessao de pagamento.';
    }

    if (rawMessage.includes('stripe')) {
        return 'Nao foi possivel iniciar o checkout com o Stripe.';
    }

    if (rawMessage.includes('facturalusa')) {
        return 'Nao foi possivel comunicar com o Facturalusa.';
    }

    return 'Erro ao iniciar o checkout. Por favor, tente novamente.';
}

function buildOrderItemSnapshots(items) {
    return items.map((item) => ({
        designId: item.designId || item.design_id || null,
        produtoId: Number(item.id) || null,
        nome: item.nome || 'Produto',
        quantidade: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
        precoUnitario: Number(item.preco || 0),
        imagem: item.imagem || '',
        customized: Boolean(item.customized),
        baseNome: item.baseNome || '',
        basePrecoExtra: Number(item.basePrecoExtra || 0)
    }));
}

async function insertOrderItemsWithFallback(orderId, items) {
    const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const { data: dbProducts, error: dbProductsError } = await supabaseClient
        .from('produtos')
        .select('id, nome');

    if (dbProductsError) {
        throw dbProductsError;
    }

    const productIdSet = new Set((dbProducts || []).map((product) => Number(product.id)).filter(Number.isFinite));
    const productIdByName = new Map();

    (dbProducts || []).forEach((product) => {
        const normalized = normalizeName(product.nome);
        if (normalized && !productIdByName.has(normalized)) {
            productIdByName.set(normalized, Number(product.id));
        }
    });

    const unresolvedItems = [];

    const normalizedItems = items.map((item) => {
        const candidateId = Number(item.id);
        const normalizedName = normalizeName(item.nome);

        let resolvedProductId = null;

        if (Number.isFinite(candidateId) && productIdSet.has(candidateId)) {
            resolvedProductId = candidateId;
        } else if (normalizedName && productIdByName.has(normalizedName)) {
            resolvedProductId = productIdByName.get(normalizedName);
        }

        if (!resolvedProductId) {
            unresolvedItems.push(item.nome || `ID ${item.id}`);
        }

        return {
            ...item,
            resolvedProductId
        };
    });

    if (unresolvedItems.length > 0) {
        throw {
            code: 'MISSING_PRODUCT_MAPPING',
            message: `Produtos nao encontrados na base de dados: ${unresolvedItems.join(', ')}`,
            details: unresolvedItems
        };
    }

    const baseItems = normalizedItems.map((item) => ({
        encomenda_id: orderId,
        produto_id: item.resolvedProductId,
        quantidade: item.quantity,
        preco_unitario: item.preco,
        subtotal: item.preco * item.quantity
    }));

    // These columns are optional because schemas can differ between environments.
    const optionalColumns = ['design_id', 'design_svg', 'design_preview', 'nome_produto', 'imagem_produto'];
    const optionalValueByColumn = {
        design_id: (item) => item.designId || item.design_id || null,
        design_svg: (item) => item.design || null,
        design_preview: (item) => item.designPreview || (typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem || null),
        nome_produto: (item) => item.nome || null,
        imagem_produto: (item) => item.imagem || null
    };

    const getSupportedOptionalColumns = async () => {
        // Prefer a schema-safe approach: inspect existing row keys when possible.
        // If there are no rows yet (or read restrictions), skip optional columns to avoid noisy 400 retries.
        try {
            const { data, error } = await supabaseClient
                .from('itens_encomenda')
                .select('*')
                .limit(1);

            if (error || !Array.isArray(data) || data.length === 0) {
                return [];
            }

            const available = new Set(Object.keys(data[0] || {}));
            return optionalColumns.filter((columnName) => available.has(columnName));
        } catch (error) {
            return [];
        }
    };

    let activeOptionalColumns = await getSupportedOptionalColumns();

    const getMissingColumnFromError = (error) => {
        const raw = [error?.message, error?.details, error?.hint]
            .filter(Boolean)
            .join(' | ')
            .toLowerCase();

        // PostgreSQL style: column "x" of relation "itens_encomenda" does not exist
        let match = raw.match(/column\s+"([a-z0-9_]+)"\s+of\s+relation\s+"itens_encomenda"\s+does\s+not\s+exist/);
        if (match) return match[1];

        // PostgREST schema cache style: Could not find the 'x' column of 'itens_encomenda' in the schema cache
        match = raw.match(/could\s+not\s+find\s+the\s+'([a-z0-9_]+)'\s+column\s+of\s+'itens_encomenda'/);
        if (match) return match[1];

        // Alternative quoting styles
        match = raw.match(/could\s+not\s+find\s+the\s+"([a-z0-9_]+)"\s+column\s+of\s+"itens_encomenda"/);
        if (match) return match[1];

        return null;
    };

    while (true) {
        const payload = baseItems.map((baseItem, index) => {
            const sourceItem = normalizedItems[index];
            const enriched = { ...baseItem };

            activeOptionalColumns.forEach((columnName) => {
                enriched[columnName] = optionalValueByColumn[columnName](sourceItem);
            });

            return enriched;
        });

        const { error } = await supabaseClient
            .from('itens_encomenda')
            .insert(payload);

        if (!error) {
            return;
        }

        const missingColumn = getMissingColumnFromError(error);
        if (!missingColumn) {
            throw error;
        }

        const columnIndex = activeOptionalColumns.indexOf(missingColumn);

        if (columnIndex === -1) {
            throw error;
        }

        activeOptionalColumns.splice(columnIndex, 1);

        if (activeOptionalColumns.length === 0) {
            const retry = await supabaseClient
                .from('itens_encomenda')
                .insert(baseItems);

            if (retry.error) {
                throw retry.error;
            }
            return;
        }
    }
}

// ===== LOAD CART =====
async function loadCart() {
    if (window.cartHydrationPromise) {
        await window.cartHydrationPromise;
    }

    if (!cart || cart.length === 0) {
        window.location.href = '/produtos.html';
        return;
    }

    // Render cart items
    orderItems.innerHTML = cart.map(item => `
        <div class="flex gap-3 pb-4 border-b">
            <img src="${typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem}" alt="${item.nome}" class="w-16 h-16 object-cover rounded bg-gray-50 border border-gray-100">
            <div class="flex-1">
                <h4 class="font-semibold text-sm">${item.nome}</h4>
                ${item.customized ? '<span class="text-xs text-green-600 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Personalizado</span>' : ''}
                ${item.baseNome ? `<p class="text-xs text-gray-500 mt-1">Base: ${item.baseNome}${Number(item.basePrecoExtra || 0) > 0 ? ` (+${Number(item.basePrecoExtra).toFixed(2)}€)` : ''}</p>` : ''}
                <p class="text-sm text-gray-600">Qtd: ${item.quantity}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-blue-600">${(item.preco * item.quantity).toFixed(2)}€</p>
            </div>
        </div>
    `).join('');

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
    const shipping = SHIPPING_COST;
    const total = subtotal + shipping;

    subtotalEl.textContent = `${subtotal.toFixed(2)}€`;
    shippingEl.textContent = 'Gratis';
    totalEl.textContent = `${total.toFixed(2)}€`;

    // Free shipping message
    if (freeShippingMsg) {
        freeShippingMsg.innerHTML = '<p class="font-semibold">Envio gratis aplicado na Peninsula Iberica.</p>';
    }
    if (remainingEl) {
        remainingEl.textContent = '0.00€';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===== VALIDATE CUSTOMIZATION =====
function validateCustomization() {
    const hasUncustomized = cart.some(item => !item.customized);
    
    if (hasUncustomized) {
        showToast('Todos os produtos devem ser personalizados antes da compra', 'error');
        setTimeout(() => {
            window.location.href = '/produtos.html';
        }, 2000);
        return false;
    }
    
    return true;
}

// ===== PLACE ORDER =====
if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (window.cartHydrationPromise) {
            await window.cartHydrationPromise;
        }

        clearCheckoutFeedback();
        
        // Validate form
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        // Check terms
        if (!termsCheckbox.checked) {
            showToast('Por favor, aceite os termos e condições', 'error');
            return;
        }

        // Validate customization
        if (!validateCustomization()) {
            return;
        }

        // Get form data
        const formData = new FormData(checkoutForm);
        const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'card';
        const customerData = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            telefone: formData.get('telefone'),
            nif: formData.get('nif') || null,
            empresa: formData.get('empresa') || null,
            morada: formData.get('morada'),
            codigo_postal: formData.get('codigo_postal'),
            cidade: formData.get('cidade')
        };

        const orderNotes = formData.get('notas') || null;

        // Calculate totals
        const subtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        const shipping = SHIPPING_COST;
        const total = subtotal + shipping;

        // Disable button
        setPlaceOrderLoading(true);

        try {
            const response = await fetch('/api/checkout/create-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customer: customerData,
                    cart,
                    paymentMethod: selectedPaymentMethod,
                    notes: orderNotes
                })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = getCheckoutErrorMessage({
                    code: payload?.error,
                    message: payload?.message || payload?.error || 'CHECKOUT_SESSION_FAILED'
                });
                throw {
                    code: payload?.error || 'CHECKOUT_SESSION_FAILED',
                    message
                };
            }

            setCheckoutFeedback('Pagamento iniciado. Vamos abrir o checkout seguro.', 'success');
            showToast('Pagamento iniciado com sucesso!', 'success');

            cart = [];
            localStorage.removeItem('iberflag_cart');
            localStorage.removeItem('cart');
            if (window.CartAssetStore?.cleanupUnusedDesigns) {
                window.CartAssetStore.cleanupUnusedDesigns([]).catch((cleanupError) => {
                    console.warn('Falha ao limpar designs do carrinho após checkout:', cleanupError);
                });
            }

            setTimeout(() => {
                if (payload?.url) {
                    window.location.href = payload.url;
                    return;
                }

                window.location.href = `/checkout-sucesso.html?codigo=${encodeURIComponent(payload?.orderCode || '')}`;
            }, 1000);

        } catch (error) {
            console.error('Erro ao criar encomenda:', error);
            const errorMessage = getCheckoutErrorMessage(error);
            setCheckoutFeedback(errorMessage, 'error');
            showToast(errorMessage, 'error');
            
            // Re-enable button
            setPlaceOrderLoading(false);
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    void loadCart();
});
