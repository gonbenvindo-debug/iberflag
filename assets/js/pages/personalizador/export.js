// ============================================================
// CROP, EXPORT & ADD TO CART
// ============================================================
Object.assign(DesignEditor.prototype, {

    startCropMode() {
        if (!this.selectedElement || this.selectedElement.type !== 'image') {
            showToast('Seleccione uma imagem para cortar', 'warning');
            return;
        }

        // Obter a imagem atual do elemento selecionado
        const imgElement = this.selectedElement.element;
        if (!imgElement || imgElement.tagName !== 'image') {
            showToast('Imagem não encontrada', 'error');
            return;
        }

        // Usar imagem original se disponivel, senao usar a atual
        const originalSrc = imgElement.dataset.originalSrc;
        const currentSrc = imgElement.getAttribute('href');
        const srcToCrop = originalSrc || currentSrc;

        // Obter cropData atual da imagem para mostrar no modal
        const existingCropData = imgElement.dataset.cropData
            ? JSON.parse(imgElement.dataset.cropData)
            : null;

        if (!srcToCrop) {
            showToast('Fonte da imagem não encontrada', 'error');
            return;
        }

        const elementToUpdate = this.selectedElement;

        this.openUploadCropModal(srcToCrop, existingCropData).then((croppedImageData) => {
            if (croppedImageData && elementToUpdate) {
                // Salvar imagem original na primeira vez que cortar
                if (!imgElement.dataset.originalSrc && currentSrc) {
                    imgElement.dataset.originalSrc = currentSrc;
                }

                imgElement.setAttribute('href', croppedImageData.dataUrl);

                if (croppedImageData.cropData) {
                    const fullWidth = croppedImageData.fullWidth;
                    const fullHeight = croppedImageData.fullHeight;
                    const cropData = croppedImageData.cropData;

                    const viewBoxX = cropData.x * fullWidth;
                    const viewBoxY = cropData.y * fullHeight;
                    const viewBoxWidth = cropData.width * fullWidth;
                    const viewBoxHeight = cropData.height * fullHeight;

                    imgElement.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
                    imgElement.dataset.cropData = JSON.stringify(cropData);
                    imgElement.dataset.fullWidth = String(fullWidth);
                    imgElement.dataset.fullHeight = String(fullHeight);

                    elementToUpdate.cropData = cropData;
                    elementToUpdate.fullWidth = fullWidth;
                    elementToUpdate.fullHeight = fullHeight;
                }

                showToast('Imagem cortada com sucesso', 'success');
                this.hideResizeHandles();
                this.showResizeHandles(elementToUpdate);
                this.saveHistory();
            }
        });
    },

    showCropHandles() {
        const handlesContainer = document.getElementById('resize-handles');
        handlesContainer.innerHTML = '';
        handlesContainer.classList.remove('hidden');

        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapperRect = this.canvasWrapper.getBoundingClientRect();
        const bbox = this.cropBounds;
        const ctm = this.selectedElement.element.getScreenCTM();

        if (!ctm) return;

        const toCanvasPoint = (x, y) => {
            const p = new DOMPoint(x, y).matrixTransform(ctm);
            return {
                x: p.x - wrapperRect.left,
                y: p.y - wrapperRect.top
            };
        };

        const tl = toCanvasPoint(bbox.x, bbox.y);
        const tr = toCanvasPoint(bbox.x + bbox.width, bbox.y);
        const br = toCanvasPoint(bbox.x + bbox.width, bbox.y + bbox.height);
        const bl = toCanvasPoint(bbox.x, bbox.y + bbox.height);

        const mid = (a, b) => ({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        });

        const tc = mid(tl, tr);
        const rc = mid(tr, br);
        const bc = mid(bl, br);
        const lc = mid(tl, bl);

        const handlePositions = {
            'nw': tl,
            'ne': tr,
            'sw': bl,
            'se': br,
            'n': tc,
            's': bc,
            'e': rc,
            'w': lc
        };

        Object.entries(handlePositions).forEach(([pos, point]) => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle crop-handle';
            handle.dataset.position = pos;
            handle.style.cursor = `${pos}-resize`;
            handle.style.left = (point.x - 5) + 'px';
            handle.style.top = (point.y - 5) + 'px';
            handle.style.backgroundColor = '#a855f7';

            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startCropResize(e, pos);
            });

            handlesContainer.appendChild(handle);
        });
    },

    startCropResize(e, position) {
        this.isResizing = true;
        this.resizeHandle = position;
        this.dragStart = {
            x: e.clientX,
            y: e.clientY,
            startClientX: e.clientX,
            startClientY: e.clientY,
            bbox: { ...this.cropBounds }
        };
    },

    applyCrop() {
        if (!this.selectedElement || this.selectedElement.type !== 'image' || !this.cropBounds) {
            return;
        }

        const currentBbox = this.selectedElement.element.getBBox();
        const widthRatio = this.cropBounds.width / currentBbox.width;
        const heightRatio = this.cropBounds.height / currentBbox.height;
        const xRatio = (this.cropBounds.x - currentBbox.x) / currentBbox.width;
        const yRatio = (this.cropBounds.y - currentBbox.y) / currentBbox.height;

        // Armazenar crop no elementData
        this.selectedElement.cropBounds = this.cropBounds;
        this.selectedElement.cropData = {
            widthRatio,
            heightRatio,
            xRatio,
            yRatio
        };

        // Aplicar clipPath ao elemento
        const clipPathId = `crop-clip-${this.selectedElement.id}`;
        let defs = this.canvas.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.canvas.prepend(defs);
        }

        const existingClip = defs.querySelector(`#${clipPathId}`);
        if (existingClip) {
            existingClip.remove();
        }

        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipPathId);

        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', String(this.cropBounds.x));
        clipRect.setAttribute('y', String(this.cropBounds.y));
        clipRect.setAttribute('width', String(this.cropBounds.width));
        clipRect.setAttribute('height', String(this.cropBounds.height));

        clipPath.appendChild(clipRect);
        defs.appendChild(clipPath);

        this.selectedElement.element.setAttribute('clip-path', `url(#${clipPathId})`);

        this.cropMode = false;
        this.cropBounds = null;
        this.hideResizeHandles();
        this.selectElement(this.selectedElement);

        showToast('Imagem cortada com sucesso', 'success');
        this.saveHistory();
    },

    createExportMaskShape() {
        const shapeOutline = this.canvas.querySelector('#print-area-shape-outline');
        const maskShape = shapeOutline
            ? shapeOutline.cloneNode(true)
            : document.createElementNS('http://www.w3.org/2000/svg', 'rect');

        if (!shapeOutline) {
            const vb = this.getCanvasViewBoxSize();
            maskShape.setAttribute('x', '0');
            maskShape.setAttribute('y', '0');
            maskShape.setAttribute('width', String(vb.width));
            maskShape.setAttribute('height', String(vb.height));
        }

        maskShape.removeAttribute('id');
        maskShape.removeAttribute('pointer-events');
        maskShape.removeAttribute('opacity');
        maskShape.removeAttribute('stroke');
        maskShape.removeAttribute('stroke-width');
        maskShape.removeAttribute('stroke-dasharray');
        maskShape.setAttribute('fill', '#ffffff');

        return maskShape;
    },

    getDesignSVG() {
        const vb = this.getCanvasViewBoxSize();
        const exportWidth = Math.max(1, Math.round(vb.width));
        const exportHeight = Math.max(1, Math.round(vb.height));

        const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
        exportSvg.setAttribute('width', String(exportWidth));
        exportSvg.setAttribute('height', String(exportHeight));
        exportSvg.setAttribute('preserveAspectRatio', 'none');

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', 'design-export-clip');
        clipPath.appendChild(this.createExportMaskShape());
        defs.appendChild(clipPath);
        exportSvg.appendChild(defs);

        const clippedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        clippedGroup.setAttribute('clip-path', 'url(#design-export-clip)');

        Array.from(this.canvas.children)
            .filter((node) => {
                const id = node.getAttribute('id');
                return id !== 'print-area-outline' && id !== 'print-area-shape-outline' && id !== 'print-area-outside-overlay' && id !== 'print-area-outside-grid';
            })
            .forEach((node) => {
                clippedGroup.appendChild(node.cloneNode(true));
            });

        exportSvg.appendChild(clippedGroup);
        return new XMLSerializer().serializeToString(exportSvg);
    },

    // ===== ADD TO CART =====
    addToCart(designOverride = null) {
        const design = designOverride || this.getDesignSVG();

        if (!design && this.elements.length === 0) {
            showToast('Adicione pelo menos um elemento ao design', 'warning');
            return;
        }

        const cart = this.getCartData();
        const targetIndex = this.resolveEditingCartIndex(cart);

        const existingCartItem = targetIndex >= 0 ? cart[targetIndex] : null;
        const designId = (existingCartItem?.designId || existingCartItem?.design_id || this.editDesignId || `dsg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const selectedBase = this.getSelectedBaseOption();
        const selectedBaseExtra = Number(selectedBase?.preco_extra_aplicado || 0);
        const finalPrice = Number(this.currentProduct.preco || 0) + selectedBaseExtra;

        const cartItem = {
            id: this.currentProduct.id,
            nome: this.currentProduct.nome,
            preco: Number(finalPrice.toFixed(2)),
            imagem: this.currentProduct.imagem,
            quantity: Math.max(1, Number.parseInt(existingCartItem?.quantity ?? 1, 10) || 1),
            customized: true,
            designId,
            design: design,
            designPreview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(design)}`,
            baseId: selectedBase ? Number(selectedBase.base_id) : null,
            baseNome: selectedBase ? String(selectedBase.base_nome || '') : null,
            baseImagem: selectedBase ? String(selectedBase.base_imagem || '') : null,
            basePrecoExtra: Number(selectedBaseExtra.toFixed(2))
        };

        if (targetIndex >= 0) {
            cart[targetIndex] = cartItem;
            showToast('Design atualizado no carrinho!', 'success');
        } else {
            cart.push(cartItem);
            showToast('Produto adicionado ao carrinho!', 'success');
        }

        this.saveCartData(cart);
        localStorage.removeItem(this.getAutosaveKey());
        this.getLegacyAutosaveKeys().forEach((key) => localStorage.removeItem(key));
        this.closeCartStepsModal();

        setTimeout(() => {
            window.location.href = '/produtos.html';
        }, 1000);
    }

});
