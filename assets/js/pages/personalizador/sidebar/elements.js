// ============================================================
// ELEMENTS DATA & EVENT SETUP
// ============================================================
Object.assign(DesignEditor.prototype, {

    isRectLikeShapeType(shapeType) {
        const normalized = String(shapeType || '').trim().toLowerCase();
        return ['rectangle', 'rounded', 'pill', 'line'].includes(normalized);
    },

    isPolygonShapeType(shapeType) {
        const normalized = String(shapeType || '').trim().toLowerCase();
        return ['triangle', 'diamond', 'star', 'hexagon', 'arrow'].includes(normalized);
    },

    buildElementDataFromNode(node, customId = null) {
        const tagName = node.tagName.toLowerCase();
        let type = 'shape';
        if (tagName === 'text') type = 'text';
        if (tagName === 'image') type = 'image';

        let shapeType = null;
        if (tagName === 'rect') shapeType = node.dataset.shapeType || 'rectangle';
        if (tagName === 'circle') shapeType = node.dataset.shapeType || 'circle';
        if (tagName === 'polygon') shapeType = node.dataset.shapeType || 'triangle';
        if (tagName === 'line') shapeType = node.dataset.shapeType || 'line';
        if (tagName === 'path') shapeType = node.dataset.shapeType || 'path';

        const data = {
            id: String(customId ?? node.dataset.elementId ?? (Date.now() + Math.random())),
            element: node,
            type,
            shapeType,
            rotation: 0,
            translateX: 0,
            translateY: 0
        };

        if (type === 'text') {
            const rawFromDataset = Object.prototype.hasOwnProperty.call(node.dataset || {}, 'rawContent')
                ? String(node.dataset.rawContent ?? '')
                : this.extractRawTextValueFromNode?.(node) ?? '';
            const capsLockEnabled = String(node.dataset.capsLock || 'false') === 'true';
            const renderedText = this.getRenderedTextValue?.(rawFromDataset, capsLockEnabled) ?? rawFromDataset;
            if (node.textContent !== renderedText) {
                node.textContent = renderedText;
            }
            const xAttr = parseFloat(node.getAttribute('x') || '0');
            const yAttr = parseFloat(node.getAttribute('y') || '0');
            const bbox = this.safeGetBBox?.(node, {
                x: Number.isFinite(xAttr) ? xAttr : 0,
                y: Number.isFinite(yAttr) ? yAttr : 0,
                width: 0,
                height: 0
            }) || node.getBBox();
            data.rawContent = rawFromDataset;
            data.content = rawFromDataset;
            data.font = node.getAttribute('font-family') || 'Arial';
            data.size = parseFloat(node.getAttribute('font-size') || '24');
            data.color = node.getAttribute('fill') || '#000000';
            data.bold = (node.getAttribute('font-weight') || 'normal') === 'bold';
            data.italic = (node.getAttribute('font-style') || 'normal') === 'italic';
            data.underline = String(node.getAttribute('text-decoration') || '').toLowerCase().includes('underline');
            data.capsLock = capsLockEnabled;
            data.textAnchor = node.getAttribute('text-anchor') || 'start';
            data.dominantBaseline = node.getAttribute('dominant-baseline') || '';
            data.x = Number.isFinite(xAttr) ? xAttr : bbox.x;
            data.y = Number.isFinite(yAttr) ? yAttr : bbox.y;
            data.width = bbox.width;
            data.height = bbox.height;
        }

        if (type === 'image') {
            data.opacity = parseFloat(node.getAttribute('opacity') || '1');
            data.src = node.getAttribute('href') || '';
            data.name = node.dataset.name || 'Imagem';
            data.imageKind = node.dataset.imageKind || 'image';
            data.originalSrc = node.dataset.originalSrc || '';
            data.qrContent = node.dataset.qrContent || '';
            data.qrColor = node.dataset.qrColor || '#111827';
            data.flipX = String(node.dataset.flipX || 'false') === 'true';
            data.flipY = String(node.dataset.flipY || 'false') === 'true';
            const preserveAspectRatio = String(node.getAttribute('preserveAspectRatio') || '').trim().toLowerCase();
            if (node.dataset.objectFit) {
                data.objectFit = String(node.dataset.objectFit).trim().toLowerCase();
            } else if (preserveAspectRatio.includes('slice')) {
                data.objectFit = 'cover';
            } else if (preserveAspectRatio.includes('meet')) {
                data.objectFit = 'contain';
            } else if (preserveAspectRatio === 'none') {
                data.objectFit = 'fill';
            } else {
                data.objectFit = 'contain';
            }
            data.x = parseFloat(node.getAttribute('x') || '0');
            data.y = parseFloat(node.getAttribute('y') || '0');
            data.width = parseFloat(node.getAttribute('width') || '0');
            data.height = parseFloat(node.getAttribute('height') || '0');
            data.baseX = parseFloat(node.dataset.baseX || String(data.x || 0));
            data.baseY = parseFloat(node.dataset.baseY || String(data.y || 0));
            data.baseWidth = parseFloat(node.dataset.baseWidth || String(data.width || 0));
            data.baseHeight = parseFloat(node.dataset.baseHeight || String(data.height || 0));
            try {
                data.cropData = node.dataset.cropData ? JSON.parse(node.dataset.cropData) : null;
            } catch {
                data.cropData = null;
            }
            try {
                data.cropSourceData = node.dataset.cropSourceData ? JSON.parse(node.dataset.cropSourceData) : null;
            } catch {
                data.cropSourceData = null;
            }
            data.fullWidth = Number(node.dataset.fullWidth || 0) || undefined;
            data.fullHeight = Number(node.dataset.fullHeight || 0) || undefined;
            data.cropData = this.normalizeCropSelectionData?.(data.cropData, data.cropSourceData, data.fullWidth, data.fullHeight) || data.cropData;

            if (!data.cropData && data.cropSourceData && data.fullWidth && data.fullHeight) {
                data.cropData = {
                    x: data.cropSourceData.x / data.fullWidth,
                    y: data.cropSourceData.y / data.fullHeight,
                    width: data.cropSourceData.width / data.fullWidth,
                    height: data.cropSourceData.height / data.fullHeight
                };
            }

            if (!data.cropSourceData && data.cropData && data.fullWidth && data.fullHeight) {
                data.cropSourceData = {
                    x: data.cropData.x * data.fullWidth,
                    y: data.cropData.y * data.fullHeight,
                    width: data.cropData.width * data.fullWidth,
                    height: data.cropData.height * data.fullHeight
                };
            }
        }

        if (type === 'shape') {
            data.fill = node.getAttribute('fill') || '#3b82f6';
            data.stroke = node.getAttribute('stroke') || '#000000';
            data.strokeWidth = parseFloat(node.getAttribute('stroke-width') || '0');

            if (shapeType === 'circle') {
                data.cx = parseFloat(node.getAttribute('cx') || '0');
                data.cy = parseFloat(node.getAttribute('cy') || '0');
                data.r = parseFloat(node.getAttribute('r') || '0');
                data.width = data.r * 2;
                data.height = data.r * 2;
            } else if (this.isPolygonShapeType?.(shapeType)) {
                const points = String(node.getAttribute('points') || '').trim();
                data.points = points;
                const bbox = node.getBBox();
                data.x = bbox.x;
                data.y = bbox.y;
                data.width = bbox.width;
                data.height = bbox.height;
            } else {
                const bbox = node.getBBox();
                data.x = parseFloat(node.getAttribute('x') || String(bbox.x || 0));
                data.y = parseFloat(node.getAttribute('y') || String(bbox.y || 0));
                data.width = parseFloat(node.getAttribute('width') || String(bbox.width || 0));
                data.height = parseFloat(node.getAttribute('height') || String(bbox.height || 0));
            }
        }

        const transform = node.getAttribute('transform') || '';
        const rotateMatch = transform.match(/rotate\(([-\d.]+)/);
        if (rotateMatch) data.rotation = parseFloat(rotateMatch[1]) || 0;
        const translateMatch = transform.trim().match(/^translate\(([-\d.]+)[,\s]+([-\d.]+)\)$/);
        if (translateMatch) {
            const translateX = parseFloat(translateMatch[1]) || 0;
            const translateY = parseFloat(translateMatch[2]) || 0;
            this.offsetElementGeometry(data, translateX, translateY);
        }

        data.translateX = 0;
        data.translateY = 0;
        this.applyElementRotation(data, data.rotation);

        return data;
    },

    syncElementMetadata(elementData) {
        if (!elementData?.element) return;

        elementData.element.dataset.elementId = String(elementData.id);

        if (elementData.type === 'image') {
            elementData.element.dataset.name = elementData.name || 'Imagem';
            elementData.element.dataset.imageKind = elementData.imageKind || 'image';
            if (elementData.objectFit) {
                elementData.element.dataset.objectFit = String(elementData.objectFit).trim().toLowerCase();
            } else {
                delete elementData.element.dataset.objectFit;
            }
            if (elementData.originalSrc) {
                elementData.element.dataset.originalSrc = elementData.originalSrc;
            } else {
                delete elementData.element.dataset.originalSrc;
            }
            if (Number.isFinite(Number(elementData.baseX))) {
                elementData.element.dataset.baseX = String(elementData.baseX);
            } else {
                delete elementData.element.dataset.baseX;
            }
            if (Number.isFinite(Number(elementData.baseY))) {
                elementData.element.dataset.baseY = String(elementData.baseY);
            } else {
                delete elementData.element.dataset.baseY;
            }
            if (Number.isFinite(Number(elementData.baseWidth))) {
                elementData.element.dataset.baseWidth = String(elementData.baseWidth);
            } else {
                delete elementData.element.dataset.baseWidth;
            }
            if (Number.isFinite(Number(elementData.baseHeight))) {
                elementData.element.dataset.baseHeight = String(elementData.baseHeight);
            } else {
                delete elementData.element.dataset.baseHeight;
            }
            if (elementData.cropData) {
                const normalizedCropData = this.normalizeCropSelectionData?.(elementData.cropData, elementData.cropSourceData, elementData.fullWidth, elementData.fullHeight) || elementData.cropData;
                elementData.element.dataset.cropData = JSON.stringify(normalizedCropData);
            } else {
                delete elementData.element.dataset.cropData;
            }
            if (Number.isFinite(Number(elementData.fullWidth))) {
                elementData.element.dataset.fullWidth = String(elementData.fullWidth);
            } else {
                delete elementData.element.dataset.fullWidth;
            }
            if (Number.isFinite(Number(elementData.fullHeight))) {
                elementData.element.dataset.fullHeight = String(elementData.fullHeight);
            } else {
                delete elementData.element.dataset.fullHeight;
            }
            if (elementData.cropSourceData) {
                elementData.element.dataset.cropSourceData = JSON.stringify(elementData.cropSourceData);
            } else {
                delete elementData.element.dataset.cropSourceData;
            }

            if (elementData.qrContent) {
                elementData.element.dataset.qrContent = elementData.qrContent;
            } else {
                delete elementData.element.dataset.qrContent;
            }

            if (elementData.qrColor) {
                elementData.element.dataset.qrColor = elementData.qrColor;
            } else {
                delete elementData.element.dataset.qrColor;
            }

            elementData.element.dataset.flipX = elementData.flipX ? 'true' : 'false';
            elementData.element.dataset.flipY = elementData.flipY ? 'true' : 'false';
        } else if (elementData.type === 'text') {
            if (elementData.rawContent != null) {
                elementData.element.dataset.rawContent = String(elementData.rawContent);
            } else {
                delete elementData.element.dataset.rawContent;
            }
            if (typeof elementData.capsLock === 'boolean') {
                elementData.element.dataset.capsLock = elementData.capsLock ? 'true' : 'false';
            } else {
                delete elementData.element.dataset.capsLock;
            }
        }
    },

    buildSerializableElementData(elementData) {
        if (!elementData?.element) return null;

        const serializable = {
            ...elementData
        };
        delete serializable.element;

        if (elementData.type === 'text') {
            const x = parseFloat(elementData.element.getAttribute('x') || String(elementData.x ?? 0));
            const y = parseFloat(elementData.element.getAttribute('y') || String(elementData.y ?? 0));
            const rawText = this.extractRawTextValueFromNode?.(elementData.element) ?? String(elementData.rawContent ?? '');
            const bbox = this.safeGetBBox?.(elementData.element, {
                x: Number.isFinite(x) ? x : Number(elementData.x) || 0,
                y: Number.isFinite(y) ? y : Number(elementData.y) || 0,
                width: Number(elementData.width) || 0,
                height: Number(elementData.height) || 0
            });

            serializable.rawContent = rawText;
            serializable.content = rawText;
            serializable.x = Number.isFinite(x) ? x : (bbox?.x ?? 0);
            serializable.y = Number.isFinite(y) ? y : (bbox?.y ?? 0);
            serializable.width = (bbox?.width ?? Number(elementData.width)) || 0;
            serializable.height = (bbox?.height ?? Number(elementData.height)) || 0;
            serializable.textAnchor = elementData.element.getAttribute('text-anchor') || elementData.textAnchor || 'start';
            serializable.dominantBaseline = elementData.element.getAttribute('dominant-baseline') || elementData.dominantBaseline || '';
        } else if (elementData.type === 'image' || (elementData.type === 'shape' && this.isRectLikeShapeType?.(elementData.shapeType))) {
            const x = parseFloat(elementData.element.getAttribute('x') || String(elementData.x ?? 0));
            const y = parseFloat(elementData.element.getAttribute('y') || String(elementData.y ?? 0));
            const width = parseFloat(elementData.element.getAttribute('width') || String(elementData.width ?? 0));
            const height = parseFloat(elementData.element.getAttribute('height') || String(elementData.height ?? 0));
            serializable.x = Number.isFinite(x) ? x : (Number(elementData.x) || 0);
            serializable.y = Number.isFinite(y) ? y : (Number(elementData.y) || 0);
            serializable.width = Number.isFinite(width) ? width : (Number(elementData.width) || 0);
            serializable.height = Number.isFinite(height) ? height : (Number(elementData.height) || 0);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            const cx = parseFloat(elementData.element.getAttribute('cx') || String(elementData.x ?? 0));
            const cy = parseFloat(elementData.element.getAttribute('cy') || String(elementData.y ?? 0));
            const radius = parseFloat(elementData.element.getAttribute('r') || String(elementData.radius ?? 0));
            serializable.x = Number.isFinite(cx) ? cx : (Number(elementData.x) || 0);
            serializable.y = Number.isFinite(cy) ? cy : (Number(elementData.y) || 0);
            serializable.radius = Number.isFinite(radius) ? radius : (Number(elementData.radius) || 0);
        }

        return serializable;
    },

    async loadExistingDesign(index) {
        if (window.cartHydrationPromise) {
            await window.cartHydrationPromise;
        }

        const cart = this.getCartData();
        let targetIndex = Number.isInteger(index) ? index : -1;

        if (this.editDesignId) {
            const byDesignId = cart.findIndex((item) => String(item?.designId || item?.design_id || '') === String(this.editDesignId));
            if (byDesignId >= 0) {
                targetIndex = byDesignId;
            }
        }

        let sourceItem = targetIndex >= 0 ? cart[targetIndex] : null;

        if (sourceItem && !sourceItem.design && window.CartAssetStore?.hydrateCartItems) {
            const hydrated = await window.CartAssetStore.hydrateCartItems([sourceItem]);
            sourceItem = hydrated[0] || sourceItem;
        }

        if (targetIndex >= 0 && sourceItem && sourceItem.design) {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(sourceItem.design, 'image/svg+xml');
                const designElements = svgDoc.documentElement.querySelectorAll('[data-editable="true"]');

                designElements.forEach(el => {
                    const imported = document.importNode(el, true);
                    this.canvas.appendChild(imported);
                    const elementData = this.buildElementDataFromNode(imported);

                    this.elements.push(elementData);
                    this.makeElementInteractive(elementData);
                });
                this.bringPrintAreaOverlaysToFront();

                this.updateLayers();
                this.saveHistory();

                this.editIndex = String(targetIndex);
                this.editDesignId = String(sourceItem.designId || sourceItem.design_id || this.editDesignId || '');
            } catch (error) {
                console.error('Error loading existing design:', error);
            }
        }
    },

    getImageObjectFitMode(elementData) {
        if (!elementData?.element || elementData.type !== 'image') {
            return null;
        }

        const datasetFit = String(elementData.element.dataset.objectFit || elementData.objectFit || '').trim().toLowerCase();
        if (datasetFit) {
            return datasetFit;
        }

        const preserveAspectRatio = String(elementData.element.getAttribute('preserveAspectRatio') || '').trim().toLowerCase();
        if (preserveAspectRatio.includes('slice')) return 'cover';
        if (preserveAspectRatio.includes('meet')) return 'contain';
        if (preserveAspectRatio === 'none') return 'fill';
        return 'contain';
    },

    setImageObjectFitMode(elementData, objectFit) {
        if (!elementData?.element || elementData.type !== 'image') return;

        const normalized = String(objectFit || '').trim().toLowerCase();
        const nextFit = normalized === 'fill' || normalized === 'cover' || normalized === 'contain'
            ? normalized
            : 'contain';

        const nextPreserveAspectRatio = nextFit === 'fill'
            ? 'none'
            : nextFit === 'cover'
                ? 'xMidYMid slice'
                : 'xMidYMid meet';

        elementData.objectFit = nextFit;
        elementData.element.dataset.objectFit = nextFit;
        elementData.element.setAttribute('preserveAspectRatio', nextPreserveAspectRatio);
    },

    loadAutosaveDesign() {
        const autosave = localStorage.getItem(this.getAutosaveKey()) || this.getLegacyAutosaveKeys()
            .map((key) => localStorage.getItem(key))
            .find(Boolean);
        if (!autosave) return;

        try {
            const trimmed = String(autosave).trim();
            if (trimmed.startsWith('{')) {
                const parsed = JSON.parse(trimmed);
                if (parsed && parsed.format === 'elements-v1' && Array.isArray(parsed.elements)) {
                    this.clearCanvas?.();
                    parsed.elements.forEach((savedElement) => {
                        this.createElementFromTemplate?.(savedElement);
                    });
                    if (Number.isFinite(Number(parsed.selectedBaseId))) {
                        this.selectedBaseId = Number(parsed.selectedBaseId);
                    }
                    this.bringPrintAreaOverlaysToFront();

                    if (this.elements.length > 0) {
                        this.updateLayers();
                        showToast('Design recuperado automaticamente', 'info');
                        this.saveHistory();
                    }
                    return;
                }
            }

            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(trimmed, 'image/svg+xml');
            const designElements = svgDoc.documentElement.querySelectorAll('[data-editable="true"]');

            designElements.forEach(el => {
                const imported = document.importNode(el, true);
                this.canvas.appendChild(imported);
                const elementData = this.buildElementDataFromNode(imported);

                this.elements.push(elementData);
                this.makeElementInteractive(elementData);
            });
            this.bringPrintAreaOverlaysToFront();

            if (this.elements.length > 0) {
                this.updateLayers();
                showToast('Design recuperado automaticamente', 'info');
                this.saveHistory();
            }
        } catch (error) {
            console.warn('Falha ao recuperar autosave:', error);
        }
    },

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Add elements
        document.getElementById('add-text-btn').addEventListener('click', () => this.executeEditorCommand('add-text'));
        document.getElementById('add-image-btn').addEventListener('click', () => {
            this.executeEditorCommand('add-image');
        });
        document.getElementById('image-upload').addEventListener('change', (e) => this.handleImageUpload(e));
        const addQrBtn = document.getElementById('add-qr-btn');
        if (addQrBtn) {
            addQrBtn.addEventListener('click', () => this.executeEditorCommand('add-qr'));
        }

        // Shapes
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', () => this.executeEditorCommand('add-shape', btn.dataset.shape));
        });

        // Zoom
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.executeEditorCommand('zoom-in'));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.executeEditorCommand('zoom-out'));

        // Undo/Redo
        document.getElementById('undo-btn').addEventListener('click', () => this.executeEditorCommand('undo'));
        document.getElementById('redo-btn').addEventListener('click', () => this.executeEditorCommand('redo'));

        // Add to cart / Save design (admin mode)
        document.getElementById('add-to-cart-btn').addEventListener('click', () => this.executeEditorCommand('add-to-cart'));
        const closeEditorLink = document.getElementById('close-editor-btn');
        if (closeEditorLink) {
            closeEditorLink.addEventListener('click', async (event) => {
                event.preventDefault();

                const targetHref = closeEditorLink.getAttribute('href') || '/produtos';
                const clearAutosaveAndExit = () => {
                    const saveKeys = [this.getAutosaveKey?.(), ...(this.getLegacyAutosaveKeys?.() || [])]
                        .filter(Boolean);
                    saveKeys.forEach((key) => localStorage.removeItem(key));
                    window.location.href = targetHref;
                };

                if (!Array.isArray(this.elements) || this.elements.length === 0) {
                    clearAutosaveAndExit();
                    return;
                }

                const askExitAction = () => new Promise((resolve) => {
                    const modal = document.getElementById('exit-editor-modal');
                    const cancelBtn = document.getElementById('exit-editor-cancel');
                    const discardBtn = document.getElementById('exit-editor-discard');
                    const saveBtn = document.getElementById('exit-editor-save');

                    if (!modal || !cancelBtn || !discardBtn || !saveBtn) {
                        const shouldSaveFallback = window.confirm(
                            'Quer guardar este design no carrinho antes de sair? Pode sempre alterar mais tarde.\n\nOK = Guardar no carrinho\nCancelar = Descartar design'
                        );
                        resolve(shouldSaveFallback ? 'save' : 'discard');
                        return;
                    }

                    const cleanup = () => {
                        modal.classList.add('hidden');
                        modal.setAttribute('aria-hidden', 'true');
                        document.removeEventListener('keydown', onKeyDown, true);
                        modal.removeEventListener('click', onBackdropClick, true);
                        cancelBtn.removeEventListener('click', onCancel);
                        discardBtn.removeEventListener('click', onDiscard);
                        saveBtn.removeEventListener('click', onSave);
                    };

                    const finish = (action) => {
                        cleanup();
                        resolve(action);
                    };

                    const onCancel = () => finish('cancel');
                    const onDiscard = () => finish('discard');
                    const onSave = () => finish('save');
                    const onBackdropClick = (clickEvent) => {
                        if (clickEvent.target === modal) {
                            finish('cancel');
                        }
                    };
                    const onKeyDown = (keyEvent) => {
                        if (keyEvent.key === 'Escape') {
                            keyEvent.preventDefault();
                            finish('cancel');
                        }
                    };

                    cancelBtn.addEventListener('click', onCancel);
                    discardBtn.addEventListener('click', onDiscard);
                    saveBtn.addEventListener('click', onSave);
                    modal.addEventListener('click', onBackdropClick, true);
                    document.addEventListener('keydown', onKeyDown, true);
                    modal.classList.remove('hidden');
                    modal.setAttribute('aria-hidden', 'false');
                });

                const exitAction = await askExitAction();

                if (exitAction === 'save') {
                    this.executeEditorCommand('add-to-cart');
                    return;
                }

                if (exitAction === 'discard') {
                    clearAutosaveAndExit();
                }
            });
        }

        // Delete element
        const deleteElementBtn = document.getElementById('delete-element-btn');
        if (deleteElementBtn) deleteElementBtn.addEventListener('click', () => this.executeEditorCommand('delete'));

        // Quick actions
        const duplicateBtn = document.getElementById('duplicate-element-btn');
        if (duplicateBtn) duplicateBtn.addEventListener('click', () => this.executeEditorCommand('duplicate'));

        const centerHBtn = document.getElementById('center-h-btn');
        if (centerHBtn) centerHBtn.addEventListener('click', () => this.executeEditorCommand('center-horizontal'));

        const centerVBtn = document.getElementById('center-v-btn');
        if (centerVBtn) centerVBtn.addEventListener('click', () => this.executeEditorCommand('center-vertical'));
        const centerBothBtn = document.getElementById('center-both-btn');
        if (centerBothBtn) centerBothBtn.addEventListener('click', () => this.centerSelectedBoth?.());

        const moveLayerUpBtn = document.getElementById('move-layer-up-btn');
        if (moveLayerUpBtn) moveLayerUpBtn.addEventListener('click', () => this.moveSelectedLayer?.(1));
        const moveLayerDownBtn = document.getElementById('move-layer-down-btn');
        if (moveLayerDownBtn) moveLayerDownBtn.addEventListener('click', () => this.moveSelectedLayer?.(-1));

        const nudgeStep = 2;
        const nudgeUpBtn = document.getElementById('nudge-up-btn');
        if (nudgeUpBtn) nudgeUpBtn.addEventListener('click', () => this.nudgeSelected?.(0, -nudgeStep));
        const nudgeLeftBtn = document.getElementById('nudge-left-btn');
        if (nudgeLeftBtn) nudgeLeftBtn.addEventListener('click', () => this.nudgeSelected?.(-nudgeStep, 0));
        const nudgeRightBtn = document.getElementById('nudge-right-btn');
        if (nudgeRightBtn) nudgeRightBtn.addEventListener('click', () => this.nudgeSelected?.(nudgeStep, 0));
        const nudgeDownBtn = document.getElementById('nudge-down-btn');
        if (nudgeDownBtn) nudgeDownBtn.addEventListener('click', () => this.nudgeSelected?.(0, nudgeStep));

        const quickDeleteBtn = document.getElementById('quick-delete-btn');
        if (quickDeleteBtn) quickDeleteBtn.addEventListener('click', () => this.executeEditorCommand('delete'));

        const quickDuplicateBtn = document.getElementById('quick-duplicate-btn');
        if (quickDuplicateBtn) quickDuplicateBtn.addEventListener('click', () => this.executeEditorCommand('duplicate'));

        const quickCenterHBtn = document.getElementById('quick-center-h-btn');
        if (quickCenterHBtn) quickCenterHBtn.addEventListener('click', () => this.executeEditorCommand('center-horizontal'));

        const quickCenterVBtn = document.getElementById('quick-center-v-btn');
        if (quickCenterVBtn) quickCenterVBtn.addEventListener('click', () => this.executeEditorCommand('center-vertical'));

        const topDeleteBtn = document.getElementById('top-delete-btn');
        if (topDeleteBtn) topDeleteBtn.addEventListener('click', () => this.executeEditorCommand('delete'));

        const topDuplicateBtn = document.getElementById('top-duplicate-btn');
        if (topDuplicateBtn) topDuplicateBtn.addEventListener('click', () => this.executeEditorCommand('duplicate'));

        const topCenterHBtn = document.getElementById('top-center-h-btn');
        if (topCenterHBtn) topCenterHBtn.addEventListener('click', () => this.executeEditorCommand('center-horizontal'));

        const topCenterVBtn = document.getElementById('top-center-v-btn');
        if (topCenterVBtn) topCenterVBtn.addEventListener('click', () => this.executeEditorCommand('center-vertical'));

        const keepAspectButtons = [
            document.getElementById('keep-aspect-ratio'),
            document.getElementById('quick-keep-aspect-btn'),
            document.getElementById('top-keep-aspect-btn')
        ].filter(Boolean);
        keepAspectButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.executeEditorCommand('toggle-keep-aspect');
            });
        });

        // Canvas interactions
        this._lastTouchInteractionAt = 0;
        const isRecentTouch = () => (Date.now() - (this._lastTouchInteractionAt || 0)) < 700;

        this._activeGestureTouchId = null;

        this.canvas.addEventListener('mousedown', (e) => {
            if (isRecentTouch()) return;
            this.handleCanvasMouseDown(e);
        });
        document.addEventListener('mousedown', (e) => {
            if (isRecentTouch()) return;
            this.handleDocumentMouseDown(e);
        });
        document.addEventListener('mousemove', (e) => {
            if (isRecentTouch()) return;
            this.handleMouseMove(e);
        });
        document.addEventListener('mouseup', () => {
            this.handleMouseUp('mouse');
        });
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        const syncViewportAndHandles = () => {
            this._lastViewportStageWidth = null;
            this._lastViewportStageHeight = null;
            this._templateLayoutNeedsReflow = true;
            this.updateSidebarMode?.();
            this.syncCanvasViewport();
            if (this.selectedElement) {
                this.requestHandlesRefresh?.();
            }
        };

        window.addEventListener('resize', syncViewportAndHandles);

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncViewportAndHandles, { passive: true });
            window.visualViewport.addEventListener('scroll', syncViewportAndHandles, { passive: true });
        }

        // ResizeObserver: recalcula canvas quando o stage muda de tamanho
        if (this.canvasStage && typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => {
                syncViewportAndHandles();
            }).observe(this.canvasStage);
        }

        // Pinch-to-zoom no canvas-stage (mobile)
        let _pinchDist0 = null;
        let _pinchZoom0 = 1;
        const stage = this.canvasStage;
        if (stage) {
            const getPinchDistance = (touches) => Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            const getPinchCenter = (touches) => ({
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            });
            const shouldStartCameraPan = (event) => {
                const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
                if (isMobileViewport) {
                    if ((Number(this.zoom) || 1) <= 1.01) return false;
                } else if (event.button != null && event.button !== 0) {
                    return false;
                }
                if (this.isDragging || this.isResizing || this.isRotating || this.cropMode || this.isPinchZooming) return false;
                const target = event.target;
                if (!(target instanceof Element)) return false;
                if (target.closest('.resize-handle, .rotate-handle')) return false;
                if (target.closest('[data-editable="true"]')) return false;
                if (target.closest('button, input, select, textarea, label, a')) return false;
                return true;
            };

            stage.addEventListener('mousedown', (event) => {
                if (!shouldStartCameraPan(event)) return;
                if (this.selectedElement && this.isCanvasBackgroundClickTarget?.(event.target)) {
                    this.clearSelection();
                }
                event.preventDefault();
                event.stopPropagation();
                this.isPanningCamera = true;
                this.cameraPanStart = {
                    clientX: event.clientX,
                    clientY: event.clientY,
                    offsetX: Number(this.cameraOffset?.x) || 0,
                    offsetY: Number(this.cameraOffset?.y) || 0
                };
                stage.classList.add('is-camera-panning');
                document.body.classList.add('is-camera-panning');
            }, true);

            stage.addEventListener('wheel', (event) => {
                if (window.matchMedia('(max-width: 767px)').matches) return;
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                event.preventDefault();
                const delta = Number(event.deltaY) || 0;
                const zoomStep = delta < 0 ? 0.08 : -0.08;
                this.setZoom((Number(this.zoom) || 1) + zoomStep, {
                    clientX: event.clientX,
                    clientY: event.clientY
                });
            }, { passive: false });

            stage.addEventListener('touchstart', (e) => {
                if (e.touches.length >= 2) {
                    this._lastTouchInteractionAt = Date.now();
                    this.isPinchZooming = true;
                    _pinchDist0 = getPinchDistance(e.touches);
                    _pinchZoom0 = Number(this.zoom) || 1;
                    if (this.isDragging || this.isResizing || this.isRotating || this.isPanningCamera) {
                        this.handleMouseUp('touch');
                    }
                    this._touchGestureActive = false;
                    this._activeGestureTouchId = null;
                    e.preventDefault();
                    return;
                }
                if (e.touches.length === 1 && shouldStartCameraPan(e)) {
                    if (this.selectedElement && this.isCanvasBackgroundClickTarget?.(e.target)) {
                        this.clearSelection();
                    }
                    const t = e.touches[0];
                    this._lastTouchInteractionAt = Date.now();
                    this._touchGestureActive = true;
                    this._activeGestureTouchId = t.identifier;
                    this.isPanningCamera = true;
                    this.cameraPanStart = {
                        clientX: t.clientX,
                        clientY: t.clientY,
                        offsetX: Number(this.cameraOffset?.x) || 0,
                        offsetY: Number(this.cameraOffset?.y) || 0
                    };
                    stage.classList.add('is-camera-panning');
                    document.body.classList.add('is-camera-panning');
                    e.preventDefault();
                    return;
                }
            }, { passive: false });
            stage.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && _pinchDist0) {
                    this.isPinchZooming = true;
                    e.preventDefault();
                    const d = getPinchDistance(e.touches);
                    const center = getPinchCenter(e.touches);
                    this.setZoom(_pinchZoom0 * (d / _pinchDist0), {
                        clientX: center.x,
                        clientY: center.y
                    });
                    if (this.selectedElement) {
                        this.requestHandlesRefresh?.();
                    }
                }
            }, { passive: false });
            stage.addEventListener('touchend', (e) => {
                if (e.touches.length === 2) {
                    _pinchDist0 = getPinchDistance(e.touches);
                    _pinchZoom0 = Number(this.zoom) || 1;
                    this.isPinchZooming = true;
                    return;
                }
                if (e.touches.length < 2) {
                    _pinchDist0 = null;
                    _pinchZoom0 = Number(this.zoom) || 1;
                    this.isPinchZooming = false;
                }
            }, { passive: true });
        }

        // ===== TOUCH SUPPORT =====
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            this._lastTouchInteractionAt = Date.now();
            this._touchGestureActive = true;
            this._activeGestureTouchId = e.touches[0].identifier;
            e.preventDefault();
            const t = e.touches[0];
            this.handleCanvasMouseDown({ target: e.target, clientX: t.clientX, clientY: t.clientY, preventDefault: () => { } });
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            this._lastTouchInteractionAt = Date.now();
            if (this.isPinchZooming || e.touches.length >= 2) {
                return;
            }
            if (this.isDragging || this.isResizing || this.isRotating || this.isPanningCamera) {
                const trackedTouch = Array.from(e.touches).find((touch) => touch.identifier === this._activeGestureTouchId)
                    || (e.touches.length > 0 ? e.touches[0] : null);
                if (!trackedTouch) return;
                e.preventDefault();
                this._touchGestureActive = true;
                this.handleMouseMove({ clientX: trackedTouch.clientX, clientY: trackedTouch.clientY, shiftKey: false });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            this._lastTouchInteractionAt = Date.now();
            if (this.isPinchZooming && e.touches.length >= 1) {
                this._touchGestureActive = false;
                this._activeGestureTouchId = null;
                return;
            }
            if (this.isDragging || this.isResizing || this.isRotating || this.isPanningCamera) {
                const releasedTrackedTouch = Array.from(e.changedTouches).find((touch) => touch.identifier === this._activeGestureTouchId);
                if (releasedTrackedTouch) {
                    this.handleMouseUp('touch', { clientX: releasedTrackedTouch.clientX, clientY: releasedTrackedTouch.clientY });
                } else if (e.touches.length === 0) {
                    this.handleMouseUp('touch');
                } else {
                    return;
                }
            }
            if (e.touches.length === 0) {
                this.isPinchZooming = false;
            }
            this._touchGestureActive = false;
            this._activeGestureTouchId = null;
        }, { passive: false });

        document.addEventListener('touchcancel', () => {
            this._lastTouchInteractionAt = Date.now();
            if (this.isDragging || this.isResizing || this.isRotating || this.isPanningCamera) {
                this.handleMouseUp('touch');
            }
            this.isPinchZooming = false;
            this._touchGestureActive = false;
            this._activeGestureTouchId = null;
        }, { passive: false });

        // Paste image (Ctrl+V)
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // Drag & drop image onto the canvas area
        const canvasStage = document.getElementById('canvas-stage');
        if (canvasStage) {
            canvasStage.addEventListener('dragover', (e) => this.handleDragOver(e));
            canvasStage.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            canvasStage.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // Templates button
        const templatesBtn = document.getElementById('templates-btn');
        if (templatesBtn) {
            templatesBtn.addEventListener('click', () => this.openTemplateModal());
        }

        // Property controls
        this.setupPropertyControls();
        this.setupUploadCropModalListeners();
        this.setupCartStepsModalListeners();
    },

    setupPropertyControls() {
        // Text properties
        const textContent = document.getElementById('prop-text-content');
        const textFont = document.getElementById('prop-text-font');
        const quickFontBtn = document.getElementById('quick-font-btn');
        const textSize = document.getElementById('prop-text-size');
        const textColor = document.getElementById('prop-text-color');
        const textBold = document.getElementById('prop-text-bold');
        const textItalic = document.getElementById('prop-text-italic');
        const textUnderline = document.getElementById('prop-text-underline');
        const textCaps = document.getElementById('prop-text-caps');

        if (textContent) textContent.addEventListener('input', (e) => this.updateTextContent(e.target.value));
        if (textFont) textFont.addEventListener('change', (e) => this.updateTextFont(e.target.value));
        if (textSize) textSize.addEventListener('input', (e) => {
            this.updateTextSize(e.target.value);
            document.getElementById('prop-text-size-val').textContent = e.target.value;
        });
        if (textColor) textColor.addEventListener('input', (e) => this.updateTextColor(e.target.value));
        if (textBold) textBold.addEventListener('click', () => this.toggleTextBold());
        if (textItalic) textItalic.addEventListener('click', () => this.toggleTextItalic());
        if (textUnderline) textUnderline.addEventListener('click', () => this.updateTextUnderline(!this.selectedElement?.underline));
        if (textCaps) textCaps.addEventListener('click', () => this.toggleTextCapsLock());
        const quickTextContent = document.getElementById('quick-text-content');
        if (quickFontBtn) quickFontBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.executeEditorCommand('toggle-quick-font');
        });
        const quickFontSelect = document.getElementById('quick-font-select');
        const quickFontBoldBtn = document.getElementById('quick-font-bold-btn');
        const quickFontItalicBtn = document.getElementById('quick-font-italic-btn');
        const quickFontUnderlineBtn = document.getElementById('quick-font-underline-btn');
        const quickFontCapsBtn = document.getElementById('quick-font-caps-btn');
        const quickSizeDecreaseBtn = document.getElementById('quick-text-size-decrease');
        const quickSizeIncreaseBtn = document.getElementById('quick-text-size-increase');
        const topFontSelect = document.getElementById('top-font-select');
        const topFontBoldBtn = document.getElementById('top-font-bold-btn');
        const topFontItalicBtn = document.getElementById('top-font-italic-btn');
        const topFontUnderlineBtn = document.getElementById('top-font-underline-btn');
        const topFontCapsBtn = document.getElementById('top-font-caps-btn');
        const topSizeDecreaseBtn = document.getElementById('top-text-size-decrease');
        const topSizeIncreaseBtn = document.getElementById('top-text-size-increase');
        const desktopFontSelect = document.getElementById('desktop-font-select');
        const desktopFontBoldBtn = document.getElementById('desktop-font-bold-btn');
        const desktopFontItalicBtn = document.getElementById('desktop-font-italic-btn');
        const desktopFontUnderlineBtn = document.getElementById('desktop-font-underline-btn');
        const desktopFontCapsBtn = document.getElementById('desktop-font-caps-btn');
        const desktopSizeDecreaseBtn = document.getElementById('desktop-text-size-decrease');
        const desktopSizeIncreaseBtn = document.getElementById('desktop-text-size-increase');
        const desktopOpacityRange = document.getElementById('desktop-opacity-range');
        const topOpacityRange = document.getElementById('top-opacity-range');
        const topImageCropBtn = document.getElementById('top-image-crop-btn');
        const topImageFlipHBtn = document.getElementById('top-image-flip-h-btn');
        const topImageFlipVBtn = document.getElementById('top-image-flip-v-btn');
        const topQrContent = document.getElementById('top-qr-content');
        const topQrColor = document.getElementById('top-qr-color');
        const topQrEyedropper = document.getElementById('top-qr-eyedropper');
        const desktopTextColor = document.getElementById('desktop-text-color');
        const topTextColor = document.getElementById('top-text-color');
        const desktopTextEyedropper = document.getElementById('desktop-text-eyedropper');
        const topTextEyedropper = document.getElementById('top-text-eyedropper');
        const desktopShapeFillColor = document.getElementById('desktop-shape-fill-color');
        const desktopShapeFillEyedropper = document.getElementById('desktop-shape-fill-eyedropper');
        const desktopShapeStrokeColor = document.getElementById('desktop-shape-stroke-color');
        const desktopShapeStrokeEyedropper = document.getElementById('desktop-shape-stroke-eyedropper');
        const topShapeFillColor = document.getElementById('top-shape-fill-color');
        const topShapeFillEyedropper = document.getElementById('top-shape-fill-eyedropper');
        const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
        if (quickTextContent) quickTextContent.addEventListener('input', (e) => this.updateTextContent(e.target.value));
        if (quickFontSelect) quickFontSelect.addEventListener('change', (e) => this.selectQuickFontFamily(e.target.value));
        if (quickFontBoldBtn) quickFontBoldBtn.addEventListener('click', () => this.toggleTextBold());
        if (quickFontItalicBtn) quickFontItalicBtn.addEventListener('click', () => this.toggleTextItalic());
        if (quickFontUnderlineBtn) quickFontUnderlineBtn.addEventListener('click', () => this.updateTextUnderline(!this.selectedElement?.underline));
        if (quickFontCapsBtn) quickFontCapsBtn.addEventListener('click', () => this.toggleTextCapsLock());
        if (quickSizeDecreaseBtn) quickSizeDecreaseBtn.addEventListener('click', () => this.stepQuickTextSize(-1));
        if (quickSizeIncreaseBtn) quickSizeIncreaseBtn.addEventListener('click', () => this.stepQuickTextSize(1));
        if (topFontSelect) topFontSelect.addEventListener('change', (e) => this.selectQuickFontFamily(e.target.value));
        if (topFontBoldBtn) topFontBoldBtn.addEventListener('click', () => this.toggleTextBold());
        if (topFontItalicBtn) topFontItalicBtn.addEventListener('click', () => this.toggleTextItalic());
        if (topFontUnderlineBtn) topFontUnderlineBtn.addEventListener('click', () => this.updateTextUnderline(!this.selectedElement?.underline));
        if (topFontCapsBtn) topFontCapsBtn.addEventListener('click', () => this.toggleTextCapsLock());
        if (topSizeDecreaseBtn) topSizeDecreaseBtn.addEventListener('click', () => this.stepQuickTextSize(-1));
        if (topSizeIncreaseBtn) topSizeIncreaseBtn.addEventListener('click', () => this.stepQuickTextSize(1));
        if (desktopFontSelect) desktopFontSelect.addEventListener('change', (e) => this.selectQuickFontFamily(e.target.value));
        if (desktopFontBoldBtn) desktopFontBoldBtn.addEventListener('click', () => this.toggleTextBold());
        if (desktopFontItalicBtn) desktopFontItalicBtn.addEventListener('click', () => this.toggleTextItalic());
        if (desktopFontUnderlineBtn) desktopFontUnderlineBtn.addEventListener('click', () => this.updateTextUnderline(!this.selectedElement?.underline));
        if (desktopFontCapsBtn) desktopFontCapsBtn.addEventListener('click', () => this.toggleTextCapsLock());
        if (desktopSizeDecreaseBtn) desktopSizeDecreaseBtn.addEventListener('click', () => this.stepQuickTextSize(-1));
        if (desktopSizeIncreaseBtn) desktopSizeIncreaseBtn.addEventListener('click', () => this.stepQuickTextSize(1));
        if (desktopOpacityRange) desktopOpacityRange.addEventListener('input', (e) => this.applyQuickOpacityValue(e.target.value));
        if (topOpacityRange) topOpacityRange.addEventListener('input', (e) => this.applyQuickOpacityValue(e.target.value));
        if (topOpacityRange) {
            let topOpacityPointerId = null;
            let topOpacityDragging = false;
            let topOpacityTouchDragging = false;
            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const applyTopOpacityFromClientX = (clientX) => {
                const rect = topOpacityRange.getBoundingClientRect();
                if (!rect.width) return;
                const min = Number(topOpacityRange.min || 0);
                const max = Number(topOpacityRange.max || 100);
                const step = Math.max(1, Number(topOpacityRange.step || 1));
                const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
                const rawValue = min + ((max - min) * ratio);
                const stepped = Math.round(rawValue / step) * step;
                this.applyQuickOpacityValue(clamp(stepped, min, max));
            };

            topOpacityRange.style.touchAction = 'none';
            topOpacityRange.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                topOpacityDragging = true;
                topOpacityPointerId = event.pointerId;
                topOpacityRange.setPointerCapture?.(event.pointerId);
                applyTopOpacityFromClientX(event.clientX);
            }, true);

            topOpacityRange.addEventListener('pointermove', (event) => {
                if (!topOpacityDragging || event.pointerId !== topOpacityPointerId) return;
                event.preventDefault();
                event.stopPropagation();
                applyTopOpacityFromClientX(event.clientX);
            }, true);

            const releaseTopOpacityPointer = (event) => {
                if (!topOpacityDragging || event.pointerId !== topOpacityPointerId) return;
                event.preventDefault();
                event.stopPropagation();
                topOpacityDragging = false;
                topOpacityRange.releasePointerCapture?.(event.pointerId);
                topOpacityPointerId = null;
                applyTopOpacityFromClientX(event.clientX);
            };

            topOpacityRange.addEventListener('pointerup', releaseTopOpacityPointer, true);
            topOpacityRange.addEventListener('pointercancel', releaseTopOpacityPointer, true);
            topOpacityRange.addEventListener('lostpointercapture', () => {
                topOpacityDragging = false;
                topOpacityPointerId = null;
            });

            topOpacityRange.addEventListener('touchstart', (event) => {
                if (!event.touches?.length) return;
                event.preventDefault();
                event.stopPropagation();
                topOpacityTouchDragging = true;
                applyTopOpacityFromClientX(event.touches[0].clientX);
            }, { passive: false, capture: true });

            topOpacityRange.addEventListener('touchmove', (event) => {
                if (!topOpacityTouchDragging || !event.touches?.length) return;
                event.preventDefault();
                event.stopPropagation();
                applyTopOpacityFromClientX(event.touches[0].clientX);
            }, { passive: false, capture: true });

            const finishTopOpacityTouchDrag = (event) => {
                if (!topOpacityTouchDragging) return;
                event.preventDefault();
                event.stopPropagation();
                topOpacityTouchDragging = false;
                const touch = event.changedTouches?.[0];
                if (touch) {
                    applyTopOpacityFromClientX(touch.clientX);
                }
            };

            topOpacityRange.addEventListener('touchend', finishTopOpacityTouchDrag, { passive: false, capture: true });
            topOpacityRange.addEventListener('touchcancel', finishTopOpacityTouchDrag, { passive: false, capture: true });
        }
        if (topImageCropBtn) topImageCropBtn.addEventListener('click', () => this.startCropMode?.());
        if (topImageFlipHBtn) topImageFlipHBtn.addEventListener('click', () => this.toggleImageFlip?.('x'));
        if (topImageFlipVBtn) topImageFlipVBtn.addEventListener('click', () => this.toggleImageFlip?.('y'));
        if (desktopTextColor) desktopTextColor.addEventListener('input', (e) => this.updateTextColor(e.target.value));
        if (topTextColor) topTextColor.addEventListener('input', (e) => this.updateTextColor(e.target.value));
        if (desktopShapeFillColor) desktopShapeFillColor.addEventListener('input', (e) => this.updateShapeFill(e.target.value));
        if (desktopShapeStrokeColor) desktopShapeStrokeColor.addEventListener('input', (e) => this.updateShapeStroke(e.target.value));
        if (topShapeFillColor) topShapeFillColor.addEventListener('input', (e) => this.updateShapeFill(e.target.value));

        const bindEyeDropper = (button, input, onPick) => {
            if (!button || !input) return;
            if (!supportsEyeDropper) {
                button.disabled = true;
                button.classList.add('is-disabled');
                button.setAttribute('title', 'Pipeta nao suportada neste browser');
                return;
            }

            button.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    const eyeDropper = new window.EyeDropper();
                    const result = await eyeDropper.open();
                    const picked = this.sanitizeColorValue?.(result?.sRGBHex, input.value || '#000000') || input.value || '#000000';
                    input.value = picked;
                    if (typeof onPick === 'function') {
                        onPick(picked);
                    } else {
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch (error) {
                    if (error?.name !== 'AbortError') {
                        console.warn('EyeDropper falhou:', error);
                        showToast?.('Nao foi possivel capturar cor com a pipeta', 'error');
                    }
                }
            });
        };

        bindEyeDropper(desktopTextEyedropper, desktopTextColor, (color) => this.updateTextColor(color));
        bindEyeDropper(topTextEyedropper, topTextColor, (color) => this.updateTextColor(color));
        bindEyeDropper(desktopShapeFillEyedropper, desktopShapeFillColor, (color) => this.updateShapeFill(color));
        bindEyeDropper(desktopShapeStrokeEyedropper, desktopShapeStrokeColor, (color) => this.updateShapeStroke(color));
        bindEyeDropper(topShapeFillEyedropper, topShapeFillColor, (color) => this.updateShapeFill(color));
        bindEyeDropper(topQrEyedropper, topQrColor, (color) => this.updateQRCodeColor(color));

        const textRotation = document.getElementById('prop-text-rotation');
        if (textRotation) textRotation.addEventListener('input', (e) => {
            this.updateRotation(e.target.value);
            document.getElementById('prop-text-rotation-val').textContent = e.target.value;
        });

        // Image properties
        const imageOpacity = document.getElementById('prop-image-opacity');
        const quickOpacityBtn = document.getElementById('quick-opacity-btn');
        const quickOpacityShell = document.getElementById('quick-opacity-shell');
        if (imageOpacity) imageOpacity.addEventListener('input', (e) => {
            this.updateImageOpacity(e.target.value / 100);
            document.getElementById('prop-image-opacity-val').textContent = e.target.value;
        });
        const quickOpacityRange = document.getElementById('quick-opacity-range');
        if (quickOpacityBtn) quickOpacityBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.executeEditorCommand('toggle-quick-opacity');
        });

        if (quickOpacityRange) {
            quickOpacityRange.addEventListener('input', (e) => {
                this.applyQuickOpacityValue(e.target.value);
            });
        }

        const applyQuickOpacityFromPointer = (clientY, shouldApply = true) => {
            if (!quickOpacityShell) return;
            const rect = quickOpacityShell.getBoundingClientRect();
            if (!rect.height) return;
            const ratio = 1 - ((clientY - rect.top) / rect.height);
            const nextValue = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
            this.applyQuickOpacityValue(nextValue, shouldApply);
        };

        if (quickOpacityShell) {
            let quickOpacityPointerId = null;
            let quickOpacityDragging = false;

            quickOpacityShell.addEventListener('pointerdown', (event) => {
                if (event.button != null && event.button !== 0) return;
                if (!this.selectedElement || this.selectedElement.type !== 'image') return;
                event.preventDefault();
                event.stopPropagation();
                quickOpacityDragging = true;
                quickOpacityPointerId = event.pointerId;
                quickOpacityShell.setPointerCapture?.(event.pointerId);
                applyQuickOpacityFromPointer(event.clientY, true);
                this.openQuickOpacityPopover();
            }, true);

            quickOpacityShell.addEventListener('pointermove', (event) => {
                if (!quickOpacityDragging || event.pointerId !== quickOpacityPointerId) return;
                event.preventDefault();
                event.stopPropagation();
                applyQuickOpacityFromPointer(event.clientY, true);
            }, true);

            const finishOpacityDrag = (event) => {
                if (!quickOpacityDragging || event.pointerId !== quickOpacityPointerId) return;
                quickOpacityDragging = false;
                quickOpacityPointerId = null;
                try {
                    quickOpacityShell.releasePointerCapture?.(event.pointerId);
                } catch {
                    // ignore pointer capture errors
                }
            };

            quickOpacityShell.addEventListener('pointerup', finishOpacityDrag, true);
            quickOpacityShell.addEventListener('pointercancel', finishOpacityDrag, true);
        }

        if (quickOpacityBtn) quickOpacityBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleQuickOpacityPopover();
        });

        if (!this._quickToolbarPopoverDismissalBound) {
            document.addEventListener('pointerdown', (event) => {
                const fontAnchor = document.getElementById('quick-font-anchor');
                const fontPopover = document.getElementById('quick-font-popover');
                const anchor = document.getElementById('quick-opacity-anchor');
                const popover = document.getElementById('quick-opacity-popover');
                if (fontAnchor && fontPopover && fontPopover.classList.contains('is-open') && !fontAnchor.contains(event.target) && !fontPopover.contains(event.target)) {
                    this.closeQuickFontPopover();
                }
                if (!anchor || !popover || !popover.classList.contains('is-open') || anchor.contains(event.target)) return;
                this.closeQuickOpacityPopover();
            }, true);

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.closeQuickOpacityPopover();
                    this.closeQuickFontPopover();
                }
            });

            this._quickToolbarPopoverDismissalBound = true;
        }

        const qrContent = document.getElementById('prop-qr-content');
        if (qrContent) qrContent.addEventListener('input', (e) => this.updateQRCodeContent(e.target.value));

        const qrColor = document.getElementById('prop-qr-color');
        if (qrColor) qrColor.addEventListener('input', (e) => this.updateQRCodeColor(e.target.value));

        if (topQrContent) {
            let qrContentDebounce = null;
            topQrContent.addEventListener('input', (event) => {
                clearTimeout(qrContentDebounce);
                const nextValue = event.target.value;
                qrContentDebounce = window.setTimeout(() => {
                    this.updateQRCodeContent(nextValue);
                }, 160);
            });
        }

        if (topQrColor) {
            topQrColor.addEventListener('input', (event) => this.updateQRCodeColor(event.target.value));
        }

        const imageRotation = document.getElementById('prop-image-rotation');
        if (imageRotation) imageRotation.addEventListener('input', (e) => {
            this.updateRotation(e.target.value);
            document.getElementById('prop-image-rotation-val').textContent = e.target.value;
        });

        const imageFitContainBtn = document.getElementById('prop-image-fit-contain');
        const imageFitCoverBtn = document.getElementById('prop-image-fit-cover');
        const imageFitFillBtn = document.getElementById('prop-image-fit-fill');
        if (imageFitContainBtn) imageFitContainBtn.addEventListener('click', () => this.updateImageObjectFit?.('contain'));
        if (imageFitCoverBtn) imageFitCoverBtn.addEventListener('click', () => this.updateImageObjectFit?.('cover'));
        if (imageFitFillBtn) imageFitFillBtn.addEventListener('click', () => this.updateImageObjectFit?.('fill'));

        // Shape properties
        const shapeFill = document.getElementById('prop-shape-fill');
        const shapeStroke = document.getElementById('prop-shape-stroke');
        const shapeStrokeWidth = document.getElementById('prop-shape-stroke-width');

        if (shapeFill) shapeFill.addEventListener('input', (e) => this.updateShapeFill(e.target.value));
        if (shapeStroke) shapeStroke.addEventListener('input', (e) => this.updateShapeStroke(e.target.value));
        if (shapeStrokeWidth) shapeStrokeWidth.addEventListener('input', (e) => {
            this.updateShapeStrokeWidth(e.target.value);
            document.getElementById('prop-shape-stroke-val').textContent = e.target.value;
        });

        const shapeRotation = document.getElementById('prop-shape-rotation');
        if (shapeRotation) shapeRotation.addEventListener('input', (e) => {
            this.updateRotation(e.target.value);
            document.getElementById('prop-shape-rotation-val').textContent = e.target.value;
        });

        // Crop image button
        const cropBtn = document.getElementById('crop-image-btn');
        if (cropBtn) {
            cropBtn.addEventListener('click', () => this.startCropMode());
        }

        this.syncKeepAspectControls();
    }


});

