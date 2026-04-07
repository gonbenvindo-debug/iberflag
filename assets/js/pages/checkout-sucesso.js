const successMessageEl = document.getElementById('checkout-success-message');
const successStateEl = document.getElementById('checkout-success-state');

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
        throw new Error(payload?.message || payload?.error || 'Falha ao consultar pagamento.');
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
            const paymentStatus = String(payload?.order?.payment_status || payload?.session?.payment_status || '').toLowerCase();

            if (paymentStatus === 'paid') {
                updateState('Pagamento confirmado', 'A abrir o tracking da encomenda...');
                window.location.href = `/encomenda.html?codigo=${encodeURIComponent(resolvedOrderCode)}`;
                return;
            }

            if (paymentStatus === 'failed' || paymentStatus === 'expired') {
                updateState('Pagamento nao confirmado', 'A sua sessao terminou sem pagamento. Pode tentar novamente no checkout.');
                return;
            }

            updateState('Pagamento em processamento', 'A confirmar a encomenda e a preparar a emissão fiscal...');
        } catch (error) {
            console.warn('Erro ao consultar o estado do checkout:', error);
            updateState('A aguardar confirmação', 'Continuamos a validar o pagamento. Esta pagina vai tentar novamente.');
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    updateState('Ainda em processamento', 'Se o pagamento foi feito, a encomenda vai aparecer no tracking em breve.');
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = String(params.get('session_id') || '').trim();
    const orderCode = normalizeOrderCode(params.get('codigo'));

    if (!sessionId && !orderCode) {
        updateState('Sessao invalida', 'Nao foi possivel identificar a encomenda.');
        return;
    }

    void pollUntilReady(sessionId, orderCode);
});
