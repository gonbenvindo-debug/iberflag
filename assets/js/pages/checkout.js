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
const customerTypeSelect = document.getElementById('customer-type-select');
const customerTypeDescription = document.getElementById('customer-type-description');
const nifInput = document.getElementById('nif-input');
const phoneInput = checkoutForm?.elements?.telefone || null;
const emailInput = checkoutForm?.elements?.email || null;
const postalCodeInput = checkoutForm?.elements?.codigo_postal || null;
const companyInput = checkoutForm?.elements?.empresa || null;
const contactNameLabel = document.getElementById('contact-name-label');
const companyLabel = document.getElementById('company-label');
const nifLabel = document.getElementById('nif-label');
const nifHelp = document.getElementById('nif-help');
const companyLookupBtn = document.getElementById('lookup-company-btn');
const companyLookupStatus = document.getElementById('company-lookup-status');
const companyFieldRow = document.getElementById('company-field-row');
const toggleOrderNotesBtn = document.getElementById('toggle-order-notes');
const orderNotesField = document.getElementById('order-notes-field');
const notesTextarea = checkoutForm?.elements?.notas || null;

const PLACE_ORDER_DEFAULT_LABEL = '<i data-lucide="lock" class="w-5 h-5"></i> Finalizar Encomenda';
const COMMON_EMAIL_DOMAIN_FIXES = {
    'gmail.com.pt': 'gmail.com',
    'gmail.pt': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'outlook.con': 'outlook.com'
};
const companyLookupCache = new Map();
let companyLookupInFlight = false;

