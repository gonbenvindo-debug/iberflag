// ============================================================
// UPLOAD, CROP MODAL & SHAPES
// ============================================================
Object.assign(DesignEditor.prototype, {

    focusPropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (!panel) return;
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    updateSidebarMode() {
        const elementsPanel = document.getElementById('elements-panel');
        const propertiesPanel = document.getElementById('properties-panel');
        const hasSelection = !!this.selectedElement;

        if (elementsPanel) {
            elementsPanel.classList.toggle('hidden', hasSelection);
        }

        if (propertiesPanel) {
            propertiesPanel.classList.toggle('hidden', !hasSelection);
        }
    },

    clearPropertiesSections() {
        document.getElementById('no-selection').classList.remove('hidden');
        document.getElementById('text-properties').classList.add('hidden');
        document.getElementById('image-properties').classList.add('hidden');
        document.getElementById('qr-properties').classList.add('hidden');
        document.getElementById('shape-properties').classList.add('hidden');
    },

    clearSelection() {
        this.selectedElement = null;
        this.hideResizeHandles();
        this.elements.forEach(el => el.element.classList.remove('element-selected'));
        this.clearPropertiesSections();
        this.updateSidebarMode();

        // Remove class from body to hide properties tab on mobile
        document.body.classList.remove('has-element-selected');
        this.updateLayers();
    },

    // ===== ADD ELEMENTS =====
    addText() {
        this.preventSidebarClose();
        const scale = this.getInsertionScale();
        const center = this.getEditableCenter();
        const baseFontSize = Math.round(Math.max(14, Math.min(40, scale.shortSide * 0.09)));
        const estimatedTextWidth = Math.max(80, baseFontSize * 5.2);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(center.x - (estimatedTextWidth / 2)));
        text.setAttribute('y', String(center.y));
        text.setAttribute('font-family', 'Arial');
        text.setAttribute('font-size', String(baseFontSize));
        text.setAttribute('fill', '#000000');
        text.setAttribute('data-editable', 'true');
        text.textContent = 'Clique para editar';
        text.style.cursor = 'move';

        this.canvas.appendChild(text);
        this.bringPrintAreaOverlaysToFront();

        // Get actual bounding box after adding to DOM
        const bbox = text.getBBox();

        const elementData = {
            id: Date.now(),
            element: text,
            type: 'text',
            content: 'Clique para editar',
            font: 'Arial',
            size: baseFontSize,
            color: '#000000',
            bold: false,
            italic: false,
            rotation: 0,
            width: bbox.width,
            height: bbox.height,
            baseX: parseFloat(text.getAttribute('x')),
            baseY: parseFloat(text.getAttribute('y'))
        };

        this.elements.push(elementData);
        this.makeElementInteractive(elementData);
        this.selectElement(elementData);
        this.updateLayers();
        this.saveHistory();
    },

    handleImageUpload(e) {
        this.preventSidebarClose();
        const file = e.target.files[0];
        if (!file) return;
        this.handleImageFile(file).finally(() => { e.target.value = ''; });
    },

    handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) return Promise.resolve();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const src = event.target.result;
                const fallbackName = (file.name ? file.name.replace(/\.[^.]+$/, '') : '').trim();
                const imageName = fallbackName || 'Imagem';
                try {
                    const cropped = await this.openUploadCropModal(src);
                    if (cropped) {
                        this.addImageFromSource(cropped.dataUrl, cropped.width, cropped.height, imageName);
                    }
                } catch (error) {
                    console.error('Erro ao inserir imagem:', error);
                    showToast('Nao foi possivel inserir a imagem', 'error');
                } finally {
                    resolve();
                }
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(file);
        });
    },

    handlePaste(e) {
        const target = e.target;
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) this.handleImageFile(file);
                break;
            }
        }
    },

    handleDragOver(e) {
        const hasImage = Array.from(e.dataTransfer?.items || []).some(
            item => item.kind === 'file' && item.type.startsWith('image/')
        );
        if (!hasImage) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        document.getElementById('canvas-wrapper')?.classList.add('drop-target');
    },

    handleDragLeave(e) {
        const stage = document.getElementById('canvas-stage');
        if (stage && !stage.contains(e.relatedTarget)) {
            document.getElementById('canvas-wrapper')?.classList.remove('drop-target');
        }
    },

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('canvas-wrapper')?.classList.remove('drop-target');
        const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            this.handleImageFile(files[0]);
        }
    },

    setupUploadCropModalListeners() {
        if (this.uploadCropListenersReady) {
            return;
        }

        const modal = document.getElementById('upload-crop-modal');
        const stage = document.getElementById('upload-crop-stage');
        const viewport = document.getElementById('upload-crop-viewport');
        const selection = document.getElementById('upload-crop-selection');
        const cancelBtn = document.getElementById('upload-crop-cancel');
        const cancelTopBtn = document.getElementById('upload-crop-cancel-top');
        const applyBtn = document.getElementById('upload-crop-apply');

        if (!modal || !stage || !viewport || !selection || !cancelBtn || !cancelTopBtn || !applyBtn) {
            return;
        }

        let cropLastTouchAt = 0;
        const cropIsRecentTouch = () => (Date.now() - cropLastTouchAt) < 700;

        const startPointer = (event) => {
            if (!this.uploadCropState) return;
            if (cropIsRecentTouch() && event.pointerSource === 'mouse') return;
            if (event.button !== undefined && event.button !== 0) return;

            const handle = event.target?.dataset?.handle || null;
            if (handle) {
                this.uploadCropState.dragging = {
                    mode: 'resize',
                    handle,
                    startX: event.clientX,
                    startY: event.clientY,
                    rect: { ...this.uploadCropState.selectionRect }
                };
            } else {
                this.uploadCropState.dragging = {
                    mode: 'pan',
                    startX: event.clientX,
                    startY: event.clientY,
                    offsetX: this.uploadCropState.viewport.offsetX,
                    offsetY: this.uploadCropState.viewport.offsetY
                };
                stage.classList.add('is-panning');
            }
            event.preventDefault();
        };

        const movePointer = (event) => {
            if (!this.uploadCropState?.dragging) {
                console.log('❌ movePointer - sem dragging');
                return;
            }
            if (cropIsRecentTouch() && event.pointerSource === 'mouse') return;

            const state = this.uploadCropState;
            const drag = state.dragging;
            console.log('🔄 movePointer - mode:', drag.mode, 'handle:', drag.handle);

            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            const minSize = 36;
            const imageRect = state.imageRect;

            if (drag.mode === 'pan') {
                state.viewport.offsetX = drag.offsetX + dx;
                state.viewport.offsetY = drag.offsetY + dy;
                this.layoutUploadCropModal(false);
                return;
            }

            console.log('✏️ RESIZE - handle:', drag.handle, 'dx:', dx, 'dy:', dy);
            let next = { ...drag.rect };

            {
                const right = drag.rect.x + drag.rect.width;
                const bottom = drag.rect.y + drag.rect.height;

                if (drag.handle.includes('w')) {
                    next.x = drag.rect.x + dx;
                    next.width = right - next.x;
                }
                if (drag.handle.includes('e')) {
                    next.width = drag.rect.width + dx;
                }
                if (drag.handle.includes('n')) {
                    next.y = drag.rect.y + dy;
                    next.height = bottom - next.y;
                }
                if (drag.handle.includes('s')) {
                    next.height = drag.rect.height + dy;
                }

                if (next.width < minSize) {
                    if (drag.handle.includes('w')) {
                        next.x = right - minSize;
                    }
                    next.width = minSize;
                }

                if (next.height < minSize) {
                    if (drag.handle.includes('n')) {
                        next.y = bottom - minSize;
                    }
                    next.height = minSize;
                }
            }

            next.x = Math.max(imageRect.x, Math.min(next.x, imageRect.x + imageRect.width - next.width));
            next.y = Math.max(imageRect.y, Math.min(next.y, imageRect.y + imageRect.height - next.height));

            if (next.x < imageRect.x) {
                next.width -= (imageRect.x - next.x);
                next.x = imageRect.x;
            }
            if (next.y < imageRect.y) {
                next.height -= (imageRect.y - next.y);
                next.y = imageRect.y;
            }
            if (next.x + next.width > imageRect.x + imageRect.width) {
                next.width = imageRect.x + imageRect.width - next.x;
            }
            if (next.y + next.height > imageRect.y + imageRect.height) {
                next.height = imageRect.y + imageRect.height - next.y;
            }

            state.selectionRect = {
                x: next.x,
                y: next.y,
                width: Math.max(minSize, next.width),
                height: Math.max(minSize, next.height)
            };

            state.selectionNormalized = {
                x: (state.selectionRect.x - imageRect.x) / imageRect.width,
                y: (state.selectionRect.y - imageRect.y) / imageRect.height,
                width: state.selectionRect.width / imageRect.width,
                height: state.selectionRect.height / imageRect.height
            };

            this.renderUploadCropSelection();
        };

        const endPointer = (event) => {
            if (cropIsRecentTouch() && event?.pointerSource === 'mouse') return;
            if (!this.uploadCropState) return;
            stage.classList.remove('is-panning');
            this.uploadCropState.dragging = null;
        };

        const handleWheel = (event) => {
            if (!this.uploadCropState) return;

            event.preventDefault();
            const state = this.uploadCropState;
            const stageRect = stage.getBoundingClientRect();
            const pointerX = event.clientX - stageRect.left;
            const pointerY = event.clientY - stageRect.top;
            const prevRect = state.imageRect;
            const minScale = 1;
            const maxScale = 6;
            const zoomFactor = event.deltaY < 0 ? 1.12 : (1 / 1.12);
            const nextScale = Math.min(maxScale, Math.max(minScale, state.viewport.scale * zoomFactor));

            if (nextScale === state.viewport.scale) {
                return;
            }

            const relX = prevRect.width ? (pointerX - prevRect.x) / prevRect.width : 0.5;
            const relY = prevRect.height ? (pointerY - prevRect.y) / prevRect.height : 0.5;

            state.viewport.scale = nextScale;
            this.layoutUploadCropModal(false);

            const nextRect = state.imageRect;
            state.viewport.offsetX += pointerX - (nextRect.x + nextRect.width * relX);
            state.viewport.offsetY += pointerY - (nextRect.y + nextRect.height * relY);
            this.layoutUploadCropModal(false);
        };

        selection.addEventListener('mousedown', (event) => {
            startPointer({ ...event, pointerSource: 'mouse', preventDefault: () => event.preventDefault() });
        });
        stage.addEventListener('mousedown', (event) => {
            startPointer({ ...event, pointerSource: 'mouse', preventDefault: () => event.preventDefault() });
        });

        // Touch events for mobile
        const startTouchPointer = (event) => {
            if (event.touches.length !== 1) return;
            cropLastTouchAt = Date.now();
            event.preventDefault();
            const touch = event.touches[0];
            startPointer({
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0,
                target: event.target,
                pointerSource: 'touch',
                preventDefault: () => { }
            });
        };

        const moveTouchPointer = (event) => {
            if (event.touches.length !== 1) return;
            cropLastTouchAt = Date.now();
            event.preventDefault();
            const touch = event.touches[0];
            movePointer({ clientX: touch.clientX, clientY: touch.clientY, pointerSource: 'touch' });
        };

        const endTouchPointer = () => {
            cropLastTouchAt = Date.now();
            endPointer({ pointerSource: 'touch' });
        };

        selection.addEventListener('touchstart', startTouchPointer, { passive: false });
        stage.addEventListener('touchstart', startTouchPointer, { passive: false });
        document.addEventListener('touchmove', moveTouchPointer, { passive: false });
        document.addEventListener('touchend', endTouchPointer);
        document.addEventListener('touchcancel', endTouchPointer);

        document.addEventListener('mousemove', (event) => {
            movePointer({ ...event, pointerSource: 'mouse' });
        });
        document.addEventListener('mouseup', (event) => {
            endPointer({ ...event, pointerSource: 'mouse' });
        });
        stage.addEventListener('wheel', handleWheel, { passive: false });

        const cancelFlow = () => this.resolveUploadCropModal(null);
        cancelBtn.addEventListener('click', cancelFlow);
        cancelTopBtn.addEventListener('click', cancelFlow);

        applyBtn.addEventListener('click', () => {
            if (!this.uploadCropState) return;
            const result = this.exportUploadCropSelection();
            this.resolveUploadCropModal(result);
        });

        window.addEventListener('resize', () => {
            if (this.uploadCropState) {
                this.layoutUploadCropModal();
            }
        });

        this.uploadCropListenersReady = true;
    },

    openUploadCropModal(imageSrc) {
        this.setupUploadCropModalListeners();

        const modal = document.getElementById('upload-crop-modal');
        const image = document.getElementById('upload-crop-image');
        const viewport = document.getElementById('upload-crop-viewport');
        const selection = document.getElementById('upload-crop-selection');

        if (!modal || !image || !viewport || !selection) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            const state = {
                resolve,
                imageSrc,
                naturalWidth: 0,
                naturalHeight: 0,
                imageRect: { x: 0, y: 0, width: 0, height: 0 },
                selectionRect: null,
                selectionNormalized: null,
                viewport: { scale: 1, offsetX: 0, offsetY: 0 },
                dragging: null
            };

            this.uploadCropState = state;
            selection.classList.add('hidden');

            image.onload = () => {
                state.naturalWidth = image.naturalWidth;
                state.naturalHeight = image.naturalHeight;
                this.layoutUploadCropModal(true);

                // Configurar event listeners dos handles DEPOIS que tudo está carregado
                const handles = selection.querySelectorAll('.upload-crop-handle');
                console.log('🔧 Configurando handles:', handles.length);

                handles.forEach(handle => {
                    const handleName = handle.dataset.handle;
                    console.log('🔧 Handle:', handleName);

                    handle.addEventListener('mousedown', (event) => {
                        console.log('✅ MOUSEDOWN handle:', handleName);
                        event.stopPropagation();
                        event.preventDefault();

                        if (!this.uploadCropState) return;

                        this.uploadCropState.dragging = {
                            mode: 'resize',
                            handle: handleName,
                            startX: event.clientX,
                            startY: event.clientY,
                            rect: { ...this.uploadCropState.selectionRect }
                        };
                        console.log('✅ Dragging definido:', this.uploadCropState.dragging);
                    });

                    handle.addEventListener('touchstart', (event) => {
                        console.log('✅ TOUCHSTART handle:', handleName);
                        event.stopPropagation();
                        event.preventDefault();

                        if (!this.uploadCropState || event.touches.length !== 1) return;

                        const touch = event.touches[0];
                        this.uploadCropState.dragging = {
                            mode: 'resize',
                            handle: handleName,
                            startX: touch.clientX,
                            startY: touch.clientY,
                            rect: { ...this.uploadCropState.selectionRect }
                        };
                        console.log('✅ Dragging definido (touch):', this.uploadCropState.dragging);
                    }, { passive: false });
                });
            };

            image.src = imageSrc;
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('overflow-hidden');
        });
    },

    layoutUploadCropModal(resetSelection = false) {
        if (!this.uploadCropState) return;

        const stage = document.getElementById('upload-crop-stage');
        const image = document.getElementById('upload-crop-image');
        const viewport = document.getElementById('upload-crop-viewport');
        if (!stage || !image || !viewport) return;

        const stageRect = stage.getBoundingClientRect();
        const maxWidth = Math.max(1, stageRect.width - 28);
        const maxHeight = Math.max(1, stageRect.height - 28);
        const imageRatio = this.uploadCropState.naturalWidth / Math.max(1, this.uploadCropState.naturalHeight);

        let fitWidth = maxWidth;
        let fitHeight = fitWidth / imageRatio;
        if (fitHeight > maxHeight) {
            fitHeight = maxHeight;
            fitWidth = fitHeight * imageRatio;
        }

        const scale = Math.max(1, this.uploadCropState.viewport?.scale || 1);
        const offsetX = this.uploadCropState.viewport?.offsetX || 0;
        const offsetY = this.uploadCropState.viewport?.offsetY || 0;
        const drawX = ((stageRect.width - fitWidth) / 2) + offsetX;
        const drawY = ((stageRect.height - fitHeight) / 2) + offsetY;

        this.uploadCropState.imageRect = {
            x: drawX,
            y: drawY,
            width: fitWidth * scale,
            height: fitHeight * scale
        };

        viewport.style.left = `${drawX}px`;
        viewport.style.top = `${drawY}px`;
        viewport.style.width = `${fitWidth}px`;
        viewport.style.height = `${fitHeight}px`;
        viewport.style.transform = `scale(${scale})`;

        if (resetSelection || !this.uploadCropState.selectionNormalized) {
            this.uploadCropState.selectionNormalized = {
                x: 0,
                y: 0,
                width: 1,
                height: 1
            };
        }

        this.renderUploadCropSelection();
    },

    renderUploadCropSelection() {
        if (!this.uploadCropState) return;

        const selection = document.getElementById('upload-crop-selection');
        if (!selection) return;

        const normalized = this.uploadCropState.selectionNormalized || { x: 0, y: 0, width: 1, height: 1 };
        const imageRect = this.uploadCropState.imageRect;
        const rect = {
            x: imageRect.x + imageRect.width * normalized.x,
            y: imageRect.y + imageRect.height * normalized.y,
            width: imageRect.width * normalized.width,
            height: imageRect.height * normalized.height
        };
        this.uploadCropState.selectionRect = rect;
        selection.style.left = `${rect.x}px`;
        selection.style.top = `${rect.y}px`;
        selection.style.width = `${rect.width}px`;
        selection.style.height = `${rect.height}px`;
        selection.classList.remove('hidden');
    },

    exportUploadCropSelection() {
        if (!this.uploadCropState) return null;

        const image = document.getElementById('upload-crop-image');
        if (!image) return null;

        const { naturalWidth, naturalHeight } = this.uploadCropState;
        const normalized = this.uploadCropState.selectionNormalized;
        if (!normalized) {
            return null;
        }

        const sx = normalized.x * naturalWidth;
        const sy = normalized.y * naturalHeight;
        const sw = normalized.width * naturalWidth;
        const sh = normalized.height * naturalHeight;

        const safeW = Math.max(1, Math.round(sw));
        const safeH = Math.max(1, Math.round(sh));
        const canvas = document.createElement('canvas');
        canvas.width = safeW;
        canvas.height = safeH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, safeW, safeH);

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: safeW,
            height: safeH
        };
    },

    resolveUploadCropModal(result) {
        if (!this.uploadCropState) {
            return;
        }

        const modal = document.getElementById('upload-crop-modal');
        const image = document.getElementById('upload-crop-image');
        const viewport = document.getElementById('upload-crop-viewport');
        const selection = document.getElementById('upload-crop-selection');
        const resolve = this.uploadCropState.resolve;

        this.uploadCropState = null;

        if (modal) {
            if (modal.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
        if (image) {
            image.removeAttribute('src');
            image.onload = null;
        }
        if (viewport) {
            viewport.removeAttribute('style');
        }
        if (selection) {
            selection.classList.add('hidden');
        }

        document.body.classList.remove('overflow-hidden');
        resolve(result);
    },

    handleAddQRCode() {
        const content = 'https://site.pt';
        const color = '#111827';
        const scale = this.getInsertionScale();
        const qrSize = Math.round(Math.max(56, Math.min(180, scale.shortSide * 0.28)));

        try {
            const dataUrl = this.generateQRCodeDataUrl(content, color);
            this.addImageFromSource(dataUrl, qrSize, qrSize, 'QR Code', {
                imageKind: 'qr',
                qrContent: content,
                qrColor: color
            });
            showToast('QR code adicionado ao design', 'success');
        } catch (error) {
            console.error('Erro ao gerar QR code:', error);
            showToast('Nao foi possivel gerar o QR code', 'error');
        }
    },

    generateQRCodeDataUrl(content, color = '#111827') {
        if (typeof qrcode !== 'function') {
            throw new Error('Biblioteca de QR code indisponivel');
        }

        const qr = qrcode(0, 'M');
        qr.addData(content);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const margin = 2;
        const size = moduleCount + margin * 2;
        const fill = this.sanitizeColorValue(color, '#111827');
        const pathSegments = [];

        for (let row = 0; row < moduleCount; row += 1) {
            for (let col = 0; col < moduleCount; col += 1) {
                if (!qr.isDark(row, col)) {
                    continue;
                }

                const x = col + margin;
                const y = row + margin;
                pathSegments.push(`M${x} ${y}h1v1H${x}z`);
            }
        }

        const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="${fill}" d="${pathSegments.join('')}"/></svg>`;

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
    },

    addImageFromSource(src, width, height, name = 'Imagem', options = {}) {
        const fitted = this.fitSizeIntoEditableBounds(width, height, 0.45);
        const center = this.getEditableCenter();
        const imageKind = options.imageKind || 'image';
        const qrContent = options.qrContent || '';
        const qrColor = options.qrColor || '#111827';

        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('x', String(center.x - (fitted.width / 2)));
        img.setAttribute('y', String(center.y - (fitted.height / 2)));
        img.setAttribute('width', String(fitted.width));
        img.setAttribute('height', String(fitted.height));
        img.setAttribute('href', src);
        img.setAttribute('preserveAspectRatio', 'none');
        img.setAttribute('data-editable', 'true');
        img.dataset.name = name;
        img.dataset.imageKind = imageKind;
        if (qrContent) {
            img.dataset.qrContent = qrContent;
        }
        if (imageKind === 'qr') {
            img.dataset.qrColor = qrColor;
        }
        img.style.cursor = 'move';

        this.canvas.appendChild(img);
        this.bringPrintAreaOverlaysToFront();

        const elementData = {
            id: Date.now(),
            element: img,
            type: 'image',
            src,
            name,
            imageKind,
            qrContent,
            qrColor,
            opacity: 1,
            rotation: 0
        };

        this.elements.push(elementData);
        this.makeElementInteractive(elementData);
        this.selectElement(elementData);
        this.updateLayers();
        this.saveHistory();
    },

    addShape(shapeType) {
        this.preventSidebarClose();
        const scale = this.getInsertionScale();
        const center = this.getEditableCenter();
        const baseSize = Math.max(48, Math.min(180, scale.shortSide * 0.28));
        let shape;

        if (shapeType === 'rectangle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const rectWidth = baseSize * 1.25;
            const rectHeight = baseSize * 0.84;
            shape.setAttribute('x', String(center.x - (rectWidth / 2)));
            shape.setAttribute('y', String(center.y - (rectHeight / 2)));
            shape.setAttribute('width', String(rectWidth));
            shape.setAttribute('height', String(rectHeight));
        } else if (shapeType === 'circle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', String(center.x));
            shape.setAttribute('cy', String(center.y));
            shape.setAttribute('r', String(baseSize / 2));
        } else if (shapeType === 'triangle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const half = baseSize / 2;
            const p1 = `${center.x},${center.y - half}`;
            const p2 = `${center.x + half},${center.y + (half * 0.75)}`;
            const p3 = `${center.x - half},${center.y + (half * 0.75)}`;
            shape.setAttribute('points', `${p1} ${p2} ${p3}`);
        }

        shape.setAttribute('fill', '#3b82f6');
        shape.setAttribute('stroke', 'none');
        shape.setAttribute('stroke-width', '0');
        shape.setAttribute('data-editable', 'true');
        shape.style.cursor = 'move';

        this.canvas.appendChild(shape);
        this.bringPrintAreaOverlaysToFront();

        const elementData = {
            id: Date.now(),
            element: shape,
            type: 'shape',
            rotation: 0,
            shapeType: shapeType,
            fill: '#3b82f6',
            stroke: '#000000',
            strokeWidth: 0
        };

        this.elements.push(elementData);
        this.makeElementInteractive(elementData);
        this.selectElement(elementData);
        this.updateLayers();
        this.saveHistory();
    },

    // ===== ELEMENT INTERACTION =====

});
