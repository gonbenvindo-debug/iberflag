// ============================================================
// HANDLES, SELECTION & INTERACTIONS
// ============================================================
Object.assign(DesignEditor.prototype, {

    makeElementInteractive(elementData) {
        this.syncElementMetadata(elementData);

        // Prevent text selection on element
        elementData.element.style.userSelect = 'none';
        elementData.element.style.webkitUserSelect = 'none';
        
        // Track double-click for text editing
        let lastClickTime = 0;
        const doubleClickThreshold = 300;
        
        const handleElementPress = () => {
            this.selectElement(elementData);
            
            // Double-click/tap to edit text
            const now = Date.now();
            if (now - lastClickTime < doubleClickThreshold && elementData.type === 'text') {
                const textContent = document.getElementById('prop-text-content');
                if (textContent) {
                    textContent.focus();
                    textContent.select();
                }
            }
            lastClickTime = now;
        };
        
        elementData.element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.startDrag(e, elementData);
            handleElementPress();
        });

        elementData.element.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            e.stopPropagation();
            e.preventDefault();
            const t = e.touches[0];
            this._touchGestureActive = true;
            this._activeGestureTouchId = t.identifier;
            this.startDrag({ clientX: t.clientX, clientY: t.clientY }, elementData);
            handleElementPress();
        }, { passive: false });
    },
    
    selectElement(elementData, options = {}) {
        const { skipReposition = false } = options;

        // Blur any active input to prevent focus blocking drag
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            document.activeElement.blur();
        }
        
        // Deselect all
        this.elements.forEach(el => {
            el.element.classList.remove('element-selected');
        });
        
        this.selectedElement = elementData;
        elementData.element.classList.add('element-selected');
        
        // Add class to body for mobile tab visibility
        document.body.classList.add('has-element-selected');
        
        // Ensure element is within bounds before showing handles
        if (!skipReposition) {
            this.bringElementInBounds(elementData);
        }
        
        // Show resize handles
        this.showResizeHandles(elementData);
        
        // Update properties panel
        this.updatePropertiesPanel(elementData);
        this.updateSidebarMode();

        // Bring attention to properties automatically.
        this.focusPropertiesPanel();
    },
    
    getTransformedBounds(elementData) {
        // Calculate the actual bounding box of an element after transformation
        const bbox = elementData.element.getBBox();
        const ctm = elementData.element.getScreenCTM();
        
        if (!ctm) {
            // If no CTM, return element's local bounds
            return {
                left: bbox.x,
                right: bbox.x + bbox.width,
                top: bbox.y,
                bottom: bbox.y + bbox.height
            };
        }
        
        // Transform all 4 corners of the bounding box
        const corners = [
            new DOMPoint(bbox.x, bbox.y),
            new DOMPoint(bbox.x + bbox.width, bbox.y),
            new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
            new DOMPoint(bbox.x, bbox.y + bbox.height)
        ];
        
        const transformedCorners = corners.map(corner => corner.matrixTransform(ctm));
        
        // Find min/max of transformed corners (in SVG coordinates)
        const svgRect = this.canvas.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) {
            return {
                left: bbox.x,
                right: bbox.x + bbox.width,
                top: bbox.y,
                bottom: bbox.y + bbox.height
            };
        }
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        transformedCorners.forEach(corner => {
            // Convert from client coords to SVG coords
            const vb = this.getCanvasViewBoxSize();
            const svgX = (corner.x - svgRect.left) / svgRect.width * vb.width;
            const svgY = (corner.y - svgRect.top) / svgRect.height * vb.height;
            if (!Number.isFinite(svgX) || !Number.isFinite(svgY)) return;
            minX = Math.min(minX, svgX);
            maxX = Math.max(maxX, svgX);
            minY = Math.min(minY, svgY);
            maxY = Math.max(maxY, svgY);
        });

        if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
            return {
                left: bbox.x,
                right: bbox.x + bbox.width,
                top: bbox.y,
                bottom: bbox.y + bbox.height
            };
        }
        
        return {
            left: minX,
            right: maxX,
            top: minY,
            bottom: maxY
        };
    },

    isElementFullyInsideEditableBounds(elementData) {
        const bounds = this.getEditableBounds();
        const transformed = this.getTransformedBounds(elementData);
        return (
            transformed.left >= bounds.x &&
            transformed.right <= bounds.x + bounds.width &&
            transformed.top >= bounds.y &&
            transformed.bottom <= bounds.y + bounds.height
        );
    },
    
    bringElementInBounds(elementData) {
        // Check if element is out of bounds and move it back in
        const bounds = this.getEditableBounds();
        const transformed = this.getTransformedBounds(elementData);
        
        // Calculate how much the element exceeds bounds on each side
        let offsetX = 0;
        let offsetY = 0;
        
        // Check left edge
        if (transformed.left < bounds.x) {
            offsetX = bounds.x - transformed.left;
        }
        // Check right edge
        else if (transformed.right > bounds.x + bounds.width) {
            offsetX = (bounds.x + bounds.width) - transformed.right;
        }
        
        // Check top edge
        if (transformed.top < bounds.y) {
            offsetY = bounds.y - transformed.top;
        }
        // Check bottom edge
        else if (transformed.bottom > bounds.y + bounds.height) {
            offsetY = (bounds.y + bounds.height) - transformed.bottom;
        }
        
        // Apply offset if needed
        if (offsetX !== 0 || offsetY !== 0) {
            this.offsetElementGeometry(elementData, offsetX, offsetY);
            this.applyElementRotation(elementData);
        }
    },
    
    // Compute all handle positions for elementData using direct SVG viewport math,
    // without getScreenCTM(). This is immune to CTM staleness during active gestures.
    getHandlePoints(elementData) {
        const bbox = elementData.element.getBBox();
        const metrics = this.getCanvasViewportMetrics();
        const scale = metrics.scale || 1;

        const rotation = (elementData.rotation || 0) * Math.PI / 180;
        const cx = bbox.x + bbox.width  / 2;
        const cy = bbox.y + bbox.height / 2;

        // Rotate a point around the element's centre, then scale to wrapper pixels.
        const toWrapper = (px, py) => {
            if (!rotation) {
                return {
                    x: metrics.offsetX + (px * scale),
                    y: metrics.offsetY + (py * scale)
                };
            }
            const dx = px - cx;
            const dy = py - cy;
            return {
                x: metrics.offsetX + ((cx + dx * Math.cos(rotation) - dy * Math.sin(rotation)) * scale),
                y: metrics.offsetY + ((cy + dx * Math.sin(rotation) + dy * Math.cos(rotation)) * scale)
            };
        };

        const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

        // Offset to viewport coords so handles work inside position:fixed container.
        const ox = metrics.rect.left;
        const oy = metrics.rect.top;
        const toVP = (p) => ({ x: p.x + ox, y: p.y + oy });

        const tl = toVP(toWrapper(bbox.x,              bbox.y));
        const tr = toVP(toWrapper(bbox.x + bbox.width,  bbox.y));
        const br = toVP(toWrapper(bbox.x + bbox.width,  bbox.y + bbox.height));
        const bl = toVP(toWrapper(bbox.x,              bbox.y + bbox.height));
        const tc     = mid(tl, tr);
        const rc     = mid(tr, br);
        const bc     = mid(bl, br);
        const lc     = mid(tl, bl);
        const center = mid(mid(tl, br), mid(tr, bl));

        const topDir = { x: tc.x - center.x, y: tc.y - center.y };
        const mag    = Math.hypot(topDir.x, topDir.y) || 1;
        const rotatePoint = {
            x: tc.x + (topDir.x / mag) * 24,
            y: tc.y + (topDir.y / mag) * 24
        };

        return { tl, tr, br, bl, tc, rc, bc, lc, center, rotatePoint };
    },

    showResizeHandles(elementData) {
        const handlesContainer = document.getElementById('resize-handles');
        handlesContainer.innerHTML = '';
        handlesContainer.classList.remove('hidden');

        const { tl, tr, br, bl, tc, rc, bc, lc, rotatePoint } = this.getHandlePoints(elementData);

        // Only show resize handles for non-text elements
        if (elementData.type !== 'text') {
            const handlePositions = { nw: tl, ne: tr, sw: bl, se: br, n: tc, s: bc, e: rc, w: lc };

            Object.entries(handlePositions).forEach(([pos, point]) => {
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                handle.dataset.position = pos;
                handle.style.setProperty('cursor', this.getResizeCursor(pos, elementData.rotation || 0), 'important');
                handle.style.left = (point.x - 6) + 'px';
                handle.style.top  = (point.y - 6) + 'px';
                handle.style.pointerEvents = 'auto';

                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.startResize(e, pos);
                });

                handle.addEventListener('touchstart', (e) => {
                    if (e.touches.length !== 1) return;
                    e.stopPropagation();
                    e.preventDefault();
                    const t = e.touches[0];
                    this._touchGestureActive = true;
                    this._activeGestureTouchId = t.identifier;
                    this.startResize({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} }, pos);
                }, { passive: false });

                handlesContainer.appendChild(handle);
            });
        }

        // Rotate handle ÔÇö position computed via getHandlePoints (already done above)
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.style.cursor = 'grab';
        rotateHandle.style.left = (rotatePoint.x - 18) + 'px';
        rotateHandle.style.top  = (rotatePoint.y - 18) + 'px';
        rotateHandle.style.pointerEvents = 'auto';
        rotateHandle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>';
        
        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.startRotate(e, elementData);
        });

        rotateHandle.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            e.stopPropagation();
            e.preventDefault();
            const t = e.touches[0];
            this._touchGestureActive = true;
            this._activeGestureTouchId = t.identifier;
            this.startRotate({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} }, elementData);
        }, { passive: false });
        
        handlesContainer.appendChild(rotateHandle);
    },

    updateResizeHandlesPosition(elementData) {
        const handlesContainer = document.getElementById('resize-handles');
        if (!handlesContainer || handlesContainer.classList.contains('hidden')) return;
        if (!elementData || !elementData.element) return;

        const { tl, tr, br, bl, tc, rc, bc, lc, rotatePoint } = this.getHandlePoints(elementData);

        const handlePositions = { nw: tl, ne: tr, sw: bl, se: br, n: tc, s: bc, e: rc, w: lc };
        Object.entries(handlePositions).forEach(([pos, point]) => {
            const handle = handlesContainer.querySelector(`.resize-handle[data-position="${pos}"]`);
            if (!handle) return;
            handle.style.left = `${point.x - 6}px`;
            handle.style.top  = `${point.y - 6}px`;
            handle.style.setProperty('cursor', this.getResizeCursor(pos, elementData.rotation || 0), 'important');
        });

        const rotateHandle = handlesContainer.querySelector('.rotate-handle');
        if (rotateHandle) {
            rotateHandle.style.left = `${rotatePoint.x - 18}px`;
            rotateHandle.style.top  = `${rotatePoint.y - 18}px`;
        }
    },

    requestHandlesRefresh() {
        if (!this.selectedElement) return;
        if (this.handlesFrameRequest !== null) return;

        this.handlesFrameRequest = requestAnimationFrame(() => {
            this.handlesFrameRequest = null;
            if (this.selectedElement) {
                this.showResizeHandles(this.selectedElement);
            }
        });
    },
    
    hideResizeHandles() {
        document.getElementById('resize-handles').classList.add('hidden');
    },
    
    updatePropertiesPanel(elementData) {
        // Hide all property panels
        document.getElementById('no-selection').classList.add('hidden');
        document.getElementById('text-properties').classList.add('hidden');
        document.getElementById('text-properties').classList.remove('active');
        document.getElementById('image-properties').classList.add('hidden');
        document.getElementById('image-properties').classList.remove('active');
        document.getElementById('shape-properties').classList.add('hidden');
        document.getElementById('shape-properties').classList.remove('active');
        
        if (elementData.type === 'text') {
            document.getElementById('text-properties').classList.remove('hidden');
            document.getElementById('text-properties').classList.add('active');
            document.getElementById('prop-text-content').value = elementData.content;
            document.getElementById('prop-text-font').value = elementData.font;
            document.getElementById('prop-text-size').value = elementData.size;
            document.getElementById('prop-text-size-val').textContent = elementData.size;
            document.getElementById('prop-text-color').value = elementData.color;
            const textRot = this.normalizeRotation(elementData.rotation || 0);
            document.getElementById('prop-text-rotation').value = textRot;
            document.getElementById('prop-text-rotation-val').textContent = textRot;
        } else if (elementData.type === 'image') {
            document.getElementById('image-properties').classList.remove('hidden');
            document.getElementById('image-properties').classList.add('active');
            document.getElementById('prop-image-opacity').value = (elementData.opacity || 1) * 100;
            document.getElementById('prop-image-opacity-val').textContent = Math.round((elementData.opacity || 1) * 100);
            const imageRot = this.normalizeRotation(elementData.rotation || 0);
            document.getElementById('prop-image-rotation').value = imageRot;
            document.getElementById('prop-image-rotation-val').textContent = imageRot;
            const qrProperties = document.getElementById('qr-properties');
            if (elementData.imageKind === 'qr') {
                qrProperties.classList.remove('hidden');
                document.getElementById('prop-qr-content').value = elementData.qrContent || '';
                document.getElementById('prop-qr-color').value = this.sanitizeColorValue(elementData.qrColor || '#111827', '#111827');
            } else {
                qrProperties.classList.add('hidden');
                document.getElementById('prop-qr-content').value = '';
                document.getElementById('prop-qr-color').value = '#111827';
            }
        } else if (elementData.type === 'shape') {
            document.getElementById('shape-properties').classList.remove('hidden');
            document.getElementById('shape-properties').classList.add('active');
            document.getElementById('prop-shape-fill').value = this.sanitizeColorValue(elementData.fill, '#3b82f6');
            document.getElementById('prop-shape-stroke').value = this.sanitizeColorValue(elementData.stroke, '#000000');
            document.getElementById('prop-shape-stroke-width').value = elementData.strokeWidth;
            document.getElementById('prop-shape-stroke-val').textContent = elementData.strokeWidth;
            const shapeRot = this.normalizeRotation(elementData.rotation || 0);
            document.getElementById('prop-shape-rotation').value = shapeRot;
            document.getElementById('prop-shape-rotation-val').textContent = shapeRot;
        }
    },
    
    // ===== DRAG & DROP =====
    startDrag(e, elementData) {
        this.beginHistoryGesture();
        this.isDragging = true;

        // Store the mouse position at drag start
        this.dragStart = {
            startClientX: e.clientX,
            startClientY: e.clientY,
            mouseX: e.clientX,
            mouseY: e.clientY,
            bbox: elementData.element.getBBox(),
            transformedBounds: this.getTransformedBounds(elementData),
            guides: this.calculateGuides(elementData),
            snapLock: { x: null, y: null }
        };
        
        // Store current element position
        if (elementData.type === 'text' || elementData.type === 'image' || (elementData.type === 'shape' && this.isRectLikeShapeType?.(elementData.shapeType))) {
            this.dragStart.elementX = parseFloat(elementData.element.getAttribute('x') || 0);
            this.dragStart.elementY = parseFloat(elementData.element.getAttribute('y') || 0);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            this.dragStart.elementX = parseFloat(elementData.element.getAttribute('cx') || 0);
            this.dragStart.elementY = parseFloat(elementData.element.getAttribute('cy') || 0);
        } else if (elementData.type === 'shape' && this.isPolygonShapeType?.(elementData.shapeType)) {
            this.dragStart.points = (elementData.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));
            this.dragStart.bbox = elementData.element.getBBox();
        }
    },
    
    handleMouseMove(e) {
        if (!e) {
            return;
        }

        this.pendingMoveEvent = {
            clientX: e.clientX,
            clientY: e.clientY,
            shiftKey: Boolean(e.shiftKey)
        };

        if (this.moveFrameRequest !== null) {
            return;
        }

        this.moveFrameRequest = requestAnimationFrame(() => {
            this.moveFrameRequest = null;
            const pendingEvent = this.pendingMoveEvent;
            this.pendingMoveEvent = null;
            if (pendingEvent) {
                this.processMouseMove(pendingEvent);
            }
        });
    },

    processMouseMove(e) {
        if (this.isDragging && this.selectedElement) {
            // Convert screen-space delta to SVG coordinates so drag speed matches cursor.
            const svgDelta = this.clientDeltaToSvgDelta(
                e.clientX - (this.dragStart.startClientX ?? this.dragStart.mouseX),
                e.clientY - (this.dragStart.startClientY ?? this.dragStart.mouseY)
            );
            let deltaX = svgDelta.dx;
            let deltaY = svgDelta.dy;

            // ===== GUIDES & SNAP ALIGNMENT (sempre activo durante drag) =====
            {
                const guides = this.dragStart.guides || this.calculateGuides(this.selectedElement);
                const transformedBounds = this.dragStart.transformedBounds || this.getTransformedBounds(this.selectedElement);
                const elLeft   = transformedBounds.left   + deltaX;
                const elRight  = transformedBounds.right  + deltaX;
                const elTop    = transformedBounds.top    + deltaY;
                const elBottom = transformedBounds.bottom + deltaY;
                const elCenterX = (elLeft + elRight) / 2;
                const elCenterY = (elTop + elBottom) / 2;

                // Test all meaningful points of the moving element against guides.
                const testH = [elTop, elCenterY, elBottom];
                const testV = [elLeft, elCenterX, elRight];

                let bestX = null;
                let bestY = null;

                testV.forEach(vx => {
                    guides.vertical.forEach(g => {
                        const diff = Math.abs(vx - g.value);
                        if (diff < this.guideThreshold && (!bestX || diff < bestX.diff)) {
                            bestX = { value: g.value, diff, type: g.type, offsetX: g.value - vx };
                        }
                    });
                });

                testH.forEach(hy => {
                    guides.horizontal.forEach(g => {
                        const diff = Math.abs(hy - g.value);
                        if (diff < this.guideThreshold && (!bestY || diff < bestY.diff)) {
                            bestY = { value: g.value, diff, type: g.type, offsetY: g.value - hy };
                        }
                    });
                });

                const snapPoints = {
                    x: this.resolveStickySnap('x', bestX, elCenterX),
                    y: this.resolveStickySnap('y', bestY, elCenterY)
                };

                if (snapPoints.x || snapPoints.y) {
                    this.showGuideLines(snapPoints);
                } else {
                    this.hideGuideLines();
                }

                if (snapPoints.x) deltaX += snapPoints.x.offsetX ?? 0;
                if (snapPoints.y) deltaY += snapPoints.y.offsetY ?? 0;
            }
            
            this.moveElementFromDragStart(this.selectedElement, deltaX, deltaY);

            this.updateResizeHandlesPosition(this.selectedElement);
        } else if (this.isResizing && this.selectedElement) {
            this.doResize(e);
        } else if (this.isRotating && this.selectedElement) {
            this.doRotate(e);
        }
    },
    
    handleMouseUp(source = 'mouse') {
        if (source === 'mouse' && (Date.now() - (this._lastTouchInteractionAt || 0)) < 700) {
            return;
        }

        const wasRotating = this.isRotating;
        const wasDragging = this.isDragging;
        const wasResizing = this.isResizing;

        if (this.moveFrameRequest !== null) {
            cancelAnimationFrame(this.moveFrameRequest);
            this.moveFrameRequest = null;
        }

        if (this.pendingMoveEvent && (this.isDragging || this.isResizing || this.isRotating)) {
            const pendingEvent = this.pendingMoveEvent;
            this.pendingMoveEvent = null;
            this.processMouseMove(pendingEvent);
        } else {
            this.pendingMoveEvent = null;
        }
        
        if (this.isDragging || this.isResizing || this.isRotating) {
            this.commitHistoryGesture();
        }
        
        // Limpar guides
        this.hideGuideLines();
        
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.resizeHandle = null;
        this.rotationCenterClient = null;
        this.rotationHandleRadiusClient = null;

        // Reset handles container CSS transform so showResizeHandles can reposition cleanly.
        const handlesContainer = document.getElementById('resize-handles');
        if (handlesContainer) {
            handlesContainer.style.transform = '';
            handlesContainer.style.transformOrigin = '';
        }

        if (this.handlesFrameRequest !== null) {
            cancelAnimationFrame(this.handlesFrameRequest);
            this.handlesFrameRequest = null;
        }

        // ===== APPLY CROP AUTOMATICALLY =====
        if (this.cropMode && wasResizing) {
            // Auto-apply crop ap├│s reposicionar handles
            showToast('Pressione Enter para confirmar corte ou Escape para cancelar', 'info');
        }

        if (this.selectedElement) {
            // After rotation or drag, ensure element stays within bounds
            if ((wasRotating || wasDragging || wasResizing) && !this.cropMode) {
                this.bringElementInBounds(this.selectedElement);
            }
            if (!this.cropMode) {
                this.showResizeHandles(this.selectedElement);
            }
        }
    },
    
    handleCanvasMouseDown(e) {
        if (e.target === this.canvas || e.target === this.printArea) {
            this.clearSelection();
        }
    },

    handleDocumentMouseDown(e) {
        if (!this.selectedElement || this.isDragging || this.isResizing || this.isRotating) {
            return;
        }

        const target = e.target;
        if (!(target instanceof Element)) {
            return;
        }

        if (target.closest('#canvas-wrapper')) {
            return;
        }

        // Keep current selection when the user clicks actionable controls.
        if (target.closest('button, input, select, textarea, label, a')) {
            return;
        }

        this.clearSelection();
    },
    
    // ===== RESIZE =====
    startResize(e, position) {
        if (!this.selectedElement) return;

        this.beginHistoryGesture();
        this.isResizing = true;
        this.resizeHandle = position;
        const bbox = this.selectedElement.element.getBBox();
        const anchorLocalPoint = this.getResizeAnchorPoint(bbox, position);
        this.dragStart = {
            x: e.clientX,
            y: e.clientY,
            startClientX: e.clientX,
            startClientY: e.clientY,
            bbox,
            textWidth: this.selectedElement.width,
            textHeight: this.selectedElement.height,
            fontSize: this.selectedElement.size,
            textX: parseFloat(this.selectedElement.element.getAttribute('x') || '0'),
            textY: parseFloat(this.selectedElement.element.getAttribute('y') || '0'),
            anchorCanvasPoint: this.getElementCanvasPoint(
                this.selectedElement.element,
                anchorLocalPoint.x,
                anchorLocalPoint.y
            ),
            points: this.isPolygonShapeType?.(this.selectedElement.shapeType)
                ? (this.selectedElement.element.getAttribute('points') || '')
                    .trim()
                    .split(/\s+/)
                    .map((pair) => pair.split(',').map(Number))
                : null,
            movementThreshold: 3,
            hasMovement: false
        };
    },
    
    doResize(e) {
        if (!this.selectedElement) return;

        // Verificar threshold de movimento para mobile
        if (!this.dragStart.hasMovement && this.dragStart.movementThreshold) {
            const dx = Math.abs(e.clientX - this.dragStart.startClientX);
            const dy = Math.abs(e.clientY - this.dragStart.startClientY);
            if (dx < this.dragStart.movementThreshold && dy < this.dragStart.movementThreshold) {
                return; // Muito pequeno ainda, aguardar
            }
            this.dragStart.hasMovement = true;
        }

        // ===== CROP MODE =====
        if (this.cropMode && this.cropBounds) {
            const svgDelta = this.clientDeltaToSvgDelta(
                e.clientX - (this.dragStart.startClientX ?? this.dragStart.x),
                e.clientY - (this.dragStart.startClientY ?? this.dragStart.y)
            );
            let dx = svgDelta.dx;
            let dy = svgDelta.dy;

            const bbox = this.dragStart.bbox || this.cropBounds;
            let newWidth = bbox.width;
            let newHeight = bbox.height;
            let newX = bbox.x;
            let newY = bbox.y;

            switch(this.resizeHandle) {
                case 'se':
                    newWidth = Math.max(20, bbox.width + dx);
                    newHeight = Math.max(20, bbox.height + dy);
                    break;
                case 'sw':
                    newWidth = Math.max(20, bbox.width - dx);
                    newHeight = Math.max(20, bbox.height + dy);
                    newX = bbox.x + dx;
                    break;
                case 'ne':
                    newWidth = Math.max(20, bbox.width + dx);
                    newHeight = Math.max(20, bbox.height - dy);
                    newY = bbox.y + dy;
                    break;
                case 'nw':
                    newWidth = Math.max(20, bbox.width - dx);
                    newHeight = Math.max(20, bbox.height - dy);
                    newX = bbox.x + dx;
                    newY = bbox.y + dy;
                    break;
                case 'e':
                    newWidth = Math.max(20, bbox.width + dx);
                    break;
                case 'w':
                    newWidth = Math.max(20, bbox.width - dx);
                    newX = bbox.x + dx;
                    break;
                case 's':
                    newHeight = Math.max(20, bbox.height + dy);
                    break;
                case 'n':
                    newHeight = Math.max(20, bbox.height - dy);
                    newY = bbox.y + dy;
                    break;
            }

            // Garantir que o crop n├úo sai dos limites da imagem
            const imageBbox = this.selectedElement.element.getBBox();
            newX = Math.max(imageBbox.x, Math.min(newX, imageBbox.x + imageBbox.width - 20));
            newY = Math.max(imageBbox.y, Math.min(newY, imageBbox.y + imageBbox.height - 20));
            newWidth = Math.min(newWidth, imageBbox.x + imageBbox.width - newX);
            newHeight = Math.min(newHeight, imageBbox.y + imageBbox.height - newY);

            this.cropBounds = { x: newX, y: newY, width: newWidth, height: newHeight };
            this.showCropHandles();
            return;
        }

        // ===== NORMAL RESIZE =====

        const svgDelta = this.clientDeltaToSvgDelta(
                e.clientX - (this.dragStart.startClientX ?? this.dragStart.x),
                e.clientY - (this.dragStart.startClientY ?? this.dragStart.y)
            );
        const resizeStateBeforeChange = this.captureResizeState(this.selectedElement);
        let dx = svgDelta.dx;
        let dy = svgDelta.dy;
        
        // If element is rotated, convert mouse delta to element's local coordinate space
        const rotation = this.selectedElement.rotation || 0;
        if (rotation !== 0) {
            const rotRad = -rotation * Math.PI / 180; // Negative for inverse rotation
            const rotatedDx = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
            const rotatedDy = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
            dx = rotatedDx;
            dy = rotatedDy;
        }
        
        const bbox = this.dragStart.bbox || this.selectedElement.element.getBBox();
        const canvasBounds = this.getEditableBounds();
        
        let newWidth = bbox.width;
        let newHeight = bbox.height;
        let newX = bbox.x;
        let newY = bbox.y;
        
        switch(this.resizeHandle) {
            case 'se':
                newWidth = Math.max(20, bbox.width + dx);
                newHeight = Math.max(20, bbox.height + dy);
                break;
            case 'sw':
                newWidth = Math.max(20, bbox.width - dx);
                newHeight = Math.max(20, bbox.height + dy);
                newX = bbox.x + dx;
                break;
            case 'ne':
                newWidth = Math.max(20, bbox.width + dx);
                newHeight = Math.max(20, bbox.height - dy);
                newY = bbox.y + dy;
                break;
            case 'nw':
                newWidth = Math.max(20, bbox.width - dx);
                newHeight = Math.max(20, bbox.height - dy);
                newX = bbox.x + dx;
                newY = bbox.y + dy;
                break;
            case 'e':
                newWidth = Math.max(20, bbox.width + dx);
                break;
            case 'w':
                newWidth = Math.max(20, bbox.width - dx);
                newX = bbox.x + dx;
                break;
            case 's':
                newHeight = Math.max(20, bbox.height + dy);
                break;
            case 'n':
                newHeight = Math.max(20, bbox.height - dy);
                newY = bbox.y + dy;
                break;
        }

        const shouldKeepRatio = (this.keepAspectRatio || e.shiftKey) && this.selectedElement.type !== 'text';
        if (shouldKeepRatio && bbox.height > 0) {
            const ratio = bbox.width / bbox.height;

            if (['e', 'w'].includes(this.resizeHandle)) {
                newHeight = Math.max(20, newWidth / ratio);
                newY = bbox.y + ((bbox.height - newHeight) / 2);
                if (this.resizeHandle === 'w') {
                    newX = bbox.x + (bbox.width - newWidth);
                }
            } else if (['n', 's'].includes(this.resizeHandle)) {
                newWidth = Math.max(20, newHeight * ratio);
                newX = bbox.x + ((bbox.width - newWidth) / 2);
                if (this.resizeHandle === 'n') {
                    newY = bbox.y + (bbox.height - newHeight);
                }
            } else {
                // Corner handles: project mouse delta into one continuous scalar
                // to avoid frame-by-frame axis switching flicker.
                const signX = this.resizeHandle.includes('w') ? -1 : 1;
                const signY = this.resizeHandle.includes('n') ? -1 : 1;
                const projectedHeightDelta = ((signY * dy) + ((signX * dx) / ratio)) / 2;
                const targetHeight = Math.max(20, bbox.height + projectedHeightDelta);
                const targetWidth = Math.max(20, targetHeight * ratio);

                newWidth = targetWidth;
                newHeight = targetHeight;

                newX = this.resizeHandle.includes('w')
                    ? bbox.x + (bbox.width - newWidth)
                    : bbox.x;
                newY = this.resizeHandle.includes('n')
                    ? bbox.y + (bbox.height - newHeight)
                    : bbox.y;
            }
        }
        
        const startBox = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };
        const proposedBox = {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
        };

        const constrainedRect = rotation === 0
            ? (shouldKeepRatio
                ? this.constrainResizeRectWithRatio(
                    startBox,
                    proposedBox,
                    this.resizeHandle,
                    canvasBounds,
                    bbox.width > 0 && bbox.height > 0 ? (bbox.width / bbox.height) : 1
                )
                : this.constrainResizeRect(
                    startBox,
                    proposedBox,
                    this.resizeHandle,
                    canvasBounds
                ))
            : proposedBox;

        newX = constrainedRect.x;
        newY = constrainedRect.y;
        newWidth = constrainedRect.width;
        newHeight = constrainedRect.height;
        
        if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
            // Apply new values
            this.selectedElement.element.setAttribute('width', newWidth);
            this.selectedElement.element.setAttribute('height', newHeight);
            this.selectedElement.element.setAttribute('x', newX);
            this.selectedElement.element.setAttribute('y', newY);
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
            const radius = Math.max(newWidth, newHeight) / 2;
            const maxRadius = Math.min(
                (canvasBounds.width - (newX - canvasBounds.x)) / 2,
                (canvasBounds.height - (newY - canvasBounds.y)) / 2
            );
            const constrainedRadius = Math.min(radius, maxRadius);
            this.selectedElement.element.setAttribute('r', constrainedRadius);
            this.selectedElement.element.setAttribute('cx', newX + constrainedRadius);
            this.selectedElement.element.setAttribute('cy', newY + constrainedRadius);
        } else if (this.selectedElement.type === 'shape' && this.isPolygonShapeType?.(this.selectedElement.shapeType)) {
            const currentPoints = this.dragStart.points || (this.selectedElement.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));

            if (currentPoints.length >= 3) {
                const scaleX = bbox.width > 0 ? (newWidth / bbox.width) : 1;
                const scaleY = bbox.height > 0 ? (newHeight / bbox.height) : 1;
                const resized = currentPoints.map(([x, y]) => {
                    const nextX = newX + (x - bbox.x) * scaleX;
                    const nextY = newY + (y - bbox.y) * scaleY;
                    return `${nextX},${nextY}`;
                });
                this.selectedElement.element.setAttribute('points', resized.join(' '));
            }
        } else if (this.selectedElement.type === 'text') {
            // Calculate scale based on stored dimensions
            const baseTextWidth = this.dragStart.textWidth || this.selectedElement.width;
            const baseTextHeight = this.dragStart.textHeight || this.selectedElement.height;
            const scaleX = newWidth / baseTextWidth;
            const scaleY = newHeight / baseTextHeight;
            const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio
            
            const oldFontSize = this.dragStart.fontSize || this.selectedElement.size;
            const newFontSize = Math.max(12, Math.min(120, oldFontSize * scale));
            
            // Get current baseline position
            const currentY = this.dragStart.textY ?? parseFloat(this.selectedElement.element.getAttribute('y') || '0');
            
            // Calculate how much the baseline should move based on bbox.y change
            const yOffset = newY - bbox.y;
            
            this.selectedElement.element.setAttribute('font-size', newFontSize);
            this.selectedElement.size = newFontSize;
            this.selectedElement.element.setAttribute('x', newX);
            this.selectedElement.element.setAttribute('y', currentY + yOffset);
            
            // Update stored dimensions
            const newBBox = this.selectedElement.element.getBBox();
            this.selectedElement.width = newBBox.width;
            this.selectedElement.height = newBBox.height;
        }

        if (rotation !== 0) {
            this.applyRotatedResizeAnchor(this.selectedElement);

            // Never allow rotated elements to grow outside the design canvas.
            // If a resize step crosses the wall, reject that step instead of
            // translating the element, which can look like growth on the opposite side.
            if (!this.isElementFullyInsideEditableBounds(this.selectedElement)) {
                this.restoreResizeState(this.selectedElement, resizeStateBeforeChange);
                return;
            }
        }

        this.updateResizeHandlesPosition(this.selectedElement);
    },
    
    // ===== ROTATION =====
    startRotate(e, elementData) {
        if (e.preventDefault) e.preventDefault();
        this.beginHistoryGesture();
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = true;

        const bbox = elementData.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        const ctm = elementData.element.getScreenCTM();
        if (!ctm) return;
        const centerClient = new DOMPoint(centerX, centerY).matrixTransform(ctm);
        this.rotationCenterClient = { x: centerClient.x, y: centerClient.y };

        // Record the rotation at the start of this gesture so we can compute the CSS delta.
        this._rotateStartRotation = elementData.rotation || 0;

        // Apply CSS transform-origin on the handles container so all handles rotate together.
        // Container is position:fixed inset:0, so origin coords are raw viewport (clientX/Y).
        const handlesContainer = document.getElementById('resize-handles');
        if (handlesContainer) {
            handlesContainer.style.transformOrigin = `${centerClient.x}px ${centerClient.y}px`;
            handlesContainer.style.transform = 'rotate(0deg)';
        }

        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        this.rotationStart = Math.atan2(mouseY - centerClient.y, mouseX - centerClient.x) * (180 / Math.PI);
        this.rotationStart -= (elementData.rotation || 0);
        
        // Tracking para mobile
        this.rotationStartX = mouseX;
        this.rotationStartY = mouseY;
        this.rotationHasMovement = false;
        this.rotationMovementThreshold = this._touchGestureActive ? 1 : 0;
    },
    
    doRotate(e) {
        if (!this.selectedElement) return;

        // Threshold para mobile
        if (!this.rotationHasMovement) {
            const dx = Math.abs(e.clientX - this.rotationStartX);
            const dy = Math.abs(e.clientY - this.rotationStartY);
            const threshold = Number.isFinite(this.rotationMovementThreshold) ? this.rotationMovementThreshold : 0;
            if (dx < threshold && dy < threshold) {
                return; // Muito pequeno ainda
            }
            this.rotationHasMovement = true;
        }

        const bbox = this.selectedElement.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const elementCenter = { x: centerX, y: centerY };

        const center = this.rotationCenterClient;
        if (!center) return;

        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const angle = Math.atan2(mouseY - center.y, mouseX - center.x) * (180 / Math.PI);
        let rotation = angle - this.rotationStart;
        
        // Snap to 15 degree increments if shift is held
        if (e.shiftKey) {
            rotation = Math.round(rotation / 15) * 15;
        }

        // Normalize rotation and snap to 45-degree guides when very close.
        rotation = this.getRotationGuideSnap(rotation, e.shiftKey ? 2 : 4).value;
        
        const previousTransform = this.selectedElement.element.getAttribute('transform');
        const candidateTransform = rotation
            ? `rotate(${rotation} ${centerX} ${centerY})`
            : null;

        // Apply candidate transform once to validate bounds at the same pivot.
        if (candidateTransform) {
            this.selectedElement.element.setAttribute('transform', candidateTransform);
        } else {
            this.selectedElement.element.removeAttribute('transform');
        }
        
        const transformed = this.getTransformedBounds(this.selectedElement);
        const bounds = this.getEditableBounds();
        
        // Check if ANY part of element is outside bounds (same logic as movement)
        const isOutOfBounds = 
            transformed.left < bounds.x ||
            transformed.right > bounds.x + bounds.width ||
            transformed.top < bounds.y ||
            transformed.bottom > bounds.y + bounds.height;
        
        if (isOutOfBounds) {
            // Revert to previous transform - not allowed to exceed bounds
            if (previousTransform) {
                this.selectedElement.element.setAttribute('transform', previousTransform);
            } else {
                this.selectedElement.element.removeAttribute('transform');
            }
            return; // Don't update the display
        }
        
        // Rotation is valid; keep the candidate transform exactly as-is.
        this.selectedElement.rotation = rotation;
        this.showRotationGuideLine(rotation, elementCenter);
        
        // Sync rotation input/display based on element type
        if (this.selectedElement.type === 'text') {
            const rotationInput = document.getElementById('prop-text-rotation');
            if (rotationInput) rotationInput.value = rotation;
            const rotationVal = document.getElementById('prop-text-rotation-val');
            if (rotationVal) rotationVal.textContent = rotation;
        } else if (this.selectedElement.type === 'image') {
            const rotationInput = document.getElementById('prop-image-rotation');
            if (rotationInput) rotationInput.value = rotation;
            const rotationVal = document.getElementById('prop-image-rotation-val');
            if (rotationVal) rotationVal.textContent = rotation;
        } else if (this.selectedElement.type === 'shape') {
            const rotationInput = document.getElementById('prop-shape-rotation');
            if (rotationInput) rotationInput.value = rotation;
            const rotationVal = document.getElementById('prop-shape-rotation-val');
            if (rotationVal) rotationVal.textContent = rotation;
        }

        // Rotate the entire handles container by the delta angle ÔÇö zero JS geometry, instant GPU sync.
        const handlesContainer = document.getElementById('resize-handles');
        if (handlesContainer) {
            const delta = rotation - (this._rotateStartRotation || 0);
            handlesContainer.style.transform = `rotate(${delta}deg)`;
        }
    },
    
    updateRotation(value) {
        if (this.selectedElement) {
            const bbox = this.selectedElement.element.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            let rotation = this.getRotationGuideSnap(parseFloat(value), 4).value;

            const previousTransform = this.selectedElement.element.getAttribute('transform');
            const candidateTransform = rotation
                ? `rotate(${rotation} ${centerX} ${centerY})`
                : null;

            // Test the new rotation using the same pivot.
            if (candidateTransform) {
                this.selectedElement.element.setAttribute('transform', candidateTransform);
            } else {
                this.selectedElement.element.removeAttribute('transform');
            }
            
            const transformed = this.getTransformedBounds(this.selectedElement);
            const bounds = this.getEditableBounds();
            
            // Check if ANY part of element would be outside bounds (same logic as movement)
            const isOutOfBounds = 
                transformed.left < bounds.x ||
                transformed.right > bounds.x + bounds.width ||
                transformed.top < bounds.y ||
                transformed.bottom > bounds.y + bounds.height;
            
            if (isOutOfBounds) {
                // Reject this rotation - revert to previous transform.
                if (previousTransform) {
                    this.selectedElement.element.setAttribute('transform', previousTransform);
                } else {
                    this.selectedElement.element.removeAttribute('transform');
                }
                // Reset input to previous value
                const prevRotation = this.selectedElement.rotation || 0;
                const inputId = this.selectedElement.type === 'text' ? 'prop-text-rotation' :
                               this.selectedElement.type === 'image' ? 'prop-image-rotation' :
                               'prop-shape-rotation';
                const input = document.getElementById(inputId);
                if (input) input.value = prevRotation;
                return;
            }
            
            // Rotation is valid; keep tested transform and persist angle.
            this.selectedElement.rotation = rotation;
            this.showResizeHandles(this.selectedElement);
            this.queueHistorySave();
        }
    },
    
    // ===== PROPERTY UPDATES =====

});
