// ===== CHECKOUT PAGE LOGIC =====

const FREE_SHIPPING_THRESHOLD = 0;
const SHIPPING_COST = 0;
const DESIGN_REVIEW_FEE = 5;

// ===== DOM ELEMENTS =====
const checkoutForm = document.getElementById('checkout-form');
const orderItems = document.getElementById('order-items');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const totalEl = document.getElementById('total');
const placeOrderBtn = document.getElementById('place-order-btn');
const designReviewCheckbox = document.getElementById('design-review-checkbox');
const designReviewRow = document.getElementById('design-review-row');
const designReviewAmountEl = document.getElementById('design-review-amount');
const termsCheckbox = document.getElementById('terms-checkbox');
const checkoutFeedback = document.getElementById('checkout-feedback');
const customerTypeSelect = document.getElementById('customer-type-select');
const nifInput = document.getElementById('nif-input');
const taxCountryToggle = document.getElementById('tax-country-toggle');
const nameInput = checkoutForm?.elements?.nome || null;
const phoneInput = checkoutForm?.elements?.telefone || null;
const phoneCountryToggle = document.getElementById('phone-country-toggle');
const emailInput = checkoutForm?.elements?.email || null;
const postalCodeInput = checkoutForm?.elements?.codigo_postal || null;
const cityInput = checkoutForm?.elements?.cidade || null;
const companyInput = checkoutForm?.elements?.empresa || null;
const contactNameLabel = document.getElementById('contact-name-label');
const nifLabel = document.getElementById('nif-label');
const companyLookupStatus = document.getElementById('company-lookup-status');
const companyFieldRow = document.getElementById('company-field-row');
const toggleOrderNotesBtn = document.getElementById('toggle-order-notes');
const orderNotesField = document.getElementById('order-notes-field');
const notesTextarea = checkoutForm?.elements?.notas || null;
const countrySelect = document.getElementById('country-select');
const addressCountrySelect = document.getElementById('address-country-select');
const addressRegionSelect = document.getElementById('address-region-select');
const addressMunicipalitySelect = document.getElementById('address-municipality-select');
const addressRegionLabel = document.getElementById('address-region-label');
const addressMunicipalityLabel = document.getElementById('address-municipality-label');
const fiscalSummaryName = document.getElementById('fiscal-summary-name');
const fiscalSummaryDocument = document.getElementById('fiscal-summary-document');
const fiscalSummaryTaxId = document.getElementById('fiscal-summary-tax-id');
const fiscalSummaryRegime = document.getElementById('fiscal-summary-regime');
const fiscalSummaryCountry = document.getElementById('fiscal-summary-country');
const fiscalSummaryTreatment = document.getElementById('fiscal-summary-treatment');
const fiscalSummaryWarning = document.getElementById('fiscal-summary-warning');
const checkoutPaymentIntro = document.getElementById('checkout-payment-intro');
const checkoutLockedNote = document.getElementById('checkout-locked-note');
const checkoutEmbedShell = document.getElementById('checkout-embed-shell');
const checkoutEmbedLoader = document.getElementById('checkout-embed-loader');
const checkoutEmbedContainer = document.getElementById('checkout-embed-container');
const checkoutEmbedBackBtn = document.getElementById('checkout-embed-back-btn');
const streetInput = checkoutForm?.elements?.morada || null;
const billingSameAsShippingCheckbox = document.getElementById('billing-same-as-shipping');
const checkoutStepButtons = Array.from(document.querySelectorAll('[data-checkout-step]'));
const checkoutStepPanels = Array.from(document.querySelectorAll('[data-checkout-panel]'));
const checkoutStepLines = Array.from(document.querySelectorAll('[data-checkout-line]'));
const checkoutNextButtons = Array.from(document.querySelectorAll('[data-checkout-next]'));
const checkoutBackButtons = Array.from(document.querySelectorAll('[data-checkout-back]'));
const CHECKOUT_STEP_ORDER = ['details', 'address', 'payment'];
const CHECKOUT_STATE_STORAGE_PREFIX = 'iberflag_checkout_state_v1';
const CHECKOUT_STATE_VERSION = 1;
const CHECKOUT_STATE_TTL_MS = 24 * 60 * 60 * 1000;
const CHECKOUT_FORM_FIELD_NAMES = [
    'tipo_cliente',
    'nome',
    'empresa',
    'email',
    'telefone',
    'nif',
    'country',
    'pais_entrega',
    'codigo_postal',
    'distrito',
    'concelho',
    'cidade',
    'morada',
    'notas'
];

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
const COMPANY_LOOKUP_DEBOUNCE_MS = 500;
const POSTAL_LOOKUP_DEBOUNCE_MS = 650;
const LOCATION_HELPERS = window.IBERFLAG_LOCATION_HELPERS || {};
const COUNTRY_LABELS = {
    PT: 'Portugal',
    ES: 'Espanha'
};
const TAX_PLACEHOLDERS = {
    PT: '123456789',
    ES: 'B12345678'
};
const PHONE_COUNTRIES = {
    PT: {
        code: 'PT',
        label: 'Portugal',
        dialCode: '+351',
        placeholder: '912 345 678',
        pattern: /^[29]\d{8}$/,
        invalidMessage: 'Introduza um número português com 9 dígitos válido.',
        flagSvg: `<svg viewBox="0 0 54 36" role="img" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect width="21.6" height="36" fill="#006A4E"/>
            <rect x="21.6" width="32.4" height="36" fill="#DA291C"/>
            <circle cx="21.6" cy="18" r="6.2" fill="#F6C645"/>
        </svg>`
    },
    ES: {
        code: 'ES',
        label: 'Espanha',
        dialCode: '+34',
        placeholder: '612 345 678',
        pattern: /^[6789]\d{8}$/,
        invalidMessage: 'Introduza um número espanhol com 9 dígitos válido.',
        flagSvg: `<svg viewBox="0 0 54 36" role="img" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect width="54" height="36" fill="#AA151B"/>
            <rect y="9" width="54" height="18" fill="#F1BF00"/>
        </svg>`
    }
};
const ES_TEXT = {
    'Pagar agora': 'Pagar ahora',
    'Pagamento aberto': 'Pago abierto',
    'Reveja o total e conclua o pagamento.': 'Revise el total y complete el pago.',
    'Pagamento carregado abaixo. Complete o processo para confirmar a encomenda.': 'Pago cargado abajo. Complete el proceso para confirmar el pedido.',
    'A preparar o pagamento seguro...': 'Preparando el pago seguro...',
    'O checkout seguro não está disponível neste momento.': 'El checkout seguro no está disponible en este momento.',
    'Não foi possível carregar o checkout seguro. Atualize a página e tente novamente.': 'No fue posible cargar el checkout seguro. Actualice la página e inténtelo de nuevo.',
    'Estamos a abrir o pagamento seguro dentro da IberFlag.': 'Estamos abriendo el pago seguro dentro de IberFlag.',
    'O pagamento vai ser confirmado no passo seguinte.': 'El pago se confirmará en el siguiente paso.',
    'Pagamento em aberto. Para alterar dados ou carrinho, atualize a página antes de criar uma nova sessão.': 'Pago abierto. Para cambiar datos o carrito, actualice la página antes de crear una nueva sesión.',
    'Preencha os dados de contacto e faturação antes de continuar.': 'Complete los datos de contacto y facturación antes de continuar.',
    'Preencha a morada de entrega antes de continuar.': 'Complete la dirección de entrega antes de continuar.',
    'Aceite os termos para continuar.': 'Acepte los términos para continuar.',
    'O pagamento abre aqui na loja com Stripe.': 'El pago se abre aquí en la tienda con Stripe.',
    'Cartão, MB Way e Multibanco aparecem conforme disponibilidade.': 'Tarjeta, MB Way y Multibanco aparecen según disponibilidad.',
    'Complete o pagamento abaixo para confirmar a encomenda.': 'Complete el pago abajo para confirmar el pedido.',
    'Grátis': 'Gratis',
    'Introduza um número de telemóvel ou telefone válido.': 'Introduzca un número de móvil o teléfono válido.',
    'Introduza um número português com 9 dígitos válido.': 'Introduzca un número portugués válido de 9 dígitos.',
    'Introduza um número espanhol com 9 dígitos válido.': 'Introduzca un número español válido de 9 dígitos.',
    'Usar indicativo de': 'Usar prefijo de',
    'Usar NIF de': 'Usar NIF de',
    'Trocar indicativo': 'Cambiar prefijo',
    'Trocar país fiscal': 'Cambiar país fiscal',
    'Portugal': 'Portugal',
    'Espanha': 'España',
    'Empresa *': 'Empresa *',
    'Nome completo *': 'Nombre completo *',
    'Nome fiscal da empresa': 'Nombre fiscal de la empresa',
    'Indique o nome fiscal da empresa.': 'Indique el nombre fiscal de la empresa.'
};
const EU_COUNTRIES = new Set(['PT', 'ES']);
let companyLookupInFlight = false;
let companyLookupDebounceTimer = null;
let beginCheckoutTracked = false;
let latestVatValidation = null;
let postalLookupDebounceTimer = null;
let postalLookupController = null;
let latestPostalLookupKey = '';
const postalLookupMissingKeys = new Set();
let addressCountryTouched = false;
let lastAutoCityValue = '';
let stripePublishableKeyInUse = '';
let stripeBrowserClient = null;
let embeddedCheckoutInstance = null;
let activeCheckoutSession = null;
let currentCheckoutStep = 'details';
let selectedPhoneCountry = 'PT';
let checkoutStateReady = false;
let checkoutStateRestoreInProgress = false;
let checkoutStateSaveTimer = null;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getCurrentLocale() {
    if (typeof SiteRoutes !== 'undefined' && typeof SiteRoutes.getLocaleFromPathname === 'function') {
        return SiteRoutes.getLocaleFromPathname(window.location.pathname);
    }

    return window.location.pathname === '/es' || window.location.pathname.startsWith('/es/') ? 'es' : 'pt';
}

