// ============================================================
// PRODUCT & CART
// ============================================================
Object.assign(DesignEditor.prototype, {

    async loadProduct() {
        const urlParams = new URLSearchParams(window.location.search);
        const locationState = typeof SiteRoutes !== 'undefined'
            ? SiteRoutes.parseLocationPath(window.location.pathname)
            : { productSlug: '', isProductPersonalizer: false };
        const productSlug = String(urlParams.get('slug') || locationState.productSlug || '').trim();
        let productId = urlParams.get('produto');
        const preselectedBaseId = Number(urlParams.get('base') || 0);
        const manifestProduct = typeof SiteRoutes !== 'undefined' && productSlug
            ? SiteRoutes.findProductBySlug(productSlug)
            : null;
        if (!productId && manifestProduct?.id) {
            productId = String(manifestProduct.id);
        }
        this.editIndex = urlParams.get('edit');
        this.editDesignId = urlParams.get('design');
        this.productId = productId;
        this.productSlug = productSlug || String(manifestProduct?.slug || '').trim();
        this.initialSelectedBaseId = Number.isFinite(preselectedBaseId) && preselectedBaseId > 0
            ? preselectedBaseId
            : null;
        if (this.initialSelectedBaseId) {
            this.selectedBaseId = this.initialSelectedBaseId;
        }
        this.isAdminMode = urlParams.get('admin') === 'true';
        this.editingTemplateId = urlParams.get('editTemplate') || null;

        if (this.isAdminMode) {
            this.setupAdminMode();
        }

        if (!productId && !productSlug) {
            window.location.href = typeof SiteRoutes !== 'undefined'
                ? SiteRoutes.STATIC_PATHS.products
                : '/produtos';
            return;
        }

        const numericProductId = Number(productId);
        let dbProduct = null;

        if (typeof supabaseClient !== 'undefined' && Number.isFinite(numericProductId)) {
            try {
                const { data, error } = await supabaseClient
                    .from('produtos')
                    .select('*')
                    .eq('id', numericProductId)
                    .maybeSingle();

                if (!error && data) {
                    dbProduct = data;
                }
            } catch (error) {
                console.warn('Falha ao carregar produto da base de dados:', error);
            }
        } else if (typeof supabaseClient !== 'undefined' && productSlug) {
            try {
                const { data, error } = await supabaseClient
                    .from('produtos')
                    .select('*')
                    .eq('slug', productSlug)
                    .maybeSingle();

                if (!error && data) {
                    dbProduct = data;
                }
            } catch (error) {
                console.warn('Falha ao carregar produto por slug:', error);
            }
        }

        this.currentProduct = dbProduct
            || initialProducts.find((product) => String(product.id) === String(productId))
            || initialProducts.find((product) => typeof SiteRoutes !== 'undefined' && SiteRoutes.inferProductSlug(product) === productSlug);

        if (!this.currentProduct) {
            showToast('Produto não encontrado', 'error');
            setTimeout(() => {
                window.location.href = typeof SiteRoutes !== 'undefined'
                    ? SiteRoutes.STATIC_PATHS.products
                    : '/produtos';
            }, 2000);
            return;
        }

        this.productId = String(this.currentProduct.id || productId || '');
        this.productSlug = typeof SiteRoutes !== 'undefined'
            ? SiteRoutes.inferProductSlug(this.currentProduct)
            : productSlug;

        if (!this.isAdminMode && (this.currentProduct.ativo === false || !(Number(this.currentProduct.preco) > 0))) {
            showToast('Este produto ainda não tem preço válido para checkout.', 'error');
            setTimeout(() => {
                window.location.href = typeof SiteRoutes !== 'undefined'
                    ? SiteRoutes.STATIC_PATHS.products
                    : '/produtos';
            }, 2000);
            return;
        }

        if (typeof SiteRoutes !== 'undefined' && !this.isAdminMode) {
            const nextPath = SiteRoutes.buildProductPersonalizerPath(this.currentProduct, {
                base: this.initialSelectedBaseId || undefined,
                template: urlParams.get('template') || undefined,
                edit: this.editIndex || undefined,
                design: this.editDesignId || undefined,
                editTemplate: this.editingTemplateId || undefined
            });
            const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
            if (currentPathWithSearch !== nextPath && window.history?.replaceState) {
                window.history.replaceState({}, '', nextPath);
            }
        }

        document.getElementById('product-name').textContent = this.currentProduct.nome;
        await this.loadProductBases();

        if (this.currentProduct.svg_template) {
            this.loadSVGTemplate(this.currentProduct.svg_template);
        } else {
            this.setDefaultPrintArea();
        }

        // Verificar se veio da galeria de templates
        const templateId = urlParams.get('template');
        if (templateId) {
            await this.loadTemplate(templateId);
        } else if (this.editIndex !== null || this.editDesignId) {
            await this.loadExistingDesign(parseInt(this.editIndex, 10));
        } else {
            this.loadAutosaveDesign();
        }

        this.restoreSelectedBaseFromCart();
        this.ensureSelectedBase();
        this.renderProductBaseOptions();
        this.updateProductPriceDisplay();
    },

    async loadProductBases() {
        if (!this.currentProduct?.id || typeof supabaseClient === 'undefined') {
            this.availableBases = [];
            return;
        }

        try {
            let queryResult = await supabaseClient
                .from('vw_produto_bases')
                .select('base_id, base_nome, base_imagem, preco_extra_aplicado, is_default, base_disponivel, base_nota_indisponibilidade')
                .eq('produto_id', Number(this.currentProduct.id))
                .eq('ativo', true)
                .eq('base_ativa', true)
                .order('ordem', { ascending: true });

            if (queryResult.error) {
                queryResult = await supabaseClient
                    .from('vw_produto_bases')
                    .select('base_id, base_nome, base_imagem, preco_extra_aplicado, is_default')
                    .eq('produto_id', Number(this.currentProduct.id))
                    .eq('ativo', true)
                    .eq('base_ativa', true)
                    .order('ordem', { ascending: true });
            }

            if (queryResult.error) throw queryResult.error;
            this.availableBases = (Array.isArray(queryResult.data) ? queryResult.data : []).map((base) => ({
                ...base,
                base_disponivel: base?.base_disponivel !== false && String(base?.base_disponivel) !== 'false',
                base_nota_indisponibilidade: String(base?.base_nota_indisponibilidade || '').trim()
            }));
        } catch (error) {
            this.availableBases = [];
            console.warn('Falha ao carregar bases do produto:', error?.message || error);
        }
    },

    // Carregar template do Supabase
    async loadTemplate(templateId) {
        if (!templateId) return;

        const localTemplate = window.DesignTemplates?.getById?.(templateId);
        if (localTemplate) {
            const localSvgMarkup = window.DesignSvgStore?.extractTemplateSvg(localTemplate.elements || localTemplate.elementos, {
                width: this.baseCanvasSize?.width || 800,
                height: this.baseCanvasSize?.height || 600
            });

            if (localSvgMarkup && window.DesignSvgStore?.importSvgIntoEditor) {
                window.DesignSvgStore.importSvgIntoEditor(this, localSvgMarkup);
                showToast(`Template "${localTemplate.name}" carregado!`, 'success');
                return;
            }
        }

        if (typeof supabaseClient === 'undefined') return;

        try {
            const { data, error } = await supabaseClient
                .from('templates')
                .select('*')
                .eq('id', templateId)
                .eq('ativo', true)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                console.warn('Template nao encontrado:', templateId);
                return;
            }

            const svgMarkup = window.DesignSvgStore?.extractTemplateSvg(data.elementos, {
                width: this.baseCanvasSize?.width || 800,
                height: this.baseCanvasSize?.height || 600
            }) || window.DesignSvgStore?.extractTemplateSvg(data.design_svg, {
                width: this.baseCanvasSize?.width || 800,
                height: this.baseCanvasSize?.height || 600
            });

            if (svgMarkup && window.DesignSvgStore?.importSvgIntoEditor) {
                window.DesignSvgStore.importSvgIntoEditor(this, svgMarkup);
            } else {
                const templateElements = Array.isArray(data.elementos)
                    ? data.elementos
                    : Array.isArray(data.elements)
                        ? data.elements
                        : [];

                if (templateElements.length > 0) {
                    this.clearCanvas?.();
                    templateElements.forEach((el) => {
                        this.createElementFromTemplate?.(el);
                    });
                    this.bringPrintAreaOverlaysToFront?.();
                    this.updateLayers?.();
                    this.saveHistory?.();
                }
            }

            showToast(`Template "${data.nome}" carregado!`, 'success');
        } catch (err) {
            console.error('Erro ao carregar template:', err);
            const fallbackTemplate = window.DesignTemplates?.getById?.(templateId);
            const fallbackSvg = fallbackTemplate
                ? window.DesignSvgStore?.extractTemplateSvg(
                    fallbackTemplate.elements || fallbackTemplate.elementos,
                    {
                        width: this.baseCanvasSize?.width || 800,
                        height: this.baseCanvasSize?.height || 600
                    }
                )
                : '';

            if (fallbackTemplate && fallbackSvg && window.DesignSvgStore?.importSvgIntoEditor) {
                window.DesignSvgStore.importSvgIntoEditor(this, fallbackSvg);
                showToast(`Template "${fallbackTemplate.name}" carregado!`, 'success');
            }
        }
    },

    resolveEditingCartIndex(cartItems = []) {
        let targetIndex = this.editIndex !== null ? Number.parseInt(this.editIndex, 10) : -1;

        if (this.editDesignId) {
            const designMatchIndex = cartItems.findIndex((item) => String(item?.designId || item?.design_id || '') === String(this.editDesignId));
            if (designMatchIndex >= 0) {
                targetIndex = designMatchIndex;
            }
        }

        return targetIndex;
    },

    restoreSelectedBaseFromCart() {
        if (Number.isFinite(Number(this.selectedBaseId)) && Number(this.selectedBaseId) > 0) {
            return;
        }

        const cart = this.getCartData();
        const targetIndex = this.resolveEditingCartIndex(cart);
        const item = targetIndex >= 0 ? cart[targetIndex] : null;
        const baseId = Number(item?.baseId || item?.base_id || 0);

        if (Number.isFinite(baseId) && baseId > 0) {
            this.selectedBaseId = baseId;
        }
    },

    isBaseOptionAvailable(base) {
        return base?.base_disponivel !== false && String(base?.base_disponivel) !== 'false';
    },

    getAvailableBaseOptions() {
        return Array.isArray(this.availableBases)
            ? this.availableBases.filter((base) => this.isBaseOptionAvailable(base))
            : [];
    },

    ensureSelectedBase() {
        if (!Array.isArray(this.availableBases) || this.availableBases.length === 0) {
            this.selectedBaseId = null;
            return;
        }

        const availableBases = this.getAvailableBaseOptions();
        const exists = availableBases.some((base) => Number(base.base_id) === Number(this.selectedBaseId));
        if (exists) return;

        const defaultBase = availableBases.find((base) => Boolean(base.is_default));
        const nextBaseId = defaultBase?.base_id || availableBases[0]?.base_id || null;
        this.selectedBaseId = nextBaseId ? Number(nextBaseId) : null;
    },

    getSelectedBaseOption() {
        if (!Array.isArray(this.availableBases) || !this.availableBases.length) {
            return null;
        }

        return this.availableBases.find((base) => (
            Number(base.base_id) === Number(this.selectedBaseId)
            && this.isBaseOptionAvailable(base)
        )) || null;
    },

    isReinforcementOptionFlow() {
        const category = String(this.currentProduct?.categoria || '').trim().toLowerCase();
        const names = (Array.isArray(this.availableBases) ? this.availableBases : [])
            .map((base) => String(base?.base_nome || '').trim().toLowerCase())
            .filter(Boolean);

        return (category === 'flybanners' || category === 'fly-banner')
            && names.length > 0
            && names.every((name) => name.includes('reforco') || name.includes('reforço') || name.includes('reforço'));
    },

    updateCartBaseStepCopy() {
        const descriptionEl = document.querySelector('#cart-step-pane-2 p:not(#cart-base-empty)');
        const labelEl = document.getElementById('checkout-step-2-label');
        const emptyState = document.getElementById('cart-base-empty');

        if (labelEl) {
            labelEl.textContent = 'Escolher base';
        }

        if (descriptionEl) {
            descriptionEl.textContent = 'Seleciona uma base para este design.';
        }

        if (emptyState) {
            emptyState.textContent = 'Este produto nao tem bases configuradas. O design sera adicionado sem base.';
        }
    },

    updateCartStepActionState() {
        const confirmBtn = document.getElementById('cart-steps-confirm');
        if (!confirmBtn) return;

        const hasOptions = Array.isArray(this.availableBases) && this.availableBases.length > 0;
        const hasAvailableSelection = Boolean(this.getSelectedBaseOption());
        const canConfirm = !hasOptions || hasAvailableSelection;

        confirmBtn.disabled = !canConfirm;
        confirmBtn.classList.toggle('opacity-50', !canConfirm);
        confirmBtn.classList.toggle('cursor-not-allowed', !canConfirm);
        confirmBtn.textContent = canConfirm ? 'Adicionar ao carrinho' : 'Indisponivel';
    },

    renderProductBaseOptions() {
        // Mantido para compatibilidade com chamadas existentes.
        // A escolha da base acontece no modal de passos do carrinho.
        this.updateProductPriceDisplay();
    },

    updateProductPriceDisplay() {
        const priceEl = document.getElementById('product-price');
        if (!priceEl) return;

        const basePrice = Number(this.currentProduct?.preco || 0);
        const selectedBase = this.getSelectedBaseOption();
        const extra = Number(selectedBase?.preco_extra_aplicado || 0);
        const total = basePrice + extra;

        priceEl.textContent = `${total.toFixed(2)}€`;
    },

    updateCartStepsTotalDisplay() {
        const totalEl = document.getElementById('cart-steps-total');
        if (!totalEl) return;

        const basePrice = Number(this.currentProduct?.preco || 0);
        const selectedBase = this.getSelectedBaseOption();
        const extra = Number(selectedBase?.preco_extra_aplicado || 0);
        const total = basePrice + extra;
        totalEl.textContent = `${total.toFixed(2)}€`;
    },

    setupCartStepsModalListeners() {
        if (this.cartStepsListenersReady) return;

        const modal = document.getElementById('cart-steps-modal');
        const closeBtn = document.getElementById('close-cart-steps');
        const backBtn = document.getElementById('cart-steps-back');
        const nextBtn = document.getElementById('cart-steps-next');
        const confirmBtn = document.getElementById('cart-steps-confirm');

        if (!modal || !closeBtn || !backBtn || !nextBtn || !confirmBtn) {
            return;
        }

        const closeModal = () => this.closeCartStepsModal();

        closeBtn.addEventListener('click', closeModal);
        backBtn.addEventListener('click', () => this.setCartStepsCurrent(1));
        nextBtn.addEventListener('click', () => this.setCartStepsCurrent(2));
        confirmBtn.addEventListener('click', () => {
            this.addToCart(this.cartStepsDesignSnapshot || this.getDesignSVG());
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('is-open')) {
                closeModal();
            }
        });

        this.cartStepsListenersReady = true;
    },

    setCartStepsCurrent(stepNumber) {
        this.cartStepsCurrent = stepNumber === 2 ? 2 : 1;

        const step1 = document.getElementById('checkout-step-1');
        const step2 = document.getElementById('checkout-step-2');
        const pane1 = document.getElementById('cart-step-pane-1');
        const pane2 = document.getElementById('cart-step-pane-2');
        const backBtn = document.getElementById('cart-steps-back');
        const nextBtn = document.getElementById('cart-steps-next');
        const confirmBtn = document.getElementById('cart-steps-confirm');

        if (step1 && step2) {
            step1.classList.toggle('active', this.cartStepsCurrent === 1);
            step1.classList.toggle('done', this.cartStepsCurrent === 2);
            step2.classList.toggle('active', this.cartStepsCurrent === 2);
            step2.classList.toggle('done', false);
        }

        if (pane1 && pane2) {
            pane1.classList.toggle('active', this.cartStepsCurrent === 1);
            pane2.classList.toggle('active', this.cartStepsCurrent === 2);
        }

        if (backBtn && nextBtn && confirmBtn) {
            backBtn.classList.toggle('hidden', this.cartStepsCurrent !== 2);
            nextBtn.classList.toggle('hidden', this.cartStepsCurrent !== 1);
            confirmBtn.classList.toggle('hidden', this.cartStepsCurrent !== 2);
        }

        this.updateCartStepActionState();
    },

    generateCartPreviewSVG() {
        return this.getDesignSVG();
    },

    renderCartStepsBaseOptions() {
        const optionsWrap = document.getElementById('cart-base-options');
        const emptyState = document.getElementById('cart-base-empty');
        if (!optionsWrap || !emptyState) return;

        this.updateCartBaseStepCopy();

        if (!Array.isArray(this.availableBases) || this.availableBases.length === 0) {
            optionsWrap.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.updateCartStepsTotalDisplay();
            this.updateCartStepActionState();
            return;
        }

        emptyState.classList.add('hidden');
        optionsWrap.innerHTML = this.availableBases.map((base) => {
            const baseId = Number(base.base_id);
            const isAvailable = this.isBaseOptionAvailable(base);
            const selected = isAvailable && baseId === Number(this.selectedBaseId);
            const extra = Number(base.preco_extra_aplicado || 0);
            const baseName = escapeHtml(base.base_nome || 'Base');
            const imageUrl = escapeHtml(base.base_imagem || `https://picsum.photos/seed/base-${baseId}/640/400`);
            const availabilityNote = escapeHtml(base.base_nota_indisponibilidade || 'Indisponivel de momento');

            return `
                <button type="button" class="cart-base-card ${selected ? 'selected' : ''} ${isAvailable ? '' : 'is-unavailable'}" data-base-id="${baseId}" ${isAvailable ? '' : 'disabled aria-disabled="true"'}>
                    <img src="${imageUrl}" alt="${baseName}">
                    <p class="text-sm font-semibold text-slate-900">${baseName}</p>
                    <p class="text-xs text-slate-500 mt-1">${isAvailable ? (extra > 0 ? `+${extra.toFixed(2)}€` : 'Incluida') : availabilityNote}</p>
                </button>
            `;
        }).join('');

        optionsWrap.querySelectorAll('.cart-base-card').forEach((button) => {
            if (button.disabled) {
                return;
            }

            button.addEventListener('click', () => {
                this.selectedBaseId = Number(button.getAttribute('data-base-id')) || null;
                this.renderProductBaseOptions();
                this.updateProductPriceDisplay();
                this.renderCartStepsBaseOptions();
            });
        });

        this.updateCartStepsTotalDisplay();
        this.updateCartStepActionState();
    },

    openCartStepsModal() {
        if (this.elements.length === 0) {
            showToast('Adicione pelo menos um elemento ao design', 'warning');
            return;
        }

        this.setupCartStepsModalListeners();

        const modal = document.getElementById('cart-steps-modal');
        const previewImg = document.getElementById('cart-design-preview');
        if (!modal || !previewImg) {
            this.addToCart();
            return;
        }

        this.cartStepsFocusReturnEl = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        this.ensureSelectedBase();
        this.cartStepsDesignSnapshot = this.getDesignSVG();
        const previewSvg = this.cartStepsDesignSnapshot || this.generateCartPreviewSVG();
        previewImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`;
        this.cartStepsDesignPreview = previewImg.src;

        this.renderCartStepsBaseOptions();
        this.updateCartStepsTotalDisplay();
        this.setCartStepsCurrent(1);

        if (typeof modal.inert !== 'undefined') {
            modal.inert = false;
        } else {
            modal.removeAttribute('inert');
        }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    closeCartStepsModal() {
        const modal = document.getElementById('cart-steps-modal');
        if (!modal) return;

        const returnFocusEl = this.cartStepsFocusReturnEl;
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && modal.contains(activeElement)) {
            activeElement.blur();
        }

        modal.classList.remove('is-open');
        if (typeof modal.inert !== 'undefined') {
            modal.inert = true;
        } else {
            modal.setAttribute('inert', '');
        }
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (returnFocusEl instanceof HTMLElement && typeof returnFocusEl.focus === 'function') {
            setTimeout(() => {
                returnFocusEl.focus({ preventScroll: true });
            }, 0);
        }

        this.cartStepsFocusReturnEl = null;
    },

    getAutosaveKey() {
        return `iberflag_autosave_${this.productId || 'default'}`;
    },

    getLegacyAutosaveKeys() {
        return [`iberflag_autosave_${this.productId || 'default'}`];
    },

    getCartData() {
        const storageKeys = [this.cartStorageKey, ...this.legacyCartStorageKeys];

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
    },

    saveCartData(cart) {
        const compactCart = Array.isArray(cart)
            ? cart.map((item) => ({
                id: Number(item?.id ?? 0) || 0,
                nome: String(item?.nome || '').trim(),
                preco: Number(item?.preco || 0),
                imagem: String(item?.imagem || '').trim(),
                quantity: Math.max(1, Number.parseInt(item?.quantity ?? 1, 10) || 1),
                customized: Boolean(item?.customized),
                designId: item?.designId ? String(item.designId).trim() : null,
                baseId: item?.baseId ?? item?.base_id ?? null,
                baseNome: item?.baseNome ? String(item.baseNome).trim() : null,
                baseImagem: item?.baseImagem ? String(item.baseImagem).trim() : null,
                basePrecoExtra: Number(item?.basePrecoExtra || 0)
            }))
            : [];

        const serialized = JSON.stringify(compactCart);

        // Libertar espaço antes de gravar a nova versão compacta.
        this.legacyCartStorageKeys.forEach((key) => {
            if (key && key !== this.cartStorageKey) {
                localStorage.removeItem(key);
            }
        });

        try {
            localStorage.setItem(this.cartStorageKey, serialized);
        } catch (error) {
            const name = String(error?.name || '').toLowerCase();
            const message = String(error?.message || '').toLowerCase();
            const isQuotaExceeded = name.includes('quota') || message.includes('quota');

            if (!isQuotaExceeded) {
                throw error;
            }

            const minimalCart = JSON.stringify(compactCart.map((item) => ({
                id: item.id,
                nome: item.nome,
                preco: item.preco,
                quantity: item.quantity,
                customized: item.customized,
                designId: item.designId,
                baseId: item.baseId,
                baseNome: item.baseNome,
                basePrecoExtra: item.basePrecoExtra
            })));

            localStorage.removeItem(this.cartStorageKey);
            localStorage.setItem(this.cartStorageKey, minimalCart);
        }

        if (window.CartAssetStore?.cleanupUnusedDesigns) {
            const activeDesignIds = compactCart
                .map((item) => String(item?.designId || item?.design_id || '').trim())
                .filter(Boolean);

            window.CartAssetStore.cleanupUnusedDesigns(activeDesignIds).catch((error) => {
                console.warn('Falha ao limpar designs antigos do carrinho:', error);
            });
        }
    },

    setupAdminMode() {
        const cartBtn = document.getElementById('add-to-cart-btn');
        if (cartBtn) {
            const icon = cartBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'save');
            }
            const text = cartBtn.querySelector('.editor-cart-text');
            if (text) text.textContent = 'Guardar Design';
            cartBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            cartBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        }

        const priceEl = document.getElementById('product-price');
        if (priceEl) priceEl.style.display = 'none';

        const closeLink = document.querySelector('#editor-nav a[href="/produtos"], #editor-nav a[href="/produtos"]');
        if (closeLink) {
            closeLink.href = '/admin#produtos';
            closeLink.title = 'Voltar ao Admin';
        }
    },

    async saveDesignAsTemplate() {
        if (this.elements.length === 0) {
            showToast('Adicione pelo menos um elemento ao design', 'warning');
            return;
        }

        const designSvg = this.getDesignSVG();
        const designPreview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(designSvg)}`;

        const nome = prompt('Nome do design:');
        if (!nome || !nome.trim()) {
            showToast('Nome obrigatorio para guardar o design', 'warning');
            return;
        }

        const serializableElements = this.elements.map(el => {
            return this.buildSerializableElementData?.(el) || null;
        }).filter(Boolean);

        const normalizeTemplateCategory = (value) => {
            const allowed = new Set(['promocoes', 'eventos', 'corporativo', 'festas', 'varejo']);
            const candidate = String(value || '').trim().toLowerCase();
            return allowed.has(candidate) ? candidate : 'promocoes';
        };

        const viewBox = this.getCanvasViewBoxSize?.() || { width: 800, height: 600 };
        const templateCategory = normalizeTemplateCategory(this.currentProduct?.categoria);

        const templateData = {
            nome: nome.trim(),
            categoria: templateCategory,
            descricao: `Design para ${this.currentProduct?.nome || 'produto'}`,
            elementos: {
                format: 'svg-inline-v1',
                svg: designSvg,
                design_svg: designSvg,
                elements: serializableElements
            },
            largura: Math.max(1, Math.round(Number(viewBox.width) || 800)),
            altura: Math.max(1, Math.round(Number(viewBox.height) || 600)),
            preview_url: designPreview,
            ativo: true
        };

        try {
            if (this.editingTemplateId) {
                const { error } = await supabaseClient
                    .from('templates')
                    .update(templateData)
                    .eq('id', this.editingTemplateId);
                if (error) throw error;
                showToast('Design atualizado com sucesso!', 'success');
            } else {
                const { data, error } = await supabaseClient
                    .from('templates')
                    .insert(templateData)
                    .select('id')
                    .single();

                if (error) {
                    if (error.code === '42501' || error.message?.includes('policy') || error.code === 'PGRST301') {
                        throw new Error('Sem permissao. Ativa INSERT na tabela templates no Supabase (RLS policies).');
                    }
                    throw error;
                }

                if (data?.id && this.productId) {
                    await supabaseClient
                        .from('produto_templates')
                        .insert({
                            produto_id: Number(this.productId),
                            template_id: data.id,
                            ordem: 1
                        });
                }
                showToast('Design criado e associado ao produto!', 'success');
            }

            setTimeout(() => {
                window.location.href = '/admin#produtos';
            }, 1200);
        } catch (err) {
            console.error('Erro ao guardar design:', err);
            showToast(err.message || 'Erro ao guardar design', 'error');
        }
    }

});


