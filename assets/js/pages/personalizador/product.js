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
            showToast('Produto n├úo encontrado', 'error');
            setTimeout(() => window.location.href = '/produtos.html', 2000);
            return;
        }
        
        document.getElementById('product-name').textContent = this.currentProduct.nome;
        await this.loadProductBases();
        
        // Load SVG template if exists
        if (this.currentProduct.svg_template) {
            this.loadSVGTemplate(this.currentProduct.svg_template);
        } else {
            this.setDefaultPrintArea();
        }
        
        // Load existing design if editing
        if (this.editIndex !== null || this.editDesignId) {
            this.loadExistingDesign(parseInt(this.editIndex, 10));
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

        priceEl.textContent = `${total.toFixed(2)}Ôé¼`;
    },

    updateCartStepsTotalDisplay() {
        const totalEl = document.getElementById('cart-steps-total');
        if (!totalEl) return;

        const basePrice = Number(this.currentProduct?.preco || 0);
        const selectedBase = this.getSelectedBaseOption();
        const extra = Number(selectedBase?.preco_extra_aplicado || 0);
        const total = basePrice + extra;
        totalEl.textContent = `${total.toFixed(2)}Ôé¼`;
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
        // Crop viewBox to print area + uniform padding on all sides
        const pb = this.printAreaBounds;
        const pad = Math.round(Math.min(pb.width, pb.height) * 0.05); // 5% of shortest side
        const cropX = Math.round(pb.x) - pad;
        const cropY = Math.round(pb.y) - pad;
        const cropW = Math.max(1, Math.round(pb.width) + pad * 2);
        const cropH = Math.max(1, Math.round(pb.height) + pad * 2);

        const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        exportSvg.setAttribute('viewBox', `${cropX} ${cropY} ${cropW} ${cropH}`);
        exportSvg.setAttribute('width', String(cropW));
        exportSvg.setAttribute('height', String(cropH));
        exportSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // --- defs: clip path that follows the print area shape exactly ---
        const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const designClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        designClip.setAttribute('id', 'cart-preview-clip');
        designClip.appendChild(this.createExportMaskShape());
        svgDefs.appendChild(designClip);
        exportSvg.appendChild(svgDefs);

        // --- design elements clipped to print area, transparent outside ---
        const clippedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        clippedGroup.setAttribute('clip-path', 'url(#cart-preview-clip)');
        Array.from(this.canvas.children)
            .filter(node => {
                const id = node.getAttribute('id') || '';
                return id !== 'print-area-outline' && id !== 'print-area-shape-outline'
                    && id !== 'print-area-outside-overlay' && id !== 'print-area-outside-grid';
            })
            .forEach(node => clippedGroup.appendChild(node.cloneNode(true)));
        exportSvg.appendChild(clippedGroup);

        // --- subtle border along the print area shape ---
        const shapeOutline = this.canvas.querySelector('#print-area-shape-outline');
        if (shapeOutline) {
            const border = shapeOutline.cloneNode(true);
            border.removeAttribute('id');
            border.setAttribute('fill', 'none');
            border.setAttribute('stroke', 'rgba(0,0,0,0.15)');
            border.setAttribute('stroke-width', '1.5');
            border.removeAttribute('stroke-dasharray');
            border.removeAttribute('vector-effect');
            border.setAttribute('opacity', '1');
            border.setAttribute('pointer-events', 'none');
            exportSvg.appendChild(border);
        }

        return new XMLSerializer().serializeToString(exportSvg);
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
                    <p class="text-xs text-slate-500 mt-1">${extra > 0 ? `+${extra.toFixed(2)}Ôé¼` : 'Inclu├¡da'}</p>
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
        const previewSvg = this.generateCartPreviewSVG();
        previewImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`;
        this.cartStepsDesignPreview = previewImg.src;

        this.renderCartStepsBaseOptions();
        this.updateCartStepsTotalDisplay();
        this.setCartStepsCurrent(1);

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
        localStorage.setItem(this.cartStorageKey, JSON.stringify(cart));
        this.legacyCartStorageKeys.forEach((key) => {
            localStorage.setItem(key, JSON.stringify(cart));
        });
    }


});