function i18nText(value) {
    if (getCurrentLocale() === 'es' && Object.prototype.hasOwnProperty.call(ES_TEXT, value)) {
        return ES_TEXT[value];
    }

    return window.IberFlagI18n?.translateText
        ? window.IberFlagI18n.translateText(value)
        : value;
}

function getCheckoutStateStorageKey(locale = getCurrentLocale()) {
    return `${CHECKOUT_STATE_STORAGE_PREFIX}:${locale === 'es' ? 'es' : 'pt'}`;
}

function getCheckoutStateStorageKeys() {
    return [getCheckoutStateStorageKey('pt'), getCheckoutStateStorageKey('es')];
}

function removeStoredCheckoutState({ allLocales = false } = {}) {
    try {
        const keys = allLocales ? getCheckoutStateStorageKeys() : [getCheckoutStateStorageKey()];
        keys.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        console.warn('Não foi possível limpar o estado do checkout:', error);
    }
}

function readStoredCheckoutState() {
    try {
        const raw = localStorage.getItem(getCheckoutStateStorageKey());
        if (!raw) {
            return null;
        }

        const state = JSON.parse(raw);
        const updatedAt = Number(state?.updatedAt || 0);
        const expired = !updatedAt || Date.now() - updatedAt > CHECKOUT_STATE_TTL_MS;
        if (state?.version !== CHECKOUT_STATE_VERSION || expired) {
            removeStoredCheckoutState();
            return null;
        }

        return state;
    } catch (error) {
        console.warn('Não foi possível restaurar o estado do checkout:', error);
        removeStoredCheckoutState();
        return null;
    }
}

function getCheckoutCartFingerprint(items = cart) {
    if (!Array.isArray(items) || items.length === 0) {
        return '';
    }

    return JSON.stringify(items.map((item) => ({
        id: item?.id ?? null,
        quantity: Number(item?.quantity || 1),
        customized: Boolean(item?.customized),
        designId: String(item?.designId || item?.design_id || ''),
        baseId: String(item?.baseId || item?.base_id || ''),
        preco: Number(item?.preco || 0)
    })));
}

function collectCheckoutFormState() {
    const values = {};
    if (!checkoutForm) {
        return values;
    }

    CHECKOUT_FORM_FIELD_NAMES.forEach((name) => {
        const field = checkoutForm.elements?.[name];
        if (!field || typeof field.value === 'undefined') {
            return;
        }
        values[name] = field.value;
    });

    return values;
}

function getSanitizedCheckoutSession(session = activeCheckoutSession) {
    const sessionId = String(session?.sessionId || '').trim();
    const orderCode = String(session?.orderCode || '').trim();
    const clientSecret = String(session?.clientSecret || '').trim();
    const publishableKey = String(session?.publishableKey || '').trim();
    if (!sessionId || !clientSecret || !publishableKey) {
        return null;
    }

    return {
        sessionId,
        orderCode,
        clientSecret,
        publishableKey
    };
}

function buildCheckoutStatePayload({ activeSession = activeCheckoutSession } = {}) {
    return {
        version: CHECKOUT_STATE_VERSION,
        updatedAt: Date.now(),
        locale: getCurrentLocale(),
        cartFingerprint: getCheckoutCartFingerprint(),
        step: CHECKOUT_STEP_ORDER.includes(currentCheckoutStep) ? currentCheckoutStep : 'details',
        form: collectCheckoutFormState(),
        phoneCountry: getSelectedPhoneCountry(),
        addressCountryTouched: Boolean(addressCountryTouched),
        lastAutoCityValue: String(lastAutoCityValue || ''),
        notesOpen: toggleOrderNotesBtn?.getAttribute('aria-expanded') === 'true',
        designReviewSelected: Boolean(designReviewCheckbox?.checked),
        termsAccepted: Boolean(termsCheckbox?.checked),
        billingSameAsShipping: billingSameAsShippingCheckbox?.checked !== false,
        paymentActive: Boolean(document.body?.classList.contains('checkout-payment-active')),
        activeSession: getSanitizedCheckoutSession(activeSession)
    };
}

function persistCheckoutState({ force = false, activeSession = activeCheckoutSession } = {}) {
    if ((!checkoutStateReady && !force) || checkoutStateRestoreInProgress || !checkoutForm) {
        return;
    }

    const cartFingerprint = getCheckoutCartFingerprint();
    if (!cartFingerprint) {
        removeStoredCheckoutState();
        return;
    }

    try {
        const payload = buildCheckoutStatePayload({ activeSession });
        localStorage.setItem(getCheckoutStateStorageKey(), JSON.stringify(payload));
    } catch (error) {
        console.warn('Não foi possível guardar o estado do checkout:', error);
    }
}

function schedulePersistCheckoutState() {
    if (!checkoutStateReady || checkoutStateRestoreInProgress) {
        return;
    }

    if (checkoutStateSaveTimer) {
        window.clearTimeout(checkoutStateSaveTimer);
    }

    checkoutStateSaveTimer = window.setTimeout(() => {
        checkoutStateSaveTimer = null;
        persistCheckoutState();
    }, 150);
}

function clearPersistedCheckoutSession() {
    const state = readStoredCheckoutState();
    if (!state) {
        return;
    }

    state.updatedAt = Date.now();
    state.paymentActive = false;
    state.activeSession = null;
    state.step = CHECKOUT_STEP_ORDER.includes(currentCheckoutStep) ? currentCheckoutStep : 'payment';

    try {
        localStorage.setItem(getCheckoutStateStorageKey(), JSON.stringify(state));
    } catch (error) {
        console.warn('Não foi possível limpar a sessão guardada do checkout:', error);
    }
}

function getLocalizedStaticPath(pathname, fallback) {
    if (typeof SiteRoutes !== 'undefined' && typeof SiteRoutes.getLocalizedPath === 'function') {
        return SiteRoutes.getLocalizedPath(pathname);
    }

    return fallback;
}

function getPlaceOrderDefaultLabel() {
    return `<i data-lucide="lock" class="w-5 h-5"></i> ${i18nText('Pagar agora')}`;
}

function getPlaceOrderLoadedLabel() {
    return `<i data-lucide="shield-check" class="w-5 h-5"></i> ${i18nText('Pagamento aberto')}`;
}

function getCheckoutEmbedBackLabel() {
    return `<i data-lucide="arrow-left" class="w-4 h-4"></i> ${i18nText('Voltar')}`;
}

function buildCheckoutSuccessPath(params = {}) {
    if (typeof SiteRoutes !== 'undefined' && typeof SiteRoutes.buildCheckoutSuccessPath === 'function') {
        return SiteRoutes.buildCheckoutSuccessPath(params);
    }

    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && String(value).trim() !== '') {
            search.set(key, String(value));
        }
    });

    const query = search.toString();
    return `/checkout/sucesso${query ? `?${query}` : ''}`;
}

function setElementHidden(element, hidden) {
    if (!element) {
        return;
    }

    const shouldHide = Boolean(hidden);
    element.hidden = shouldHide;
    element.classList.toggle('hidden', shouldHide);
    element.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
}

function getCheckoutStepIndex(step) {
    const index = CHECKOUT_STEP_ORDER.indexOf(step);
    return index >= 0 ? index : 0;
}

