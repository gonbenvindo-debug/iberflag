// ============================================================
// CANVAS & VIEWPORT
// ============================================================
Object.assign(DesignEditor.prototype, {

    getEditableBounds() {
        const stageRect = this.canvasStage?.getBoundingClientRect?.();
        const metrics = this.getCanvasViewportMetrics?.();

        if (
            stageRect &&
            Number.isFinite(stageRect.width) &&
            Number.isFinite(stageRect.height) &&
            stageRect.width > 0 &&
            stageRect.height > 0 &&
            metrics &&
            metrics.rect &&
            Number.isFinite(metrics.rect.width) &&
            Number.isFinite(metrics.rect.height) &&
            metrics.rect.width > 0 &&
            metrics.rect.height > 0 &&
            Number.isFinite(metrics.scale) &&
            metrics.scale > 0
        ) {
            // Use the actual canvas-stage bounds, mapped into SVG coordinates.
            // This keeps drag/resize limits aligned with the full checkerboard
            // area, not just the rendered SVG element box.
            const left = ((stageRect.left - metrics.rect.left) - metrics.offsetX) / metrics.scale;
            const top = ((stageRect.top - metrics.rect.top) - metrics.offsetY) / metrics.scale;
            const right = ((stageRect.right - metrics.rect.left) - metrics.offsetX) / metrics.scale;
            const bottom = ((stageRect.bottom - metrics.rect.top) - metrics.offsetY) / metrics.scale;

            return {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top
            };
        }

        return this.getWorkspaceBounds();
    },

    getCanvasBounds() {
        const vb = this.getCanvasViewBoxSize();
        return {
            x: 0,
            y: 0,
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
            return { width: parts[2], height: parts[3] };
        }

        const fallbackWidth = Number(this.baseCanvasSize?.width) || 800;
        const fallbackHeight = Number(this.baseCanvasSize?.height) || 600;
        return { width: fallbackWidth, height: fallbackHeight };
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
            x: ((clientX - rect.left - metrics.offsetX) / metrics.scale),
            y: ((clientY - rect.top - metrics.offsetY) / metrics.scale)
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
