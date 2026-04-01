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
            const bbox = node.getBBox();
            data.rawContent = node.dataset.rawContent || node.textContent || '';
            data.content = node.textContent || '';
            data.font = node.getAttribute('font-family') || 'Arial';
            data.size = parseFloat(node.getAttribute('font-size') || '24');
            data.color = node.getAttribute('fill') || '#000000';
            data.bold = (node.getAttribute('font-weight') || 'normal') === 'bold';
            data.italic = (node.getAttribute('font-style') || 'normal') === 'italic';
            data.underline = String(node.getAttribute('text-decoration') || '').toLowerCase().includes('underline');
            data.capsLock = String(node.dataset.capsLock || 'false') === 'true';
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
        const translateMatch = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
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
        document.getElementById('add-text-btn').addEventListener('click', () => this.addText());
        document.getElementById('add-image-btn').addEventListener('click', () => {
            document.getElementById('image-upload')?.click();
        });
        document.getElementById('image-upload').addEventListener('change', (e) => this.handleImageUpload(e));
        const addQrBtn = document.getElementById('add-qr-btn');
        if (addQrBtn) {
            addQrBtn.addEventListener('click', () => this.handleAddQRCode());
        }

        // Shapes
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', () => this.addShape(btn.dataset.shape));
        });

        // Zoom
        document.getElementById('zoom-in').addEventListener('click', () => this.setZoom(this.zoom + 0.1));
        document.getElementById('zoom-out').addEventListener('click', () => this.setZoom(this.zoom - 0.1));

        // Undo/Redo
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Add to cart / Save design (admin mode)
        document.getElementById('add-to-cart-btn').addEventListener('click', () => {
            if (this.isAdminMode) {
                this.saveDesignAsTemplate();
            } else {
                this.openCartStepsModal();
            }
        });

        // Delete element
        document.getElementById('delete-element-btn').addEventListener('click', () => this.deleteSelected());

        // Quick actions
        const duplicateBtn = document.getElementById('duplicate-element-btn');
        if (duplicateBtn) duplicateBtn.addEventListener('click', () => this.duplicateSelected());

        const centerHBtn = document.getElementById('center-h-btn');
        if (centerHBtn) centerHBtn.addEventListener('click', () => this.centerSelected('horizontal'));

        const centerVBtn = document.getElementById('center-v-btn');
        if (centerVBtn) centerVBtn.addEventListener('click', () => this.centerSelected('vertical'));

        const quickDeleteBtn = document.getElementById('quick-delete-btn');
        if (quickDeleteBtn) quickDeleteBtn.addEventListener('click', () => this.deleteSelected());

        const quickDuplicateBtn = document.getElementById('quick-duplicate-btn');
        if (quickDuplicateBtn) quickDuplicateBtn.addEventListener('click', () => this.duplicateSelected());

        const quickCenterHBtn = document.getElementById('quick-center-h-btn');
        if (quickCenterHBtn) quickCenterHBtn.addEventListener('click', () => this.centerSelected('horizontal'));

        const quickCenterVBtn = document.getElementById('quick-center-v-btn');
        if (quickCenterVBtn) quickCenterVBtn.addEventListener('click', () => this.centerSelected('vertical'));

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
        window.addEventListener('resize', () => {
            this._lastViewportStageWidth = null;
            this._lastViewportStageHeight = null;
            this._templateLayoutNeedsReflow = true;
            this.syncCanvasViewport();
        });

        // ResizeObserver: recalcula canvas quando o stage muda de tamanho
        if (this.canvasStage && typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => {
                this._lastViewportStageWidth = null;
                this._lastViewportStageHeight = null;
                this._templateLayoutNeedsReflow = true;
                this.syncCanvasViewport();
            }).observe(this.canvasStage);
        }

        // Pinch-to-zoom no canvas-stage (mobile)
        let _pinchDist0 = null;
        let _pinchZoom0 = 1;
        const stage = this.canvasStage;
        if (stage) {
            stage.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    _pinchDist0 = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    _pinchZoom0 = this.zoom;
                }
            }, { passive: true });
            stage.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && _pinchDist0) {
                    e.preventDefault();
                    const d = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    this.setZoom(_pinchZoom0 * (d / _pinchDist0));
                }
            }, { passive: false });
            stage.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) _pinchDist0 = null;
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
            if (this.isDragging || this.isResizing || this.isRotating) {
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
            if (this.isDragging || this.isResizing || this.isRotating) {
                const releasedTrackedTouch = Array.from(e.changedTouches).find((touch) => touch.identifier === this._activeGestureTouchId);
                if (!releasedTrackedTouch) return;
                this.handleMouseUp('touch', { clientX: releasedTrackedTouch.clientX, clientY: releasedTrackedTouch.clientY });
            }
            this._touchGestureActive = false;
            this._activeGestureTouchId = null;
        }, { passive: false });

        document.addEventListener('touchcancel', () => {
            this._lastTouchInteractionAt = Date.now();
            if (this.isDragging || this.isResizing || this.isRotating) {
                this.handleMouseUp('touch');
            }
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

        if (textContent) textContent.addEventListener('input', (e) => this.updateTextContent(e.target.value));
        if (textFont) textFont.addEventListener('change', (e) => this.updateTextFont(e.target.value));
        if (textSize) textSize.addEventListener('input', (e) => {
            this.updateTextSize(e.target.value);
            document.getElementById('prop-text-size-val').textContent = e.target.value;
        });
        if (textColor) textColor.addEventListener('input', (e) => this.updateTextColor(e.target.value));
        if (textBold) textBold.addEventListener('click', () => this.toggleTextBold());
        if (textItalic) textItalic.addEventListener('click', () => this.toggleTextItalic());
        const quickTextContent = document.getElementById('quick-text-content');
        if (quickFontBtn) quickFontBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleQuickFontPopover();
        });
        const quickFontSelect = document.getElementById('quick-font-select');
        const quickFontBoldBtn = document.getElementById('quick-font-bold-btn');
        const quickFontItalicBtn = document.getElementById('quick-font-italic-btn');
        const quickFontUnderlineBtn = document.getElementById('quick-font-underline-btn');
        const quickFontCapsBtn = document.getElementById('quick-font-caps-btn');
        if (quickTextContent) quickTextContent.addEventListener('input', (e) => this.updateTextContent(e.target.value));
        if (quickFontSelect) quickFontSelect.addEventListener('change', (e) => this.selectQuickFontFamily(e.target.value));
        if (quickFontBoldBtn) quickFontBoldBtn.addEventListener('click', () => this.toggleTextBold());
        if (quickFontItalicBtn) quickFontItalicBtn.addEventListener('click', () => this.toggleTextItalic());
        if (quickFontUnderlineBtn) quickFontUnderlineBtn.addEventListener('click', () => this.updateTextUnderline(!this.selectedElement?.underline));
        if (quickFontCapsBtn) quickFontCapsBtn.addEventListener('click', () => this.toggleTextCapsLock());

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

        const imageRotation = document.getElementById('prop-image-rotation');
        if (imageRotation) imageRotation.addEventListener('input', (e) => {
            this.updateRotation(e.target.value);
            document.getElementById('prop-image-rotation-val').textContent = e.target.value;
        });

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

        const keepAspectButtons = [
            document.getElementById('keep-aspect-ratio'),
            document.getElementById('quick-keep-aspect-btn')
        ].filter(Boolean);

        keepAspectButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.keepAspectRatio = !this.keepAspectRatio;
                this.syncKeepAspectControls();
            });
        });

        const quickDeleteBtn = document.getElementById('quick-delete-btn');
        if (quickDeleteBtn) {
            quickDeleteBtn.addEventListener('click', () => this.deleteSelected());
        }

        this.syncKeepAspectControls();
    }


});