function setCheckoutStep(step = 'details', { scroll = false } = {}) {
    const normalizedStep = CHECKOUT_STEP_ORDER.includes(step) ? step : 'details';
    if (document.body?.classList.contains('checkout-payment-active') && normalizedStep !== 'payment') {
        return;
    }

    currentCheckoutStep = normalizedStep;
    const activeIndex = getCheckoutStepIndex(normalizedStep);

    checkoutStepPanels.forEach((panel) => {
        const isActive = panel.dataset.checkoutPanel === normalizedStep;
        panel.hidden = !isActive;
        panel.classList.toggle('checkout-step-panel-active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    checkoutStepButtons.forEach((button) => {
        const stepIndex = getCheckoutStepIndex(button.dataset.checkoutStep);
        const isActive = button.dataset.checkoutStep === normalizedStep;
        button.classList.toggle('checkout-step-active', isActive);
        button.classList.toggle('checkout-step-complete', stepIndex < activeIndex);
        button.setAttribute('aria-current', isActive ? 'step' : 'false');
    });

    checkoutStepLines.forEach((line, index) => {
        line.classList.toggle('checkout-step-line-active', index < activeIndex);
    });

    document.body?.setAttribute('data-checkout-step', normalizedStep);
    schedulePersistCheckoutState();

    if (scroll) {
        const activePanel = checkoutStepPanels.find((panel) => panel.dataset.checkoutPanel === normalizedStep);
        if (activePanel && typeof activePanel.getBoundingClientRect === 'function') {
            const rect = activePanel.getBoundingClientRect();
            const nextTop = Math.max(0, window.scrollY + rect.top - getCheckoutScrollOffset());
            window.scrollTo({ top: nextTop, behavior: 'smooth' });
        }
    }
}

function getCheckoutStepForField(field) {
    return field?.closest?.('[data-checkout-panel]')?.dataset?.checkoutPanel || '';
}

function getFirstInvalidField(fields = []) {
    return fields.find((field) => (
        field
        && !field.disabled
        && typeof field.checkValidity === 'function'
        && !field.checkValidity()
    )) || null;
}

function validateCheckoutStep(step = currentCheckoutStep) {
    clearCheckoutFeedback();

    if (step === 'details') {
        syncCustomerTypeUI();
        updateEmailValidity({ normalizeInput: true });
        updatePhoneValidity({ normalizeInput: true });
        updateTaxIdValidity();
        updateCompanyValidity();

        const invalidField = getFirstInvalidField([
            checkoutForm?.elements?.nome,
            emailInput,
            phoneInput,
            customerTypeSelect,
            countrySelect,
            nifInput,
            companyInput
        ]);

        if (invalidField) {
            setCheckoutFeedback(i18nText('Preencha os dados de contacto e faturação antes de continuar.'), 'error');
            revealCheckoutField(invalidField);
            return false;
        }

        return true;
    }

    if (step === 'address') {
        updatePostalCodeFormatting();
        syncFiscalCountryFromAddress();

        const invalidField = getFirstInvalidField([
            addressCountrySelect,
            postalCodeInput,
            addressRegionSelect,
            addressMunicipalitySelect,
            cityInput,
            streetInput
        ]);

        if (invalidField) {
            setCheckoutFeedback(i18nText('Preencha a morada de entrega antes de continuar.'), 'error');
            revealCheckoutField(invalidField);
            return false;
        }

        return true;
    }

    if (step === 'payment' && termsCheckbox && !termsCheckbox.checked) {
        setCheckoutFeedback(i18nText('Aceite os termos para continuar.'), 'error');
        revealCheckoutField(termsCheckbox);
        return false;
    }

    return true;
}

function canMoveToCheckoutStep(nextStep) {
    const nextIndex = getCheckoutStepIndex(nextStep);
    const currentIndex = getCheckoutStepIndex(currentCheckoutStep);

    if (nextIndex <= currentIndex) {
        return true;
    }

    for (let index = currentIndex; index < nextIndex; index += 1) {
        if (!validateCheckoutStep(CHECKOUT_STEP_ORDER[index])) {
            return false;
        }
    }

    return true;
}

function localizeEmbeddedCheckoutStaticContent() {
    if (getCurrentLocale() !== 'es') {
        return;
    }

    const paymentSection = checkoutPaymentIntro?.closest('[data-checkout-panel="payment"]');
    const paymentSubtitle = paymentSection?.querySelector('.app-section-subtitle');
    if (paymentSubtitle) {
        paymentSubtitle.textContent = i18nText('Reveja o total e conclua o pagamento.');
    }

    const paymentCopy = checkoutPaymentIntro?.querySelector('.checkout-payment-copy span');
    if (paymentCopy) {
        paymentCopy.textContent = i18nText('Cartão, MB Way e Multibanco aparecem conforme disponibilidade.');
    }
    if (checkoutLockedNote) {
        checkoutLockedNote.textContent = i18nText('Pagamento em aberto. Para alterar dados ou carrinho, atualize a página antes de criar uma nova sessão.');
    }

    const embedTitle = checkoutEmbedShell?.querySelector('h3');
    const embedSubtitle = checkoutEmbedShell?.querySelector('p.text-slate-600');
    const embedLoaderText = checkoutEmbedLoader?.querySelector('span');
    if (embedTitle) {
        embedTitle.textContent = 'Pago seguro';
    }
    if (embedSubtitle) {
        embedSubtitle.textContent = i18nText('Complete o pagamento abaixo para confirmar a encomenda.');
    }
    if (embedLoaderText) {
        embedLoaderText.textContent = i18nText('A preparar o pagamento seguro...');
    }

    const checkoutSteps = document.querySelectorAll('.checkout-step-text');
    if (checkoutSteps[0]) {
        checkoutSteps[0].textContent = 'Datos';
    }
    if (checkoutSteps[1]) {
        checkoutSteps[1].textContent = 'Dirección';
    }
    if (checkoutSteps[2]) {
        checkoutSteps[2].textContent = 'Pago';
    }

    if (placeOrderBtn && !document.body.classList.contains('checkout-payment-active')) {
        placeOrderBtn.innerHTML = getPlaceOrderDefaultLabel();
    }
    if (checkoutEmbedBackBtn) {
        checkoutEmbedBackBtn.innerHTML = getCheckoutEmbedBackLabel();
    }
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
            message: i18nText('Introduza um email válido.')
        };
    }

    const domain = normalized.split('@').pop();
    const suggestedDomain = COMMON_EMAIL_DOMAIN_FIXES[domain];
    if (suggestedDomain) {
        return {
            valid: false,
            normalized,
            suggestion: normalized.replace(/@[^@]+$/, `@${suggestedDomain}`),
            message: `${i18nText('O domínio do email parece inválido:')} @${domain}. ${i18nText('Queria dizer')} @${suggestedDomain}?`
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

function getSelectedFiscalCountry() {
    const normalized = String(countrySelect?.value || 'PT').trim().toUpperCase();
    return ['PT', 'ES'].includes(normalized) ? normalized : 'PT';
}

function normalizeFiscalCountry(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return ['PT', 'ES'].includes(normalized) ? normalized : 'PT';
}

function getDefaultFiscalCountry() {
    return getCurrentLocale() === 'es' ? 'ES' : 'PT';
}

function getSelectedAddressCountry() {
    const normalized = String(addressCountrySelect?.value || getSelectedFiscalCountry() || 'PT').trim().toUpperCase();
    return ['PT', 'ES'].includes(normalized) ? normalized : 'PT';
}

function getLocationConfig(countryCode = getSelectedAddressCountry()) {
    return LOCATION_HELPERS[String(countryCode || '').trim().toUpperCase()] || LOCATION_HELPERS.PT || null;
}

function getFiscalCountryLabel(countryCode = '') {
    return COUNTRY_LABELS[String(countryCode || '').trim().toUpperCase()] || String(countryCode || '—').trim() || '—';
}

function isEuCountry(countryCode = '') {
    return EU_COUNTRIES.has(String(countryCode || '').trim().toUpperCase());
}

function isBusinessCustomerSelected() {
    return getSelectedCustomerType() === 'empresa';
}

function detectTaxCountry(value, postalCode = '') {
    const explicitCountry = getSelectedFiscalCountry();
    if (['PT', 'ES'].includes(explicitCountry)) {
        return explicitCountry;
    }

    const normalized = normalizeTaxId(value);
    const normalizedPostalCode = String(postalCode || '').trim().toUpperCase();

    if (/^[XYZ]\d{7}[A-Z]$/.test(normalized) || /^[A-Z]\d{7}[A-Z0-9]$/.test(normalized)) {
        return 'ES';
    }

    if (/^\d{5}(-\d{4})?$/.test(normalizedPostalCode)) {
        return 'ES';
    }

    if (/^\d{4}-\d{3}$/.test(normalizedPostalCode)) {
        return 'PT';
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
    return {
        valid: true,
        normalized,
        message: ''
    };
}

function normalizePhoneCountry(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return PHONE_COUNTRIES[normalized] ? normalized : 'PT';
}

function getDefaultPhoneCountry() {
    const localeCountry = getCurrentLocale() === 'es' ? 'ES' : '';
    return normalizePhoneCountry(localeCountry || getSelectedFiscalCountry() || 'PT');
}

function getSelectedPhoneCountry() {
    return normalizePhoneCountry(selectedPhoneCountry || phoneCountryToggle?.dataset?.country || getDefaultPhoneCountry());
}

function getPhoneCountryFromInternationalDigits(digits = '') {
    if (String(digits).startsWith('351')) {
        return 'PT';
    }
    if (String(digits).startsWith('34')) {
        return 'ES';
    }
    return '';
}

function formatLocalPhoneNumber(value = '') {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length <= 3) {
        return digits;
    }
    if (digits.length <= 6) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    }
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function renderPhoneCountryToggle() {
    if (!phoneCountryToggle) {
        return;
    }

    const country = getSelectedPhoneCountry();
    const config = PHONE_COUNTRIES[country];
    phoneCountryToggle.dataset.country = country;
    phoneCountryToggle.setAttribute('aria-label', `${i18nText('Usar indicativo de')} ${i18nText(config.label)}, ${config.dialCode}`);
    phoneCountryToggle.setAttribute('title', i18nText('Trocar indicativo'));
    phoneCountryToggle.innerHTML = `
        <span class="checkout-phone-flag" aria-hidden="true">${config.flagSvg}</span>
        <span class="checkout-phone-dial">${config.dialCode}</span>
    `;
}

function renderTaxCountryToggle() {
    if (!taxCountryToggle) {
        return;
    }

    const country = getSelectedFiscalCountry();
    const config = PHONE_COUNTRIES[country];
    taxCountryToggle.dataset.country = country;
    taxCountryToggle.setAttribute('aria-label', `${i18nText('Usar NIF de')} ${i18nText(config.label)}`);
    taxCountryToggle.setAttribute('title', i18nText('Trocar país fiscal'));
    taxCountryToggle.innerHTML = `
        <span class="checkout-phone-flag" aria-hidden="true">${config.flagSvg}</span>
        <span class="checkout-phone-dial">${country}</span>
    `;
}

function syncTaxCountryUI() {
    const country = getSelectedFiscalCountry();
    const wrapper = taxCountryToggle?.closest?.('.checkout-tax-field');
    if (wrapper) {
        wrapper.dataset.taxCountry = country;
    }
    if (nifInput) {
        nifInput.placeholder = TAX_PLACEHOLDERS[country] || TAX_PLACEHOLDERS.PT;
    }
    renderTaxCountryToggle();
}

function setPhoneCountry(country, { normalizeInput = false, skipValidation = false } = {}) {
    selectedPhoneCountry = normalizePhoneCountry(country);
    const config = PHONE_COUNTRIES[selectedPhoneCountry];
    const wrapper = phoneCountryToggle?.closest?.('.checkout-phone-field');
    if (wrapper) {
        wrapper.dataset.phoneCountry = selectedPhoneCountry;
    }
    if (phoneInput) {
        phoneInput.placeholder = config.placeholder;
    }
    renderPhoneCountryToggle();
    if (!skipValidation) {
        updatePhoneValidity({ normalizeInput });
    }
    schedulePersistCheckoutState();
}

function setFiscalCountry(country, {
    syncAddress = true,
    preserveAddressRegion = true,
    updatePhoneCountry = false,
    validateTax = true,
    scheduleLookups = true
} = {}) {
    const normalizedCountry = normalizeFiscalCountry(country);
    if (countrySelect) {
        countrySelect.value = normalizedCountry;
    }

    syncTaxCountryUI();

    if (syncAddress) {
        syncAddressCountryFromFiscal({ force: true });
        populateAddressRegions({ preserveValue: preserveAddressRegion });
    }

    updatePostalCodeFormatting();

    if (updatePhoneCountry && phoneInput && !String(phoneInput.value || '').trim()) {
        setPhoneCountry(normalizedCountry, { skipValidation: true });
    }

    updatePhoneValidity({ allowEmpty: true });
    applyVatValidationResult(null);
    setCompanyLookupStatus('');

    if (validateTax) {
        updateTaxIdValidity();
    }

    updateFiscalSummary();

    if (scheduleLookups) {
        scheduleCompanyLookup();
        schedulePostalLookup();
    }
    schedulePersistCheckoutState();
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

    if (String(country || '').toUpperCase() !== 'PT') {
        return normalized.slice(0, 16);
    }

    const digits = normalized.replace(/[^\d]/g, '').slice(0, 7);
    if (digits.length === 7) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    return normalized;
}

function normalizeLocationKey(value) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function setSelectOptions(select, options, placeholder = '') {
    if (!select) {
        return;
    }

    select.innerHTML = '';
    if (placeholder) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        select.appendChild(option);
    }

    options.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
    });
}

