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

function normalizeTaxId(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function detectTaxCountry(value, postalCode = '') {
    const normalized = normalizeTaxId(value);
    const normalizedPostalCode = String(postalCode || '').trim().toUpperCase();

    if (/^[XYZ]\d{7}[A-Z]$/.test(normalized) || /^[A-Z]\d{7}[A-Z0-9]$/.test(normalized)) {
        return 'ES';
    }

    if (/^\d{5}(-\d{4})?$/.test(normalizedPostalCode)) {
        return 'ES';
    }

    return 'PT';
}

function isValidPortugueseNif(value) {
    const nif = normalizeTaxId(value);
    if (!/^[1235689]\d{8}$/.test(nif)) {
        return false;
    }

    const digits = nif.split('').map((digit) => Number.parseInt(digit, 10));
    const sum = digits.slice(0, 8).reduce((acc, digit, index) => acc + (digit * (9 - index)), 0);
    const rawCheckDigit = 11 - (sum % 11);
    const checkDigit = rawCheckDigit >= 10 ? 0 : rawCheckDigit;
    return checkDigit === digits[8];
}

function getSpanishControlLetter(number) {
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    return letters[Number(number) % 23];
}

function isValidSpanishDniOrNie(value) {
    const taxId = normalizeTaxId(value);

    if (/^\d{8}[A-Z]$/.test(taxId)) {
        return getSpanishControlLetter(taxId.slice(0, 8)) === taxId[8];
    }

    if (/^[XYZ]\d{7}[A-Z]$/.test(taxId)) {
        const prefixMap = { X: '0', Y: '1', Z: '2' };
        const number = `${prefixMap[taxId[0]]}${taxId.slice(1, 8)}`;
        return getSpanishControlLetter(number) === taxId[8];
    }

    return false;
}

function isValidSpanishCif(value) {
    const cif = normalizeTaxId(value);
    if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(cif)) {
        return false;
    }

    const digits = cif.slice(1, 8).split('').map((digit) => Number.parseInt(digit, 10));
    const evenSum = digits[1] + digits[3] + digits[5];
    const oddSum = [digits[0], digits[2], digits[4], digits[6]].reduce((sum, digit) => {
        const doubled = digit * 2;
        return sum + Math.floor(doubled / 10) + (doubled % 10);
    }, 0);
    const controlNumber = (10 - ((evenSum + oddSum) % 10)) % 10;
    const controlLetter = 'JABCDEFGHI'[controlNumber];
    const control = cif[8];
    const first = cif[0];

    if ('KPQSW'.includes(first)) {
        return control === controlLetter;
    }

    if ('ABEH'.includes(first)) {
        return control === String(controlNumber);
    }

    return control === String(controlNumber) || control === controlLetter;
}

function validateTaxId(value, postalCode = '') {
    const normalized = normalizeTaxId(value);
    if (!normalized) {
        return { valid: true, normalized, message: '' };
    }

    const country = detectTaxCountry(normalized, postalCode);
    const valid = country === 'ES'
        ? isValidSpanishDniOrNie(normalized) || isValidSpanishCif(normalized)
        : isValidPortugueseNif(normalized);

    return {
        valid,
        normalized,
        message: valid
            ? ''
            : country === 'ES'
                ? 'NIF/NIE espanhol invalido. Verifique o numero fiscal antes de continuar.'
                : 'NIF portugues invalido. Verifique os 9 digitos antes de continuar.'
    };
}

function updateTaxIdValidity() {
    const nifInput = checkoutForm?.elements?.nif;
    if (!nifInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const postalCode = checkoutForm?.elements?.codigo_postal?.value || '';
    const validation = validateTaxId(nifInput.value, postalCode);
    nifInput.value = validation.normalized;
    nifInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

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

    if (error?.code === 'PRODUCT_INACTIVE') {
        return 'Um produto do carrinho deixou de estar disponivel. Atualize o carrinho e tente novamente.';
    }

    if (error?.code === 'BASE_INVALIDA') {
        return 'Uma base selecionada ja nao esta disponivel para esse produto. Reabra o personalizador e escolha outra base.';
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

    if (error?.code === 'NIF_INVALIDO') {
        return error?.message || 'NIF invalido. Verifique o numero fiscal antes de continuar.';
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

function buildCheckoutRequestCart(items) {
    return items.map((item) => ({
        id: item.id ?? null,
        nome: String(item.nome || 'Produto').trim(),
        quantity: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
        customized: Boolean(item.customized),
        imagem: String(item.imagem || '').trim(),
        design: String(item.design || '').trim(),
        designPreview: String(item.designPreview || '').trim(),
        baseNome: String(item.baseNome || '').trim(),
        baseId: item.baseId || item.base_id || null,
        designId: item.designId || item.design_id || null
    }));
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
        const taxIdValidation = updateTaxIdValidity();
        if (!taxIdValidation.valid) {
            setCheckoutFeedback(taxIdValidation.message, 'error');
            checkoutForm.reportValidity();
            return;
        }
        
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
                    cart: buildCheckoutRequestCart(cart),
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
    const nifInput = checkoutForm?.elements?.nif;
    const postalCodeInput = checkoutForm?.elements?.codigo_postal;
    if (nifInput) {
        nifInput.addEventListener('input', () => {
            updateTaxIdValidity();
        });
        nifInput.addEventListener('blur', () => {
            const validation = updateTaxIdValidity();
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
            }
        });
    }
    if (postalCodeInput) {
        postalCodeInput.addEventListener('blur', () => {
            updateTaxIdValidity();
        });
    }

    void loadCart();
});
