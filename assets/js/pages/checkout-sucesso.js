const successMessageEl = document.getElementById('checkout-success-message');
const successStateEl = document.getElementById('checkout-success-state');
const ES_TEXT = {
    'Falha ao consultar pagamento.': 'No fue posible consultar el pago.',
    'Pagamento confirmado': 'Pago confirmado',
    'A abrir o tracking da encomenda...': 'Abriendo el seguimiento del pedido...',
    'Pagamento não confirmado': 'Pago no confirmado',
    'A sua sessão terminou sem pagamento. Pode tentar novamente no checkout.': 'Su sesión terminó sin pago. Puede intentarlo de nuevo en el checkout.',
    'Pagamento em processamento': 'Pago en procesamiento',
    'A confirmar a encomenda e a preparar a emissão fiscal...': 'Confirmando el pedido y preparando la emisión fiscal...',
    'A aguardar confirmação': 'Esperando confirmación',
    'Continuamos a validar o pagamento. Esta página vai tentar novamente.': 'Seguimos validando el pago. Esta página volverá a intentarlo.',
    'Ainda em processamento': 'Todavía en procesamiento',
    'Se o pagamento foi feito, a encomenda vai aparecer no tracking em breve.': 'Si el pago se ha realizado, el pedido aparecerá pronto en el seguimiento.',
    'Sessão inválida': 'Sesión inválida',
    'Não foi possível identificar a encomenda.': 'No fue posible identificar el pedido.'
};

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

function normalizeOrderCode(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function updateState(title, message) {
    if (successStateEl) {
        successStateEl.textContent = title;
    }
    if (successMessageEl && message) {
        successMessageEl.textContent = message;
    }
}

async function fetchCheckoutStatus(sessionId, orderCode) {
    const url = new URL('/api/checkout/session-status', window.location.origin);
    if (sessionId) {
        url.searchParams.set('session_id', sessionId);
    }
    if (orderCode) {
        url.searchParams.set('codigo', orderCode);
    }

    const response = await fetch(url.toString(), {
        headers: {
            Accept: 'application/json'
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || payload?.error || i18nText('Falha ao consultar pagamento.'));
    }

    return payload;
}

async function pollUntilReady(sessionId, orderCode) {
    const startedAt = Date.now();
    const timeoutMs = 2 * 60 * 1000;

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const payload = await fetchCheckoutStatus(sessionId, orderCode);
            const resolvedOrderCode = normalizeOrderCode(payload?.order?.numero_encomenda || payload?.orderCode || orderCode);
            const paymentStatus = String(payload?.session?.payment_status || payload?.order?.payment_status || '').toLowerCase();

            if (paymentStatus === 'paid') {
                updateState(i18nText('Pagamento confirmado'), i18nText('A abrir o tracking da encomenda...'));
                const nextPath = typeof SiteRoutes !== 'undefined'
                    ? SiteRoutes.buildOrderPath(resolvedOrderCode)
                    : `/encomenda/${encodeURIComponent(resolvedOrderCode)}`;
                window.location.href = nextPath;
                return;
            }

            if (paymentStatus === 'failed' || paymentStatus === 'expired') {
                updateState(i18nText('Pagamento não confirmado'), i18nText('A sua sessão terminou sem pagamento. Pode tentar novamente no checkout.'));
                return;
            }

            updateState(i18nText('Pagamento em processamento'), i18nText('A confirmar a encomenda e a preparar a emissão fiscal...'));
        } catch (error) {
            console.warn('Erro ao consultar o estado do checkout:', error);
            updateState(i18nText('A aguardar confirmação'), i18nText('Continuamos a validar o pagamento. Esta página vai tentar novamente.'));
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    updateState(i18nText('Ainda em processamento'), i18nText('Se o pagamento foi feito, a encomenda vai aparecer no tracking em breve.'));
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = String(params.get('session_id') || '').trim();
    const orderCode = normalizeOrderCode(params.get('codigo'));

    if (!sessionId && !orderCode) {
        updateState(i18nText('Sessão inválida'), i18nText('Não foi possível identificar a encomenda.'));
        return;
    }

    void pollUntilReady(sessionId, orderCode);
});