function getAddressRegions() {
    const config = getLocationConfig();
    return Array.isArray(config?.regions) ? config.regions : [];
}

function getAddressLocationCopy() {
    const locale = getCurrentLocale();
    const country = getSelectedAddressCountry();
    const config = getLocationConfig();
    const isSpanishCountry = country === 'ES';

    if (locale === 'es') {
        return isSpanishCountry
            ? {
                regionLabel: 'Provincia',
                municipalityLabel: 'Municipio',
                chooseRegion: 'Elija la provincia',
                chooseMunicipality: 'Elija el municipio',
                chooseFirstRegion: 'Elija primero la provincia'
            }
            : {
                regionLabel: config?.regionLabel || 'Distrito / isla',
                municipalityLabel: config?.municipalityLabel || 'Municipio',
                chooseRegion: 'Elija el distrito / isla',
                chooseMunicipality: 'Elija el municipio',
                chooseFirstRegion: 'Elija primero el distrito / isla'
            };
    }

    if (isSpanishCountry) {
        return {
            regionLabel: 'Província',
            municipalityLabel: 'Município',
            chooseRegion: 'Escolha a província',
            chooseMunicipality: 'Escolha o município',
            chooseFirstRegion: 'Escolha primeiro a província'
        };
    }

    return {
        regionLabel: config?.regionLabel || 'Distrito / ilha',
        municipalityLabel: config?.municipalityLabel || 'Concelho',
        chooseRegion: 'Escolha o distrito / ilha',
        chooseMunicipality: 'Escolha o concelho',
        chooseFirstRegion: 'Escolha primeiro o distrito / ilha'
    };
}

function findAddressRegion(regionName = '') {
    const wanted = normalizeLocationKey(regionName);
    if (!wanted) {
        return null;
    }

    return getAddressRegions().find((region) => (
        normalizeLocationKey(region.name) === wanted
        || normalizeLocationKey(region.code) === wanted
    )) || null;
}

function findAddressMunicipality(region, municipalityName = '') {
    const wanted = normalizeLocationKey(municipalityName);
    if (!region || !wanted) {
        return '';
    }

    return (region.municipalities || []).find((municipality) => normalizeLocationKey(municipality) === wanted) || '';
}

function syncFiscalCountryFromAddress() {
    const addressCountry = getSelectedAddressCountry();
    if (!countrySelect || countrySelect.value === addressCountry) {
        return;
    }

    countrySelect.value = addressCountry;
    syncTaxCountryUI();
    applyVatValidationResult(null);
    updateTaxIdValidity();
    updatePhoneValidity({ allowEmpty: true });
    updateFiscalSummary();
    scheduleCompanyLookup();
}

function syncAddressCountryFromFiscal({ force = false } = {}) {
    if (!addressCountrySelect) {
        return;
    }

    const fiscalCountry = getSelectedFiscalCountry();
    if (!['PT', 'ES'].includes(fiscalCountry)) {
        return;
    }

    if (!force && addressCountryTouched && addressCountrySelect.value !== fiscalCountry) {
        return;
    }

    addressCountrySelect.value = fiscalCountry;
}

function updateAddressLabels() {
    const config = getLocationConfig();
    const copy = getAddressLocationCopy();
    if (addressRegionLabel) {
        addressRegionLabel.textContent = `${copy.regionLabel} *`;
    }
    if (addressMunicipalityLabel) {
        addressMunicipalityLabel.textContent = `${copy.municipalityLabel} *`;
    }
    if (postalCodeInput && config?.postalPlaceholder) {
        postalCodeInput.placeholder = config.postalPlaceholder;
    }
}

function populateAddressMunicipalities({ preserveValue = true } = {}) {
    if (!addressMunicipalitySelect) {
        return;
    }

    const previousValue = preserveValue ? addressMunicipalitySelect.value : '';
    const region = findAddressRegion(addressRegionSelect?.value || '');
    const copy = getAddressLocationCopy();
    if (!region) {
        setSelectOptions(addressMunicipalitySelect, [], copy.chooseFirstRegion);
        addressMunicipalitySelect.value = '';
        addressMunicipalitySelect.disabled = true;
        return;
    }

    addressMunicipalitySelect.disabled = false;
    setSelectOptions(
        addressMunicipalitySelect,
        (region.municipalities || []).map((municipality) => ({ value: municipality, label: municipality })),
        copy.chooseMunicipality
    );

    const matchingValue = findAddressMunicipality(region, previousValue);
    if (matchingValue) {
        addressMunicipalitySelect.value = matchingValue;
    }
}

function populateAddressRegions({ preserveValue = true } = {}) {
    if (!addressRegionSelect) {
        return;
    }

    updateAddressLabels();

    const previousValue = preserveValue ? addressRegionSelect.value : '';
    const regions = getAddressRegions();
    const copy = getAddressLocationCopy();
    setSelectOptions(
        addressRegionSelect,
        regions.map((region) => ({ value: region.name, label: region.name })),
        copy.chooseRegion
    );

    const matchingRegion = findAddressRegion(previousValue);
    addressRegionSelect.value = matchingRegion?.name || '';
    populateAddressMunicipalities({ preserveValue });
}

function setAddressSelection({ country, region, municipality, city, forceCity = false } = {}) {
    if (country && addressCountrySelect && ['PT', 'ES'].includes(String(country).toUpperCase())) {
        addressCountrySelect.value = String(country).toUpperCase();
        populateAddressRegions({ preserveValue: false });
    }

    if (region && addressRegionSelect) {
        const matchingRegion = findAddressRegion(region);
        if (matchingRegion) {
            addressRegionSelect.value = matchingRegion.name;
            populateAddressMunicipalities({ preserveValue: false });
        }
    }

    if (municipality && addressMunicipalitySelect) {
        const selectedRegion = findAddressRegion(addressRegionSelect?.value || '');
        const matchingMunicipality = findAddressMunicipality(selectedRegion, municipality);
        if (matchingMunicipality) {
            addressMunicipalitySelect.value = matchingMunicipality;
        }
    }

    const resolvedCity = String(city || '').trim();
    if (cityInput && resolvedCity && (forceCity || !cityInput.value.trim() || cityInput.value === lastAutoCityValue)) {
        cityInput.value = resolvedCity;
        lastAutoCityValue = resolvedCity;
    }
    schedulePersistCheckoutState();
}

function clearAutoCityIfStillOwned() {
    if (!cityInput || !lastAutoCityValue) {
        return;
    }

    if (cityInput.value === lastAutoCityValue) {
        cityInput.value = '';
    }
    lastAutoCityValue = '';
}

function inferAddressCountryFromPostalCode(value = '') {
    const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (/^\d{4}-?\d{3}$/.test(raw)) {
        return 'PT';
    }
    if (/^\d{5}$/.test(raw)) {
        return 'ES';
    }
    return '';
}

function isPostalCodeReadyForLookup(value = '', country = getSelectedAddressCountry()) {
    const normalized = normalizePostalCode(value, country);
    return country === 'PT'
        ? /^\d{4}-\d{3}$/.test(normalized)
        : country === 'ES'
            ? /^\d{5}$/.test(normalized)
            : false;
}

function clearPostalLookupDebounce() {
    if (postalLookupDebounceTimer) {
        window.clearTimeout(postalLookupDebounceTimer);
        postalLookupDebounceTimer = null;
    }
}

