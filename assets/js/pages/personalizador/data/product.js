// ============================================================
// PRODUCT & CART
// ============================================================
Object.assign(DesignEditor.prototype, {

    async loadProduct() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('produto');
        this.editIndex = urlParams.get('edit');
        this.editDesignId = urlParams.get('design');
        this.productId = productId;
        this.isAdminMode = urlParams.get('admin') === 'true';
        this.editingTemplateId = urlParams.get('editTemplate') || null;

        if (this.isAdminMode) {
            this.setupAdminMode();
        }

        if (!productId) {
            window.location.href = '/produtos.html';
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
        }

        this.currentProduct = dbProduct || initialProducts.find(p => p.id == productId);

        if (!this.currentProduct) {
            showToast('Produto não encontrado', 'error');
            setTimeout(() => window.location.href = '/produtos.html', 2000);
            return;
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
            const { data, error } = await supabaseClient
                .from('vw_produto_bases')
                .select('base_id, base_nome, base_imagem, preco_extra_aplicado, is_default')
                .eq('produto_id', Number(this.currentProduct.id))
                .eq('ativo', true)
                .eq('base_ativa', true)
                .order('ordem', { ascending: true });

            if (error) throw error;
            this.availableBases = Array.isArray(data) ? data : [];
        } catch (error) {
            this.availableBases = [];
            console.warn('Falha ao carregar bases do produto:', error?.message || error);
        }
    },

    // Carregar template do Supabase
    async loadTemplate(templateId) {
        if (!templateId || typeof supabaseClient === 'undefined') return;

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
            // Fallback: tentar carregar de TEMPLATES_DATA local
            if (typeof TEMPLATES_DATA !== 'undefined') {
                const allTemplates = Object.values(TEMPLATES_DATA).flat();
                const template = allTemplates.find(t => t.id === templateId || t.slug === templateId);
                const fallbackSvg = window.DesignSvgStore?.extractTemplateSvg(
                    template?.elementos || template?.elements,
                    {
                        width: this.baseCanvasSize?.width || 800,
                        height: this.baseCanvasSize?.height || 600
                    }
                );

                if (template && fallbackSvg && window.DesignSvgStore?.importSvgIntoEditor) {
                    window.DesignSvgStore.importSvgIntoEditor(this, fallbackSvg);
                    showToast(`Template "${template.name}" carregado!`, 'success');
                }
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
        const cart = this.getCartData();
        const targetIndex = this.resolveEditingCartIndex(cart);
        const item = targetIndex >= 0 ? cart[targetIndex] : null;
        const baseId = Number(item?.baseId || item?.base_id || 0);

        if (Number.isFinite(baseId) && baseId > 0) {
            this.selectedBaseId = baseId;
        }
    },

    ensureSelectedBase() {
        if (!Array.isArray(this.availableBases) || this.availableBases.length === 0) {
            this.selectedBaseId = null;
            return;
        }

        const exists = this.availableBases.some((base) => Number(base.base_id) === Number(this.selectedBaseId));
        if (exists) return;

        const defaultBase = this.availableBases.find((base) => Boolean(base.is_default));
        this.selectedBaseId = Number(defaultBase?.base_id || this.availableBases[0]?.base_id || null);
    },

    getSelectedBaseOption() {
        if (!Array.isArray(this.availableBases) || !this.availableBases.length) {
            return null;
        }

        return this.availableBases.find((base) => Number(base.base_id) === Number(this.selectedBaseId)) || null;
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
    },

    generateCartPreviewSVG() {
        return this.getDesignSVG();
    },

    renderCartStepsBaseOptions() {
        const optionsWrap = document.getElementById('cart-base-options');
        const emptyState = document.getElementById('cart-base-empty');
        if (!optionsWrap || !emptyState) return;

        if (!Array.isArray(this.availableBases) || this.availableBases.length === 0) {
            optionsWrap.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.updateCartStepsTotalDisplay();
            return;
        }

        emptyState.classList.add('hidden');
        optionsWrap.innerHTML = this.availableBases.map((base) => {
            const baseId = Number(base.base_id);
            const selected = baseId === Number(this.selectedBaseId);
            const extra = Number(base.preco_extra_aplicado || 0);
            const baseName = escapeHtml(base.base_nome || 'Base');
            const imageUrl = escapeHtml(base.base_imagem || `https://picsum.photos/seed/base-${baseId}/640/400`);

            return `
                <button type="button" class="cart-base-card ${selected ? 'selected' : ''}" data-base-id="${baseId}">
                    <img src="${imageUrl}" alt="${baseName}">
                    <p class="text-sm font-semibold text-slate-900">${baseName}</p>
                    <p class="text-xs text-slate-500 mt-1">${extra > 0 ? `+${extra.toFixed(2)}€` : 'Incluída'}</p>
                </button>
            `;
        }).join('');

        optionsWrap.querySelectorAll('.cart-base-card').forEach((button) => {
            button.addEventListener('click', () => {
                this.selectedBaseId = Number(button.getAttribute('data-base-id')) || null;
                this.renderProductBaseOptions();
                this.updateProductPriceDisplay();
                this.renderCartStepsBaseOptions();
            });
        });

        this.updateCartStepsTotalDisplay();
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

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        if (typeof modal.inert !== 'undefined') {
            modal.inert = true;
        } else {
            modal.setAttribute('inert', '');
        }
        document.body.style.overflow = '';
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
            ? cart.map((item) => {
                const {
                    design,
                    designPreview,
                    design_svg,
                    preview_url,
                    previewUrl,
                    thumbnail,
                    ...rest
                } = item || {};

                return {
                    ...rest
                };
            })
            : [];

        const serialized = JSON.stringify(compactCart);

        // Libertar espaço antes de gravar a nova versão compacta.
        this.legacyCartStorageKeys.forEach((key) => {
            if (key && key !== this.cartStorageKey) {
                localStorage.removeItem(key);
            }
        });

        localStorage.setItem(this.cartStorageKey, serialized);

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

        const closeLink = document.querySelector('#editor-nav a[href="/produtos.html"]');
        if (closeLink) {
            closeLink.href = '/pages/admin.html#produtos';
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
            const { element, ...rest } = el;
            return rest;
        });

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
                window.location.href = '/pages/admin.html#produtos';
            }, 1200);
        } catch (err) {
            console.error('Erro ao guardar design:', err);
            showToast(err.message || 'Erro ao guardar design', 'error');
        }
    }

});