function setElementHidden(element, hidden) {
    if (!element) {
        return;
    }

    element.classList.toggle('hidden', hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function normalizeTaxId(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeCheckoutEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function validateCheckoutEmail(value) {
    const normalized = normalizeCheckoutEmail(value);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return {
            valid: false,
            normalized,
            message: 'Introduza um email valido.'
        };
    }

    const domain = normalized.split('@').pop();
    const suggestedDomain = COMMON_EMAIL_DOMAIN_FIXES[domain];
    if (suggestedDomain) {
        return {
            valid: false,
            normalized,
            suggestion: normalized.replace(/@[^@]+$/, `@${suggestedDomain}`),
            message: `O dominio do email parece invalido: @${domain}. Queria dizer @${suggestedDomain}?`
        };
    }

    return {
        valid: true,
        normalized,
        message: ''
    };
}

function updateEmailValidity({ normalizeInput = false } = {}) {
    const emailInput = checkoutForm?.elements?.email;
    if (!emailInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const validation = validateCheckoutEmail(emailInput.value);
    if (normalizeInput) {
        emailInput.value = validation.normalized;
    }
    emailInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function normalizeCustomerType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'empresa') {
        return 'empresa';
    }
    return 'particular';
}

function getSelectedCustomerType() {
    return normalizeCustomerType(customerTypeSelect?.value || 'particular');
}

function isBusinessCustomerSelected() {
    return getSelectedCustomerType() === 'empresa';
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

function normalizeCheckoutPhone(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    let normalized = raw.replace(/[^\d+]/g, '');
    if (normalized.startsWith('00')) {
        normalized = `+${normalized.slice(2)}`;
    }

    if (normalized.startsWith('+')) {
        return `+${normalized.slice(1).replace(/\D/g, '')}`;
    }

    return normalized.replace(/\D/g, '');
}

function normalizePostalCode(value, country = 'PT') {
    const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
        return '';
    }

    if (String(country || '').toUpperCase() === 'ES') {
        return normalized.replace(/[^\d]/g, '').slice(0, 5);
    }

    const digits = normalized.replace(/[^\d]/g, '').slice(0, 7);
    if (digits.length === 7) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    return normalized;
}

function validateCheckoutPhone(value, postalCode = '', taxId = '') {
    const normalized = normalizeCheckoutPhone(value);
    const country = detectTaxCountry(taxId, postalCode);
    if (!normalized) {
        return {
            valid: false,
            normalized,
            message: 'Introduza um numero de telemovel ou telefone valido.'
        };
    }

    const digits = normalized.replace(/^\+/, '');

    if (digits.startsWith('351')) {
        const localNumber = digits.slice(3);
        return {
            valid: /^[29]\d{8}$/.test(localNumber),
            normalized: `+${digits}`,
            message: /^[29]\d{8}$/.test(localNumber)
                ? ''
                : 'O numero de contacto portugues parece invalido.'
        };
    }

    if (digits.startsWith('34')) {
        const localNumber = digits.slice(2);
        return {
            valid: /^[6789]\d{8}$/.test(localNumber),
            normalized: `+${digits}`,
            message: /^[6789]\d{8}$/.test(localNumber)
                ? ''
                : 'O numero de contacto espanhol parece invalido.'
        };
    }

    if (country === 'ES' || /^[678]\d{8}$/.test(digits)) {
        return {
            valid: /^[6789]\d{8}$/.test(digits),
            normalized: `+34${digits}`,
            country: 'ES',
            message: /^[6789]\d{8}$/.test(digits)
                ? ''
                : 'Introduza um numero espanhol com 9 digitos valido.'
        };
    }

    return {
        valid: /^[29]\d{8}$/.test(digits),
        normalized: `+351${digits}`,
        message: /^[29]\d{8}$/.test(digits)
            ? ''
            : 'Introduza um numero portugues com 9 digitos valido.'
    };
}

function updatePhoneValidity({ normalizeInput = false } = {}) {
    if (!phoneInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const validation = validateCheckoutPhone(
        phoneInput.value,
        postalCodeInput?.value || '',
        nifInput?.value || ''
    );
    if (normalizeInput) {
        phoneInput.value = validation.normalized;
    }
    phoneInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function updatePostalCodeFormatting() {
    if (!postalCodeInput) {
        return '';
    }

    const normalizedCountry = detectTaxCountry(nifInput?.value || '', postalCodeInput.value);
    const normalized = normalizePostalCode(postalCodeInput.value, normalizedCountry);
    postalCodeInput.value = normalized;
    return normalized;
}

function updateTaxIdValidity() {
    if (!nifInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const postalCode = postalCodeInput?.value || '';
    const validation = validateTaxId(nifInput.value, postalCode);
    nifInput.value = validation.normalized;
    const nifRequired = isBusinessCustomerSelected();
    if (nifRequired && !validation.normalized) {
        nifInput.setCustomValidity('Para faturacao empresarial o NIF e obrigatorio.');
        return {
            valid: false,
            normalized: validation.normalized,
            message: 'Para faturacao empresarial o NIF e obrigatorio.'
        };
    }

    nifInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function updateCompanyValidity() {
    if (!companyInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const normalized = String(companyInput.value || '').trim();
    const required = isBusinessCustomerSelected();
    const message = required && !normalized
        ? 'Indique o nome fiscal da empresa.'
        : '';

    companyInput.setCustomValidity(message);
    return {
        valid: !message,
        normalized,
        message
    };
}

function setCompanyLookupStatus(message = '', type = 'info') {
    if (!companyLookupStatus) {
        return;
    }

    if (!message) {
        companyLookupStatus.classList.add('hidden');
        companyLookupStatus.textContent = '';
        companyLookupStatus.className = 'hidden';
        return;
    }

    const palette = {
        info: 'checkout-inline-status text-slate-600 bg-slate-50 border-slate-200',
        success: 'checkout-inline-status text-emerald-700 bg-emerald-50 border-emerald-200',
        warning: 'checkout-inline-status text-amber-700 bg-amber-50 border-amber-200',
        error: 'checkout-inline-status text-red-700 bg-red-50 border-red-200'
    };

    companyLookupStatus.className = palette[type] || palette.info;
    companyLookupStatus.textContent = message;
}

function setCompanyLookupLoading(isLoading) {
    companyLookupInFlight = isLoading;
    if (!companyLookupBtn) {
        return;
    }

    companyLookupBtn.disabled = isLoading;
    companyLookupBtn.textContent = isLoading ? 'A procurar...' : 'Preencher empresa';
}

function applyCompanyLookupResult(customer = {}) {
    if (!customer || typeof customer !== 'object') {
        return;
    }

    if (companyInput && !String(companyInput.value || '').trim() && String(customer.empresa || '').trim()) {
        companyInput.value = String(customer.empresa || '').trim();
    }

    if (checkoutForm?.elements?.cidade && !String(checkoutForm.elements.cidade.value || '').trim() && String(customer.cidade || '').trim()) {
        checkoutForm.elements.cidade.value = String(customer.cidade || '').trim();
    }

    updateCompanyValidity();
}

async function lookupCompanyByTaxId({ force = false } = {}) {
    if (!isBusinessCustomerSelected() || !nifInput) {
        return null;
    }

    const taxValidation = updateTaxIdValidity();
    if (!taxValidation.valid || !taxValidation.normalized) {
        return null;
    }

    const cacheKey = taxValidation.normalized;
    if (!force && companyLookupCache.has(cacheKey)) {
        const cached = companyLookupCache.get(cacheKey);
        if (cached?.found && cached.customer) {
            applyCompanyLookupResult(cached.customer);
            setCompanyLookupStatus(`Dados encontrados em ${cached.sourceLabel || 'registos anteriores'}.`, 'success');
        }
        return cached;
    }

    if (companyLookupInFlight) {
        return null;
    }

    setCompanyLookupLoading(true);
    setCompanyLookupStatus('A procurar dados fiscais para este NIF...', 'info');

    try {
        const response = await fetch('/api/checkout/company-lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taxId: taxValidation.normalized,
                postalCode: postalCodeInput?.value || '',
                customerType: getSelectedCustomerType()
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = String(payload?.message || 'Nao foi possivel procurar a empresa pelo NIF.');
            setCompanyLookupStatus(message, 'warning');
            return null;
        }

        companyLookupCache.set(cacheKey, payload || {});

        if (payload?.found && payload?.customer) {
            applyCompanyLookupResult(payload.customer);
            setCompanyLookupStatus(
                `Nome fiscal encontrado em ${payload.sourceLabel || 'registos existentes'} e aplicado aos campos em falta.`,
                'success'
            );
            return payload;
        }

        setCompanyLookupStatus('Nao encontrámos dados automaticos para este NIF. Podes continuar e preencher manualmente.', 'info');
        return payload;
    } catch (error) {
        console.warn('Falha ao procurar empresa por NIF:', error);
        setCompanyLookupStatus('Nao foi possivel procurar dados automaticos agora. Podes continuar manualmente.', 'warning');
        return null;
    } finally {
        setCompanyLookupLoading(false);
    }
}

function syncCustomerTypeUI() {
    const business = isBusinessCustomerSelected();

    if (customerTypeDescription) {
        customerTypeDescription.textContent = business
            ? 'Mostramos os campos fiscais da empresa e tentamos preencher o nome fiscal pelo NIF.'
            : 'Mantemos apenas os dados pessoais essenciais. O NIF continua opcional.';
    }

    if (contactNameLabel) {
        contactNameLabel.textContent = business ? 'Pessoa de contacto *' : 'Nome completo *';
    }

    if (companyLabel) {
        companyLabel.textContent = 'Empresa *';
    }

    if (nifLabel) {
        nifLabel.textContent = business ? 'NIF / VAT / CIF *' : 'NIF / NIE (opcional)';
    }

    if (nifHelp) {
        nifHelp.textContent = business
            ? 'Para faturacao empresarial precisamos do NIF valido e, se existir, tentamos preencher os dados automaticamente.'
            : 'Se preencher, o numero fiscal tem de ser valido para emitirmos a fatura.';
    }

    if (companyLookupBtn) {
        setElementHidden(companyLookupBtn, !business);
    }

    if (companyFieldRow) {
        setElementHidden(companyFieldRow, !business);
    }

    if (companyInput) {
        companyInput.required = business;
        if (!business) {
            companyInput.value = '';
            companyInput.setCustomValidity('');
        }
    }

    if (nifInput) {
        nifInput.required = business;
    }

    updateCompanyValidity();
    updateTaxIdValidity();
    clearCheckoutFeedback();

    if (!business) {
        setCompanyLookupStatus('');
    }
}

function syncOrderNotesVisibility({ forceOpen = null } = {}) {
    const shouldOpen = forceOpen === null
        ? Boolean(String(notesTextarea?.value || '').trim())
        : Boolean(forceOpen);

    setElementHidden(orderNotesField, !shouldOpen);

    if (toggleOrderNotesBtn) {
        toggleOrderNotesBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        toggleOrderNotesBtn.textContent = shouldOpen
            ? 'Remover nota interna'
            : 'Adicionar nota interna';
    }

    if (!shouldOpen && notesTextarea) {
        notesTextarea.value = '';
    }
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

    if (error?.code === 'EMAIL_INVALIDO') {
        return error?.message || 'Introduza um email valido para iniciar o checkout.';
    }

    if (error?.code === 'CUSTOMER_IDENTITY_CONFLICT') {
        return error?.message || 'Ja existe um cliente com este NIF associado a outro contacto. Confirme o email e o nome fiscal antes de continuar.';
    }

    if (error?.code === 'TELEFONE_INVALIDO') {
        return error?.message || 'Introduza um numero de contacto valido.';
    }

    if (error?.code === 'MORADA_INVALIDA') {
        return 'Preencha morada, codigo postal e cidade.';
    }

    if (error?.code === 'CODIGO_POSTAL_INVALIDO') {
        return error?.message || 'Introduza um codigo postal valido.';
    }

    if (error?.code === 'TOTAL_INVALIDO') {
        return 'O total da encomenda nao e valido.';
    }

    if (error?.code === 'NIF_INVALIDO') {
        return error?.message || 'NIF invalido. Verifique o numero fiscal antes de continuar.';
    }

    if (error?.code === 'NIF_REQUIRED') {
        return error?.message || 'Para faturacao empresarial o NIF e obrigatorio.';
    }

    if (error?.code === 'EMPRESA_REQUIRED') {
        return error?.message || 'Indique o nome fiscal da empresa.';
    }

    if (error?.code === 'TIPO_CLIENTE_INVALIDO') {
        return error?.message || 'Escolha se a faturacao e para particular ou empresa.';
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
        const customerType = getSelectedCustomerType();
        syncCustomerTypeUI();
        const emailValidation = updateEmailValidity({ normalizeInput: true });
        if (!emailValidation.valid) {
            setCheckoutFeedback(emailValidation.message, 'error');
            checkoutForm.reportValidity();
            return;
        }

        const phoneValidation = updatePhoneValidity({ normalizeInput: true });
        if (!phoneValidation.valid) {
            setCheckoutFeedback(phoneValidation.message, 'error');
            checkoutForm.reportValidity();
            return;
        }

        updatePostalCodeFormatting();

        const taxIdValidation = updateTaxIdValidity();
        if (!taxIdValidation.valid) {
            setCheckoutFeedback(taxIdValidation.message, 'error');
            checkoutForm.reportValidity();
            return;
        }

        const companyValidation = updateCompanyValidity();
        if (!companyValidation.valid) {
            setCheckoutFeedback(companyValidation.message, 'error');
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
            tipo_cliente: customerType,
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
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            updateEmailValidity();
        });
        emailInput.addEventListener('blur', () => {
            const validation = updateEmailValidity({ normalizeInput: true });
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
            }
        });
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            updatePhoneValidity();
        });
        phoneInput.addEventListener('blur', () => {
            const validation = updatePhoneValidity({ normalizeInput: true });
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
            }
        });
    }
    if (nifInput) {
        nifInput.addEventListener('input', () => {
            updateTaxIdValidity();
            setCompanyLookupStatus('');
        });
        nifInput.addEventListener('blur', () => {
            const validation = updateTaxIdValidity();
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
                return;
            }
            if (isBusinessCustomerSelected() && validation.normalized) {
                void lookupCompanyByTaxId();
            }
        });
    }
    if (postalCodeInput) {
        postalCodeInput.addEventListener('input', () => {
            updatePostalCodeFormatting();
            updateTaxIdValidity();
        });
        postalCodeInput.addEventListener('blur', () => {
            updatePostalCodeFormatting();
            updateTaxIdValidity();
            updatePhoneValidity();
        });
    }
    if (companyInput) {
        companyInput.addEventListener('input', () => {
            updateCompanyValidity();
        });
    }
    if (toggleOrderNotesBtn) {
        toggleOrderNotesBtn.addEventListener('click', () => {
            const isOpen = toggleOrderNotesBtn.getAttribute('aria-expanded') === 'true';
            syncOrderNotesVisibility({ forceOpen: !isOpen });
        });
    }
    if (notesTextarea) {
        notesTextarea.addEventListener('input', () => {
            if (String(notesTextarea.value || '').trim()) {
                syncOrderNotesVisibility({ forceOpen: true });
            }
        });
    }
    if (companyLookupBtn) {
        companyLookupBtn.addEventListener('click', async () => {
            await lookupCompanyByTaxId({ force: true });
        });
    }
    if (customerTypeSelect) {
        customerTypeSelect.addEventListener('change', () => {
            syncCustomerTypeUI();
        });
    }

    syncCustomerTypeUI();
    syncOrderNotesVisibility();

    void loadCart();
});