async function lookupPostalCode({ force = false } = {}) {
    if (!postalCodeInput || typeof fetch !== 'function') {
        return;
    }

    const inferredCountry = inferAddressCountryFromPostalCode(postalCodeInput.value);
    if (inferredCountry && addressCountrySelect?.value !== inferredCountry) {
        addressCountrySelect.value = inferredCountry;
        populateAddressRegions({ preserveValue: false });
        syncFiscalCountryFromAddress();
    }

    const country = getSelectedAddressCountry();
    const normalized = normalizePostalCode(postalCodeInput.value, country);
    if (!isPostalCodeReadyForLookup(normalized, country)) {
        return;
    }

    const lookupKey = `${country}:${normalized}`;
    if (postalLookupMissingKeys.has(lookupKey) || (!force && lookupKey === latestPostalLookupKey)) {
        return;
    }
    latestPostalLookupKey = lookupKey;

    try {
        if (postalLookupController) {
            postalLookupController.abort();
        }
        postalLookupController = new AbortController();

        const lookupParams = new URLSearchParams({
            mode: 'postal',
            country,
            postalCode: normalized,
            v: '20260430postal2'
        });
        const response = await fetch(`/api/checkout/company-lookup?${lookupParams.toString()}`, {
            signal: postalLookupController.signal
        });
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        if (data?.found === false) {
            postalLookupMissingKeys.add(lookupKey);
            return;
        }
        postalLookupMissingKeys.delete(lookupKey);

        if (!data?.region && !data?.city) {
            return;
        }

        setAddressSelection({
            country: data.country || country,
            region: data.region,
            municipality: data.municipality,
            city: data.city,
            forceCity: false
        });
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.warn('Não foi possível preencher a morada pelo código postal:', error);
        }
    }
}

function schedulePostalLookup() {
    clearPostalLookupDebounce();
    if (!postalCodeInput) {
        return;
    }

    const inferredCountry = inferAddressCountryFromPostalCode(postalCodeInput.value);
    const lookupCountry = inferredCountry || getSelectedAddressCountry();
    if (!isPostalCodeReadyForLookup(postalCodeInput.value, lookupCountry)) {
        return;
    }

    postalLookupDebounceTimer = window.setTimeout(() => {
        postalLookupDebounceTimer = null;
        void lookupPostalCode();
    }, POSTAL_LOOKUP_DEBOUNCE_MS);
}

function validateCheckoutPhone(value, postalCode = '', taxId = '', phoneCountry = getSelectedPhoneCountry()) {
    const normalized = normalizeCheckoutPhone(value);
    const selectedCountry = normalizePhoneCountry(phoneCountry || detectTaxCountry(taxId, postalCode));
    if (!normalized) {
        return {
            valid: false,
            normalized,
            country: selectedCountry,
            displayValue: '',
            message: i18nText('Introduza um número de telemóvel ou telefone válido.')
        };
    }

    const digits = normalized.replace(/^\+/, '');
    const explicitCountry = normalized.startsWith('+') ? getPhoneCountryFromInternationalDigits(digits) : '';
    const country = explicitCountry || selectedCountry;
    const config = PHONE_COUNTRIES[country];
    const localNumber = explicitCountry
        ? digits.slice(config.dialCode.replace('+', '').length)
        : digits;

    if (!config) {
        const validInternational = /^\d{6,15}$/.test(digits);
        return {
            valid: validInternational,
            normalized: normalized.startsWith('+') ? normalized : `+${digits}`,
            country,
            displayValue: normalized,
            message: validInternational
                ? ''
                : i18nText('Introduza um número de telemóvel ou telefone válido.')
        };
    }

    const localDigits = String(localNumber || '').replace(/\D/g, '');
    const valid = config.pattern.test(localDigits);
    return {
        valid,
        normalized: `${config.dialCode}${localDigits}`,
        country,
        explicitCountry,
        displayValue: formatLocalPhoneNumber(localDigits),
        message: valid ? '' : i18nText(config.invalidMessage)
    };
}

function updatePhoneValidity({ normalizeInput = false, allowEmpty = false } = {}) {
    if (!phoneInput) {
        return { valid: true, normalized: '', message: '' };
    }

    if (allowEmpty && !String(phoneInput.value || '').trim()) {
        if (normalizeInput) {
            phoneInput.value = '';
        }
        phoneInput.setCustomValidity('');
        return {
            valid: true,
            normalized: '',
            country: getSelectedPhoneCountry(),
            displayValue: '',
            message: ''
        };
    }

    const validation = validateCheckoutPhone(
        phoneInput.value,
        postalCodeInput?.value || '',
        nifInput?.value || '',
        getSelectedPhoneCountry()
    );
    if (validation.explicitCountry && validation.explicitCountry !== getSelectedPhoneCountry()) {
        setPhoneCountry(validation.explicitCountry, { skipValidation: true });
    }
    if (normalizeInput) {
        phoneInput.value = validation.displayValue || '';
    }
    phoneInput.setCustomValidity(validation.valid ? '' : validation.message);
    return validation;
}

function updatePostalCodeFormatting() {
    if (!postalCodeInput) {
        return '';
    }

    const normalizedCountry = getSelectedAddressCountry();
    const normalized = normalizePostalCode(postalCodeInput.value, normalizedCountry);
    postalCodeInput.value = normalized;
    return normalized;
}

