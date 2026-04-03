// ============================================================
// CANVAS & VIEWPORT
// ============================================================
Object.assign(DesignEditor.prototype, {

    getEditableBounds() {
        // Limites de edição = design-canvas inteiro (viewBox completo).
        // Isto mantém drag/resize sempre dentro da área total do canvas,
        // independentemente de zoom/pan/viewport visível.
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
        this.clampCameraOffset?.(nextWidth, nextHeight);
        this.applyCameraTransform?.();
        return true;
    },

    clampCameraOffset(wrapperWidth = null, wrapperHeight = null) {
        if (!this.canvasStage) {
            this.cameraOffset = { x: 0, y: 0 };
            return this.cameraOffset;
        }

        const stageRect = this.canvasStage.getBoundingClientRect();
        const stageWidth = Number(stageRect?.width) || this.canvasStage.clientWidth || 0;
        const stageHeight = Number(stageRect?.height) || this.canvasStage.clientHeight || 0;
        const currentWrapperWidth = Math.max(
            1,
            Number(wrapperWidth) || parseFloat(this.canvasWrapper?.style?.width || '') || this.canvasWrapper?.clientWidth || 1
        );
        const currentWrapperHeight = Math.max(
            1,
            Number(wrapperHeight) || parseFloat(this.canvasWrapper?.style?.height || '') || this.canvasWrapper?.clientHeight || 1
        );

        const maxX = Math.max(0, (currentWrapperWidth - stageWidth) / 2);
        const maxY = Math.max(0, (currentWrapperHeight - stageHeight) / 2);

        const nextX = Math.min(maxX, Math.max(-maxX, Number(this.cameraOffset?.x) || 0));
        const nextY = Math.min(maxY, Math.max(-maxY, Number(this.cameraOffset?.y) || 0));
        this.cameraOffset = { x: nextX, y: nextY };
        return this.cameraOffset;
    },

    applyCameraTransform() {
        if (!this.canvasWrapper) return;
        const offsetX = Math.round(Number(this.cameraOffset?.x) || 0);
        const offsetY = Math.round(Number(this.cameraOffset?.y) || 0);
        this.canvasWrapper.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    },

    setCameraOffset(x, y, options = {}) {
        this.cameraOffset = {
            x: Number(x) || 0,
            y: Number(y) || 0
        };
        this.clampCameraOffset?.();
        this.applyCameraTransform?.();
        if (options.refreshHandles && this.selectedElement) {
            this.requestHandlesRefresh?.();
        }
    },

    constrainResizeRect(startBox, proposedBox, handle, bounds) {
        const minWidth = 20;
        const minHeight = 20;
        const startLeft = startBox.x;
        const startTop = startBox.y;
        const startRight = startBox.x + startBox.width;
        const startBottom = startBox.y + startBox.height;
        const maxRight = bounds.x + bounds.width;
        const maxBottom = bounds.y + bounds.height;

        let left = proposedBox.x;
        let top = proposedBox.y;
        let right = proposedBox.x + proposedBox.width;
        let bottom = proposedBox.y + proposedBox.height;

        const movesWest = handle.includes('w');
        const movesEast = handle.includes('e');
        const movesNorth = handle.includes('n');
        const movesSouth = handle.includes('s');

        if (movesWest && !movesEast) {
            left = Math.max(bounds.x, Math.min(left, startRight - minWidth));
            right = startRight;
        } else if (movesEast && !movesWest) {
            left = startLeft;
            right = Math.min(maxRight, Math.max(right, startLeft + minWidth));
        } else {
            // When moving both sides (corner handles), keep within bounds
            if (movesWest && movesEast) {
                left = Math.max(bounds.x, left);
                right = Math.min(maxRight, right);
            }
            // Ensure minimum size
            if ((right - left) < minWidth) {
                const centerX = (left + right) / 2;
                left = centerX - (minWidth / 2);
                right = centerX + (minWidth / 2);
                // Clamp to bounds if needed
                if (left < bounds.x) {
                    left = bounds.x;
                    right = left + minWidth;
                } else if (right > maxRight) {
                    right = maxRight;
                    left = right - minWidth;
                }
            }
        }

        if (movesNorth && !movesSouth) {
            top = Math.max(bounds.y, Math.min(top, startBottom - minHeight));
            bottom = startBottom;
        } else if (movesSouth && !movesNorth) {
            top = startTop;
            bottom = Math.min(maxBottom, Math.max(bottom, startTop + minHeight));
        } else {
            // When moving both sides (corner handles), keep within bounds
            if (movesNorth && movesSouth) {
                top = Math.max(bounds.y, top);
                bottom = Math.min(maxBottom, bottom);
            }
            // Ensure minimum size
            if ((bottom - top) < minHeight) {
                const centerY = (top + bottom) / 2;
                top = centerY - (minHeight / 2);
                bottom = centerY + (minHeight / 2);
                // Clamp to bounds if needed
                if (top < bounds.y) {
                    top = bounds.y;
                    bottom = top + minHeight;
                } else if (bottom > maxBottom) {
                    bottom = maxBottom;
                    top = bottom - minHeight;
                }
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
        const maxRight = bounds.x + bounds.width;
        const maxBottom = bounds.y + bounds.height;
        const startRight = startBox.x + startBox.width;
        const startBottom = startBox.y + startBox.height;
        const startCenterX = startBox.x + (startBox.width / 2);
        const startCenterY = startBox.y + (startBox.height / 2);

        const clamp = (value, min, max) => {
            if (!Number.isFinite(value)) return min;
            if (max < min) return Math.max(1, max);
            return Math.min(max, Math.max(min, value));
        };

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
            const maxWidth = Math.min(maxRight - anchorX, (maxBottom - anchorY) * safeRatio);
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = clamp(targetWidth, minWidth, maxWidth);
            return buildFromWidth(width, anchorX, anchorY, true, true);
        }

        if (handle === 'sw') {
            const anchorX = startRight;
            const anchorY = startBox.y;
            const maxWidth = Math.min(anchorX - bounds.x, (maxBottom - anchorY) * safeRatio);
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = clamp(targetWidth, minWidth, maxWidth);
            return buildFromWidth(width, anchorX, anchorY, false, true);
        }

        if (handle === 'ne') {
            const anchorX = startBox.x;
            const anchorY = startBottom;
            const maxWidth = Math.min(maxRight - anchorX, (anchorY - bounds.y) * safeRatio);
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = clamp(targetWidth, minWidth, maxWidth);
            return buildFromWidth(width, anchorX, anchorY, true, false);
        }

        if (handle === 'nw') {
            const anchorX = startRight;
            const anchorY = startBottom;
            const maxWidth = Math.min(anchorX - bounds.x, (anchorY - bounds.y) * safeRatio);
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = clamp(targetWidth, minWidth, maxWidth);
            return buildFromWidth(width, anchorX, anchorY, false, false);
        }

        if (handle === 'e' || handle === 'w') {
            const maxHeightByCenter = 2 * Math.min(startCenterY - bounds.y, maxBottom - startCenterY);
            const maxWidthByHeight = maxHeightByCenter * safeRatio;
            const maxWidthBySide = handle === 'e'
                ? (maxRight - startBox.x)
                : (startRight - bounds.x);
            const maxWidth = Math.min(maxWidthBySide, maxWidthByHeight);
            const targetWidth = Math.max(proposedBox.width, proposedBox.height * safeRatio);
            const width = clamp(targetWidth, minWidth, maxWidth);
            const height = width / safeRatio;
            const y = startCenterY - (height / 2);
            const x = handle === 'e' ? startBox.x : startRight - width;
            return { x, y, width, height };
        }

        if (handle === 's' || handle === 'n') {
            const maxWidthByCenter = 2 * Math.min(startCenterX - bounds.x, maxRight - startCenterX);
            const maxHeightByWidth = maxWidthByCenter / safeRatio;
            const maxHeightBySide = handle === 's'
                ? (maxBottom - startBox.y)
                : (startBottom - bounds.y);
            const maxHeight = Math.min(maxHeightBySide, maxHeightByWidth);
            const targetHeight = Math.max(proposedBox.height, proposedBox.width / safeRatio);
            const height = clamp(targetHeight, minHeight, maxHeight);
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

    getInsertionScale() {
        const bounds = this.getEditableBounds();
        const shortSide = Math.max(120, Math.min(bounds.width, bounds.height));
        const longSide = Math.max(bounds.width, bounds.height);
        return { bounds, shortSide, longSide };
    },

    fitSizeIntoEditableBounds(width, height, maxRatio = 0.42) {
        const bounds = this.getEditableBounds();
        const maxWidth = Math.max(32, bounds.width * maxRatio);
        const maxHeight = Math.max(32, bounds.height * maxRatio);

        const baseWidth = Math.max(1, Number(width) || maxWidth);
        const baseHeight = Math.max(1, Number(height) || maxHeight);
        const ratio = Math.min(maxWidth / baseWidth, maxHeight / baseHeight, 1);

        return {
            width: baseWidth * ratio,
            height: baseHeight * ratio
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
