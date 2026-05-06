// ============================================================
// CANVAS & VIEWPORT
// ============================================================
Object.assign(DesignEditor.prototype, {

    getEditableBounds() {
        // Bounds stay in SVG coordinates. The visible limits then scale with
        // the design canvas transform instead of the fixed viewport wrapper.
        return this.getCanvasBounds();
    },

    getCanvasBounds() {
        const vb = this.getCanvasViewBoxSize();
        return {
            // Limites em coordenadas reais do viewBox (inclui origem x/y).
            // Isto evita "encolher/deslocar" limites quando o template não começa em 0 0.
            x: Number(vb.x) || 0,
            y: Number(vb.y) || 0,
            width: vb.width,
            height: vb.height
        };
    },

    getElementLimitBounds() {
        // Legacy callers still ask for element bounds. Keep the contract, but
        // make the workspace effectively open so elements are not pushed back.
        const range = Number.MAX_SAFE_INTEGER / 8;
        return {
            x: -range,
            y: -range,
            width: range * 2,
            height: range * 2
        };
    },

    getCanvasViewportMetrics() {
        const rect = this.canvas?.getBoundingClientRect?.();
        const vb = this.getCanvasViewBoxSize();

        if (!rect || !rect.width || !rect.height || !vb.width || !vb.height) {
            return {
                rect: rect || { left: 0, top: 0, width: 0, height: 0 },
                vb,
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                renderedWidth: rect?.width || 0,
                renderedHeight: rect?.height || 0
            };
        }

        const preserveAspectRatio = String(this.canvas?.getAttribute?.('preserveAspectRatio') || '').toLowerCase();
        const useSlice = preserveAspectRatio.includes('slice');
        const scale = (useSlice
            ? Math.max(rect.width / vb.width, rect.height / vb.height)
            : Math.min(rect.width / vb.width, rect.height / vb.height)) || 1;
        const renderedWidth = vb.width * scale;
        const renderedHeight = vb.height * scale;

        return {
            rect,
            vb,
            scale,
            renderedWidth,
            renderedHeight,
            offsetX: (rect.width - renderedWidth) / 2,
            offsetY: (rect.height - renderedHeight) / 2
        };
    },

    syncCanvasWrapperToStage(width, height) {
        if (!this.canvasWrapper) {
            return false;
        }

        const nextWidth = Math.max(1, Math.round(Number(width) || 0));
        const nextHeight = Math.max(1, Math.round(Number(height) || 0));
        if (!nextWidth || !nextHeight) {
            return false;
        }

        const currentWidth = parseFloat(this.canvasWrapper.style.width || '');
        const currentHeight = parseFloat(this.canvasWrapper.style.height || '');
        if (currentWidth !== nextWidth || currentHeight !== nextHeight) {
            this.canvasWrapper.style.width = `${nextWidth}px`;
            this.canvasWrapper.style.height = `${nextHeight}px`;
        }
        this.canvasWrapper.style.transform = '';
        this.canvasWrapper.style.overflow = 'visible';

        if (this.canvas?.style) {
            this.canvas.style.overflow = 'visible';
            this.canvas.setAttribute('overflow', 'visible');
        }

        const checkerSize = 20;
        this.canvasWrapper.style.setProperty('--checker-size', `${checkerSize.toFixed(2)}px`);

        this.applyCameraTransform?.();
        return true;
    },

    clampCameraOffset(wrapperWidth = null, wrapperHeight = null) {
        const nextX = Number.isFinite(Number(this.cameraOffset?.x)) ? Number(this.cameraOffset.x) : 0;
        const nextY = Number.isFinite(Number(this.cameraOffset?.y)) ? Number(this.cameraOffset.y) : 0;
        this.cameraOffset = { x: nextX, y: nextY };
        return this.cameraOffset;
    },

    applyCameraTransform() {
        if (!this.canvasWrapper) return;
        const offsetX = Number(this.cameraOffset?.x) || 0;
        const offsetY = Number(this.cameraOffset?.y) || 0;
        const zoom = Math.max(0.5, Math.min(5, Number(this.zoom) || 1));

        this.canvasWrapper.style.transform = '';
        this.canvasWrapper.style.overflow = 'visible';

        if (this.canvas?.style) {
            this.canvas.style.overflow = 'visible';
            this.canvas.setAttribute('overflow', 'visible');
            this.canvas.style.transformOrigin = 'center center';
            this.canvas.style.transformBox = 'fill-box';
            this.canvas.style.willChange = 'transform';
            this.canvas.style.transform = `translate3d(${offsetX.toFixed(3)}px, ${offsetY.toFixed(3)}px, 0) scale(${zoom.toFixed(4)})`;
        }
        this.updateResetViewButtonVisibility?.();
    },

    setCameraOffset(x, y, options = {}) {
        this.cameraOffset = {
            x: Number(x) || 0,
            y: Number(y) || 0
        };
        this.applyCameraTransform?.();
        if (options.refreshHandles && this.selectedElement) {
            this.requestHandlesRefresh?.();
        }
    },

    updateZoomLevelDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round((Number(this.zoom) || 1) * 100) + '%';
        }
    },

    resetCanvasView() {
        this.hideGuideLines?.();
        this.zoom = Number(this.initialZoom) || 0.9;
        this.cameraOffset = { x: 0, y: 0 };
        this.syncCanvasViewport?.();
        this.applyCameraTransform?.();
        this.updateZoomLevelDisplay?.();
        if (this.selectedElement) {
            this.requestHandlesRefresh?.();
        }
        this.updateDesktopFloatingToolbarPosition?.();
        this.updateResetViewButtonVisibility?.();
    },

    getProjectViewportRect() {
        const projectNode = this.canvas?.querySelector?.('#print-area-shape-outline, #print-area-shape-outline-border')
            || this.printArea
            || this.canvas;
        const rect = projectNode?.getBoundingClientRect?.();
        if (rect && Number(rect.width) > 0 && Number(rect.height) > 0) {
            return rect;
        }
        return null;
    },

    isProjectVisibleInCanvasStage() {
        const stageRect = this.canvasStage?.getBoundingClientRect?.();
        const projectRect = this.getProjectViewportRect();
        if (!stageRect || !projectRect || stageRect.width <= 0 || stageRect.height <= 0) {
            return true;
        }

        const visibleWidth = Math.max(0, Math.min(stageRect.right, projectRect.right) - Math.max(stageRect.left, projectRect.left));
        const visibleHeight = Math.max(0, Math.min(stageRect.bottom, projectRect.bottom) - Math.max(stageRect.top, projectRect.top));
        return visibleWidth > 4 && visibleHeight > 4;
    },

    updateResetViewButtonVisibility() {
        const button = document.getElementById('reset-view-btn');
        if (!button) return;
        const shouldShow = !this.isProjectVisibleInCanvasStage();
        button.classList.toggle('is-visible', shouldShow);
        button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        button.tabIndex = shouldShow ? 0 : -1;
    },

    constrainResizeRect(startBox, proposedBox, handle, bounds) {
        const minWidth = 20;
        const minHeight = 20;
        const startLeft = startBox.x;
        const startTop = startBox.y;
        const startRight = startBox.x + startBox.width;
        const startBottom = startBox.y + startBox.height;

        let left = proposedBox.x;
        let top = proposedBox.y;
        let right = proposedBox.x + proposedBox.width;
        let bottom = proposedBox.y + proposedBox.height;

        const movesWest = handle.includes('w');
        const movesEast = handle.includes('e');
        const movesNorth = handle.includes('n');
        const movesSouth = handle.includes('s');

        if (movesWest && !movesEast) {
            left = Math.min(left, startRight - minWidth);
            right = startRight;
        } else if (movesEast && !movesWest) {
            left = startLeft;
            right = Math.max(right, startLeft + minWidth);
        } else {
            if ((right - left) < minWidth) {
                const centerX = (left + right) / 2;
                left = centerX - (minWidth / 2);
                right = centerX + (minWidth / 2);
            }
        }

        if (movesNorth && !movesSouth) {
            top = Math.min(top, startBottom - minHeight);
            bottom = startBottom;
        } else if (movesSouth && !movesNorth) {
            top = startTop;
            bottom = Math.max(bottom, startTop + minHeight);
        } else {
            if ((bottom - top) < minHeight) {
                const centerY = (top + bottom) / 2;
                top = centerY - (minHeight / 2);
                bottom = centerY + (minHeight / 2);
            }
        }

        return {
            x: left,
            y: top,
            width: Math.max(minWidth, right - left),
            height: Math.max(minHeight, bottom - top)
        };
    },

    constrainResizeRectWithRatio(startBox, proposedBox, handle, bounds, ratio) {
        const safeRatio = Math.max(0.0001, Number(ratio) || 1);
        const minWidthByHeight = 20 * safeRatio;
        const minWidth = Math.max(20, minWidthByHeight);
        const minHeightByWidth = 20 / safeRatio;
        const minHeight = Math.max(20, minHeightByWidth);
        const startRight = startBox.x + startBox.width;
        const startBottom = startBox.y + startBox.height;
        const startCenterX = startBox.x + (startBox.width / 2);
        const startCenterY = startBox.y + (startBox.height / 2);

        const normalize = (value, min) => Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min);

        const buildFromWidth = (width, anchorX, anchorY, fromLeft, fromTop) => {
            const h = width / safeRatio;
            return {
                x: fromLeft ? anchorX : anchorX - width,
                y: fromTop ? anchorY : anchorY - h,
                width,
                height: h
            };
        };

        if (handle === 'se') {
            const anchorX = startBox.x;
            const anchorY = startBox.y;
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = normalize(targetWidth, minWidth);
            return buildFromWidth(width, anchorX, anchorY, true, true);
        }

        if (handle === 'sw') {
            const anchorX = startRight;
            const anchorY = startBox.y;
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = normalize(targetWidth, minWidth);
            return buildFromWidth(width, anchorX, anchorY, false, true);
        }

        if (handle === 'ne') {
            const anchorX = startBox.x;
            const anchorY = startBottom;
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = normalize(targetWidth, minWidth);
            return buildFromWidth(width, anchorX, anchorY, true, false);
        }

        if (handle === 'nw') {
            const anchorX = startRight;
            const anchorY = startBottom;
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = normalize(targetWidth, minWidth);
            return buildFromWidth(width, anchorX, anchorY, false, false);
        }

        if (handle === 'e' || handle === 'w') {
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = normalize(targetWidth, minWidth);
            const height = width / safeRatio;
            const y = startCenterY - (height / 2);
            const x = handle === 'e' ? startBox.x : startRight - width;
            return { x, y, width, height };
        }

        if (handle === 's' || handle === 'n') {
            const targetHeight = Math.max(proposedBox.height, proposedBox.width / safeRatio);
            const height = normalize(targetHeight, minHeight);
            const width = height * safeRatio;
            const x = startCenterX - (width / 2);
            const y = handle === 's' ? startBox.y : startBottom - height;
            return { x, y, width, height };
        }

        return this.constrainResizeRect(startBox, proposedBox, handle, bounds);
    },

    getEditableCenter() {
        const bounds = this.getEditableBounds();
        return {
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2)
        };
    },

    getCanvasViewBoxSize() {
        const viewBoxAttr = this.canvas?.getAttribute('viewBox') || '';
        const parts = viewBoxAttr.trim().split(/\s+/).map(Number);
        if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
            return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
        }

        const fallbackWidth = Number(this.baseCanvasSize?.width) || 800;
        const fallbackHeight = Number(this.baseCanvasSize?.height) || 600;
        return { x: 0, y: 0, width: fallbackWidth, height: fallbackHeight };
    },

    setCanvasViewBoxFromBounds(bounds) {
        if (!this.canvas) {
            return this.getCanvasViewBoxSize();
        }

        const normalized = {
            x: Number.isFinite(Number(bounds?.x)) ? Number(bounds.x) : 0,
            y: Number.isFinite(Number(bounds?.y)) ? Number(bounds.y) : 0,
            width: Math.max(1, Math.round(Number(bounds?.width) || Number(this.baseCanvasSize?.width) || 800)),
            height: Math.max(1, Math.round(Number(bounds?.height) || Number(this.baseCanvasSize?.height) || 600))
        };

        this.canvas.setAttribute('viewBox', `${normalized.x} ${normalized.y} ${normalized.width} ${normalized.height}`);
        this.baseCanvasSize = {
            width: normalized.width,
            height: normalized.height
        };

        // Força recalcular viewport/câmara com a nova geometria do canvas.
        this.initialCanvasSize = null;
        this._lastViewportViewBoxWidth = null;
        this._lastViewportViewBoxHeight = null;
        this.syncCanvasViewport?.();

        return { width: normalized.width, height: normalized.height };
    },

    getViewportDrivenCanvasSize(stageWidth = 0) {
        const viewBox = this.getCanvasViewBoxSize();
        const viewportHeight = Number(window.visualViewport?.height || window.innerHeight || 0);
        const heightFromViewport = Math.max(320, Math.round(viewportHeight * 0.8));
        const aspectRatio = Math.max(0.0001, viewBox.width / viewBox.height);
        const widthFromViewport = Math.round(heightFromViewport * aspectRatio);
        const availableWidth = Math.max(0, Number(stageWidth) || 0);

        if (availableWidth > 0 && widthFromViewport > availableWidth) {
            const scale = availableWidth / widthFromViewport;
            return {
                width: Math.max(1, Math.round(widthFromViewport * scale)),
                height: Math.max(1, Math.round(heightFromViewport * scale))
            };
        }

        return {
            width: Math.max(1, widthFromViewport),
            height: Math.max(1, heightFromViewport)
        };
    },

    getEditorScaleMetrics(bounds = null) {
        const rawBounds = bounds || this.getCanvasBounds?.() || this.getEditableBounds?.() || {
            x: 0,
            y: 0,
            width: 800,
            height: 600
        };
        const width = Math.max(1, Number(rawBounds.width) || 800);
        const height = Math.max(1, Number(rawBounds.height) || 600);
        const safeBounds = {
            x: Number(rawBounds.x) || 0,
            y: Number(rawBounds.y) || 0,
            width,
            height
        };

        return {
            bounds: safeBounds,
            shortSide: Math.max(1, Math.min(width, height)),
            longSide: Math.max(width, height)
        };
    },

    getInsertionScale() {
        return this.getEditorScaleMetrics();
    },

    getMinimumElementSize(ratio = 0.012) {
        const scale = this.getEditorScaleMetrics();
        return Math.max(1, Math.min(24, scale.shortSide * ratio));
    },

    getDefaultSquareElementSize(ratio = 0.28) {
        const scale = this.getEditorScaleMetrics();
        return Math.round(Math.max(this.getMinimumElementSize(), scale.shortSide * ratio));
    },

    getTextSizeLimits() {
        const scale = this.getEditorScaleMetrics();
        return {
            min: Math.max(2, Math.min(14, scale.shortSide * 0.012)),
            max: Math.max(5000, Math.ceil(scale.longSide * 12))
        };
    },

    getTextSizeStep() {
        const scale = this.getEditorScaleMetrics();
        return Math.max(1, Math.round(scale.shortSide * 0.005));
    },

    clampTextSize(value) {
        const limits = this.getTextSizeLimits();
        const numeric = Number(value);
        const safeValue = Number.isFinite(numeric) ? numeric : limits.min;
        return Math.min(limits.max, Math.max(limits.min, safeValue));
    },

    getDefaultTextSize() {
        const scale = this.getEditorScaleMetrics();
        return Math.round(this.clampTextSize(scale.shortSide * 0.09));
    },

    syncTextSizeControls(size) {
        const limits = this.getTextSizeLimits();
        const clampedSize = this.clampTextSize(size);
        const roundedSize = Math.round(clampedSize);
        const min = Math.max(1, Math.floor(limits.min));
        const max = Math.max(roundedSize, Math.ceil(limits.max));
        const step = this.getTextSizeStep();
        const range = document.getElementById('prop-text-size');
        const labels = [
            document.getElementById('prop-text-size-val'),
            document.getElementById('top-text-size-label'),
            document.getElementById('desktop-text-size-label')
        ];

        if (range) {
            range.min = String(min);
            range.max = String(max);
            range.step = String(step);
            range.value = String(roundedSize);
        }

        labels.forEach((label) => {
            if (label) {
                label.textContent = String(roundedSize);
            }
        });

        return clampedSize;
    },

    fitSizeIntoEditableBounds(width, height, maxRatio = 0.42, options = {}) {
        const scale = this.getEditorScaleMetrics();
        const bounds = scale.bounds;
        const ratioLimit = Math.max(0.01, Math.min(1, Number(maxRatio) || 0.42));
        const maxWidth = Math.max(0.0001, bounds.width * ratioLimit);
        const maxHeight = Math.max(0.0001, bounds.height * ratioLimit);

        const fallbackSize = Math.min(maxWidth, maxHeight);
        const baseWidth = Math.max(0.0001, Number(width) || fallbackSize);
        const baseHeight = Math.max(0.0001, Number(height) || fallbackSize);
        const fitRatio = Math.min(maxWidth / baseWidth, maxHeight / baseHeight);
        const appliedRatio = options.allowUpscale === false
            ? Math.min(fitRatio, 1)
            : fitRatio;

        return {
            width: baseWidth * appliedRatio,
            height: baseHeight * appliedRatio
        };
    },

    clientToSvgPoint(clientX, clientY) {
        const metrics = this.getCanvasViewportMetrics();
        const rect = metrics.rect;

        return {
            x: (Number(metrics.vb?.x) || 0) + ((clientX - rect.left - metrics.offsetX) / metrics.scale),
            y: (Number(metrics.vb?.y) || 0) + ((clientY - rect.top - metrics.offsetY) / metrics.scale)
        };
    },

    clientDeltaToSvgDelta(deltaClientX, deltaClientY) {
        const metrics = this.getCanvasViewportMetrics();
        if (!metrics.rect.width || !metrics.rect.height || !metrics.scale) {
            return { dx: 0, dy: 0 };
        }

        return {
            dx: deltaClientX / metrics.scale,
            dy: deltaClientY / metrics.scale
        };
    },

    sanitizeColorValue(value, fallback = '#000000') {
        if (typeof value !== 'string') {
            return fallback;
        }

        const normalized = value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
            return normalized;
        }

        if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
            const [r, g, b] = normalized.slice(1).split('');
            return `#${r}${r}${g}${g}${b}${b}`;
        }

        return fallback;
    }


});