function updateTaxIdValidity() {
    if (!nifInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const validation = validateTaxId(nifInput.value, postalCodeInput?.value || '');
    nifInput.value = validation.normalized;
    nifInput.setCustomValidity('');
    return validation;
}

function updateCompanyValidity() {
    const targetInput = companyInput || nameInput;
    if (!targetInput) {
        return { valid: true, normalized: '', message: '' };
    }

    const normalized = String(targetInput.value || '').trim();
    const required = isBusinessCustomerSelected();
    const message = required && !normalized
        ? i18nText('Indique o nome fiscal da empresa.')
        : '';

    targetInput.setCustomValidity(message);
    if (companyInput && companyInput !== targetInput) {
        companyInput.setCustomValidity('');
    }
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
    if (!nifInput) {
        return;
    }

    nifInput.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

function clearCompanyLookupDebounce() {
    if (companyLookupDebounceTimer) {
        window.clearTimeout(companyLookupDebounceTimer);
        companyLookupDebounceTimer = null;
    }
}

function isTaxIdLookupReady(normalized, postalCode = '') {
    if (!normalized) {
        return false;
    }

    const country = detectTaxCountry(normalized, postalCode);
    if (country === 'PT') {
        return /^\d{9}$/.test(normalized);
    }

    if (country !== 'ES') {
        return /^[A-Z0-9]{2,14}$/.test(normalized);
    }

    return /^[A-Z]\d{7}[A-Z0-9]$/.test(normalized) || /^\d{8}[A-Z]$/.test(normalized);
}

function scheduleCompanyLookup() {
    clearCompanyLookupDebounce();
    setCompanyLookupStatus('');
}

function applyCompanyLookupResult(customer = {}) {
    if (!customer || typeof customer !== 'object') {
        return;
    }

    const companyName = String(customer.empresa || '').trim();
    if (companyInput && !String(companyInput.value || '').trim() && companyName) {
        companyInput.value = companyName;
    }
    if (isBusinessCustomerSelected() && nameInput && !String(nameInput.value || '').trim() && companyName) {
        nameInput.value = companyName;
    }

    if (cityInput && !String(cityInput.value || '').trim() && String(customer.cidade || '').trim()) {
        cityInput.value = String(customer.cidade || '').trim();
    }

    updateCompanyValidity();
}

function applyVatValidationResult(vatValidation = null) {
    latestVatValidation = vatValidation && typeof vatValidation === 'object'
        ? { ...vatValidation }
        : null;
    updateFiscalSummary();
}

function getCurrentVatValidationStatus() {
    return String(latestVatValidation?.status || 'not_required').trim().toLowerCase() || 'not_required';
}

function buildFiscalSummaryState() {
    const customerType = getSelectedCustomerType();
    const countryCode = getSelectedFiscalCountry();
    const taxId = normalizeTaxId(nifInput?.value || '');
    const companyName = String(companyInput?.value || '').trim();
    const personName = String(checkoutForm?.elements?.nome?.value || '').trim();
    const fiscalName = customerType === 'empresa'
        ? (companyName || personName || 'Por definir')
        : (personName || 'Por definir');
    const vatValidationStatus = getCurrentVatValidationStatus();

    let treatment = 'Sem liquidação de IVA (M10)';
    let warning = '';

    if (countryCode !== 'PT' && countryCode !== 'ES') {
        treatment = 'Revisão manual antes de emitir';
        warning = 'Este país fica fora da emissão automática. O pagamento pode avançar, mas a faturação segue para revisão manual.';
    } else if (customerType === 'empresa' && countryCode === 'ES' && vatValidationStatus === 'valid') {
        treatment = 'Empresa UE validada em VIES';
    } else if (customerType === 'empresa' && countryCode === 'ES' && vatValidationStatus === 'invalid') {
        treatment = 'Faturação normal sem benefício intracomunitário';
        warning = latestVatValidation?.message || 'O VAT não foi validado no VIES. A compra pode continuar, mas sem tratamento intracomunitário.';
    } else if (customerType === 'empresa' && countryCode === 'ES' && vatValidationStatus === 'unavailable') {
        treatment = 'Faturação normal sem benefício intracomunitário';
        warning = latestVatValidation?.message || 'O VIES está indisponível. A compra pode continuar, mas sem tratamento intracomunitário automático.';
    }

    return {
        fiscalName,
        countryCode,
        taxId: taxId || '—',
        treatment,
        warning
    };
}

function updateFiscalSummary() {
    const summary = buildFiscalSummaryState();

    if (fiscalSummaryName) {
        fiscalSummaryName.textContent = summary.fiscalName;
    }
    if (fiscalSummaryDocument) {
        fiscalSummaryDocument.textContent = i18nText('Fatura-recibo');
    }
    if (fiscalSummaryTaxId) {
        fiscalSummaryTaxId.textContent = summary.taxId;
    }
    if (fiscalSummaryRegime) {
        fiscalSummaryRegime.textContent = 'Artigo 53.º do CIVA';
    }
    if (fiscalSummaryCountry) {
        fiscalSummaryCountry.textContent = getFiscalCountryLabel(summary.countryCode);
    }
    if (fiscalSummaryTreatment) {
        fiscalSummaryTreatment.textContent = summary.treatment;
    }
    if (fiscalSummaryWarning) {
        const hasWarning = Boolean(String(summary.warning || '').trim());
        fiscalSummaryWarning.textContent = summary.warning || '';
        fiscalSummaryWarning.classList.toggle('hidden', !hasWarning);
    }
}

async function lookupCompanyByTaxId({ force = false } = {}) {
    void force;
    setCompanyLookupStatus('');
    setCompanyLookupLoading(false);
    applyVatValidationResult(null);
    return null;
}

function syncCustomerTypeUI() {
    const business = isBusinessCustomerSelected();

    if (contactNameLabel) {
        contactNameLabel.textContent = business ? i18nText('Empresa *') : i18nText('Nome completo *');
    }
    if (nameInput) {
        nameInput.autocomplete = business ? 'organization' : 'name';
        nameInput.placeholder = business ? i18nText('Nome fiscal da empresa') : '';
        nameInput.setCustomValidity('');
    }

    if (nifLabel) {
        nifLabel.textContent = business ? i18nText('NIF / VAT / CIF (opcional)') : i18nText('NIF / NIE (opcional)');
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
        nifInput.required = false;
    }

    updateCompanyValidity();
    updateTaxIdValidity();
    updateFiscalSummary();
    clearCheckoutFeedback();

    if (!business) {
        clearCompanyLookupDebounce();
        setCompanyLookupStatus('');
        applyVatValidationResult(null);
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
            ? i18nText('Remover nota da encomenda')
            : i18nText('Adicionar nota à encomenda');
    }

    if (!shouldOpen && notesTextarea) {
        notesTextarea.value = '';
    }
    schedulePersistCheckoutState();
}

function setCheckoutFormFieldValue(name, value) {
    const field = checkoutForm?.elements?.[name];
    if (!field || typeof field.value === 'undefined') {
        return;
    }
    field.value = value ?? '';
}

function restoreCheckoutFormState(state) {
    const formState = state?.form || {};
    checkoutStateRestoreInProgress = true;

    try {
        if (customerTypeSelect && formState.tipo_cliente) {
            customerTypeSelect.value = normalizeCustomerType(formState.tipo_cliente);
        }

        const fiscalCountry = normalizeFiscalCountry(formState.country || getDefaultFiscalCountry());
        setFiscalCountry(fiscalCountry, {
            syncAddress: false,
            updatePhoneCountry: false,
            validateTax: false,
            scheduleLookups: false
        });

        const addressCountry = normalizeFiscalCountry(formState.pais_entrega || fiscalCountry);
        if (addressCountrySelect) {
            addressCountrySelect.value = addressCountry;
            populateAddressRegions({ preserveValue: false });
        }

        [
            'nome',
            'empresa',
            'email',
            'telefone',
            'nif',
            'codigo_postal',
            'cidade',
            'morada',
            'notas'
        ].forEach((name) => {
            setCheckoutFormFieldValue(name, formState[name] || '');
        });

        if (formState.distrito && addressRegionSelect) {
            const matchingRegion = findAddressRegion(formState.distrito);
            if (matchingRegion) {
                addressRegionSelect.value = matchingRegion.name;
                populateAddressMunicipalities({ preserveValue: false });
            }
        }

        if (formState.concelho && addressMunicipalitySelect) {
            const selectedRegion = findAddressRegion(addressRegionSelect?.value || '');
            const matchingMunicipality = findAddressMunicipality(selectedRegion, formState.concelho);
            if (matchingMunicipality) {
                addressMunicipalitySelect.value = matchingMunicipality;
            }
        }

        if (designReviewCheckbox) {
            designReviewCheckbox.checked = Boolean(state?.designReviewSelected);
        }
        if (termsCheckbox) {
            termsCheckbox.checked = Boolean(state?.termsAccepted);
        }
        if (billingSameAsShippingCheckbox) {
            billingSameAsShippingCheckbox.checked = state?.billingSameAsShipping !== false;
        }

        addressCountryTouched = Boolean(state?.addressCountryTouched);
        lastAutoCityValue = String(state?.lastAutoCityValue || '');
        setPhoneCountry(state?.phoneCountry || getDefaultPhoneCountry(), { skipValidation: true });
        syncCustomerTypeUI();
        updatePostalCodeFormatting();
        updateEmailValidity();
        updatePhoneValidity({ allowEmpty: true });
        updateTaxIdValidity();
        updateFiscalSummary();
        syncOrderNotesVisibility({
            forceOpen: Boolean(state?.notesOpen || String(formState.notas || '').trim())
        });
        renderCheckoutSummary(cart);

        const savedStep = CHECKOUT_STEP_ORDER.includes(state?.step) ? state.step : 'details';
        if (!state?.paymentActive || !getSanitizedCheckoutSession(state?.activeSession)) {
            setCheckoutStep(savedStep, { scroll: false });
        }
    } finally {
        checkoutStateRestoreInProgress = false;
    }
}

function restoreCheckoutStateAfterCartLoad() {
    const state = readStoredCheckoutState();
    if (!state) {
        return null;
    }

    const currentCartFingerprint = getCheckoutCartFingerprint();
    if (!currentCartFingerprint || state.cartFingerprint !== currentCartFingerprint) {
        removeStoredCheckoutState();
        return null;
    }

    restoreCheckoutFormState(state);
    return state;
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

    checkoutFeedback.hidden = false;
    checkoutFeedback.className = `checkout-feedback rounded-xl border px-4 py-3 text-sm font-medium ${palette[type] || palette.error}`;
    checkoutFeedback.textContent = message;
    checkoutFeedback.classList.remove('hidden');
}

function clearCheckoutFeedback() {
    if (!checkoutFeedback) return;
    checkoutFeedback.hidden = true;
    checkoutFeedback.classList.add('hidden');
    checkoutFeedback.textContent = '';
}

function getCheckoutScrollOffset() {
    const stickyNav = document.querySelector('.checkout-page nav.sticky, nav.sticky');
    const navHeight = stickyNav?.getBoundingClientRect?.().height || 0;
    return Math.max(88, navHeight + 28);
}

function getFirstInvalidCheckoutField() {
    if (!checkoutForm) {
        return null;
    }

    return checkoutForm.querySelector(':invalid');
}

function revealCheckoutField(field = null) {
    const target = field || getFirstInvalidCheckoutField();
    if (!target || typeof target.getBoundingClientRect !== 'function') {
        checkoutForm?.reportValidity?.();
        return;
    }

    const fieldStep = getCheckoutStepForField(target);
    if (fieldStep && fieldStep !== currentCheckoutStep) {
        setCheckoutStep(fieldStep);
    }

    const rect = target.getBoundingClientRect();
    const nextTop = Math.max(0, window.scrollY + rect.top - getCheckoutScrollOffset());
    window.scrollTo({ top: nextTop, behavior: 'smooth' });

    try {
        target.focus({ preventScroll: true });
    } catch {
        target.focus?.();
    }

    window.setTimeout(() => {
        if (typeof target.reportValidity === 'function') {
            target.reportValidity();
            return;
        }
        checkoutForm?.reportValidity?.();
    }, 260);
}

function setPlaceOrderLoading(isLoading) {
    if (!placeOrderBtn) return;
    placeOrderBtn.disabled = isLoading;
    placeOrderBtn.innerHTML = isLoading
        ? '<div class="spinner mx-auto"></div>'
        : getPlaceOrderDefaultLabel();

    if (!isLoading && typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function setPlaceOrderLoadedState() {
    if (!placeOrderBtn) {
        return;
    }

    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = getPlaceOrderLoadedLabel();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function setCheckoutInputsLocked(locked) {
    document.body?.classList.toggle('checkout-payment-active', locked);

    checkoutStepButtons.forEach((button) => {
        button.disabled = locked && button.dataset.checkoutStep !== 'payment';
    });

    if (checkoutForm) {
        checkoutForm.querySelectorAll('input, select, textarea, button').forEach((field) => {
            field.disabled = locked;
        });
    }

    if (designReviewCheckbox) {
        designReviewCheckbox.disabled = locked;
    }

    if (termsCheckbox) {
        termsCheckbox.disabled = locked;
    }

    if (toggleOrderNotesBtn) {
        toggleOrderNotesBtn.disabled = locked;
    }

    if (placeOrderBtn && !locked) {
        placeOrderBtn.disabled = false;
    }

    // Keep the embedded checkout back action available while the form stays locked.
    if (checkoutEmbedBackBtn && locked) {
        checkoutEmbedBackBtn.disabled = false;
    }

    if (checkoutPaymentIntro) {
        checkoutPaymentIntro.classList.toggle('opacity-60', locked);
    }

    setElementHidden(checkoutLockedNote, !locked);
}

function setCheckoutEmbedLoading(isLoading) {
    setElementHidden(checkoutEmbedLoader, !isLoading);
    if (checkoutEmbedContainer) {
        checkoutEmbedContainer.classList.toggle('checkout-embed-container-ready', !isLoading);
    }
}

async function destroyEmbeddedCheckout({ clearPersistedSession = true } = {}) {
    if (embeddedCheckoutInstance) {
        try {
            if (typeof embeddedCheckoutInstance.destroy === 'function') {
                embeddedCheckoutInstance.destroy();
            } else if (typeof embeddedCheckoutInstance.unmount === 'function') {
                embeddedCheckoutInstance.unmount();
            }
        } catch (error) {
            console.warn('Falha ao desmontar o checkout embebido:', error);
        }
    }

    embeddedCheckoutInstance = null;
    activeCheckoutSession = null;
    setCheckoutEmbedLoading(true);
    setElementHidden(checkoutEmbedShell, true);

    if (checkoutEmbedContainer) {
        checkoutEmbedContainer.innerHTML = '';
        checkoutEmbedContainer.classList.remove('checkout-embed-container-ready');
    }

    setCheckoutInputsLocked(false);

    if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = getPlaceOrderDefaultLabel();
    }

    if (checkoutEmbedBackBtn) {
        checkoutEmbedBackBtn.disabled = false;
        checkoutEmbedBackBtn.innerHTML = getCheckoutEmbedBackLabel();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    if (clearPersistedSession) {
        clearPersistedCheckoutSession();
    }
}

async function handleEmbeddedCheckoutBack() {
    if (checkoutEmbedBackBtn) {
        checkoutEmbedBackBtn.disabled = true;
    }

    clearCheckoutFeedback();
    await destroyEmbeddedCheckout();
    setCheckoutStep('address', { scroll: true });
}

function scrollToEmbeddedCheckout() {
    if (!checkoutEmbedShell || typeof checkoutEmbedShell.getBoundingClientRect !== 'function') {
        return;
    }

    const rect = checkoutEmbedShell.getBoundingClientRect();
    const nextTop = Math.max(0, window.scrollY + rect.top - getCheckoutScrollOffset());
    window.scrollTo({ top: nextTop, behavior: 'smooth' });
}

function getStripeBrowserClient(publishableKey) {
    const normalizedKey = String(publishableKey || '').trim();
    if (!normalizedKey || typeof window.Stripe !== 'function') {
        return null;
    }

    if (!stripeBrowserClient || stripePublishableKeyInUse !== normalizedKey) {
        stripeBrowserClient = window.Stripe(normalizedKey);
        stripePublishableKeyInUse = normalizedKey;
    }

    return stripeBrowserClient;
}

async function handleEmbeddedCheckoutComplete(sessionPayload = activeCheckoutSession) {
    const sessionId = String(sessionPayload?.sessionId || '').trim();
    const orderCode = String(sessionPayload?.orderCode || '').trim();
    const nextPath = buildCheckoutSuccessPath({
        session_id: sessionId,
        codigo: orderCode
    });

    window.location.href = nextPath;
}

async function mountEmbeddedCheckout(sessionPayload) {
    if (!checkoutEmbedContainer || !checkoutEmbedShell) {
        throw new Error(i18nText('O checkout seguro não está disponível neste momento.'));
    }

    const clientSecret = String(sessionPayload?.clientSecret || '').trim();
    const publishableKey = String(sessionPayload?.publishableKey || '').trim();
    if (!clientSecret || !publishableKey) {
        throw new Error(i18nText('Não foi possível carregar o checkout seguro. Atualize a página e tente novamente.'));
    }

    const stripe = getStripeBrowserClient(publishableKey);
    if (!stripe || typeof stripe.initEmbeddedCheckout !== 'function') {
        throw new Error(i18nText('O checkout seguro não está disponível neste momento.'));
    }

    await destroyEmbeddedCheckout({ clearPersistedSession: false });

    activeCheckoutSession = {
        sessionId: String(sessionPayload.sessionId || '').trim(),
        orderCode: String(sessionPayload.orderCode || '').trim(),
        clientSecret,
        publishableKey
    };

    setCheckoutStep('payment');
    setCheckoutInputsLocked(true);
    setElementHidden(checkoutEmbedShell, false);
    setCheckoutEmbedLoading(true);
    persistCheckoutState({ force: true });
    scrollToEmbeddedCheckout();

    try {
        embeddedCheckoutInstance = await stripe.initEmbeddedCheckout({
            fetchClientSecret: async () => clientSecret,
            onComplete: () => {
                void handleEmbeddedCheckoutComplete(activeCheckoutSession);
            }
        });

        embeddedCheckoutInstance.mount('#checkout-embed-container');
        setCheckoutEmbedLoading(false);
        setPlaceOrderLoadedState();
        persistCheckoutState({ force: true });
        scrollToEmbeddedCheckout();
    } catch (error) {
        await destroyEmbeddedCheckout();
        throw error;
    }
}

function getCheckoutErrorMessage(error) {
    const rawMessage = String(error?.message || error?.details || error?.hint || '').toLowerCase();

    if (error?.code === 'MISSING_PRODUCT_MAPPING') {
        return i18nText('Existem produtos no carrinho que já não existem na base de dados. Atualize o carrinho e tente novamente.');
    }

    if (error?.code === 'PRODUCT_INACTIVE') {
        return i18nText('Um produto do carrinho deixou de estar disponível. Atualize o carrinho e tente novamente.');
    }

    if (error?.code === 'BASE_INVALIDA') {
        return i18nText('Uma base selecionada já não está disponível para esse produto. Reabra o personalizador e escolha outra base.');
    }

    if (error?.code === '23503') {
        return 'Um produto do carrinho deixou de existir. Reabra o produto e adicione novamente ao carrinho.';
    }

    if (error?.code === 'CARRINHO_VAZIO') {
        return i18nText('O carrinho está vazio.');
    }

    if (error?.code === 'DADOS_CLIENTE_INVALIDOS') {
        return 'Preencha nome, email e telefone.';
    }

    if (error?.code === 'EMAIL_INVALIDO') {
        return error?.message || i18nText('Introduza um email válido para iniciar o checkout.');
    }

    if (error?.code === 'CUSTOMER_IDENTITY_CONFLICT') {
        return error?.message || i18nText('Já existe um cliente com este NIF associado a outro contacto. Confirme o email e o nome fiscal antes de continuar.');
    }

    if (error?.code === 'TELEFONE_INVALIDO') {
        return error?.message || i18nText('Introduza um número de contacto válido.');
    }

    if (error?.code === 'MORADA_INVALIDA') {
        return i18nText('Preencha morada, código postal e cidade.');
    }

    if (error?.code === 'CODIGO_POSTAL_INVALIDO') {
        return error?.message || i18nText('Introduza um código postal válido.');
    }

    if (error?.code === 'COUNTRY_REQUIRED') {
        return error?.message || i18nText('Escolha o país fiscal antes de continuar.');
    }

    if (error?.code === 'TOTAL_INVALIDO') {
        return i18nText('O total da encomenda não é válido.');
    }

    if (error?.code === 'NIF_INVALIDO') {
        return error?.message || i18nText('NIF inválido. Verifique o número fiscal antes de continuar.');
    }

    if (error?.code === 'NIF_REQUIRED') {
        return error?.message || i18nText('Para faturação empresarial o NIF é obrigatório.');
    }

    if (error?.code === 'EMPRESA_REQUIRED') {
        return error?.message || 'Indique o nome fiscal da empresa.';
    }

    if (error?.code === 'TIPO_CLIENTE_INVALIDO') {
        return error?.message || i18nText('Escolha se a faturação é para particular ou empresa.');
    }

    if (error?.code === 'CHECKOUT_SESSION_FAILED') {
        return error?.message || i18nText('Não foi possível iniciar a sessão de pagamento.');
    }

    if (rawMessage.includes('stripe')) {
        return i18nText('Não foi possível iniciar o checkout com o Stripe.');
    }

    if (rawMessage.includes('facturalusa')) {
        return i18nText('Não foi possível comunicar com o Facturalusa.');
    }

    if (rawMessage.includes('checkout seguro')) {
        return error?.message || i18nText('Não foi possível carregar o checkout seguro. Atualize a página e tente novamente.');
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

function getCatalogPath() {
    return typeof SiteRoutes !== 'undefined'
        ? getLocalizedStaticPath(SiteRoutes.STATIC_PATHS.products, '/produtos')
        : '/produtos';
}

function isDesignReviewSelected() {
    return Boolean(designReviewCheckbox?.checked);
}

function calculateCheckoutSummary(items = []) {
    const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
        return sum + (Number(item.preco || 0) * Number(item.quantity || 0));
    }, 0);
    const designReview = isDesignReviewSelected() ? DESIGN_REVIEW_FEE : 0;
    const shipping = SHIPPING_COST;
    const total = subtotal + designReview + shipping;

    return {
        subtotal,
        designReview,
        shipping,
        total
    };
}

function renderCheckoutSummary(items = []) {
    const summary = calculateCheckoutSummary(items);

    if (subtotalEl) {
        subtotalEl.textContent = `${summary.subtotal.toFixed(2)}€`;
    }

    if (designReviewAmountEl) {
        designReviewAmountEl.textContent = `${summary.designReview.toFixed(2)}€`;
    }

    setElementHidden(designReviewRow, summary.designReview <= 0);

    if (shippingEl) {
        shippingEl.textContent = summary.shipping > 0
            ? `${summary.shipping.toFixed(2)}€`
            : i18nText('Grátis');
    }

    if (totalEl) {
        totalEl.textContent = `${summary.total.toFixed(2)}€`;
    }

    return summary;
}

// ===== LOAD CART =====
async function loadCart() {
    if (window.cartHydrationPromise) {
        await window.cartHydrationPromise;
    }

    if (!cart || cart.length === 0) {
        window.location.href = getCatalogPath();
        return;
    }

    // Render cart items
    orderItems.innerHTML = cart.map(item => `
        <div class="checkout-summary-item">
            <img src="${escapeHtml(typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem)}" alt="${escapeHtml(item.nome)}" class="checkout-summary-item-media">
            <div class="checkout-summary-item-body">
                <div class="checkout-summary-item-main">
                    <h4>${escapeHtml(item.nome)}</h4>
                    <div class="checkout-summary-item-meta">
                        ${item.customized ? '<span class="checkout-summary-item-status"><i data-lucide="check" class="w-3 h-3"></i>Personalizado</span>' : ''}
                        ${item.baseNome ? `<span>Base: ${escapeHtml(item.baseNome)}${Number(item.basePrecoExtra || 0) > 0 ? ` (+${Number(item.basePrecoExtra).toFixed(2)}€)` : ''}</span>` : ''}
                        <span>Qtd: ${Number(item.quantity || 0)}</span>
                    </div>
                </div>
                <p class="checkout-summary-item-total">${(Number(item.preco || 0) * Number(item.quantity || 0)).toFixed(2)}€</p>
            </div>
        </div>
    `).join('');

    const summary = renderCheckoutSummary(cart);

    if (!beginCheckoutTracked && typeof window.trackAnalyticsEvent === 'function') {
        beginCheckoutTracked = true;
        void window.trackAnalyticsEvent('begin_checkout', {
            productId: cart[0]?.id || null,
            countryCode: getSelectedFiscalCountry(),
            metadata: {
                itemCount: cart.length,
                total: summary.total,
                designReviewSelected: isDesignReviewSelected()
            }
        });
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===== VALIDATE CUSTOMIZATION =====
function validateCustomization() {
    const hasUncustomized = cart.some(item => !item.customized);
    
    if (hasUncustomized) {
        showToast(i18nText('Todos os produtos devem ser personalizados antes da compra'), 'error');
        setTimeout(() => {
            window.location.href = getCatalogPath();
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
            revealCheckoutField(emailInput);
            return;
        }

        const phoneValidation = updatePhoneValidity({ normalizeInput: true });
        if (!phoneValidation.valid) {
            setCheckoutFeedback(phoneValidation.message, 'error');
            revealCheckoutField(phoneInput);
            return;
        }

        updatePostalCodeFormatting();
        updateFiscalSummary();

        updateTaxIdValidity();

        const companyValidation = updateCompanyValidity();
        if (!companyValidation.valid) {
            setCheckoutFeedback(companyValidation.message, 'error');
            revealCheckoutField(companyInput || nameInput);
            return;
        }

        if (!getSelectedFiscalCountry()) {
            setCheckoutFeedback(i18nText('Escolha o país fiscal antes de continuar.'), 'error');
            revealCheckoutField(countrySelect);
            return;
        }

        syncFiscalCountryFromAddress();

        // Validate form
        if (!checkoutForm.checkValidity()) {
            revealCheckoutField();
            return;
        }

        // Check terms
        if (!termsCheckbox.checked) {
            showToast(i18nText('Por favor, aceite os termos e condições'), 'error');
            return;
        }

        // Validate customization
        if (!validateCustomization()) {
            return;
        }

        // Get form data
        const formData = new FormData(checkoutForm);
        const customerName = String(formData.get('nome') || '').trim();
        const companyName = String(formData.get('empresa') || '').trim();
        const customerData = {
            nome: customerName,
            email: formData.get('email'),
            telefone: phoneValidation.normalized,
            tipo_cliente: customerType,
            country: getSelectedFiscalCountry(),
            nif: formData.get('nif') || null,
            empresa: customerType === 'empresa' ? (companyName || customerName) : null,
            morada: formData.get('morada'),
            codigo_postal: formData.get('codigo_postal'),
            cidade: formData.get('cidade'),
            pais_entrega: getSelectedAddressCountry(),
            distrito: formData.get('distrito') || null,
            concelho: formData.get('concelho') || null,
            billing_same_as_shipping: billingSameAsShippingCheckbox?.checked !== false
        };

        const orderNotes = formData.get('notas') || null;

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
                    designReviewSelected: isDesignReviewSelected(),
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

            showToast(i18nText('Pagamento iniciado com sucesso!'), 'success');

            await mountEmbeddedCheckout(payload);

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
    localizeEmbeddedCheckoutStaticContent();
    setCheckoutStep('details');

    checkoutNextButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextStep = button.dataset.checkoutNext;
            if (nextStep && canMoveToCheckoutStep(nextStep)) {
                setCheckoutStep(nextStep, { scroll: true });
            }
        });
    });

    checkoutBackButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const previousStep = button.dataset.checkoutBack;
            if (previousStep) {
                setCheckoutStep(previousStep, { scroll: true });
            }
        });
    });

    checkoutStepButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextStep = button.dataset.checkoutStep;
            if (nextStep && canMoveToCheckoutStep(nextStep)) {
                setCheckoutStep(nextStep, { scroll: true });
            }
        });
    });

    checkoutEmbedBackBtn?.addEventListener('click', () => {
        void handleEmbeddedCheckoutBack();
    });

    checkoutForm?.addEventListener('input', schedulePersistCheckoutState);
    checkoutForm?.addEventListener('change', schedulePersistCheckoutState);
    window.addEventListener('pagehide', () => {
        persistCheckoutState({ force: true });
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            persistCheckoutState({ force: true });
        }
    });

    if (emailInput) {
        emailInput.addEventListener('input', () => {
            updateEmailValidity();
            updateFiscalSummary();
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
            updatePhoneValidity({ allowEmpty: true });
        });
        phoneInput.addEventListener('blur', (event) => {
            if (event.relatedTarget === phoneCountryToggle || !String(phoneInput.value || '').trim()) {
                updatePhoneValidity({ normalizeInput: true, allowEmpty: true });
                clearCheckoutFeedback();
                return;
            }
            const validation = updatePhoneValidity({ normalizeInput: true });
            if (!validation.valid) {
                setCheckoutFeedback(validation.message, 'error');
            }
        });
    }
    if (phoneCountryToggle) {
        phoneCountryToggle.addEventListener('click', () => {
            const nextCountry = getSelectedPhoneCountry() === 'PT' ? 'ES' : 'PT';
            const hasPhoneValue = Boolean(String(phoneInput?.value || '').trim());
            setPhoneCountry(nextCountry, { normalizeInput: hasPhoneValue, skipValidation: !hasPhoneValue });
            if (!hasPhoneValue) {
                phoneInput?.setCustomValidity('');
            }
            clearCheckoutFeedback();
            phoneInput?.focus();
        });
    }
    if (nifInput) {
        nifInput.addEventListener('input', () => {
            updateTaxIdValidity();
            setCompanyLookupStatus('');
            applyVatValidationResult(null);
            updateFiscalSummary();
        });
        nifInput.addEventListener('blur', () => {
            clearCompanyLookupDebounce();
            updateTaxIdValidity();
        });
    }
    if (postalCodeInput) {
        postalCodeInput.addEventListener('input', () => {
            updateTaxIdValidity();
            updateFiscalSummary();
            schedulePostalLookup();
        });
        postalCodeInput.addEventListener('blur', () => {
            updatePostalCodeFormatting();
            updateTaxIdValidity();
            updatePhoneValidity({ allowEmpty: true });
            updateFiscalSummary();
            void lookupPostalCode({ force: true });
        });
    }
    addressCountrySelect?.addEventListener('change', () => {
        addressCountryTouched = true;
        populateAddressRegions({ preserveValue: false });
        updatePostalCodeFormatting();
        syncFiscalCountryFromAddress();
        schedulePostalLookup();
        schedulePersistCheckoutState();
    });
    addressRegionSelect?.addEventListener('change', () => {
        populateAddressMunicipalities({ preserveValue: false });
        clearAutoCityIfStillOwned();
    });
    cityInput?.addEventListener('input', () => {
        if (cityInput.value !== lastAutoCityValue) {
            lastAutoCityValue = '';
        }
    });
    if (companyInput) {
        companyInput.addEventListener('input', () => {
            updateCompanyValidity();
            updateFiscalSummary();
        });
    }
    checkoutForm?.elements?.nome?.addEventListener('input', () => {
        updateCompanyValidity();
        updateFiscalSummary();
    });
    countrySelect?.addEventListener('change', () => {
        setFiscalCountry(countrySelect.value);
    });
    if (taxCountryToggle) {
        taxCountryToggle.addEventListener('click', () => {
            const nextCountry = getSelectedFiscalCountry() === 'PT' ? 'ES' : 'PT';
            setFiscalCountry(nextCountry);
            clearCheckoutFeedback();
            nifInput?.focus();
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
    if (customerTypeSelect) {
        customerTypeSelect.addEventListener('change', () => {
            syncCustomerTypeUI();
        });
    }
    if (designReviewCheckbox) {
        designReviewCheckbox.addEventListener('change', () => {
            clearCheckoutFeedback();
            renderCheckoutSummary(cart);
            schedulePersistCheckoutState();
        });
    }

    setFiscalCountry(getDefaultFiscalCountry(), {
        syncAddress: false,
        validateTax: false,
        scheduleLookups: false
    });
    syncAddressCountryFromFiscal({ force: true });
    populateAddressRegions({ preserveValue: true });
    setPhoneCountry(getDefaultPhoneCountry(), { skipValidation: true });
    syncCustomerTypeUI();
    syncOrderNotesVisibility();
    updateFiscalSummary();

    void (async () => {
        await loadCart();
        const restoredState = restoreCheckoutStateAfterCartLoad();
        const restoredSession = restoredState?.paymentActive
            ? getSanitizedCheckoutSession(restoredState.activeSession)
            : null;
        checkoutStateReady = true;

        if (restoredSession) {
            try {
                await mountEmbeddedCheckout(restoredSession);
            } catch (error) {
                console.warn('Não foi possível restaurar o pagamento em aberto:', error);
                const message = getCheckoutErrorMessage(error);
                setCheckoutFeedback(message, 'error');
                setCheckoutStep('payment');
                persistCheckoutState({ force: true, activeSession: null });
            }
        } else {
            persistCheckoutState({ force: true });
        }
    })();
});
