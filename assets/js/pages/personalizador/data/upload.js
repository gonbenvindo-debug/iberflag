// ============================================================
// UPLOAD, CROP MODAL & SHAPES
// ============================================================
Object.assign(DesignEditor.prototype, {

    parseSourceCropData(nodeOrDataset) {
        const dataset = nodeOrDataset?.dataset || nodeOrDataset || {};
        try {
            if (dataset.cropSourceData) {
                const parsed = JSON.parse(dataset.cropSourceData);
                if (parsed && Number.isFinite(Number(parsed.x)) && Number.isFinite(Number(parsed.y)) && Number.isFinite(Number(parsed.width)) && Number.isFinite(Number(parsed.height))) {
                    return {
                        x: Number(parsed.x),
                        y: Number(parsed.y),
                        width: Number(parsed.width),
                        height: Number(parsed.height)
                    };
                }
            }
        } catch {
            return null;
        }
        return null;
    },

    normalizeCropSelectionData(cropData, sourceCropData = null, fullWidth = null, fullHeight = null) {
        const toFinite = (value) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
        };

        if (!cropData) {
            return null;
        }

        const direct = {
            x: toFinite(cropData.x),
            y: toFinite(cropData.y),
            width: toFinite(cropData.width),
            height: toFinite(cropData.height)
        };
        if (direct.x !== null && direct.y !== null && direct.width !== null && direct.height !== null) {
            return {
                x: Math.max(0, Math.min(1, direct.x)),
                y: Math.max(0, Math.min(1, direct.y)),
                width: Math.max(0.05, Math.min(1, direct.width)),
                height: Math.max(0.05, Math.min(1, direct.height))
            };
        }

        const ratio = {
            x: toFinite(cropData.xRatio),
            y: toFinite(cropData.yRatio),
            width: toFinite(cropData.widthRatio),
            height: toFinite(cropData.heightRatio)
        };
        if (ratio.x !== null && ratio.y !== null && ratio.width !== null && ratio.height !== null) {
            return {
                x: Math.max(0, Math.min(1, ratio.x)),
                y: Math.max(0, Math.min(1, ratio.y)),
                width: Math.max(0.05, Math.min(1, ratio.width)),
                height: Math.max(0.05, Math.min(1, ratio.height))
            };
        }

        if (sourceCropData && Number.isFinite(Number(fullWidth)) && Number.isFinite(Number(fullHeight))) {
            const fw = Number(fullWidth);
            const fh = Number(fullHeight);
            const normalized = {
                x: toFinite(sourceCropData.x) !== null ? Number(sourceCropData.x) / fw : null,
                y: toFinite(sourceCropData.y) !== null ? Number(sourceCropData.y) / fh : null,
                width: toFinite(sourceCropData.width) !== null ? Number(sourceCropData.width) / fw : null,
                height: toFinite(sourceCropData.height) !== null ? Number(sourceCropData.height) / fh : null
            };
            if (normalized.x !== null && normalized.y !== null && normalized.width !== null && normalized.height !== null) {
                return {
                    x: Math.max(0, Math.min(1, normalized.x)),
                    y: Math.max(0, Math.min(1, normalized.y)),
                    width: Math.max(0.05, Math.min(1, normalized.width)),
                    height: Math.max(0.05, Math.min(1, normalized.height))
                };
            }
        }

        return null;
    },

    async blobToDataUrl(blob) {
        if (!(blob instanceof Blob)) return '';
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    },

    async optimizeImageBlob(sourceBlob, options = {}) {
        if (!(sourceBlob instanceof Blob)) {
            return null;
        }

        const maxSide = Math.max(800, Number(options.maxSide) || 2560);
        const sourceMime = String(options.sourceMime || sourceBlob.type || '').toLowerCase();
        const preferLossless = sourceMime === 'image/png' || sourceMime === 'image/svg+xml' || sourceMime === 'image/webp';
        const quality = preferLossless ? 1 : (Number.isFinite(Number(options.quality)) ? Number(options.quality) : 0.84);
        const outputMime = String(options.outputMime || 'image/webp');

        let bitmap = null;
        try {
            bitmap = await createImageBitmap(sourceBlob);
        } catch {
            bitmap = null;
        }
        if (!bitmap) {
            return {
                blob: sourceBlob,
                width: null,
                height: null,
                mime: sourceBlob.type || sourceMime || 'application/octet-stream',
                bytes: sourceBlob.size
            };
        }

        const sourceWidth = Math.max(1, Number(bitmap.width) || 1);
        const sourceHeight = Math.max(1, Number(bitmap.height) || 1);
        const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            bitmap.close?.();
            return {
                blob: sourceBlob,
                width: sourceWidth,
                height: sourceHeight,
                mime: sourceBlob.type || sourceMime || 'application/octet-stream',
                bytes: sourceBlob.size
            };
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        bitmap.close?.();

        const encodedBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), outputMime, quality);
        });
        if (!(encodedBlob instanceof Blob)) {
            return {
                blob: sourceBlob,
                width: targetWidth,
                height: targetHeight,
                mime: sourceBlob.type || sourceMime || 'application/octet-stream',
                bytes: sourceBlob.size
            };
        }

        const shouldKeepSource = scale >= 0.999
            && Number.isFinite(Number(sourceBlob.size))
            && sourceBlob.size > 0
            && encodedBlob.size >= (sourceBlob.size * 0.98);
        if (shouldKeepSource) {
            return {
                blob: sourceBlob,
                width: sourceWidth,
                height: sourceHeight,
                mime: sourceBlob.type || sourceMime || 'application/octet-stream',
                bytes: sourceBlob.size
            };
        }

        return {
            blob: encodedBlob,
            width: targetWidth,
            height: targetHeight,
            mime: encodedBlob.type || outputMime,
            bytes: encodedBlob.size
        };
    },

    collectSceneAssetIds(sceneLike = null) {
        const scene = sceneLike && typeof sceneLike === 'object'
            ? sceneLike
            : this.getDesignSceneV1?.();
        if (!scene || !Array.isArray(scene.elements)) {
            return [];
        }

        return scene.elements
            .map((element) => String(element?.assetRef?.assetId || element?.assetId || '').trim())
            .filter(Boolean);
    },

    compactDesignSceneForStorage(sceneLike = null, options = {}) {
        const scene = sceneLike && typeof sceneLike === 'object'
            ? sceneLike
            : this.getDesignSceneV1?.();
        if (!scene || !Array.isArray(scene.elements)) {
            return scene || null;
        }

        const stripImageSources = options?.stripImageSources !== false;
        const clone = JSON.parse(JSON.stringify(scene));

        clone.elements = clone.elements.map((element) => {
            if (!element || typeof element !== 'object' || String(element.type || '').toLowerCase() !== 'image') {
                return element;
            }

            const assetId = String(element?.assetRef?.assetId || element?.assetId || '').trim();
            if (!assetId) {
                return element;
            }

            const next = {
                ...element,
                assetId,
                assetRef: {
                    ...(element.assetRef && typeof element.assetRef === 'object' ? element.assetRef : {}),
                    assetId
                }
            };

            if (stripImageSources) {
                const src = String(next.src || '').trim();
                if (src.startsWith('data:image/') || src.startsWith('blob:')) {
                    next.src = '';
                }

                const originalSrc = String(next.originalSrc || '').trim();
                if (originalSrc.startsWith('data:image/') || originalSrc.startsWith('blob:')) {
                    next.originalSrc = '';
                }
            }

            return next;
        });

        return clone;
    },

    async hydrateDesignSceneImageSources(sceneLike = null, options = {}) {
        const source = sceneLike && typeof sceneLike === 'object'
            ? sceneLike
            : this.getDesignSceneV1?.();
        if (!source || !Array.isArray(source.elements)) {
            return source || null;
        }

        if (!window.CartAssetStore?.getImageAsset) {
            return source;
        }

        const mode = String(options.mode || 'dataUrl').toLowerCase();
        const hydrated = JSON.parse(JSON.stringify(source));

        for (const element of hydrated.elements) {
            if (!element || typeof element !== 'object' || String(element.type || '').toLowerCase() !== 'image') {
                continue;
            }

            const assetId = String(element?.assetRef?.assetId || element?.assetId || '').trim();
            if (!assetId) {
                continue;
            }

            const currentSrc = String(element.src || '').trim();
            if (currentSrc && !currentSrc.startsWith('blob:') && !currentSrc.startsWith('data:image/')) {
                continue;
            }

            try {
                const assetRecord = await window.CartAssetStore.getImageAsset(assetId);
                const blob = assetRecord?.blob instanceof Blob ? assetRecord.blob : null;
                if (!blob) {
                    continue;
                }

                const hydratedSrc = mode === 'objecturl' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
                    ? URL.createObjectURL(blob)
                    : await this.blobToDataUrl(blob);
                if (!hydratedSrc) {
                    continue;
                }

                element.src = hydratedSrc;
                if (!String(element.originalSrc || '').trim() || String(element.originalSrc || '').startsWith('blob:')) {
                    element.originalSrc = hydratedSrc;
                }

                if (!Number.isFinite(Number(element.fullWidth)) && Number.isFinite(Number(assetRecord?.width))) {
                    element.fullWidth = Number(assetRecord.width);
                }
                if (!Number.isFinite(Number(element.fullHeight)) && Number.isFinite(Number(assetRecord?.height))) {
                    element.fullHeight = Number(assetRecord.height);
                }
            } catch (error) {
                console.warn('Falha ao hidratar image asset no scene:', error);
            }
        }

        return hydrated;
    },

    buildShapePoints(shapeType, center, size) {
        const normalized = String(shapeType || 'triangle').trim().toLowerCase();
        const cx = Number(center?.x) || 0;
        const cy = Number(center?.y) || 0;
        const half = Math.max(1, Number(size) || 120) / 2;

        if (normalized === 'triangle') {
            return `${cx},${cy - half} ${cx + half},${cy + (half * 0.8)} ${cx - half},${cy + (half * 0.8)}`;
        }

        if (normalized === 'diamond') {
            return `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
        }

        if (normalized === 'hexagon') {
            const xInset = half * 0.55;
            return `${cx - xInset},${cy - half} ${cx + xInset},${cy - half} ${cx + half},${cy} ${cx + xInset},${cy + half} ${cx - xInset},${cy + half} ${cx - half},${cy}`;
        }

        if (normalized === 'arrow') {
            const shaft = half * 0.34;
            return `${cx - half},${cy - shaft} ${cx + shaft},${cy - shaft} ${cx + shaft},${cy - half} ${cx + half},${cy} ${cx + shaft},${cy + half} ${cx + shaft},${cy + shaft} ${cx - half},${cy + shaft}`;
        }

        if (normalized === 'star') {
            const outer = half;
            const inner = half * 0.45;
            const points = [];
            for (let i = 0; i < 10; i += 1) {
                const angle = (-90 + (i * 36)) * (Math.PI / 180);
                const radius = i % 2 === 0 ? outer : inner;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;
                points.push(`${x},${y}`);
            }
            return points.join(' ');
        }

        return `${cx},${cy - half} ${cx + half},${cy + half} ${cx - half},${cy + half}`;
    },

    createShapeElementFromDescriptor(data = {}) {
        const normalizedShapeType = String(data.shapeType || 'rectangle').trim().toLowerCase();
        const fill = data.fill || '#3b82f6';
        const stroke = data.stroke || 'none';
        const strokeWidth = Number(data.strokeWidth || 0);
        const center = {
            x: Number(data.x || 0) + (Number(data.width || 0) / 2),
            y: Number(data.y || 0) + (Number(data.height || 0) / 2)
        };
        const fallbackSize = this.getDefaultSquareElementSize?.(0.28) || 120;
        const minElementSize = this.getMinimumElementSize?.() || 1;
        const baseSize = Math.max(
            minElementSize,
            Number(data.size || Math.max(Number(data.width || 0), Number(data.height || 0)) || fallbackSize)
        );
        let shape;

        if (normalizedShapeType === 'circle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            const radius = Number.isFinite(Number(data.r))
                ? Math.max(minElementSize / 2, Number(data.r))
                : Math.max(minElementSize / 2, baseSize / 2);
            shape.setAttribute('cx', String(Number(data.cx ?? center.x) || center.x));
            shape.setAttribute('cy', String(Number(data.cy ?? center.y) || center.y));
            shape.setAttribute('r', String(radius));
        } else if (this.isPolygonShapeType?.(normalizedShapeType)) {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const points = Array.isArray(data.points) && data.points.length > 0
                ? data.points.map(([x, y]) => `${x},${y}`).join(' ')
                : typeof data.points === 'string' && data.points.trim()
                    ? data.points.trim()
                : this.buildShapePoints(normalizedShapeType, center, baseSize);
            shape.setAttribute('points', points);
        } else {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const width = Math.max(minElementSize, Number(data.width) || (normalizedShapeType === 'line' ? baseSize * 1.7 : normalizedShapeType === 'pill' ? baseSize * 1.5 : baseSize * 1.25));
            const height = Math.max(minElementSize * 0.5, Number(data.height) || (normalizedShapeType === 'line' ? Math.max(minElementSize * 0.5, baseSize * 0.13) : normalizedShapeType === 'pill' ? baseSize * 0.58 : baseSize * 0.84));
            shape.setAttribute('x', String(Number(data.x ?? (center.x - (width / 2))) || 0));
            shape.setAttribute('y', String(Number(data.y ?? (center.y - (height / 2))) || 0));
            shape.setAttribute('width', String(width));
            shape.setAttribute('height', String(height));
            if (normalizedShapeType === 'pill' || normalizedShapeType === 'line' || normalizedShapeType === 'rounded') {
                const rx = normalizedShapeType === 'line'
                    ? Math.max(minElementSize * 0.1, height / 2)
                    : Math.max(minElementSize * 0.25, Math.min(width, height) / 4);
                shape.setAttribute('rx', String(rx));
                shape.setAttribute('ry', String(rx));
            }
        }

        shape.setAttribute('fill', fill);
        shape.setAttribute('stroke', stroke);
        shape.setAttribute('stroke-width', String(strokeWidth));
        shape.setAttribute('data-editable', 'true');
        shape.dataset.shapeType = normalizedShapeType;
        shape.style.cursor = 'move';

        if (Number(data.rotation)) {
            const rotateX = normalizedShapeType === 'circle'
                ? (Number(data.cx ?? center.x) || center.x)
                : center.x;
            const rotateY = normalizedShapeType === 'circle'
                ? (Number(data.cy ?? center.y) || center.y)
                : center.y;
            shape.setAttribute('transform', `rotate(${Number(data.rotation)} ${rotateX} ${rotateY})`);
        }

        return shape;
    },

    focusPropertiesPanel() {
        if (this.isMobileViewport?.()) {
            return;
        }

        const drawer = document.getElementById('editor-properties-drawer');
        if (drawer) {
            drawer.classList.remove('hidden');
        }
    },

    updateSidebarMode() {
        const isMobile = Boolean(this.isMobileViewport?.());
        this.editorState = this.editorState || {};
        this.editorState.mode = isMobile ? 'mobile' : 'desktop';
        document.body.classList.toggle('editor-mode-mobile', isMobile);
        document.body.classList.toggle('editor-mode-desktop', !isMobile);

        if (isMobile) {
            const leftOpen = document.getElementById('editor-sidebar-left')?.classList.contains('panel-open');
            const rightOpen = document.getElementById('editor-sidebar-right')?.classList.contains('panel-open');
            const hasOpenPanel = Boolean(leftOpen || rightOpen);
            if (hasOpenPanel && this.editorState.activeMobilePanel) {
                this.openMobilePanel?.(this.editorState.activeMobilePanel);
            } else {
                this.closeMobilePanels?.();
            }
        } else {
            this.closeMobilePanels?.();
        }

        this.updateContextualToolbar?.(this.selectedElement);
    },

    clearPropertiesSections() {
        document.getElementById('no-selection')?.classList.remove('hidden');
        document.getElementById('text-properties')?.classList.add('hidden');
        document.getElementById('image-properties')?.classList.add('hidden');
        document.getElementById('qr-properties')?.classList.add('hidden');
        document.getElementById('shape-properties')?.classList.add('hidden');
    },

    clearSelection() {
        if (this._inlineTextEditorState) {
            this.closeInlineTextEditor?.(true);
        }
        this.hideGuideLines?.();
        document.body.classList.remove('is-resizing-element');
        this.selectedElement = null;
        this.editorState = this.editorState || {};
        this.editorState.selectionType = null;
        this.hideResizeHandles();
        this.elements.forEach(el => el.element.classList.remove('element-selected'));
        this.clearPropertiesSections();
        this.updateContextualToolbar?.(null);

        // Remove class from body to hide properties tab on mobile
        document.body.classList.remove('has-element-selected');
        this.updateLayers();
    },

    // ===== ADD ELEMENTS =====
    addText() {
        this.preventSidebarClose();
        const scale = this.getInsertionScale();
        const center = this.getEditableCenter();
        const baseFontSize = this.getDefaultTextSize?.() || Math.round(scale.shortSide * 0.09);
        const estimatedTextWidth = Math.min(scale.bounds.width * 0.7, Math.max(baseFontSize * 5.2, scale.bounds.width * 0.08));
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const defaultLabel = window.personalizerI18nText
            ? window.personalizerI18nText('Clique para editar')
            : 'Clique para editar';
        text.setAttribute('x', String(center.x - (estimatedTextWidth / 2)));
        text.setAttribute('y', String(center.y));
        text.setAttribute('font-family', 'Arial');
        text.setAttribute('font-size', String(baseFontSize));
        text.setAttribute('fill', '#000000');
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('xml:space', 'preserve');
        text.setAttribute('data-editable', 'true');
        text.dataset.rawContent = defaultLabel;
        text.textContent = this.getRenderedTextValue?.(defaultLabel, false) || defaultLabel;
        text.style.cursor = 'move';

        this.canvas.appendChild(text);
        this.bringPrintAreaOverlaysToFront();

        // Get actual bounding box after adding to DOM
        const bbox = text.getBBox();

        const elementData = {
            id: Date.now(),
            element: text,
            type: 'text',
            rawContent: defaultLabel,
            content: defaultLabel,
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
                const fallbackName = file.name ? file.name.replace(/\.[^.]+$/, '') : '';
                const imageName = fallbackName || (window.personalizerI18nText ? window.personalizerI18nText('Imagem') : 'Imagem');
                try {
                    const cropped = await this.openUploadCropModal(src);
                    if (cropped) {
                        let finalDataUrl = cropped.dataUrl;
                        let finalWidth = cropped.width;
                        let finalHeight = cropped.height;
                        let imageAssetId = '';

                        try {
                            const sourceBlob = cropped.blob instanceof Blob
                                ? cropped.blob
                                : await (async () => {
                                    const response = await fetch(cropped.dataUrl);
                                    return await response.blob();
                                })();
                            const optimized = await this.optimizeImageBlob(sourceBlob, {
                                sourceMime: file.type,
                                maxSide: 2560,
                                quality: 0.84,
                                outputMime: 'image/webp'
                            });

                            if (optimized?.blob) {
                                if (window.CartAssetStore?.saveImageAsset) {
                                    const saved = await window.CartAssetStore.saveImageAsset(optimized.blob, {
                                        mime: optimized.mime,
                                        width: optimized.width,
                                        height: optimized.height
                                    });
                                    imageAssetId = String(saved?.assetId || saved?.id || '').trim();
                                }

                                finalDataUrl = await this.blobToDataUrl(optimized.blob) || finalDataUrl;
                                finalWidth = Number(optimized.width) || finalWidth;
                                finalHeight = Number(optimized.height) || finalHeight;
                            }
                        } catch (assetError) {
                            console.warn('Falha ao otimizar/guardar image asset. A usar dataURL direto.', assetError);
                        }

                        this.addImageFromSource(finalDataUrl, finalWidth || cropped.width, finalHeight || cropped.height, imageName, {
                            originalSrc: finalDataUrl,
                            assetId: imageAssetId,
                            sourceMime: file.type || '',
                            cropData: cropped.cropData,
                            fullWidth: finalWidth || cropped.fullWidth,
                            fullHeight: finalHeight || cropped.fullHeight
                        });
                    }
                } catch (error) {
                    console.error('Erro ao inserir imagem:', error);
                    showToast(
                        window.personalizerI18nText
                            ? window.personalizerI18nText('Não foi possível inserir a imagem')
                            : 'Não foi possível inserir a imagem',
                        'error'
                    );
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

        const updateSelectionState = (nextRect) => {
            const state = this.uploadCropState;
            if (!state?.imageRect) return;

            const imageRect = state.imageRect;
            const minSize = 36;
            const boundedWidth = Math.max(minSize, Math.min(nextRect.width, imageRect.width));
            const boundedHeight = Math.max(minSize, Math.min(nextRect.height, imageRect.height));
            const boundedX = Math.max(imageRect.x, Math.min(nextRect.x, imageRect.x + imageRect.width - boundedWidth));
            const boundedY = Math.max(imageRect.y, Math.min(nextRect.y, imageRect.y + imageRect.height - boundedHeight));

            state.selectionRect = {
                x: boundedX,
                y: boundedY,
                width: boundedWidth,
                height: boundedHeight
            };

            state.selectionNormalized = {
                x: (boundedX - imageRect.x) / imageRect.width,
                y: (boundedY - imageRect.y) / imageRect.height,
                width: boundedWidth / imageRect.width,
                height: boundedHeight / imageRect.height
            };

            this.renderUploadCropSelection();
        };

        const startPointer = (event) => {
            if (!this.uploadCropState) return;
            if (cropIsRecentTouch() && event.pointerSource === 'mouse') return;
            if (event.button !== undefined && event.button !== 0) return;

            // Verificar se o clique foi em um handle de resize
            const isHandle = event.target?.closest?.('.upload-crop-handle') !== null;
            if (isHandle) {
                // Não iniciar pan se clicou em um handle - o handle tem seu próprio listener
                return;
            }

            // Iniciar pan em qualquer outro lugar do stage
            const isSelection = event.target?.closest?.('.upload-crop-selection') !== null;
            this.uploadCropState.dragging = {
                mode: isSelection ? 'move-selection' : 'pan',
                startX: event.clientX,
                startY: event.clientY,
                rect: isSelection && this.uploadCropState.selectionRect ? { ...this.uploadCropState.selectionRect } : null,
                offsetX: this.uploadCropState.viewport.offsetX,
                offsetY: this.uploadCropState.viewport.offsetY
            };
            stage.classList.add('is-panning');
            event.preventDefault();
        };

        const movePointer = (event) => {
            if (!this.uploadCropState?.dragging) return;
            if (cropIsRecentTouch() && event.pointerSource === 'mouse') return;

            const state = this.uploadCropState;
            const drag = state.dragging;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            const minSize = 36;
            const imageRect = state.imageRect;

            if (drag.mode === 'pan') {
                const newOffsetX = drag.offsetX + dx;
                const newOffsetY = drag.offsetY + dy;

                // Limitar pan para nao afastar demasiado da imagem
                // Desktop: 80% para todos os lados
                // Mobile: 100% horizontal, 80% vertical
                const isTouch = event.pointerSource === 'touch';
                const maxOffsetX = imageRect.width * (isTouch ? 1.0 : 0.8);
                const maxOffsetY = imageRect.height * 0.8;
                const minOffsetX = -maxOffsetX;
                const minOffsetY = -maxOffsetY;

                const clampedOffsetX = Math.max(minOffsetX, Math.min(maxOffsetX, newOffsetX));
                const clampedOffsetY = Math.max(minOffsetY, Math.min(maxOffsetY, newOffsetY));

                state.viewport.offsetX = clampedOffsetX;
                state.viewport.offsetY = clampedOffsetY;

                // Se atingiu o limite, atualizar startX/startY para evitar acumulacao
                // e dead zone quando inverter direcao
                if (clampedOffsetX !== newOffsetX) {
                    drag.startX = event.clientX - (clampedOffsetX - drag.offsetX);
                }
                if (clampedOffsetY !== newOffsetY) {
                    drag.startY = event.clientY - (clampedOffsetY - drag.offsetY);
                }

                this.layoutUploadCropModal(false);
                return;
            }

            if (drag.mode === 'move-selection') {
                const rect = drag.rect || state.selectionRect;
                if (!rect) return;
                updateSelectionState({
                    ...rect,
                    x: rect.x + dx,
                    y: rect.y + dy
                });
                return;
            }

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

            updateSelectionState({
                x: next.x,
                y: next.y,
                width: Math.max(minSize, next.width),
                height: Math.max(minSize, next.height)
            });
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

        stage.addEventListener('mousedown', (event) => {
            startPointer({
                clientX: event.clientX,
                clientY: event.clientY,
                button: event.button,
                target: event.target,
                pointerSource: 'mouse',
                preventDefault: () => event.preventDefault()
            });
        });

        // Touch events for mobile
        let pinchStartDistance = 0;
        let pinchStartScale = 1;
        let pinchCenter = { x: 0, y: 0 };

        const getPinchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const getPinchCenter = (touches) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        };

        const startTouchPointer = (event) => {
            if (event.touches.length === 2) {
                // Iniciar pinch zoom
                event.preventDefault();
                pinchStartDistance = getPinchDistance(event.touches);
                pinchStartScale = this.uploadCropState?.viewport?.scale || 1;
                pinchCenter = getPinchCenter(event.touches);
                const stageRect = stage.getBoundingClientRect();
                pinchCenter.x -= stageRect.left;
                pinchCenter.y -= stageRect.top;
                return;
            }
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
            if (event.touches.length === 2 && this.uploadCropState) {
                // Pinch zoom
                event.preventDefault();
                const currentDistance = getPinchDistance(event.touches);
                if (pinchStartDistance > 0) {
                    const scaleRatio = currentDistance / pinchStartDistance;
                    const state = this.uploadCropState;
                    const minScale = 1;
                    const maxScale = 6;
                    const newScale = Math.min(maxScale, Math.max(minScale, pinchStartScale * scaleRatio));

                    if (newScale !== state.viewport.scale) {
                        const prevRect = state.imageRect;
                        const relX = prevRect.width ? (pinchCenter.x - prevRect.x) / prevRect.width : 0.5;
                        const relY = prevRect.height ? (pinchCenter.y - prevRect.y) / prevRect.height : 0.5;

                        state.viewport.scale = newScale;
                        this.layoutUploadCropModal(false);

                        const nextRect = state.imageRect;
                        state.viewport.offsetX += pinchCenter.x - (nextRect.x + nextRect.width * relX);
                        state.viewport.offsetY += pinchCenter.y - (nextRect.y + nextRect.height * relY);
                        this.layoutUploadCropModal(false);
                    }
                }
                return;
            }
            if (event.touches.length !== 1) return;
            cropLastTouchAt = Date.now();
            event.preventDefault();
            const touch = event.touches[0];
            movePointer({ clientX: touch.clientX, clientY: touch.clientY, pointerSource: 'touch' });
        };

        const endTouchPointer = () => {
            cropLastTouchAt = Date.now();
            pinchStartDistance = 0;
            endPointer({ pointerSource: 'touch' });
        };

        stage.addEventListener('touchstart', startTouchPointer, { passive: false });
        document.addEventListener('touchmove', moveTouchPointer, { passive: false });
        document.addEventListener('touchend', endTouchPointer);
        document.addEventListener('touchcancel', endTouchPointer);

        document.addEventListener('mousemove', (event) => {
            movePointer({
                clientX: event.clientX,
                clientY: event.clientY,
                pointerSource: 'mouse'
            });
        });
        document.addEventListener('mouseup', (event) => {
            endPointer({ pointerSource: 'mouse' });
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

    openUploadCropModal(imageSrc, initialCropData = null) {
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
                initialCropData,
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

                // Configurar event listeners nos handles de resize
                const handles = selection.querySelectorAll('.upload-crop-handle');
                handles.forEach(handle => {
                    const handleName = handle.dataset.handle;

                    const startResize = (event) => {
                        event.stopPropagation();
                        event.preventDefault();

                        if (!this.uploadCropState) return;

                        const clientX = event.clientX || event.touches?.[0]?.clientX;
                        const clientY = event.clientY || event.touches?.[0]?.clientY;

                        this.uploadCropState.dragging = {
                            mode: 'resize',
                            handle: handleName,
                            startX: clientX,
                            startY: clientY,
                            rect: { ...this.uploadCropState.selectionRect }
                        };
                    };

                    handle.addEventListener('mousedown', startResize);
                    handle.addEventListener('touchstart', startResize, { passive: false });
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

        const normalizedInitialCropData = this.normalizeCropSelectionData(
            this.uploadCropState.initialCropData
        );

        if (resetSelection || !this.uploadCropState.selectionNormalized) {
            // Se ha cropData inicial (imagem ja cortada), usar ele
            if (normalizedInitialCropData) {
                this.uploadCropState.selectionNormalized = {
                    x: normalizedInitialCropData.x,
                    y: normalizedInitialCropData.y,
                    width: normalizedInitialCropData.width,
                    height: normalizedInitialCropData.height
                };
            } else {
                this.uploadCropState.selectionNormalized = {
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1
                };
            }
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

        const clampRatio = (value, fallback) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return fallback;
            }
            return Math.max(0, Math.min(1, numeric));
        };

        const cropSelection = {
            x: clampRatio(normalized.x, 0),
            y: clampRatio(normalized.y, 0),
            width: Math.max(0.05, clampRatio(normalized.width, 1)),
            height: Math.max(0.05, clampRatio(normalized.height, 1))
        };

        const isFullImageSelection = (
            cropSelection.x <= 0.0005 &&
            cropSelection.y <= 0.0005 &&
            Math.abs(1 - cropSelection.width) <= 0.0005 &&
            Math.abs(1 - cropSelection.height) <= 0.0005
        );

        if (isFullImageSelection) {
            return {
                dataUrl: this.uploadCropState.imageSrc,
                width: naturalWidth,
                height: naturalHeight,
                fullWidth: naturalWidth,
                fullHeight: naturalHeight,
                cropData: {
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1
                }
            };
        }

        const canvas = document.createElement('canvas');
        const cropWidth = Math.max(1, Math.round(cropSelection.width * naturalWidth));
        const cropHeight = Math.max(1, Math.round(cropSelection.height * naturalHeight));
        const sourceX = Math.round(cropSelection.x * naturalWidth);
        const sourceY = Math.round(cropSelection.y * naturalHeight);

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: cropWidth,
            height: cropHeight,
            fullWidth: naturalWidth,
            fullHeight: naturalHeight,
            cropData: {
                x: cropSelection.x,
                y: cropSelection.y,
                width: cropSelection.width,
                height: cropSelection.height
            }
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
        const qrSize = this.getDefaultSquareElementSize?.(0.28) || 120;

        try {
            const dataUrl = this.generateQRCodeDataUrl(content, color);
            this.addImageFromSource(dataUrl, qrSize, qrSize, 'QR Code', {
                imageKind: 'qr',
                qrContent: content,
                qrColor: color
            });
            showToast(
                window.personalizerI18nText
                    ? window.personalizerI18nText('QR code adicionado ao design')
                    : 'QR code adicionado ao design',
                'success'
            );
        } catch (error) {
            console.error('Erro ao gerar QR code:', error);
            showToast(
                window.personalizerI18nText
                    ? window.personalizerI18nText('Não foi possível gerar o QR code')
                    : 'Não foi possível gerar o QR code',
                'error'
            );
        }
    },

    generateQRCodeDataUrl(content, color = '#111827') {
        if (typeof qrcode !== 'function') {
            throw new Error(
                window.personalizerI18nText
                    ? window.personalizerI18nText('Biblioteca de QR code indisponível')
                    : 'Biblioteca de QR code indisponível'
            );
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

    addImageFromSource(src, width, height, name = window.personalizerI18nText ? window.personalizerI18nText('Imagem') : 'Imagem', options = {}) {
        const fitted = this.fitSizeIntoEditableBounds(width, height, 0.45);
        const center = this.getEditableCenter();
        const imageKind = options.imageKind || 'image';
        const qrContent = options.qrContent || '';
        const qrColor = options.qrColor || '#111827';
        const cropData = options.cropData || null;
        const fullWidth = options.fullWidth || width;
        const fullHeight = options.fullHeight || height;
        const originalSrc = options.originalSrc || src;
        const cropSourceData = options.cropSourceData || null;
        const assetId = String(options.assetId || '').trim();
        const objectFit = String(options.objectFit || 'contain').toLowerCase();
        const flipX = Boolean(options.flipX);
        const flipY = Boolean(options.flipY);
        const layerLabel = options.layerLabel || this.getNextImageLayerLabel(imageKind === 'qr' ? 'QR Code' : 'Imagem');
        const x = center.x - (fitted.width / 2);
        const y = center.y - (fitted.height / 2);

        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('x', String(x));
        img.setAttribute('y', String(y));
        img.setAttribute('width', String(fitted.width));
        img.setAttribute('height', String(fitted.height));
        img.setAttribute('href', src);
        img.setAttribute('data-editable', 'true');
        img.setAttribute(
            'preserveAspectRatio',
            objectFit === 'fill' ? 'none' : objectFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
        );
        img.dataset.name = name;
        img.dataset.imageKind = imageKind;
        img.dataset.originalSrc = originalSrc;
        img.dataset.objectFit = objectFit;
        img.dataset.layerLabel = layerLabel;
        img.dataset.baseX = String(x);
        img.dataset.baseY = String(y);
        img.dataset.baseWidth = String(fitted.width);
        img.dataset.baseHeight = String(fitted.height);
        img.dataset.flipX = flipX ? 'true' : 'false';
        img.dataset.flipY = flipY ? 'true' : 'false';
        if (assetId) {
            img.dataset.assetId = assetId;
        } else {
            delete img.dataset.assetId;
        }

        if (cropData) {
            img.dataset.cropData = JSON.stringify(cropData);
            img.dataset.fullWidth = String(fullWidth);
            img.dataset.fullHeight = String(fullHeight);
            if (cropSourceData) {
                img.dataset.cropSourceData = JSON.stringify(cropSourceData);
            } else {
                img.dataset.cropSourceData = JSON.stringify({
                    x: cropData.x * fullWidth,
                    y: cropData.y * fullHeight,
                    width: cropData.width * fullWidth,
                    height: cropData.height * fullHeight
                });
            }
        }

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
            x,
            y,
            width: fitted.width,
            height: fitted.height,
            baseX: x,
            baseY: y,
            baseWidth: fitted.width,
            baseHeight: fitted.height,
            src,
            name,
            imageKind,
            qrContent,
            qrColor,
            originalSrc,
            layerLabel,
            assetId,
            assetRef: assetId ? { assetId } : null,
            cropData,
            fullWidth,
            fullHeight,
            flipX,
            flipY,
            cropSourceData: cropSourceData || (cropData ? {
                x: cropData.x * fullWidth,
                y: cropData.y * fullHeight,
                width: cropData.width * fullWidth,
                height: cropData.height * fullHeight
            } : null),
            opacity: 1,
            rotation: 0
        };

        this.elements.push(elementData);
        this.syncImageGeometryState?.(elementData, {
            x,
            y,
            width: fitted.width,
            height: fitted.height
        });
        this.makeElementInteractive(elementData);
        this.selectElement(elementData);
        this.updateLayers();
        this.saveHistory();
    },

    addShape(shapeType) {
        this.preventSidebarClose();
        const center = this.getEditableCenter();
        const baseSize = this.getDefaultSquareElementSize?.(0.28) || 120;
        const shape = this.createShapeElementFromDescriptor({
            shapeType,
            x: center.x - (baseSize / 2),
            y: center.y - (baseSize / 2),
            width: baseSize,
            height: baseSize,
            fill: '#3b82f6',
            stroke: 'none',
            strokeWidth: 0
        });

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
