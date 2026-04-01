// ============================================================
// PROPERTIES, LAYERS & HISTORY
// ============================================================
Object.assign(DesignEditor.prototype, {

    updateTextContent(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.textContent = value;
            this.selectedElement.content = value;
            
            // Update stored dimensions
            const bbox = this.selectedElement.element.getBBox();
            this.selectedElement.width = bbox.width;
            this.selectedElement.height = bbox.height;
            
            this.showResizeHandles(this.selectedElement);
            this.queueHistorySave(250);
        }
    },
    
    updateTextFont(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('font-family', value);
            this.selectedElement.font = value;
            
            // Update stored dimensions
            const bbox = this.selectedElement.element.getBBox();
            this.selectedElement.width = bbox.width;
            this.selectedElement.height = bbox.height;
            
            this.showResizeHandles(this.selectedElement);
            this.queueHistorySave();
        }
    },
    
    updateTextSize(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('font-size', value);
            this.selectedElement.size = value;
            
            // Update stored dimensions
            const bbox = this.selectedElement.element.getBBox();
            this.selectedElement.width = bbox.width;
            this.selectedElement.height = bbox.height;
            
            this.showResizeHandles(this.selectedElement);
            this.queueHistorySave();
        }
    },
    
    updateTextColor(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('fill', value);
            this.selectedElement.color = value;
            this.queueHistorySave();
        }
    },
    
    toggleTextBold() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const current = this.selectedElement.element.getAttribute('font-weight') || 'normal';
            const newWeight = current === 'bold' ? 'normal' : 'bold';
            this.selectedElement.element.setAttribute('font-weight', newWeight);
            this.selectedElement.bold = newWeight === 'bold';
            this.saveHistory();
        }
    },
    
    toggleTextItalic() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const current = this.selectedElement.element.getAttribute('font-style') || 'normal';
            const newStyle = current === 'italic' ? 'normal' : 'italic';
            this.selectedElement.element.setAttribute('font-style', newStyle);
            this.selectedElement.italic = newStyle === 'italic';
            this.saveHistory();
        }
    },
    
    updateImageOpacity(value) {
        if (this.selectedElement && this.selectedElement.type === 'image') {
            this.selectedElement.element.setAttribute('opacity', value);
            this.selectedElement.opacity = value;
            this.queueHistorySave();
        }
    },

    updateQRCodeContent(value) {
        if (!this.selectedElement || this.selectedElement.type !== 'image' || this.selectedElement.imageKind !== 'qr') {
            return;
        }

        const content = value.trim();
        this.selectedElement.qrContent = content;
        this.selectedElement.element.dataset.qrContent = content;

        if (!content) {
            return;
        }

        try {
            const nextSrc = this.generateQRCodeDataUrl(content, this.selectedElement.qrColor || '#111827');
            this.selectedElement.src = nextSrc;
            this.selectedElement.element.setAttribute('href', nextSrc);
            this.queueHistorySave(250);
        } catch (error) {
            console.error('Erro ao atualizar QR code:', error);
        }
    },

    updateQRCodeColor(value) {
        if (!this.selectedElement || this.selectedElement.type !== 'image' || this.selectedElement.imageKind !== 'qr') {
            return;
        }

        const color = this.sanitizeColorValue(value, '#111827');
        this.selectedElement.qrColor = color;
        this.selectedElement.element.dataset.qrColor = color;

        if (!this.selectedElement.qrContent) {
            return;
        }

        try {
            const nextSrc = this.generateQRCodeDataUrl(this.selectedElement.qrContent, color);
            this.selectedElement.src = nextSrc;
            this.selectedElement.element.setAttribute('href', nextSrc);
            this.queueHistorySave();
        } catch (error) {
            console.error('Erro ao atualizar cor do QR code:', error);
        }
    },
    
    updateShapeFill(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextFill = this.sanitizeColorValue(value, '#3b82f6');
            this.selectedElement.element.setAttribute('fill', nextFill);
            this.selectedElement.fill = nextFill;
            this.queueHistorySave();
        }
    },
    
    updateShapeStroke(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextStroke = this.sanitizeColorValue(value, '#000000');
            this.selectedElement.element.setAttribute('stroke', nextStroke);
            this.selectedElement.stroke = nextStroke;
            this.queueHistorySave();
        }
    },
    
    updateShapeStrokeWidth(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            this.selectedElement.element.setAttribute('stroke-width', value);
            this.selectedElement.strokeWidth = value;
            this.queueHistorySave();
        }
    },
    
    // ===== DELETE =====
    deleteSelected() {
        if (this.selectedElement) {
            this.selectedElement.element.remove();
            this.elements = this.elements.filter(el => el.id !== this.selectedElement.id);
            this.clearSelection();
            this.updateLayers();
            this.saveHistory();
        }
    },

    duplicateSelected() {
        if (!this.selectedElement) return;

        const clone = this.selectedElement.element.cloneNode(true);
        const clonedData = this.buildElementDataFromNode(clone);
        const offset = 20;

        if (clonedData.type === 'text') {
            const x = parseFloat(clone.getAttribute('x') || '0') + offset;
            const y = parseFloat(clone.getAttribute('y') || '0') + offset;
            clone.setAttribute('x', x);
            clone.setAttribute('y', y);
        } else if (clonedData.type === 'image' || (clonedData.type === 'shape' && this.isRectLikeShapeType?.(clonedData.shapeType))) {
            const x = parseFloat(clone.getAttribute('x') || '0') + offset;
            const y = parseFloat(clone.getAttribute('y') || '0') + offset;
            clone.setAttribute('x', x);
            clone.setAttribute('y', y);
        } else if (clonedData.type === 'shape' && clonedData.shapeType === 'circle') {
            const cx = parseFloat(clone.getAttribute('cx') || '0') + offset;
            const cy = parseFloat(clone.getAttribute('cy') || '0') + offset;
            clone.setAttribute('cx', cx);
            clone.setAttribute('cy', cy);
        } else if (clonedData.type === 'shape' && this.isPolygonShapeType?.(clonedData.shapeType)) {
            const points = (clone.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number))
                .map(([x, y]) => `${x + offset},${y + offset}`)
                .join(' ');
            clone.setAttribute('points', points);
        }

        this.canvas.appendChild(clone);
        this.bringPrintAreaOverlaysToFront();
        clonedData.element = clone;
        this.makeElementInteractive(clonedData);
        this.elements.push(clonedData);
        this.selectElement(clonedData);
        this.updateLayers();
        this.saveHistory();
    },

    centerSelected(axis) {
        if (!this.selectedElement) return;

        const bounds = this.getEditableBounds();
        const transformed = this.getTransformedBounds(this.selectedElement);
        const currentCenterX = (transformed.left + transformed.right) / 2;
        const currentCenterY = (transformed.top + transformed.bottom) / 2;
        const targetCenterX = bounds.x + (bounds.width / 2);
        const targetCenterY = bounds.y + (bounds.height / 2);

        const deltaX = axis === 'horizontal' ? (targetCenterX - currentCenterX) : 0;
        const deltaY = axis === 'vertical' ? (targetCenterY - currentCenterY) : 0;

        this.moveElementBy(this.selectedElement, deltaX, deltaY);

        this.showResizeHandles(this.selectedElement);
        this.updateLayers();
        this.saveHistory();
    },

    nudgeSelected(dx, dy) {
        if (!this.selectedElement) return;

        this.moveElementBy(this.selectedElement, dx, dy);

        this.showResizeHandles(this.selectedElement);
        this.saveHistory();
    },

    handleKeyDown(e) {
        const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const isTypingContext = ['input', 'textarea', 'select'].includes(targetTag);

        // ===== CROP MODE HANDLING =====
        if (this.cropMode) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.applyCrop();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cropMode = false;
                this.cropBounds = null;
                this.hideResizeHandles();
                this.selectElement(this.selectedElement);
                showToast('Corte cancelado', 'info');
                return;
            }
        }

        if ((e.ctrlKey || e.metaKey) && !isTypingContext) {
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
                return;
            }
            if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                this.redo();
                return;
            }
            if (key === 'd') {
                e.preventDefault();
                this.duplicateSelected();
                return;
            }
        }

        if (!this.selectedElement || isTypingContext) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelected();
            return;
        }

        const nudge = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.nudgeSelected(-nudge, 0);
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.nudgeSelected(nudge, 0);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.nudgeSelected(0, -nudge);
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.nudgeSelected(0, nudge);
        }
    },

    getLayerBaseLabel(elementData) {
        if (!elementData) return 'Camada';

        if (elementData.type === 'text') return 'Texto';
        if (elementData.type === 'image') {
            return elementData.imageKind === 'qr' ? 'QR Code' : 'Imagem';
        }

        if (elementData.type === 'shape') {
            const shapeType = String(elementData.shapeType || '').toLowerCase();
            const shapeLabels = {
                rectangle: 'Quadrado',
                rounded: 'Quadrado',
                pill: 'Quadrado',
                circle: 'Circulo',
                triangle: 'Triangulo',
                diamond: 'Losango',
                line: 'Linha',
                star: 'Estrela',
                hexagon: 'Hexagono',
                arrow: 'Seta',
                path: 'Forma'
            };

            return shapeLabels[shapeType] || 'Forma';
        }

        return 'Camada';
    },
    
    // ===== LAYERS =====
    updateLayers() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        
        if (this.elements.length === 0) {
            layersList.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Nenhuma camada ainda</p>';
            return;
        }

        const selectedId = this.selectedElement ? String(this.selectedElement.id) : null;
        const labelCounters = new Map();

        const getLayerLabel = (elementData) => {
            const baseLabel = this.getLayerBaseLabel(elementData);
            const key = baseLabel.toLowerCase();
            const nextCount = (labelCounters.get(key) || 0) + 1;
            labelCounters.set(key, nextCount);
            return `${baseLabel} ${nextCount}`;
        };
        
        layersList.innerHTML = this.elements.map((el, index) => `
            <div class="layer-item p-3 border rounded-lg mb-2 hover:bg-gray-50 cursor-pointer ${selectedId === String(el.id) ? 'bg-blue-50 border-blue-600' : ''}"
                 data-layer-index="${index}"
                 data-layer-id="${String(el.id)}"
                 draggable="true">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${el.type === 'text' ? 'type' : el.type === 'image' ? (el.imageKind === 'qr' ? 'qr-code' : 'image') : 'square'}" class="w-4 h-4"></i>
                        <span class="text-sm font-semibold">${getLayerLabel(el)}</span>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" data-layer-action="up" data-layer-index="${index}" class="p-1 hover:bg-gray-200 rounded" ${index === 0 ? 'disabled' : ''}>
                            <i data-lucide="arrow-up" class="w-3 h-3"></i>
                        </button>
                        <button type="button" data-layer-action="down" data-layer-index="${index}" class="p-1 hover:bg-gray-200 rounded" ${index === this.elements.length - 1 ? 'disabled' : ''}>
                            <i data-lucide="arrow-down" class="w-3 h-3"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        layersList.querySelectorAll('.layer-item').forEach((item) => {
            item.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                const id = item.dataset.layerId;
                this.selectElementById(id);
            });

            item.addEventListener('dragstart', (event) => {
                const startIndex = Number(item.dataset.layerIndex);
                if (!Number.isInteger(startIndex)) return;
                this.layerDragIndex = startIndex;
                item.classList.add('opacity-60');
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(startIndex));
                }
            });

            item.addEventListener('dragover', (event) => {
                event.preventDefault();
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                }
                item.classList.add('border-blue-400', 'bg-blue-50');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('border-blue-400', 'bg-blue-50');
            });

            item.addEventListener('drop', (event) => {
                event.preventDefault();
                item.classList.remove('border-blue-400', 'bg-blue-50');

                const targetIndex = Number(item.dataset.layerIndex);
                const fromIndex = Number.isInteger(this.layerDragIndex)
                    ? this.layerDragIndex
                    : Number(event.dataTransfer?.getData('text/plain'));

                this.layerDragIndex = null;
                if (!Number.isInteger(fromIndex) || !Number.isInteger(targetIndex) || fromIndex === targetIndex) {
                    return;
                }

                this.moveLayerToIndex(fromIndex, targetIndex);
            });

            item.addEventListener('dragend', () => {
                this.layerDragIndex = null;
                item.classList.remove('opacity-60', 'border-blue-400', 'bg-blue-50');
            });
        });

        layersList.querySelectorAll('button[data-layer-action]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                const index = Number(button.dataset.layerIndex);
                if (!Number.isInteger(index)) return;

                const action = button.dataset.layerAction;
                this.moveLayer(index, action === 'up' ? -1 : 1);
            });
        });
        
        lucide.createIcons();
    },
    
    selectElementByIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.elements.length) return;
        this.selectElement(this.elements[index]);
    },

    selectElementById(layerId) {
        const targetId = String(layerId || '');
        if (!targetId) return;
        const elementData = this.elements.find((el) => String(el.id) === targetId);
        if (!elementData) return;
        this.selectElement(elementData);
    },

    syncCanvasOrderFromLayers() {
        this.elements.forEach((elementData) => {
            if (elementData?.element && elementData.element.parentNode === this.canvas) {
                this.canvas.appendChild(elementData.element);
            }
        });
        this.bringPrintAreaOverlaysToFront();
    },

    moveLayerToIndex(fromIndex, toIndex) {
        if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
        if (fromIndex < 0 || fromIndex >= this.elements.length) return;
        if (toIndex < 0 || toIndex >= this.elements.length) return;
        if (fromIndex === toIndex) return;

        const [moved] = this.elements.splice(fromIndex, 1);
        this.elements.splice(toIndex, 0, moved);

        this.syncCanvasOrderFromLayers();
        this.updateLayers();
        this.saveHistory();
    },
    
    moveLayer(index, direction) {
        const newIndex = index + direction;
        this.moveLayerToIndex(index, newIndex);
    },
    
    // ===== ZOOM =====
    syncCanvasViewport() {
        if (!this.canvasStage || !this.canvasWrapper) return;

        const stageRect = this.canvasStage.getBoundingClientRect();
        const stageWidth = Number(stageRect?.width) || this.canvasStage.clientWidth || 0;
        const stageHeight = Number(stageRect?.height) || this.canvasStage.clientHeight || 0;
        const stageStyle = window.getComputedStyle(this.canvasStage);
        const paddingX = (parseFloat(stageStyle.paddingLeft) || 0) + (parseFloat(stageStyle.paddingRight) || 0);
        const paddingY = (parseFloat(stageStyle.paddingTop) || 0) + (parseFloat(stageStyle.paddingBottom) || 0);
        const availableWidth = Math.max(0, stageWidth - paddingX);
        const availableHeight = Math.max(0, stageHeight - paddingY);

        if (!availableWidth || !availableHeight) {
            if (!this.initialCanvasSize) {
                this.initialCanvasSize = {
                    width: Math.max(1, stageWidth || Number(this.baseCanvasSize?.width) || 800),
                    height: Math.max(1, stageHeight || Number(this.baseCanvasSize?.height) || 600)
                };
            }

            const fallbackWidth = this.initialCanvasSize.width * this.zoom;
            const fallbackHeight = this.initialCanvasSize.height * this.zoom;
            this.canvasWrapper.style.width = `${fallbackWidth}px`;
            this.canvasWrapper.style.height = `${fallbackHeight}px`;
            this.canvasWrapper.style.transform = 'none';
            return;
        }

        const needsResizeRecalc = (
            !this.initialCanvasSize ||
            this._lastViewportStageWidth !== stageWidth ||
            this._lastViewportStageHeight !== stageHeight
        );

        if (needsResizeRecalc) {
            this.initialCanvasSize = {
                width: Math.max(1, availableWidth),
                height: Math.max(1, availableHeight)
            };
            this._lastViewportStageWidth = stageWidth;
            this._lastViewportStageHeight = stageHeight;
        }

        // Apply zoom to base size
        const scaledWidth = this.initialCanvasSize.width * this.zoom;
        const scaledHeight = this.initialCanvasSize.height * this.zoom;

        this.canvasWrapper.style.width = `${scaledWidth}px`;
        this.canvasWrapper.style.height = `${scaledHeight}px`;
        this.canvasWrapper.style.transform = 'none';
        this.syncWorkspaceBounds?.();

        if (
            this._loadedSvgTemplateContent &&
            this._templateLayoutNeedsReflow &&
            !this._isReflowingSvgTemplate
        ) {
            this._isReflowingSvgTemplate = true;
            this._templateLayoutNeedsReflow = false;
            this.loadSVGTemplate(this._loadedSvgTemplateContent, { skipViewportReflow: true });
            this._isReflowingSvgTemplate = false;
        }
    },

    setZoom(newZoom) {
        this.zoom = Math.max(0.5, Math.min(2, newZoom));
        this.syncCanvasViewport();
        document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
    },

    getHistorySnapshot() {
        this.elements.forEach((elementData) => this.syncElementMetadata(elementData));

        const serializableElements = this.elements
            .map((elementData) => {
                if (!elementData?.element || typeof elementData.element.outerHTML !== 'string') {
                    return null;
                }

                return {
                    id: String(elementData.id),
                    markup: elementData.element.outerHTML
                };
            })
            .filter(Boolean);

        return JSON.stringify({
            selectedElementId: this.selectedElement ? String(this.selectedElement.id) : null,
            elements: serializableElements
        });
    },

    queueHistorySave(delay = this.historyCommitDelay) {
        if (this.isRestoringHistory) {
            return;
        }

        if (this.historyCommitTimer !== null) {
            clearTimeout(this.historyCommitTimer);
        }

        this.historyCommitTimer = setTimeout(() => {
            this.historyCommitTimer = null;
            this.saveHistory();
        }, delay);
    },

    flushPendingHistorySave() {
        if (this.historyCommitTimer === null) {
            return;
        }

        clearTimeout(this.historyCommitTimer);
        this.historyCommitTimer = null;
        this.saveHistory();
    },

    beginHistoryGesture() {
        if (this.activeHistoryGestureSnapshot !== null) {
            return;
        }

        this.flushPendingHistorySave();
        this.activeHistoryGestureSnapshot = this.getHistorySnapshot();
    },

    commitHistoryGesture() {
        if (this.activeHistoryGestureSnapshot === null) {
            return;
        }

        const gestureStartSnapshot = this.activeHistoryGestureSnapshot;
        this.activeHistoryGestureSnapshot = null;

        if (gestureStartSnapshot !== this.getHistorySnapshot()) {
            this.saveHistory();
        } else {
            this.updateHistoryButtons();
        }
    },

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const canUndo = this.historyIndex > 0;
        const canRedo = this.historyIndex < this.history.length - 1;

        const applyButtonState = (button, isEnabled, label) => {
            if (!button) return;
            button.disabled = !isEnabled;
            button.style.opacity = isEnabled ? '1' : '0.38';
            button.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
            button.style.pointerEvents = isEnabled ? 'auto' : 'none';
            button.title = isEnabled ? label : `${label} indisponivel`;
        };

        applyButtonState(undoBtn, canUndo, 'Desfazer');
        applyButtonState(redoBtn, canRedo, 'Refazer');
    },
    
    // ===== HISTORY =====
    saveHistory() {
        if (this.isRestoringHistory) {
            return;
        }

        if (this.historyCommitTimer !== null) {
            clearTimeout(this.historyCommitTimer);
            this.historyCommitTimer = null;
        }

        const state = this.getHistorySnapshot();

        if (this.history[this.historyIndex] === state) {
            this.updateHistoryButtons();
            return;
        }

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);

        if (this.history.length > this.maxHistoryEntries) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        if (this.history.length > 0) {
            this.historyIndex = this.history.length - 1;
        }

        this.updateHistoryButtons();
    },
    
    undo() {
        this.flushPendingHistorySave();
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        } else {
            this.updateHistoryButtons();
        }
    },
    
    redo() {
        this.flushPendingHistorySave();
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        } else {
            this.updateHistoryButtons();
        }
    },
    
    restoreState(stateStr) {
        try {
            this.isRestoringHistory = true;
            const state = JSON.parse(stateStr);
            const selectedElementId = state.selectedElementId ? String(state.selectedElementId) : null;

            this.elements.forEach((el) => el.element.remove());
            this.elements = [];
            this.selectedElement = null;

            (state.elements || []).forEach((saved) => {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(
                    `<svg xmlns="http://www.w3.org/2000/svg">${saved.markup}</svg>`,
                    'image/svg+xml'
                );
                const restored = svgDoc.documentElement.firstElementChild;
                if (!restored) return;

                const imported = document.importNode(restored, true);
                this.canvas.appendChild(imported);

                const elementData = this.buildElementDataFromNode(imported, saved.id);

                this.elements.push(elementData);
                this.makeElementInteractive(elementData);
            });

            this.bringPrintAreaOverlaysToFront();

            this.hideResizeHandles();
            this.updateLayers();
            this.clearPropertiesSections();
            this.updateSidebarMode();

            if (selectedElementId) {
                const restoredSelection = this.elements.find((elementData) => String(elementData.id) === selectedElementId);
                if (restoredSelection) {
                    this.selectElement(restoredSelection, { skipReposition: true });
                }
            }
        } catch (error) {
            console.error('Erro ao restaurar hist├│rico:', error);
        } finally {
            this.isRestoringHistory = false;
            this.updateHistoryButtons();
        }
    },
    
    // ===== AUTO SAVE =====
    setupAutoSave() {
        setInterval(() => {
            if (this.elements.length > 0) {
                this.autoSave();
            }
        }, 5000);
    },
    
    autoSave() {
        const saveKeys = [this.getAutosaveKey(), ...this.getLegacyAutosaveKeys()];
        const svgDesign = this.getDesignSVG();
        const payload = {
            format: 'elements-v1',
            productId: this.productId || null,
            selectedBaseId: this.selectedBaseId || null,
            elements: this.elements.map((elementData) => {
                const { element, ...serializable } = elementData || {};
                return serializable;
            })
        };
        const compactDesign = JSON.stringify(payload);

        const candidates = svgDesign && svgDesign.length <= 180000
            ? [svgDesign, compactDesign]
            : [compactDesign, svgDesign];

        let stored = false;
        for (const value of candidates) {
            if (!value) continue;

            try {
                saveKeys.forEach((key) => {
                    localStorage.setItem(key, value);
                });
                stored = true;
                break;
            } catch (error) {
                if (error && error.name !== 'QuotaExceededError') {
                    console.warn('Falha ao gravar autosave:', error);
                }
            }
        }

        if (!stored) {
            console.warn('Autosave indisponivel: armazenamento cheio.');
        }
    },

    // ===== CROP FUNCTIONALITY =====

});
