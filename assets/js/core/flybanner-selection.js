(function () {
    const FLYBANNER_CATEGORIES = new Set(['fly-banner', 'flybanners']);
    const baseOptionsCache = new Map();
    let modalElements = null;
    let titleFitResizeBound = false;

    function normalizeCategory(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isFlybannerCategory(value) {
        return FLYBANNER_CATEGORIES.has(normalizeCategory(value));
    }

    function escapeHtmlLocal(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function i18nText(value) {
        return window.IberFlagI18n?.translateText
            ? window.IberFlagI18n.translateText(value)
            : value;
    }

    function decodeProductName(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return '';
        }

        try {
            return decodeURIComponent(raw);
        } catch {
            return raw;
        }
    }

    function getSupabaseClient() {
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
            return window.supabaseClient;
        }

        if (window.supabase && typeof window.supabase.createClient === 'function') {
            const url = window.APP_CONFIG?.SUPABASE_URL || window.SUPABASE_URL;
            const anonKey = window.APP_CONFIG?.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
            if (url && anonKey) {
                try {
                    window.supabaseClient = window.supabase.createClient(url, anonKey);
                    return window.supabaseClient;
                } catch (error) {
                    console.warn('Falha ao inicializar Supabase para flybanners:', error);
                }
            }
        }

        return null;
    }

    function appendFlybannerSelectionQuery(targetUrl, selectionId) {
        const url = new URL(String(targetUrl || '/'), window.location.origin);
        if (selectionId) {
            url.searchParams.set('reinforcement', String(selectionId));
        } else {
            url.searchParams.delete('reinforcement');
        }
        return `${url.pathname}${url.search}${url.hash}`;
    }

    function getFlybannerReinforcementOptions() {
        return [
            {
                base_id: 'com-reforco',
                base_nome: 'Com reforço',
                base_imagem: '/assets/images/flybanner-variants/com-reforco.svg',
                preco_extra_aplicado: 0,
                is_default: true,
                base_disponivel: true,
                base_nota_indisponibilidade: 'Incluído'
            },
            {
                base_id: 'sem-reforco',
                base_nome: 'Sem reforço',
                base_imagem: '/assets/images/flybanner-variants/sem-reforco.svg',
                preco_extra_aplicado: 0,
                is_default: false,
                base_disponivel: false,
                base_nota_indisponibilidade: 'Indisponível'
            }
        ];
    }

    function ensureModal() {
        if (modalElements) {
            return modalElements;
        }

        const overlay = document.createElement('div');
        overlay.id = 'flybanner-selection-modal';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '1200';
        overlay.style.display = 'none';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '1rem';
        overlay.style.background = 'rgba(15, 23, 42, 0.65)';
        overlay.style.backdropFilter = 'blur(10px)';

        overlay.innerHTML = `
            <div role="dialog" aria-modal="true" aria-labelledby="flybanner-selection-title" style="width:min(100%, 960px); max-height:90vh; overflow:hidden; display:flex; flex-direction:column; background:#ffffff; border-radius:28px; box-shadow:0 32px 90px rgba(15,23,42,0.24);">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:1.5rem; border-bottom:1px solid rgba(148,163,184,0.22);">
                    <div>
                        <h2 id="flybanner-selection-title" style="margin:0; font-size:1.25rem; line-height:1.2; font-weight:700; color:#0f172a;">${i18nText('Escolha o reforço')}</h2>
                        <p id="flybanner-selection-subtitle" style="margin:0.5rem 0 0; font-size:0.95rem; line-height:1.5; color:#64748b;">${i18nText('Selecione a opção pretendida antes de continuar.')}</p>
                    </div>
                    <button type="button" data-flybanner-close="true" aria-label="${i18nText('Fechar seletor')}" style="width:2.5rem; height:2.5rem; border:0; border-radius:999px; background:#f8fafc; color:#475569; cursor:pointer; font-size:1.5rem; line-height:1;">&times;</button>
                </div>
                <div id="flybanner-selection-body" style="padding:1.5rem; overflow:auto;"></div>
            </div>
        `;

        overlay.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            if (target === overlay || target.closest('[data-flybanner-close="true"]')) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && overlay.style.display !== 'none') {
                closeModal();
            }
        });

        document.body.appendChild(overlay);

        modalElements = {
            overlay,
            title: overlay.querySelector('#flybanner-selection-title'),
            subtitle: overlay.querySelector('#flybanner-selection-subtitle'),
            body: overlay.querySelector('#flybanner-selection-body')
        };

        return modalElements;
    }

    function closeModal() {
        const modal = ensureModal();
        modal.overlay.style.display = 'none';
        modal.overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function showModal() {
        const modal = ensureModal();
        modal.overlay.style.display = 'flex';
        modal.overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function buildBaseOptionMarkup(base, nextUrl) {
        const baseId = String(base?.base_id || '').trim();
        const baseName = escapeHtmlLocal(i18nText(base?.base_nome || 'Base'));
        const imageUrl = escapeHtmlLocal(base?.base_imagem || '/assets/images/template-placeholder.svg');
        const isAvailable = base?.base_disponivel !== false && String(base?.base_disponivel) !== 'false';
        const extra = Number(base?.preco_extra_aplicado || 0);
        const priceLabel = extra > 0 ? `+${extra.toFixed(2)}€` : i18nText('Incluído');
        const note = escapeHtmlLocal(i18nText(base?.base_nota_indisponibilidade || 'Indisponível'));
        const badgeLabel = isAvailable ? priceLabel : note;
        const buttonStyles = isAvailable
            ? 'cursor:pointer; border:1px solid rgba(148,163,184,0.28); background:#ffffff;'
            : 'cursor:not-allowed; border:1px solid rgba(148,163,184,0.2); background:#f8fafc; opacity:0.72;';

        return `
            <button
                type="button"
                data-flybanner-base-id="${baseId}"
                data-next-url="${escapeHtmlLocal(nextUrl)}"
                ${isAvailable ? '' : 'disabled aria-disabled="true"'}
                style="position:relative; display:block; width:100%; padding:0; border-radius:22px; overflow:hidden; text-align:left; transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; ${buttonStyles}">
                <span class="cart-base-card__price-badge" style="position:absolute; top:0.75rem; right:0.75rem; z-index:2; display:inline-flex; align-items:center; justify-content:center; min-height:1.9rem; padding:0.35rem 0.7rem; border-radius:999px; background:${isAvailable ? '#ffffff' : '#e2e8f0'}; border:1px solid rgba(148,163,184,0.28); color:#0f172a; font-size:0.8rem; font-weight:700; letter-spacing:0.01em; box-shadow:0 10px 18px rgba(15,23,42,0.08);">${badgeLabel}</span>
                <img
                    src="${imageUrl}"
                    alt="${baseName}"
                    class="cart-base-card__image"
                    style="display:block; width:100%; height:auto; object-fit:contain; background:#ffffff;">
                <span class="cart-base-card__overlay" style="position:absolute; left:0; right:0; bottom:0; padding:0.8rem 0.9rem 0.85rem; background:linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 28%, rgba(255,255,255,0.98) 100%);">
                    <span class="cart-base-card__title" style="display:block; font-size:1.02rem; font-weight:700; line-height:1.25; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${baseName}</span>
                </span>
            </button>
        `;
    }

    function fitBaseCardTitles(scope = document) {
        const titles = scope.querySelectorAll?.('.cart-base-card__title');
        if (!titles || titles.length === 0) {
            return;
        }

        titles.forEach((title) => {
            if (!(title instanceof HTMLElement)) {
                return;
            }

            const text = title.textContent || '';
            if (!text.trim()) {
                return;
            }

            const parent = title.parentElement;
            if (!(parent instanceof HTMLElement)) {
                return;
            }

            const availableWidth = Math.max(0, parent.clientWidth - 1);
            if (availableWidth <= 0) {
                return;
            }

            let fontSize = 1.02;
            title.style.fontSize = `${fontSize}rem`;
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';

            while (fontSize > 0.76 && title.scrollWidth > availableWidth) {
                fontSize -= 0.02;
                title.style.fontSize = `${fontSize.toFixed(2)}rem`;
            }
        });
    }

    function ensureTitleFitResizeBinding() {
        if (titleFitResizeBound) {
            return;
        }

        window.addEventListener('resize', () => {
            if (!modalElements || modalElements.overlay.style.display === 'none') {
                return;
            }

            requestAnimationFrame(() => fitBaseCardTitles(modalElements.body || document));
        });

        titleFitResizeBound = true;
    }

    function bindBaseOptionEvents() {
        const modal = ensureModal();
        modal.body.querySelectorAll('[data-flybanner-base-id]').forEach((button) => {
            if (!(button instanceof HTMLButtonElement) || button.disabled) {
                return;
            }

            button.addEventListener('click', () => {
                const baseId = String(button.getAttribute('data-flybanner-base-id') || '').trim();
                const nextUrl = button.getAttribute('data-next-url') || '/';
                closeModal();
                window.location.assign(appendFlybannerSelectionQuery(nextUrl, baseId));
            });
        });
    }

    function renderLoading(productName) {
        const modal = ensureModal();
        if (modal.title) {
            modal.title.textContent = i18nText('Escolha o reforço');
        }
        if (modal.subtitle) {
            modal.subtitle.textContent = `${i18nText('A carregar as opções disponíveis para')} ${i18nText(productName || 'este flybanner')}...`;
        }
        if (modal.body) {
            modal.body.innerHTML = `
                <div class="flybanner-selection-grid" style="display:grid; gap:1rem;">
                    ${Array.from({ length: 2 }).map(() => `
                        <div aria-hidden="true" style="border-radius:22px; border:1px solid rgba(148,163,184,0.18); padding:1rem; background:#ffffff;">
                            <div style="height:220px; border-radius:18px; background:linear-gradient(90deg, #e2e8f0 25%, #f8fafc 37%, #e2e8f0 63%); background-size:400% 100%; animation: flybanner-skeleton 1.4s ease infinite;"></div>
                            <div style="margin-top:0.9rem; height:1rem; width:65%; border-radius:999px; background:linear-gradient(90deg, #e2e8f0 25%, #f8fafc 37%, #e2e8f0 63%); background-size:400% 100%; animation: flybanner-skeleton 1.4s ease infinite;"></div>
                            <div style="margin-top:0.55rem; height:0.8rem; width:40%; border-radius:999px; background:linear-gradient(90deg, #e2e8f0 25%, #f8fafc 37%, #e2e8f0 63%); background-size:400% 100%; animation: flybanner-skeleton 1.4s ease infinite;"></div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        ensureSkeletonAnimation();
        showModal();
    }

    function ensureSkeletonAnimation() {
        if (document.getElementById('flybanner-skeleton-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'flybanner-skeleton-style';
        style.textContent = '@keyframes flybanner-skeleton{0%{background-position:100% 50%;}100%{background-position:0 50%;}}';
        document.head.appendChild(style);
    }

    function renderEmptyState(productName, nextUrl) {
        const modal = ensureModal();
        if (modal.title) {
            modal.title.textContent = i18nText('Sem opções configuradas');
        }
        if (modal.subtitle) {
            modal.subtitle.textContent = `${i18nText('Este flybanner ainda não tem opções configuradas para')} ${i18nText(productName || 'este produto')}.`;
        }
        if (modal.body) {
            modal.body.innerHTML = `
                <div style="padding:1rem 0 0.25rem; text-align:center;">
                    <p style="margin:0; color:#64748b; line-height:1.6;">${i18nText('Vamos continuar para a página do produto para não bloquear a navegação.')}</p>
                    <button type="button" data-flybanner-fallback="true" style="margin-top:1rem; padding:0.85rem 1.35rem; border:0; border-radius:14px; background:#0f172a; color:#ffffff; font-weight:700; cursor:pointer;">${i18nText('Continuar')}</button>
                </div>
            `;

            const button = modal.body.querySelector('[data-flybanner-fallback="true"]');
            if (button instanceof HTMLButtonElement) {
                button.addEventListener('click', () => {
                    closeModal();
                    window.location.assign(String(nextUrl || '/'));
                });
            }
        }

        showModal();
    }

    function renderOptions(productName, options, nextUrl) {
        const modal = ensureModal();
        if (modal.title) {
            modal.title.textContent = i18nText('Escolha o reforço');
        }
        if (modal.subtitle) {
            modal.subtitle.textContent = `${i18nText('Selecione a opção pretendida para')} ${i18nText(productName || 'este flybanner')} ${i18nText('antes de continuar.')}`;
        }
        if (modal.body) {
            modal.body.innerHTML = `
                <div class="flybanner-selection-grid" style="display:grid; gap:1rem;">
                    ${options.map((base) => buildBaseOptionMarkup(base, nextUrl)).join('')}
                </div>
            `;
        }

        bindBaseOptionEvents();
        showModal();
        ensureTitleFitResizeBinding();
        requestAnimationFrame(() => fitBaseCardTitles(modal.body || document));
    }

    async function openSelectionFlow({ productId, productName, nextUrl }) {
        void productId;
        const options = getFlybannerReinforcementOptions();
        if (!Array.isArray(options) || options.length === 0) {
            renderEmptyState(productName, nextUrl);
            return;
        }

        renderOptions(productName, options, nextUrl);
    }

    function syncPersonalizeLinksWithSelectionQuery() {
        const currentReinforcement = new URLSearchParams(window.location.search).get('reinforcement');
        if (!currentReinforcement) {
            return;
        }

        document.querySelectorAll('[data-personalize-link="true"]').forEach((link) => {
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }
            link.href = appendFlybannerSelectionQuery(link.href, currentReinforcement);
        });
    }

    function findTrigger(eventTarget) {
        if (!(eventTarget instanceof Element)) {
            return null;
        }

        return eventTarget.closest('[data-flybanner-personalize-trigger="true"]');
    }

    document.addEventListener('click', (event) => {
        const trigger = findTrigger(event.target);
        if (!trigger) {
            return;
        }

        const category = trigger.getAttribute('data-product-category')
            || document.body.getAttribute('data-product-category-slug')
            || '';

        if (!isFlybannerCategory(category)) {
            return;
        }

        const currentReinforcement = new URLSearchParams(window.location.search).get('reinforcement');
        const isPersonalizeTrigger = trigger.hasAttribute('data-flybanner-personalize-trigger');

        if (isPersonalizeTrigger && currentReinforcement && trigger instanceof HTMLAnchorElement) {
            trigger.href = appendFlybannerSelectionQuery(trigger.href, currentReinforcement);
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const nextUrl = trigger.getAttribute('href')
            || trigger.getAttribute('data-next-url')
            || '/';
        const productId = Number(
            trigger.getAttribute('data-product-id')
            || document.body.getAttribute('data-product-id')
            || 0
        );
        const productName = decodeProductName(trigger.getAttribute('data-product-name'))
            || document.body.getAttribute('data-product-name')
            || 'este flybanner';

        void openSelectionFlow({
            productId,
            productName,
            nextUrl
        });
    }, true);

    document.addEventListener('DOMContentLoaded', () => {
        syncPersonalizeLinksWithSelectionQuery();
    });

    window.FlybannerSelection = {
        appendFlybannerSelectionQuery,
        closeModal,
        openSelectionFlow
    };
}());
