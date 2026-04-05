// ============================================================
// GEOMETRY, TRANSFORMS & GUIDES
// ============================================================
Object.assign(DesignEditor.prototype, {
    ensureGuideLineLayer() {
        if (!this.canvas) {
            return null;
        }

        let layer = this.canvas.querySelector('#guide-lines-layer');
        if (!layer) {
            layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            layer.setAttribute('id', 'guide-lines-layer');
            layer.setAttribute('pointer-events', 'none');
            layer.setAttribute('aria-hidden', 'true');
            this.canvas.appendChild(layer);
        } else if (layer.parentNode === this.canvas && layer !== this.canvas.lastElementChild) {
            // Keep guide lines above overlays/print border to avoid disappearing while dragging.
            this.canvas.appendChild(layer);
        }

        return layer;
    },

    offsetElementGeometry(elementData, deltaX, deltaY, pointSet = null) {
        if (!elementData || (!deltaX && !deltaY && !pointSet)) {
            return;
        }

        const toFinite = (value, fallback = 0) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : fallback;
        };

        if (elementData.type === 'text' || elementData.type === 'image' || (elementData.type === 'shape' && this.isRectLikeShapeType?.(elementData.shapeType))) {
            const currentX = pointSet
                ? toFinite(pointSet.x, parseFloat(elementData.element.getAttribute('x') || '0'))
                : toFinite(parseFloat(elementData.element.getAttribute('x') || '0') + deltaX, parseFloat(elementData.element.getAttribute('x') || '0'));
            const currentY = pointSet
                ? toFinite(pointSet.y, parseFloat(elementData.element.getAttribute('y') || '0'))
                : toFinite(parseFloat(elementData.element.getAttribute('y') || '0') + deltaY, parseFloat(elementData.element.getAttribute('y') || '0'));
            elementData.element.setAttribute('x', currentX);
            elementData.element.setAttribute('y', currentY);
            elementData.x = currentX;
            elementData.y = currentY;
            return;
        }

        if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            const currentCx = pointSet
                ? toFinite(pointSet.x, parseFloat(elementData.element.getAttribute('cx') || '0'))
                : toFinite(parseFloat(elementData.element.getAttribute('cx') || '0') + deltaX, parseFloat(elementData.element.getAttribute('cx') || '0'));
            const currentCy = pointSet
                ? toFinite(pointSet.y, parseFloat(elementData.element.getAttribute('cy') || '0'))
                : toFinite(parseFloat(elementData.element.getAttribute('cy') || '0') + deltaY, parseFloat(elementData.element.getAttribute('cy') || '0'));
            elementData.element.setAttribute('cx', currentCx);
            elementData.element.setAttribute('cy', currentCy);
            elementData.x = currentCx;
            elementData.y = currentCy;
            return;
        }

        if (elementData.type === 'shape' && this.isPolygonShapeType?.(elementData.shapeType)) {
            const sourcePoints = pointSet || (elementData.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));

            if (sourcePoints.length >= 3) {
                const translatedPoints = pointSet
                    ? sourcePoints
                    : sourcePoints.map(([x, y]) => [x + deltaX, y + deltaY]);
                elementData.element.setAttribute(
                    'points',
                    translatedPoints.map(([x, y]) => `${x},${y}`).join(' ')
                );
            }
        }
    },

    buildElementTransform(elementData, rotation = elementData.rotation || 0) {
        if (!elementData?.element?.getBBox) {
            return '';
        }

        const safeRotation = Number(rotation) || 0;
        const flipX = Boolean(elementData.flipX);
        const flipY = Boolean(elementData.flipY);
        if (!safeRotation && !flipX && !flipY) {
            return '';
        }

        const bbox = elementData.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const scaleX = flipX ? -1 : 1;
        const scaleY = flipY ? -1 : 1;

        return [
            `translate(${centerX} ${centerY})`,
            safeRotation ? `rotate(${safeRotation})` : '',
            (flipX || flipY) ? `scale(${scaleX} ${scaleY})` : '',
            `translate(${-centerX} ${-centerY})`
        ].filter(Boolean).join(' ');
    },

    applyElementRotation(elementData, rotation = elementData.rotation || 0) {
        const transform = this.buildElementTransform(elementData, rotation);
        if (!transform) {
            elementData.element.removeAttribute('transform');
            return;
        }

        elementData.element.setAttribute('transform', transform);
    },

    moveElementBy(elementData, deltaX, deltaY) {
        if (!elementData || (!deltaX && !deltaY)) {
            return;
        }

        this.offsetElementGeometry(elementData, deltaX, deltaY);
        this.applyElementRotation(elementData);
        this.bringElementInBounds(elementData);
    },

    setElementTransform(elementData, translateX, translateY, rotation) {
        this.applyElementRotation(elementData, rotation);
    },

    getGuideBounds() {
        const outline = this.canvas?.querySelector?.('#print-area-shape-outline-border, #print-area-shape-outline');
        if (outline?.getBBox) {
            try {
                const bbox = outline.getBBox();
                if (bbox && bbox.width > 0 && bbox.height > 0) {
                    return {
                        x: bbox.x,
                        y: bbox.y,
                        width: bbox.width,
                        height: bbox.height
                    };
                }
            } catch {
                // Fall back to editable bounds below.
            }
        }

        return this.getEditableBounds();
    },

    getResizeAnchorPoint(box, handle) {
        const left = box.x;
        const right = box.x + box.width;
        const top = box.y;
        const bottom = box.y + box.height;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        switch (handle) {
            case 'se': return { x: left, y: top };
            case 'sw': return { x: right, y: top };
            case 'ne': return { x: left, y: bottom };
            case 'nw': return { x: right, y: bottom };
            case 'e': return { x: left, y: centerY };
            case 'w': return { x: right, y: centerY };
            case 's': return { x: centerX, y: top };
            case 'n': return { x: centerX, y: bottom };
            default: return { x: left, y: top };
        }
    },

    getElementCanvasPoint(element, x, y) {
        const ctm = element.getCTM();
        if (!ctm) {
            return { x, y };
        }

        const point = new DOMPoint(x, y).matrixTransform(ctm);
        return { x: point.x, y: point.y };
    },

    captureResizeState(elementData) {
        const state = {
            transform: elementData.element.getAttribute('transform')
        };

        if (elementData.type === 'text') {
            state.x = elementData.element.getAttribute('x');
            state.y = elementData.element.getAttribute('y');
            state.fontSize = elementData.element.getAttribute('font-size');
        } else if (elementData.type === 'image' || (elementData.type === 'shape' && this.isRectLikeShapeType?.(elementData.shapeType))) {
            state.x = elementData.element.getAttribute('x');
            state.y = elementData.element.getAttribute('y');
            state.width = elementData.element.getAttribute('width');
            state.height = elementData.element.getAttribute('height');
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            state.cx = elementData.element.getAttribute('cx');
            state.cy = elementData.element.getAttribute('cy');
            state.r = elementData.element.getAttribute('r');
        } else if (elementData.type === 'shape' && this.isPolygonShapeType?.(elementData.shapeType)) {
            state.points = elementData.element.getAttribute('points');
        }

        return state;
    },

    restoreResizeState(elementData, state) {
        if (!state) return;

        if (elementData.type === 'text') {
            elementData.element.setAttribute('x', state.x);
            elementData.element.setAttribute('y', state.y);
            elementData.element.setAttribute('font-size', state.fontSize);
        } else if (elementData.type === 'image' || (elementData.type === 'shape' && this.isRectLikeShapeType?.(elementData.shapeType))) {
            elementData.element.setAttribute('x', state.x);
            elementData.element.setAttribute('y', state.y);
            elementData.element.setAttribute('width', state.width);
            elementData.element.setAttribute('height', state.height);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            elementData.element.setAttribute('cx', state.cx);
            elementData.element.setAttribute('cy', state.cy);
            elementData.element.setAttribute('r', state.r);
        } else if (elementData.type === 'shape' && this.isPolygonShapeType?.(elementData.shapeType)) {
            elementData.element.setAttribute('points', state.points);
        }

        if (state.transform) {
            elementData.element.setAttribute('transform', state.transform);
        } else {
            elementData.element.removeAttribute('transform');
        }
    },

    applyResizeAnchor(elementData) {
        if (!this.dragStart?.anchorCanvasPoint || !this.resizeHandle) {
            return;
        }

        const rotation = elementData.rotation || 0;
        this.applyElementRotation(elementData, rotation);

        const currentBox = elementData.element.getBBox();
        const anchorLocalPoint = this.getResizeAnchorPoint(currentBox, this.resizeHandle);
        const currentAnchorPoint = this.getElementCanvasPoint(
            elementData.element,
            anchorLocalPoint.x,
            anchorLocalPoint.y
        );

        const offsetX = this.dragStart.anchorCanvasPoint.x - currentAnchorPoint.x;
        const offsetY = this.dragStart.anchorCanvasPoint.y - currentAnchorPoint.y;
        if (offsetX || offsetY) {
            this.offsetElementGeometry(elementData, offsetX, offsetY);
        }

        this.applyElementRotation(elementData, rotation);
    },

    applyRotatedResizeAnchor(elementData) {
        this.applyResizeAnchor(elementData);
    },

    moveElementFromDragStart(elementData, deltaX, deltaY) {
        if (!elementData || !this.dragStart) {
            return;
        }

        if (elementData.type === 'text' || elementData.type === 'image' || (elementData.type === 'shape' && this.isRectLikeShapeType?.(elementData.shapeType))) {
            this.offsetElementGeometry(elementData, 0, 0, {
                x: (this.dragStart.elementX || 0) + deltaX,
                y: (this.dragStart.elementY || 0) + deltaY
            });
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            this.offsetElementGeometry(elementData, 0, 0, {
                x: (this.dragStart.elementX || 0) + deltaX,
                y: (this.dragStart.elementY || 0) + deltaY
            });
        } else if (elementData.type === 'shape' && this.isPolygonShapeType?.(elementData.shapeType)) {
            const startPoints = this.dragStart.points || [];
            if (startPoints.length >= 3) {
                this.offsetElementGeometry(
                    elementData,
                    0,
                    0,
                    startPoints.map(([x, y]) => [x + deltaX, y + deltaY])
                );
            }
        }

        this.applyElementRotation(elementData);
        this.bringElementInBounds(elementData);
    },

    normalizeRotation(rotation) {
        // Clean up floating point errors
        const deadzone = 0.1;
        if (Math.abs(rotation) < deadzone) {
            return 0;
        }

        // Only allow 0.5 degree increments.
        rotation = Math.round(rotation * 2) / 2;

        // Normalize to 0-360 range
        rotation = ((rotation % 360) + 360) % 360;

        return Number(rotation.toFixed(1));
    },

    getResizeCursor(handle, rotation = 0) {
        const vectors = {
            n: { x: 0, y: -1 },
            ne: { x: 1, y: -1 },
            e: { x: 1, y: 0 },
            se: { x: 1, y: 1 },
            s: { x: 0, y: 1 },
            sw: { x: -1, y: 1 },
            w: { x: -1, y: 0 },
            nw: { x: -1, y: -1 }
        };

        const vector = vectors[handle] || vectors.se;
        const rad = (Number(rotation) || 0) * Math.PI / 180;
        const rotated = {
            x: vector.x * Math.cos(rad) - vector.y * Math.sin(rad),
            y: vector.x * Math.sin(rad) + vector.y * Math.cos(rad)
        };

        // Browser cursors are most consistent with these 4 resize families.
        const families = [
            { name: 'ns-resize', x: 0, y: 1 },
            { name: 'ew-resize', x: 1, y: 0 },
            { name: 'nwse-resize', x: 1, y: 1 },
            { name: 'nesw-resize', x: 1, y: -1 }
        ];

        let best = families[0].name;
        let bestDot = -Infinity;
        const length = Math.hypot(rotated.x, rotated.y) || 1;
        const nx = rotated.x / length;
        const ny = rotated.y / length;

        families.forEach((family) => {
            const fl = Math.hypot(family.x, family.y) || 1;
            const fx = family.x / fl;
            const fy = family.y / fl;
            const dot = Math.abs(nx * fx + ny * fy);
            if (dot > bestDot) {
                bestDot = dot;
                best = family.name;
            }
        });

        return best;
    },

    // ===== GUIDES & ALIGNMENT =====
    calculateGuides(elementData) {
        if (!elementData) return { horizontal: [], vertical: [] };

        const bounds = this.getGuideBounds();
        const horizontal = [];
        const vertical = [];

        // Canvas centre
        horizontal.push({ value: bounds.y + bounds.height / 2, type: 'center-canvas' });
        vertical.push({ value: bounds.x + bounds.width / 2, type: 'center-canvas' });

        // Canvas edges
        horizontal.push({ value: bounds.y, type: 'edge-canvas' });
        horizontal.push({ value: bounds.y + bounds.height, type: 'edge-canvas' });
        vertical.push({ value: bounds.x, type: 'edge-canvas' });
        vertical.push({ value: bounds.x + bounds.width, type: 'edge-canvas' });

        // Other elements: centres and edges
        this.elements.forEach(el => {
            if (el === elementData || !el.element) return;
            const t = this.getTransformedBounds(el);
            // horizontal guides (for Y-axis alignment)
            horizontal.push({ value: t.top,                       type: 'edge-element' });
            horizontal.push({ value: (t.top + t.bottom) / 2,      type: 'center-element' });
            horizontal.push({ value: t.bottom,                    type: 'edge-element' });
            // vertical guides (for X-axis alignment)
            vertical.push({ value: t.left,                        type: 'edge-element' });
            vertical.push({ value: (t.left + t.right) / 2,        type: 'center-element' });
            vertical.push({ value: t.right,                       type: 'edge-element' });
        });

        return { horizontal, vertical };
    },

    findSnapPoints(position, guides, threshold) {
        const snaps = { x: null, y: null };

        // Snap horizontal
        guides.horizontal.forEach(guide => {
            const diff = Math.abs(position.y - guide.value);
            if (diff < threshold && diff < (snaps.y?.diff === undefined ? Infinity : snaps.y.diff)) {
                snaps.y = { value: guide.value, diff, type: guide.type };
            }
        });

        // Snap vertical
        guides.vertical.forEach(guide => {
            const diff = Math.abs(position.x - guide.value);
            if (diff < threshold && diff < (snaps.x?.diff === undefined ? Infinity : snaps.x.diff)) {
                snaps.x = { value: guide.value, diff, type: guide.type };
            }
        });

        return snaps;
    },

    clearGuideLineArtifacts() {
        const trackedLines = Array.isArray(this.guideLines) ? this.guideLines : [];
        trackedLines.forEach((line) => {
            try {
                line?.remove?.();
            } catch {
                // ignore stale nodes
            }
        });
        this.guideLines = [];

        if (!this.canvas?.querySelectorAll) {
            return;
        }

        this.canvas.querySelectorAll('#guide-lines-layer .guide-line').forEach((line) => {
            try {
                line.remove();
            } catch {
                // ignore stale nodes
            }
        });

        this.canvas.querySelectorAll('.guide-line').forEach((line) => {
            try {
                line.remove();
            } catch {
                // ignore stale nodes
            }
        });
    },

    showGuideLines(snaps) {
        this.clearGuideLineArtifacts();

        if (!this.showGuides) return;

        if (!snaps.x && !snaps.y) return;

        const guideLayer = this.ensureGuideLineLayer();
        if (!guideLayer) return;

        const b = this.getGuideBounds();
        const x0 = b.x;
        const y0 = b.y;
        const x1 = b.x + b.width;
        const y1 = b.y + b.height;

        const styleFor = (type) => {
            if (type === 'center-canvas') {
                return {
                    stroke: '#ef4825',
                    strokeWidth: '1.9',
                    dash: '8,4',
                    opacity: '0.96'
                };
            }

            if (type === 'edge-canvas') {
                return {
                    stroke: '#ef4825',
                    strokeWidth: '1.5',
                    dash: '7,4',
                    opacity: '0.88'
                };
            }

            if (type === 'center-element') {
                return {
                    stroke: '#0f172a',
                    strokeWidth: '1',
                    dash: '3,4',
                    opacity: '0.58'
                };
            }

            return {
                stroke: '#64748b',
                strokeWidth: '0.9',
                dash: '2,4',
                opacity: '0.52'
            };
        };

        const makeLine = (x1v, y1v, x2v, y2v, type) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(x1v));
            line.setAttribute('y1', String(y1v));
            line.setAttribute('x2', String(x2v));
            line.setAttribute('y2', String(y2v));
            const style = styleFor(type);
            line.setAttribute('stroke', style.stroke);
            line.setAttribute('stroke-width', style.strokeWidth);
            line.setAttribute('stroke-dasharray', style.dash);
            line.setAttribute('vector-effect', 'non-scaling-stroke');
            line.setAttribute('pointer-events', 'none');
            line.setAttribute('class', 'guide-line guide-line-support');
            line.setAttribute('opacity', style.opacity);
            guideLayer.appendChild(line);
            this.guideLines.push(line);
        };

        if (snaps.x) makeLine(snaps.x.value, y0, snaps.x.value, y1, snaps.x.type);
        if (snaps.y) makeLine(x0, snaps.y.value, x1, snaps.y.value, snaps.y.type);
    },

    hideGuideLines() {
        this.clearGuideLineArtifacts();
    },

    getRotationGuideSnap(rotation, threshold = 4) {
        if (!Number.isFinite(rotation)) {
            return { snapped: false, value: rotation, guide: null, diff: Infinity };
        }

        const normalized = this.normalizeRotation(rotation);
        const guide = Math.round(normalized / 45) * 45;
        const wrappedGuide = this.normalizeRotation(guide);
        const diff = Math.abs((((normalized - wrappedGuide) % 360) + 540) % 360 - 180);

        if (diff <= threshold) {
            return { snapped: true, value: wrappedGuide, guide: wrappedGuide, diff };
        }

        return { snapped: false, value: normalized, guide: wrappedGuide, diff };
    },

    showRotationGuideLine(rotation, center) {
        this.clearGuideLineArtifacts();

        if (!this.showGuides) return;

        if (!Number.isFinite(rotation) || !center) return;

        const guideLayer = this.ensureGuideLineLayer();
        if (!guideLayer) return;

        const snap = this.getRotationGuideSnap(rotation, 4);

        if (!snap.snapped) {
            return;
        }

        const snapped = snap.value;

        const bounds = this.getEditableBounds();
        const lineLength = Math.hypot(bounds.width, bounds.height) * 1.25;
        const angleRad = (snapped * Math.PI) / 180;
        const dx = Math.cos(angleRad) * lineLength;
        const dy = Math.sin(angleRad) * lineLength;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(center.x - dx));
        line.setAttribute('y1', String(center.y - dy));
        line.setAttribute('x2', String(center.x + dx));
        line.setAttribute('y2', String(center.y + dy));
        line.setAttribute('stroke', '#ef4825');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-dasharray', '6,6');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        line.setAttribute('pointer-events', 'none');
        line.setAttribute('class', 'guide-line guide-line-rotation');
        line.setAttribute('opacity', '0.9');
        guideLayer.appendChild(line);
        this.guideLines.push(line);

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', String(center.x));
        ring.setAttribute('cy', String(center.y));
        ring.setAttribute('r', '6');
        ring.setAttribute('fill', '#ffffff');
        ring.setAttribute('stroke', '#ef4825');
        ring.setAttribute('stroke-width', '1.5');
        ring.setAttribute('vector-effect', 'non-scaling-stroke');
        ring.setAttribute('pointer-events', 'none');
        ring.setAttribute('class', 'guide-line guide-line-rotation-center');
        ring.setAttribute('opacity', '0.95');
        guideLayer.appendChild(ring);
        this.guideLines.push(ring);
    },

    applySnapToMove(deltaX, deltaY, snaps, proposedCenter) {
        let snappedDeltaX = deltaX;
        let snappedDeltaY = deltaY;

        if (snaps.x && Math.abs(snaps.x.diff) < this.guideThreshold && proposedCenter) {
            // Keep snap incremental to avoid runaway jumps while dragging.
            snappedDeltaX += snaps.x.value - proposedCenter.x;
        }

        if (snaps.y && Math.abs(snaps.y.diff) < this.guideThreshold && proposedCenter) {
            // Keep snap incremental to avoid runaway jumps while dragging.
            snappedDeltaY += snaps.y.value - proposedCenter.y;
        }

        return { deltaX: snappedDeltaX, deltaY: snappedDeltaY };
    },

    resolveStickySnap(axis, nextSnap, proposedCenterValue) {
        if (!this.dragStart?.snapLock) {
            return nextSnap;
        }

        const lockedSnap = this.dragStart.snapLock[axis];
        if (nextSnap) {
            this.dragStart.snapLock[axis] = nextSnap;
            return nextSnap;
        }

        if (!lockedSnap) {
            return null;
        }

        const releaseDistance = Math.max(this.guideThreshold + 2, this.guideReleaseThreshold);
        const distanceFromLockedAxis = Math.abs(proposedCenterValue - lockedSnap.value);

        if (distanceFromLockedAxis <= releaseDistance) {
            return lockedSnap;
        }

        this.dragStart.snapLock[axis] = null;
        return null;
    },

    applySnapToGrid(deltaX, deltaY, gridSize) {
        return {
            deltaX: Math.round(deltaX / gridSize) * gridSize,
            deltaY: Math.round(deltaY / gridSize) * gridSize
        };
    }


});
