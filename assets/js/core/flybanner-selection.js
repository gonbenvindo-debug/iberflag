(function () {
    const FLYBANNER_CATEGORIES = new Set(['fly-banner', 'flybanners']);
    const baseOptionsCache = new Map();
    let modalElements = null;

    function normalizeCategory(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isFlybannerCategory(value) {
        return FLYBANNER_CATEGORIES.has(normalizeCategory(value));
    }

    function escapeHtmlLocal(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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

    function appendBaseQuery(targetUrl, baseId) {
        const url = new URL(String(targetUrl || '/'), window.location.origin);
        if (baseId) {
            url.searchParams.set('base', String(baseId));
        } else {
            url.searchParams.delete('base');
        }
        return `${url.pathname}${url.search}${url.hash}`;
    }

    async function fetchFlybannerBaseOptions(productId) {
        const numericProductId = Number(productId);
        if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
            return [];
        }

        if (baseOptionsCache.has(numericProductId)) {
            return baseOptionsCache.get(numericProductId);
        }

        const client = getSupabaseClient();
        if (!client) {
            return [];
        }

        const request = client
            .from('vw_produto_bases')
            .select('base_id, base_nome, base_imagem, preco_extra_aplicado, is_default, base_disponivel, base_nota_indisponibilidade')
            .eq('produto_id', numericProductId)
            .eq('ativo', true)
            .eq('base_ativa', true)
            .order('ordem', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    throw error;
                }

                return (Array.isArray(data) ? data : []).map((base) => ({
                    ...base,
                    base_disponivel: base?.base_disponivel !== false && String(base?.base_disponivel) !== 'false',
                    base_nota_indisponibilidade: String(base?.base_nota_indisponibilidade || '').trim()
                }));
            })
            .catch((error) => {
                console.warn('Falha ao carregar opcoes de flybanner:', error?.message || error);
                return [];
            });

        baseOptionsCache.set(numericProductId, request);
        return request;
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
                        <h2 id="flybanner-selection-title" style="margin:0; font-size:1.25rem; line-height:1.2; font-weight:700; color:#0f172a;">Escolha a base</h2>
                        <p id="flybanner-selection-subtitle" style="margin:0.5rem 0 0; font-size:0.95rem; line-height:1.5; color:#64748b;">Selecione a base disponivel antes de continuar.</p>
                    </div>
                    <button type="button" data-flybanner-close="true" aria-label="Fechar seletor" style="width:2.5rem; height:2.5rem; border:0; border-radius:999px; background:#f8fafc; color:#475569; cursor:pointer; font-size:1.5rem; line-height:1;">&times;</button>
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
        const baseId = Number(base?.base_id || 0);
        const baseName = escapeHtmlLocal(base?.base_nome || 'Base');
        const imageUrl = escapeHtmlLocal(base?.base_imagem || '/assets/images/template-placeholder.svg');
        const isAvailable = base?.base_disponivel !== false && String(base?.base_disponivel) !== 'false';
        const extra = Number(base?.preco_extra_aplicado || 0);
        const priceLabel = extra > 0 ? `+${extra.toFixed(2)}€` : 'Incluido';
        const note = escapeHtmlLocal(base?.base_nota_indisponibilidade || 'Indisponivel de momento');
        const buttonStyles = isAvailable
            ? 'cursor:pointer; border:1px solid rgba(148,163,184,0.28); background:#ffffff;'
            : 'cursor:not-allowed; border:1px solid rgba(148,163,184,0.2); background:#f8fafc; opacity:0.72;';

        return `
            <button
                type="button"
                data-flybanner-base-id="${baseId}"
                data-next-url="${escapeHtmlLocal(nextUrl)}"
                ${isAvailable ? '' : 'disabled aria-disabled="true"'}
                style="display:flex; flex-direction:column; align-items:stretch; gap:0.9rem; width:100%; padding:1rem; border-radius:22px; text-align:left; transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; ${buttonStyles}">
                <span style="display:flex; align-items:center; justify-content:center; min-height:220px; border-radius:18px; background:#ffffff; padding:1rem;">
                    <img src="${imageUrl}" alt="${baseName}" style="display:block; max-width:100%; max-height:200px; object-fit:contain;">
                </span>
                <span style="display:flex; flex-direction:column; gap:0.4rem;">
                    <span style="font-size:1.05rem; font-weight:700; line-height:1.3; color:#0f172a;">${baseName}</span>
                    <span style="font-size:0.92rem; line-height:1.45; color:${isAvailable ? '#475569' : '#64748b'};">${isAvailable ? priceLabel : note}</span>
                </span>
            </button>
        `;
    }

    function bindBaseOptionEvents() {
        const modal = ensureModal();
        modal.body.querySelectorAll('[data-flybanner-base-id]').forEach((button) => {
            if (!(button instanceof HTMLButtonElement) || button.disabled) {
                return;
            }

            button.addEventListener('click', () => {
                const baseId = Number(button.getAttribute('data-flybanner-base-id'));
                const nextUrl = button.getAttribute('data-next-url') || '/';
                closeModal();
                window.location.assign(appendBaseQuery(nextUrl, baseId));
            });
        });
    }

    function renderLoading(productName) {
        const modal = ensureModal();
        if (modal.title) {
            modal.title.textContent = 'Escolha a base';
        }
        if (modal.subtitle) {
            modal.subtitle.textContent = `A carregar as bases disponiveis para ${productName || 'este flybanner'}...`;
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
            modal.title.textContent = 'Sem bases configuradas';
        }
        if (modal.subtitle) {
            modal.subtitle.textContent = `Este flybanner ainda nao tem bases configuradas para ${productName || 'este produto'}.`;
        }
        if (modal.body) {
            modal.body.innerHTML = `
                <div style="padding:1rem 0 0.25rem; text-align:center;">
                    <p style="margin:0; color:#64748b; line-height:1.6;">Vamos continuar para a pagina do produto para nao bloquear a navegacao.</p>
                    <button type="button" data-flybanner-fallback="true" style="margin-top:1rem; padding:0.85rem 1.35rem; border:0; border-radius:14px; background:#0f172a; color:#ffffff; font-weight:700; cursor:pointer;">Continuar</button>
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
            modal.title.textContent = 'Escolha a base';
        }
        if (modal.subtitle) {
            modal.subtitle.textContent = `Selecione a base pretendida para ${productName || 'este flybanner'} antes de continuar.`;
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
    }

    async function openSelectionFlow({ productId, productName, nextUrl }) {
        renderLoading(productName);
        const options = await fetchFlybannerBaseOptions(productId);
        if (!Array.isArray(options) || options.length === 0) {
            renderEmptyState(productName, nextUrl);
            return;
        }

        renderOptions(productName, options, nextUrl);
    }

    function syncPersonalizeLinksWithBaseQuery() {
        const currentBase = new URLSearchParams(window.location.search).get('base');
        if (!currentBase) {
            return;
        }

        document.querySelectorAll('[data-personalize-link="true"]').forEach((link) => {
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }
            link.href = appendBaseQuery(link.href, currentBase);
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

        const currentBase = new URLSearchParams(window.location.search).get('base');
        const isPersonalizeTrigger = trigger.hasAttribute('data-flybanner-personalize-trigger');

        if (isPersonalizeTrigger && currentBase && trigger instanceof HTMLAnchorElement) {
            trigger.href = appendBaseQuery(trigger.href, currentBase);
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
        syncPersonalizeLinksWithBaseQuery();
    });

    window.FlybannerSelection = {
        appendBaseQuery,
        closeModal,
        openSelectionFlow
    };
}());
