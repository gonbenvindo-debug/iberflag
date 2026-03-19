const ordersSearchForm = document.getElementById('orders-search-form');
const ordersSearchBtn = document.getElementById('orders-search-btn');
const ordersIdentifierInput = document.getElementById('orders-identifier');

function normalizeOrderCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
}

if (ordersSearchForm) {
    ordersSearchForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const normalizedCode = normalizeOrderCode(ordersIdentifierInput?.value);

        if (!normalizedCode) {
            showToast('Introduza o codigo da encomenda', 'warning');
            ordersIdentifierInput?.focus();
            return;
        }

        ordersSearchBtn.disabled = true;
        ordersSearchBtn.innerHTML = '<div class="spinner"></div>';

        window.location.href = `/encomenda.html?codigo=${encodeURIComponent(normalizedCode)}`;
    });
}
