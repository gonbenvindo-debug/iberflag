// ===== MODERN PRODUCT CUSTOMIZER - CANVA STYLE =====

class DesignEditor {
    constructor() {
        this.canvas = document.getElementById('design-canvas');
        this.canvasStage = document.getElementById('canvas-stage');
        this.printArea = document.getElementById('print-area-outline');
        this.canvasWrapper = document.getElementById('canvas-wrapper');
        this.elements = [];
        this.selectedElement = null;
        this.history = [];
        this.historyIndex = -1;
        this.isRestoringHistory = false;
        this.maxHistoryEntries = 200;
        this.historyCommitTimer = null;
        this.historyCommitDelay = 180;
        this.activeHistoryGestureSnapshot = null;
        this.layerDragIndex = null;
        this.zoom = 1;
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandle = null;
        this.rotationStart = 0;
        this.rotationCenterClient = null;
        this.currentProduct = null;
        this.editIndex = null;
        this.editDesignId = null;
        this.productId = null;
        this.cartStorageKey = 'iberflag_cart';
        this.legacyCartStorageKeys = ['latinflag_cart', 'cart'];
        this.printAreaBounds = { x: 50, y: 50, width: 700, height: 500 };
        this.keepAspectRatio = false;
        this.baseCanvasSize = { width: 800, height: 600 };
        this.initialCanvasSize = null; // Will store computed base size at 100% zoom
        this.handlesFrameRequest = null;
        
        // ===== GUIDES & SNAP =====
        this.showGuides = false;
        this.guideLines = [];
        this.guideThreshold = 10; // pixels para snap
        this.guideReleaseThreshold = 18;
        this.gridSize = 10; // para snap grid
        
        // ===== CROP =====
        this.cropMode = false;
        this.cropBounds = null;
        
        this.init();
    }
    
    async init() {
        await this.loadProduct();
        this.setupEventListeners();
        this.syncCanvasViewport();
        this.setupAutoSave();
        this.saveHistory();
        this.updateSidebarMode();
    }
    
    // ===== PRODUCT LOADING =====
    async loadProduct() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('produto');
        this.editIndex = urlParams.get('edit');
        this.editDesignId = urlParams.get('design');
        this.productId = productId;
        
        if (!productId) {
            window.location.href = '/produtos.html';
            return;
        }

        const numericProductId = Number(productId);
        let dbProduct = null;

        if (typeof supabaseClient !== 'undefined' && Number.isFinite(numericProductId)) {
            try {
                const { data, error } = await supabaseClient
                    .from('produtos')
                    .select('*')
                    .eq('id', numericProductId)
                    .maybeSingle();

                if (!error && data) {
                    dbProduct = data;
                }
            } catch (error) {
                console.warn('Falha ao carregar produto da base de dados:', error);
            }
        }

        this.currentProduct = dbProduct || initialProducts.find(p => p.id == productId);
        
        if (!this.currentProduct) {
            showToast('Produto não encontrado', 'error');
            setTimeout(() => window.location.href = '/produtos.html', 2000);
            return;
        }
        
        document.getElementById('product-name').textContent = this.currentProduct.nome;
        document.getElementById('product-price').textContent = `${this.currentProduct.preco.toFixed(2)}€`;
        
        // Load SVG template if exists
        if (this.currentProduct.svg_template) {
            this.loadSVGTemplate(this.currentProduct.svg_template);
        } else {
            this.setDefaultPrintArea();
        }
        
        // Load existing design if editing
        if (this.editIndex !== null || this.editDesignId) {
            this.loadExistingDesign(parseInt(this.editIndex, 10));
        } else {
            this.loadAutosaveDesign();
        }
    }

    getAutosaveKey() {
        return `iberflag_autosave_${this.productId || 'default'}`;
    }

    getLegacyAutosaveKeys() {
        return [`latinflag_autosave_${this.productId || 'default'}`];
    }

    getCartData() {
        const storageKeys = [this.cartStorageKey, ...this.legacyCartStorageKeys];

        for (const key of storageKeys) {
            try {
                const stored = JSON.parse(localStorage.getItem(key) || '[]');
                if (Array.isArray(stored) && stored.length > 0) {
                    return stored;
                }
            } catch (error) {
                console.warn('Falha ao recuperar carrinho:', key, error);
            }
        }

        return [];
    }

    saveCartData(cart) {
        localStorage.setItem(this.cartStorageKey, JSON.stringify(cart));
        this.legacyCartStorageKeys.forEach((key) => {
            localStorage.setItem(key, JSON.stringify(cart));
        });
    }

    getEditableBounds() {
        if (this.printAreaBounds) {
            return this.printAreaBounds;
        }

        const canvasWidth = Number(this.baseCanvasSize?.width) || 800;
        const canvasHeight = Number(this.baseCanvasSize?.height) || 600;
        return {
            x: 50,
            y: 50,
            width: Math.max(100, canvasWidth - 100),
            height: Math.max(100, canvasHeight - 100)
        };
    }

    getCanvasBounds() {
        const vb = this.getCanvasViewBoxSize();
        return {
            x: 0,
            y: 0,
            width: vb.width,
            height: vb.height
        };
    }

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
            left = Math.max(bounds.x, left);
            right = Math.min(maxRight, right);
            if ((right - left) < minWidth) {
                right = Math.min(maxRight, left + minWidth);
                left = Math.max(bounds.x, right - minWidth);
            }
        }

        if (movesNorth && !movesSouth) {
            top = Math.max(bounds.y, Math.min(top, startBottom - minHeight));
            bottom = startBottom;
        } else if (movesSouth && !movesNorth) {
            top = startTop;
            bottom = Math.min(maxBottom, Math.max(bottom, startTop + minHeight));
        } else {
            top = Math.max(bounds.y, top);
            bottom = Math.min(maxBottom, bottom);
            if ((bottom - top) < minHeight) {
                bottom = Math.min(maxBottom, top + minHeight);
                top = Math.max(bounds.y, bottom - minHeight);
            }
        }

        return {
            x: left,
            y: top,
            width: Math.max(minWidth, right - left),
            height: Math.max(minHeight, bottom - top)
        };
    }

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
    }

    getEditableCenter() {
        const bounds = this.getEditableBounds();
        return {
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2)
        };
    }

    getCanvasViewBoxSize() {
        const viewBoxAttr = this.canvas?.getAttribute('viewBox') || '';
        const parts = viewBoxAttr.trim().split(/\s+/).map(Number);
        if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
            return { width: parts[2], height: parts[3] };
        }

        const fallbackWidth = Number(this.baseCanvasSize?.width) || 800;
        const fallbackHeight = Number(this.baseCanvasSize?.height) || 600;
        return { width: fallbackWidth, height: fallbackHeight };
    }

    getInsertionScale() {
        const bounds = this.getEditableBounds();
        const shortSide = Math.max(120, Math.min(bounds.width, bounds.height));
        const longSide = Math.max(bounds.width, bounds.height);
        return { bounds, shortSide, longSide };
    }

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
    }

    clientToSvgPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const vb = this.getCanvasViewBoxSize();
        const svgWidth = vb.width;
        const svgHeight = vb.height;

        return {
            x: ((clientX - rect.left) / rect.width) * svgWidth,
            y: ((clientY - rect.top) / rect.height) * svgHeight
        };
    }

    clientDeltaToSvgDelta(deltaClientX, deltaClientY) {
        const rect = this.canvas.getBoundingClientRect();
        const vb = this.getCanvasViewBoxSize();
        const svgWidth = vb.width;
        const svgHeight = vb.height;

        if (!rect.width || !rect.height) {
            return { dx: 0, dy: 0 };
        }

        return {
            dx: (deltaClientX / rect.width) * svgWidth,
            dy: (deltaClientY / rect.height) * svgHeight
        };
    }

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

    clampRotatedTranslate(elementData, proposedTranslateX, proposedTranslateY) {
        const bounds = this.getEditableBounds();
        const bbox = elementData.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const rotation = elementData.rotation || 0;

        elementData.element.setAttribute(
            'transform',
            `translate(${proposedTranslateX} ${proposedTranslateY}) rotate(${rotation} ${centerX} ${centerY})`
        );

        const transformed = this.getTransformedBounds(elementData);
        let clampedTranslateX = proposedTranslateX;
        let clampedTranslateY = proposedTranslateY;

        if (transformed.left < bounds.x) {
            clampedTranslateX += bounds.x - transformed.left;
        } else if (transformed.right > bounds.x + bounds.width) {
            clampedTranslateX -= transformed.right - (bounds.x + bounds.width);
        }

        if (transformed.top < bounds.y) {
            clampedTranslateY += bounds.y - transformed.top;
        } else if (transformed.bottom > bounds.y + bounds.height) {
            clampedTranslateY -= transformed.bottom - (bounds.y + bounds.height);
        }

        elementData.element.setAttribute(
            'transform',
            `translate(${clampedTranslateX} ${clampedTranslateY}) rotate(${rotation} ${centerX} ${centerY})`
        );

        return {
            translateX: clampedTranslateX,
            translateY: clampedTranslateY
        };
    }

    moveElementBy(elementData, deltaX, deltaY) {
        if (!elementData || (!deltaX && !deltaY)) {
            return;
        }

        if (elementData.rotation && elementData.rotation !== 0) {
            const proposedTranslateX = (elementData.translateX || 0) + deltaX;
            const proposedTranslateY = (elementData.translateY || 0) + deltaY;
            const clampedTranslate = this.clampRotatedTranslate(
                elementData,
                proposedTranslateX,
                proposedTranslateY
            );

            elementData.translateX = clampedTranslate.translateX;
            elementData.translateY = clampedTranslate.translateY;
            return;
        }

        if (elementData.type === 'text' || elementData.type === 'image' || (elementData.type === 'shape' && elementData.shapeType === 'rectangle')) {
            const currentX = parseFloat(elementData.element.getAttribute('x') || '0');
            const currentY = parseFloat(elementData.element.getAttribute('y') || '0');
            elementData.element.setAttribute('x', currentX + deltaX);
            elementData.element.setAttribute('y', currentY + deltaY);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            const currentCx = parseFloat(elementData.element.getAttribute('cx') || '0');
            const currentCy = parseFloat(elementData.element.getAttribute('cy') || '0');
            elementData.element.setAttribute('cx', currentCx + deltaX);
            elementData.element.setAttribute('cy', currentCy + deltaY);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'triangle') {
            const currentPoints = (elementData.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));

            if (currentPoints.length >= 3) {
                const translatedPoints = currentPoints.map(([x, y]) => `${x + deltaX},${y + deltaY}`);
                elementData.element.setAttribute('points', translatedPoints.join(' '));
            }
        }

        this.bringElementInBounds(elementData);
    }

    setElementTransform(elementData, translateX, translateY, rotation) {
        const safeTranslateX = Number(translateX) || 0;
        const safeTranslateY = Number(translateY) || 0;
        const safeRotation = Number(rotation) || 0;

        if (safeRotation === 0 && safeTranslateX === 0 && safeTranslateY === 0) {
            elementData.element.removeAttribute('transform');
            return;
        }

        const bbox = elementData.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        elementData.element.setAttribute(
            'transform',
            `translate(${safeTranslateX} ${safeTranslateY}) rotate(${safeRotation} ${centerX} ${centerY})`
        );
    }

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
    }

    getElementCanvasPoint(element, x, y) {
        const ctm = element.getCTM();
        if (!ctm) {
            return { x, y };
        }

        const point = new DOMPoint(x, y).matrixTransform(ctm);
        return { x: point.x, y: point.y };
    }

    captureResizeState(elementData) {
        const state = {
            transform: elementData.element.getAttribute('transform'),
            translateX: elementData.translateX || 0,
            translateY: elementData.translateY || 0
        };

        if (elementData.type === 'text') {
            state.x = elementData.element.getAttribute('x');
            state.y = elementData.element.getAttribute('y');
            state.fontSize = elementData.element.getAttribute('font-size');
        } else if (elementData.type === 'image' || (elementData.type === 'shape' && elementData.shapeType === 'rectangle')) {
            state.x = elementData.element.getAttribute('x');
            state.y = elementData.element.getAttribute('y');
            state.width = elementData.element.getAttribute('width');
            state.height = elementData.element.getAttribute('height');
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            state.cx = elementData.element.getAttribute('cx');
            state.cy = elementData.element.getAttribute('cy');
            state.r = elementData.element.getAttribute('r');
        } else if (elementData.type === 'shape' && elementData.shapeType === 'triangle') {
            state.points = elementData.element.getAttribute('points');
        }

        return state;
    }

    restoreResizeState(elementData, state) {
        if (!state) return;

        if (elementData.type === 'text') {
            elementData.element.setAttribute('x', state.x);
            elementData.element.setAttribute('y', state.y);
            elementData.element.setAttribute('font-size', state.fontSize);
        } else if (elementData.type === 'image' || (elementData.type === 'shape' && elementData.shapeType === 'rectangle')) {
            elementData.element.setAttribute('x', state.x);
            elementData.element.setAttribute('y', state.y);
            elementData.element.setAttribute('width', state.width);
            elementData.element.setAttribute('height', state.height);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            elementData.element.setAttribute('cx', state.cx);
            elementData.element.setAttribute('cy', state.cy);
            elementData.element.setAttribute('r', state.r);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'triangle') {
            elementData.element.setAttribute('points', state.points);
        }

        elementData.translateX = state.translateX || 0;
        elementData.translateY = state.translateY || 0;

        if (state.transform) {
            elementData.element.setAttribute('transform', state.transform);
        } else {
            elementData.element.removeAttribute('transform');
        }
    }

    applyRotatedResizeAnchor(elementData) {
        const rotation = elementData.rotation || 0;
        if (!rotation || !this.dragStart?.anchorCanvasPoint) {
            return;
        }

        const baseTranslateX = this.dragStart.translateX || 0;
        const baseTranslateY = this.dragStart.translateY || 0;

        this.setElementTransform(elementData, baseTranslateX, baseTranslateY, rotation);

        const currentBox = elementData.element.getBBox();
        const anchorLocalPoint = this.getResizeAnchorPoint(currentBox, this.resizeHandle);
        const currentAnchorPoint = this.getElementCanvasPoint(
            elementData.element,
            anchorLocalPoint.x,
            anchorLocalPoint.y
        );

        const correctedTranslateX = baseTranslateX + (this.dragStart.anchorCanvasPoint.x - currentAnchorPoint.x);
        const correctedTranslateY = baseTranslateY + (this.dragStart.anchorCanvasPoint.y - currentAnchorPoint.y);

        elementData.translateX = correctedTranslateX;
        elementData.translateY = correctedTranslateY;
        this.setElementTransform(elementData, correctedTranslateX, correctedTranslateY, rotation);
    }

    moveElementFromDragStart(elementData, deltaX, deltaY) {
        if (!elementData || !this.dragStart) {
            return;
        }

        if (elementData.rotation && elementData.rotation !== 0) {
            const proposedTranslateX = (this.dragStart.translateX ?? elementData.translateX ?? 0) + deltaX;
            const proposedTranslateY = (this.dragStart.translateY ?? elementData.translateY ?? 0) + deltaY;
            const clampedTranslate = this.clampRotatedTranslate(
                elementData,
                proposedTranslateX,
                proposedTranslateY
            );

            elementData.translateX = clampedTranslate.translateX;
            elementData.translateY = clampedTranslate.translateY;
            return;
        }

        if (elementData.type === 'text' || elementData.type === 'image' || (elementData.type === 'shape' && elementData.shapeType === 'rectangle')) {
            elementData.element.setAttribute('x', (this.dragStart.elementX || 0) + deltaX);
            elementData.element.setAttribute('y', (this.dragStart.elementY || 0) + deltaY);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            elementData.element.setAttribute('cx', (this.dragStart.elementX || 0) + deltaX);
            elementData.element.setAttribute('cy', (this.dragStart.elementY || 0) + deltaY);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'triangle') {
            const startPoints = this.dragStart.points || [];
            if (startPoints.length >= 3) {
                const translatedPoints = startPoints.map(([x, y]) => `${x + deltaX},${y + deltaY}`);
                elementData.element.setAttribute('points', translatedPoints.join(' '));
            }
        }

        this.bringElementInBounds(elementData);
    }

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
    }

    // ===== GUIDES & ALIGNMENT =====
    calculateGuides(elementData) {
        if (!elementData) return { horizontal: [], vertical: [] };

        const bounds = this.getEditableBounds();
        
        return {
            horizontal: [
                { value: bounds.y + bounds.height / 2, type: 'center-canvas' }
            ],
            vertical: [
                { value: bounds.x + bounds.width / 2, type: 'center-canvas' }
            ]
        };
    }

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
    }

    showGuideLines(snaps) {
        this.hideGuideLines();

        if (!snaps.x && !snaps.y) return;

        const canvasBounds = this.getCanvasBounds();

        // Linha vertical
        if (snaps.x) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(snaps.x.value));
            line.setAttribute('y1', String(canvasBounds.y));
            line.setAttribute('x2', String(snaps.x.value));
            line.setAttribute('y2', String(canvasBounds.y + canvasBounds.height));
            line.setAttribute('stroke', '#3b82f6');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '4,4');
            line.setAttribute('pointer-events', 'none');
            line.setAttribute('class', 'guide-line');
            line.setAttribute('opacity', '0.7');
            this.canvas.appendChild(line);
            this.guideLines.push(line);
        }

        // Linha horizontal
        if (snaps.y) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(canvasBounds.x));
            line.setAttribute('y1', String(snaps.y.value));
            line.setAttribute('x2', String(canvasBounds.x + canvasBounds.width));
            line.setAttribute('y2', String(snaps.y.value));
            line.setAttribute('stroke', '#3b82f6');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '4,4');
            line.setAttribute('pointer-events', 'none');
            line.setAttribute('class', 'guide-line');
            line.setAttribute('opacity', '0.7');
            this.canvas.appendChild(line);
            this.guideLines.push(line);
        }

        this.bringPrintAreaOverlaysToFront();
    }

    hideGuideLines() {
        this.guideLines.forEach(line => line.remove());
        this.guideLines = [];
    }

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
    }

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
    }

    applySnapToGrid(deltaX, deltaY, gridSize) {
        return {
            deltaX: Math.round(deltaX / gridSize) * gridSize,
            deltaY: Math.round(deltaY / gridSize) * gridSize
        };
    }

    setDefaultPrintArea() {
        const existingVisualArea = this.canvas.querySelector('#print-area-shape-outline');
        if (existingVisualArea) {
            existingVisualArea.remove();
        }

        if (!this.printArea || this.printArea.tagName.toLowerCase() !== 'rect' || this.printArea.ownerSVGElement !== this.canvas) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('id', 'print-area-outline');
            if (this.printArea && this.printArea.parentNode) {
                this.printArea.replaceWith(rect);
            } else {
                this.canvas.prepend(rect);
            }
            this.printArea = rect;
        }

        this.configureCanvasFromSourceBounds({ x: 0, y: 0, width: 800, height: 600 });
        this.printArea.setAttribute('x', String(this.printAreaBounds.x));
        this.printArea.setAttribute('y', String(this.printAreaBounds.y));
        this.printArea.setAttribute('width', String(this.printAreaBounds.width));
        this.printArea.setAttribute('height', String(this.printAreaBounds.height));
        this.printArea.setAttribute('fill', 'none');
        this.printArea.setAttribute('stroke', 'none');
        this.printArea.setAttribute('stroke-width', '0');
        this.printArea.removeAttribute('stroke-dasharray');
        this.printArea.setAttribute('opacity', '0');
        this.printArea.setAttribute('pointer-events', 'none');
        this.printArea.removeAttribute('transform');

        const defaultMaskShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        defaultMaskShape.setAttribute('x', String(this.printAreaBounds.x));
        defaultMaskShape.setAttribute('y', String(this.printAreaBounds.y));
        defaultMaskShape.setAttribute('width', String(this.printAreaBounds.width));
        defaultMaskShape.setAttribute('height', String(this.printAreaBounds.height));
        this.upsertOutsideAreaOverlay(defaultMaskShape);

        this.bringPrintAreaOverlaysToFront();
    }

    configureCanvasFromSourceBounds(sourceBounds) {
        const safeWidth = Math.max(1, Number(sourceBounds?.width) || 800);
        const safeHeight = Math.max(1, Number(sourceBounds?.height) || 600);
        const ratio = safeWidth / safeHeight;

        const margin = 50;
        const contentLongestSide = 700;

        let contentWidth = contentLongestSide;
        let contentHeight = contentLongestSide;

        if (ratio >= 1) {
            contentWidth = contentLongestSide;
            contentHeight = contentLongestSide / ratio;
        } else {
            contentHeight = contentLongestSide;
            contentWidth = contentLongestSide * ratio;
        }

        const canvasWidth = Math.max(200, Math.round(contentWidth + (margin * 2)));
        const canvasHeight = Math.max(200, Math.round(contentHeight + (margin * 2)));

        this.baseCanvasSize = { width: canvasWidth, height: canvasHeight };
        this.printAreaBounds = {
            x: margin,
            y: margin,
            width: contentWidth,
            height: contentHeight
        };

        if (this.canvas) {
            this.canvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
        }

        // Force viewport recalculation because ratio changed with template.
        this.initialCanvasSize = null;
    }

    bringPrintAreaOverlaysToFront() {
        if (!this.canvas) return;

        const outsideOverlay = this.canvas.querySelector('#print-area-outside-overlay');
        if (outsideOverlay) {
            this.canvas.appendChild(outsideOverlay);
        }

        const outsideGridOverlay = this.canvas.querySelector('#print-area-outside-grid');
        if (outsideGridOverlay) {
            this.canvas.appendChild(outsideGridOverlay);
        }

        if (this.printArea && this.printArea.parentNode === this.canvas) {
            this.canvas.appendChild(this.printArea);
        }

        const shapeOutline = this.canvas.querySelector('#print-area-shape-outline');
        if (shapeOutline) {
            this.canvas.appendChild(shapeOutline);
        }
    }

    upsertOutsideAreaOverlay(maskShapeNode, transform = '') {
        if (!this.canvas || !maskShapeNode) return;

        const viewBoxParts = (this.canvas.getAttribute('viewBox') || '')
            .trim()
            .split(/\s+/)
            .map(Number);
        const canvasWidth = Number.isFinite(viewBoxParts[2]) ? viewBoxParts[2] : (Number(this.baseCanvasSize?.width) || 800);
        const canvasHeight = Number.isFinite(viewBoxParts[3]) ? viewBoxParts[3] : (Number(this.baseCanvasSize?.height) || 600);

        let defs = this.canvas.querySelector('defs[data-print-overlay-defs="1"]');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.setAttribute('data-print-overlay-defs', '1');
            this.canvas.prepend(defs);
        }

        let mask = this.canvas.querySelector('#print-area-outside-mask');
        if (!mask) {
            mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            mask.setAttribute('id', 'print-area-outside-mask');
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            defs.appendChild(mask);
        }

        while (mask.firstChild) {
            mask.removeChild(mask.firstChild);
        }

        const fullMaskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fullMaskRect.setAttribute('x', '0');
        fullMaskRect.setAttribute('y', '0');
        fullMaskRect.setAttribute('width', String(canvasWidth));
        fullMaskRect.setAttribute('height', String(canvasHeight));
        fullMaskRect.setAttribute('fill', '#ffffff');
        mask.appendChild(fullMaskRect);

        const cutout = document.importNode(maskShapeNode, true);
        cutout.removeAttribute('id');
        cutout.removeAttribute('stroke');
        cutout.removeAttribute('stroke-width');
        cutout.removeAttribute('stroke-dasharray');
        cutout.removeAttribute('opacity');
        cutout.setAttribute('fill', '#000000');
        cutout.setAttribute('pointer-events', 'none');
        if (transform) {
            cutout.setAttribute('transform', transform);
        } else {
            cutout.removeAttribute('transform');
        }
        mask.appendChild(cutout);

        let gridPattern = this.canvas.querySelector('#print-area-outside-grid-pattern');
        if (!gridPattern) {
            gridPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            gridPattern.setAttribute('id', 'print-area-outside-grid-pattern');
            gridPattern.setAttribute('patternUnits', 'userSpaceOnUse');
            defs.appendChild(gridPattern);
        }

        gridPattern.setAttribute('x', '0');
        gridPattern.setAttribute('y', '0');
        gridPattern.setAttribute('width', '28');
        gridPattern.setAttribute('height', '28');

        while (gridPattern.firstChild) {
            gridPattern.removeChild(gridPattern.firstChild);
        }

        const gridV = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        gridV.setAttribute('d', 'M 28 0 L 0 0 0 28');
        gridV.setAttribute('fill', 'none');
        gridV.setAttribute('stroke', '#2563eb');
        gridV.setAttribute('stroke-opacity', '0.28');
        gridV.setAttribute('stroke-width', '0.8');
        gridPattern.appendChild(gridV);

        let outsideOverlay = this.canvas.querySelector('#print-area-outside-overlay');
        if (!outsideOverlay) {
            outsideOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            outsideOverlay.setAttribute('id', 'print-area-outside-overlay');
            outsideOverlay.setAttribute('pointer-events', 'none');
            outsideOverlay.setAttribute('fill', '#ffffff');
            outsideOverlay.setAttribute('opacity', '0.22');
            this.canvas.appendChild(outsideOverlay);
        }

        outsideOverlay.setAttribute('x', '0');
        outsideOverlay.setAttribute('y', '0');
        outsideOverlay.setAttribute('width', String(canvasWidth));
        outsideOverlay.setAttribute('height', String(canvasHeight));
        outsideOverlay.setAttribute('mask', 'url(#print-area-outside-mask)');

        let outsideGrid = this.canvas.querySelector('#print-area-outside-grid');
        if (!outsideGrid) {
            outsideGrid = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            outsideGrid.setAttribute('id', 'print-area-outside-grid');
            outsideGrid.setAttribute('pointer-events', 'none');
            outsideGrid.setAttribute('fill', 'url(#print-area-outside-grid-pattern)');
            outsideGrid.setAttribute('opacity', '0.38');
            this.canvas.appendChild(outsideGrid);
        }

        outsideGrid.setAttribute('x', '0');
        outsideGrid.setAttribute('y', '0');
        outsideGrid.setAttribute('width', String(canvasWidth));
        outsideGrid.setAttribute('height', String(canvasHeight));
        outsideGrid.setAttribute('mask', 'url(#print-area-outside-mask)');
    }

    updatePrintAreaFromElement(areaElement, sourceBounds) {
        this.setDefaultPrintArea();

        if (!areaElement || !sourceBounds || !sourceBounds.width || !sourceBounds.height) {
            return;
        }

        this.configureCanvasFromSourceBounds(sourceBounds);
        const contentBounds = {
            x: this.printAreaBounds.x,
            y: this.printAreaBounds.y,
            width: this.printAreaBounds.width,
            height: this.printAreaBounds.height
        };
        const uniformScale = Math.min(
            contentBounds.width / sourceBounds.width,
            contentBounds.height / sourceBounds.height
        );
        const renderedWidth = sourceBounds.width * uniformScale;
        const renderedHeight = sourceBounds.height * uniformScale;
        const offsetX = contentBounds.x + ((contentBounds.width - renderedWidth) / 2) - (sourceBounds.x * uniformScale);
        const offsetY = contentBounds.y + ((contentBounds.height - renderedHeight) / 2) - (sourceBounds.y * uniformScale);

        const visualArea = document.importNode(areaElement, true);
        visualArea.setAttribute('id', 'print-area-shape-outline');
        visualArea.setAttribute('fill', 'none');
        visualArea.setAttribute('stroke', '#3b82f6');
        visualArea.setAttribute('stroke-width', '2');
        visualArea.setAttribute('vector-effect', 'non-scaling-stroke');
        visualArea.setAttribute('opacity', '0.75');
        visualArea.setAttribute('pointer-events', 'none');
        visualArea.setAttribute('transform', `translate(${offsetX} ${offsetY}) scale(${uniformScale} ${uniformScale})`);

        this.printArea.setAttribute('x', String(this.printAreaBounds.x));
        this.printArea.setAttribute('y', String(this.printAreaBounds.y));
        this.printArea.setAttribute('width', String(this.printAreaBounds.width));
        this.printArea.setAttribute('height', String(this.printAreaBounds.height));

        this.upsertOutsideAreaOverlay(areaElement, `translate(${offsetX} ${offsetY}) scale(${uniformScale} ${uniformScale})`);

        this.canvas.appendChild(visualArea);
        this.bringPrintAreaOverlaysToFront();
    }

    getTemplateElementArea(element) {
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'rect') {
            const width = parseFloat(element.getAttribute('width') || '0');
            const height = parseFloat(element.getAttribute('height') || '0');
            return Math.max(0, width * height);
        }

        if (tagName === 'circle') {
            const radius = parseFloat(element.getAttribute('r') || '0');
            return Math.max(0, Math.PI * radius * radius);
        }

        if (tagName === 'ellipse') {
            const rx = parseFloat(element.getAttribute('rx') || '0');
            const ry = parseFloat(element.getAttribute('ry') || '0');
            return Math.max(0, Math.PI * rx * ry);
        }

        if (tagName === 'polygon') {
            const points = (element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map(point => point.split(',').map(Number))
                .filter(point => point.length === 2 && point.every(Number.isFinite));

            if (points.length === 0) {
                return 0;
            }

            const xs = points.map(point => point[0]);
            const ys = points.map(point => point[1]);
            return Math.max(0, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
        }

        return 0;
    }

    isTemplateBackgroundElement(element, sourceBounds) {
        if (!element || element.tagName.toLowerCase() !== 'rect') {
            return false;
        }

        const x = parseFloat(element.getAttribute('x') || '0');
        const y = parseFloat(element.getAttribute('y') || '0');
        const width = parseFloat(element.getAttribute('width') || '0');
        const height = parseFloat(element.getAttribute('height') || '0');
        const fill = (element.getAttribute('fill') || '').trim();
        const stroke = (element.getAttribute('stroke') || '').trim();
        const coversFullViewbox = (
            Math.abs(x - sourceBounds.x) < 0.01 &&
            Math.abs(y - sourceBounds.y) < 0.01 &&
            Math.abs(width - sourceBounds.width) < 0.01 &&
            Math.abs(height - sourceBounds.height) < 0.01
        );

        return coversFullViewbox && (!stroke || stroke === 'none') && (fill.startsWith('url(') || fill === '#ffffff' || fill === 'white');
    }

    findTemplateOutlineElement(root, sourceBounds) {
        const candidates = Array.from(root.querySelectorAll('path, polygon, rect, circle, ellipse'));

        if (candidates.length === 0) {
            return null;
        }

        const scored = candidates
            .filter(element => !this.isTemplateBackgroundElement(element, sourceBounds))
            .map(element => {
                const id = `${element.getAttribute('id') || ''} ${element.getAttribute('class') || ''}`.toLowerCase();
                const stroke = (element.getAttribute('stroke') || '').trim().toLowerCase();
                const fill = (element.getAttribute('fill') || '').trim().toLowerCase();
                const strokeDasharray = (element.getAttribute('stroke-dasharray') || '').trim();
                const area = this.getTemplateElementArea(element);
                let score = area;

                if (id.includes('print') || id.includes('safe') || id.includes('area') || id.includes('outline')) {
                    score += 1000000;
                }

                if (strokeDasharray) {
                    score += 500000;
                }

                if (stroke && stroke !== 'none') {
                    score += 200000;
                }

                if (fill === 'none') {
                    score += 50000;
                }

                if (fill.startsWith('url(')) {
                    score -= 1000000;
                }

                return { element, score };
            })
            .sort((left, right) => right.score - left.score);

        return scored.length > 0 ? scored[0].element : candidates[0];
    }
    
    loadSVGTemplate(svgContent) {
        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const root = svgDoc.documentElement;

            const viewBoxAttr = root.getAttribute('viewBox');
            let sourceBounds = { x: 0, y: 0, width: 800, height: 600 };

            if (viewBoxAttr) {
                const parts = viewBoxAttr.split(/\s+/).map(Number);
            if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
                    sourceBounds = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
                }
            } else {
                const width = parseFloat(root.getAttribute('width') || '800');
                const height = parseFloat(root.getAttribute('height') || '600');
                if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                    sourceBounds = { x: 0, y: 0, width, height };
                }
            }

            const areaElement = this.findTemplateOutlineElement(root, sourceBounds);

            if (!areaElement) {
                this.setDefaultPrintArea();
                return;
            }

            this.updatePrintAreaFromElement(areaElement, sourceBounds);
        } catch (error) {
            console.error('Error loading SVG template:', error);
            this.setDefaultPrintArea();
        }
    }

    buildElementDataFromNode(node, customId = null) {
        const tagName = node.tagName.toLowerCase();
        let type = 'shape';
        if (tagName === 'text') type = 'text';
        if (tagName === 'image') type = 'image';

        let shapeType = null;
        if (tagName === 'rect') shapeType = 'rectangle';
        if (tagName === 'circle') shapeType = 'circle';
        if (tagName === 'polygon') shapeType = 'triangle';

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
            data.content = node.textContent || '';
            data.font = node.getAttribute('font-family') || 'Arial';
            data.size = parseFloat(node.getAttribute('font-size') || '24');
            data.color = node.getAttribute('fill') || '#000000';
            data.bold = (node.getAttribute('font-weight') || 'normal') === 'bold';
            data.italic = (node.getAttribute('font-style') || 'normal') === 'italic';
            data.width = bbox.width;
            data.height = bbox.height;
        }

        if (type === 'image') {
            data.opacity = parseFloat(node.getAttribute('opacity') || '1');
            data.src = node.getAttribute('href') || '';
            data.name = node.dataset.name || 'Imagem';
            data.imageKind = node.dataset.imageKind || 'image';
            data.qrContent = node.dataset.qrContent || '';
            data.qrColor = node.dataset.qrColor || '#111827';
        }

        if (type === 'shape') {
            data.fill = node.getAttribute('fill') || '#3b82f6';
            data.stroke = node.getAttribute('stroke') || '#000000';
            data.strokeWidth = parseFloat(node.getAttribute('stroke-width') || '0');
        }

        const transform = node.getAttribute('transform') || '';
        const rotateMatch = transform.match(/rotate\(([-\d.]+)/);
        if (rotateMatch) data.rotation = parseFloat(rotateMatch[1]) || 0;
        const translateMatch = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
        if (translateMatch) {
            data.translateX = parseFloat(translateMatch[1]) || 0;
            data.translateY = parseFloat(translateMatch[2]) || 0;
        }

        return data;
    }

    syncElementMetadata(elementData) {
        if (!elementData?.element) return;

        elementData.element.dataset.elementId = String(elementData.id);

        if (elementData.type === 'image') {
            elementData.element.dataset.name = elementData.name || 'Imagem';
            elementData.element.dataset.imageKind = elementData.imageKind || 'image';

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
        }
    }
    
    loadExistingDesign(index) {
        const cart = this.getCartData();
        let targetIndex = Number.isInteger(index) ? index : -1;

        if (this.editDesignId) {
            const byDesignId = cart.findIndex((item) => String(item?.designId || item?.design_id || '') === String(this.editDesignId));
            if (byDesignId >= 0) {
                targetIndex = byDesignId;
            }
        }

        if (targetIndex >= 0 && cart[targetIndex] && cart[targetIndex].design) {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(cart[targetIndex].design, 'image/svg+xml');
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
                this.editDesignId = String(cart[targetIndex].designId || cart[targetIndex].design_id || this.editDesignId || '');
            } catch (error) {
                console.error('Error loading existing design:', error);
            }
        }
    }

    loadAutosaveDesign() {
        const autosave = localStorage.getItem(this.getAutosaveKey()) || this.getLegacyAutosaveKeys()
            .map((key) => localStorage.getItem(key))
            .find(Boolean);
        if (!autosave) return;

        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(autosave, 'image/svg+xml');
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
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Add elements
        document.getElementById('add-text-btn').addEventListener('click', () => this.addText());
        document.getElementById('add-image-btn').addEventListener('click', () => {
            document.getElementById('image-upload').click();
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
        
        // Add to cart
        document.getElementById('add-to-cart-btn').addEventListener('click', () => this.addToCart());
        
        // Delete element
        document.getElementById('delete-element-btn').addEventListener('click', () => this.deleteSelected());

        // Quick actions
        const duplicateBtn = document.getElementById('duplicate-element-btn');
        if (duplicateBtn) duplicateBtn.addEventListener('click', () => this.duplicateSelected());

        const centerHBtn = document.getElementById('center-h-btn');
        if (centerHBtn) centerHBtn.addEventListener('click', () => this.centerSelected('horizontal'));

        const centerVBtn = document.getElementById('center-v-btn');
        if (centerVBtn) centerVBtn.addEventListener('click', () => this.centerSelected('vertical'));

        const keepAspectCheckbox = document.getElementById('keep-aspect-ratio');
        if (keepAspectCheckbox) {
            this.keepAspectRatio = keepAspectCheckbox.checked;
            keepAspectCheckbox.addEventListener('change', (e) => {
                this.keepAspectRatio = e.target.checked;
            });
        }
        
        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        document.addEventListener('mousedown', (e) => this.handleDocumentMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('resize', () => this.syncCanvasViewport());
        
        // Property controls
        this.setupPropertyControls();
    }
    
    setupPropertyControls() {
        // Text properties
        const textContent = document.getElementById('prop-text-content');
        const textFont = document.getElementById('prop-text-font');
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
        
        const textRotation = document.getElementById('prop-text-rotation');
        if (textRotation) textRotation.addEventListener('input', (e) => {
            this.updateRotation(e.target.value);
            document.getElementById('prop-text-rotation-val').textContent = e.target.value;
        });
        
        // Image properties
        const imageOpacity = document.getElementById('prop-image-opacity');
        if (imageOpacity) imageOpacity.addEventListener('input', (e) => {
            this.updateImageOpacity(e.target.value / 100);
            document.getElementById('prop-image-opacity-val').textContent = e.target.value;
        });

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
    }
    
    focusPropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (!panel) return;
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

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
    }

    clearPropertiesSections() {
        document.getElementById('no-selection').classList.remove('hidden');
        document.getElementById('text-properties').classList.add('hidden');
        document.getElementById('image-properties').classList.add('hidden');
        document.getElementById('qr-properties').classList.add('hidden');
        document.getElementById('shape-properties').classList.add('hidden');
    }

    clearSelection() {
        this.selectedElement = null;
        this.hideResizeHandles();
        this.elements.forEach(el => el.element.classList.remove('element-selected'));
        this.clearPropertiesSections();
        this.updateSidebarMode();
        this.updateLayers();
    }
    
    // ===== ADD ELEMENTS =====
    addText() {
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
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            // Load image to get natural dimensions
            const tempImg = new Image();
            tempImg.onload = () => {
                // Calculate dimensions maintaining aspect ratio
                let width = tempImg.naturalWidth;
                let height = tempImg.naturalHeight;

                const fitted = this.fitSizeIntoEditableBounds(width, height, 0.45);
                width = fitted.width;
                height = fitted.height;

                const center = this.getEditableCenter();
                
                const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                img.setAttribute('x', String(center.x - (width / 2)));
                img.setAttribute('y', String(center.y - (height / 2)));
                img.setAttribute('width', width);
                img.setAttribute('height', height);
                img.setAttribute('href', event.target.result);
                img.setAttribute('preserveAspectRatio', 'none');
                img.setAttribute('data-editable', 'true');
                img.style.cursor = 'move';
                
                this.canvas.appendChild(img);
                this.bringPrintAreaOverlaysToFront();
                
                const elementData = {
                    id: Date.now(),
                    element: img,
                    type: 'image',
                    src: event.target.result,
                    opacity: 1,
                    rotation: 0
                };
                
                this.elements.push(elementData);
                this.makeElementInteractive(elementData);
                this.selectElement(elementData);
                this.updateLayers();
                this.saveHistory();
            };
            tempImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

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
    }

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
    }

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
    }
    
    addShape(shapeType) {
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
    }
    
    // ===== ELEMENT INTERACTION =====
    makeElementInteractive(elementData) {
        this.syncElementMetadata(elementData);

        // Prevent text selection on element
        elementData.element.style.userSelect = 'none';
        elementData.element.style.webkitUserSelect = 'none';
        
        elementData.element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault(); // Prevent text selection
            this.selectElement(elementData);
            this.startDrag(e, elementData);
        });
    }
    
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
    }
    
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
        const svgLeft = 0; // SVG coordinate system
        const svgTop = 0;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        transformedCorners.forEach(corner => {
            // Convert from client coords to SVG coords
            const vb = this.getCanvasViewBoxSize();
            const svgX = (corner.x - svgRect.left) / svgRect.width * vb.width;
            const svgY = (corner.y - svgRect.top) / svgRect.height * vb.height;
            minX = Math.min(minX, svgX);
            maxX = Math.max(maxX, svgX);
            minY = Math.min(minY, svgY);
            maxY = Math.max(maxY, svgY);
        });
        
        return {
            left: minX,
            right: maxX,
            top: minY,
            bottom: maxY
        };
    }
    
    bringElementInBounds(elementData) {
        // Check if element is out of bounds and move it back in
        const bounds = this.getCanvasBounds();
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
            // Reapply transform with new translation
            if (elementData.rotation && elementData.rotation !== 0) {
                const translateX = (elementData.translateX || 0) + offsetX;
                const translateY = (elementData.translateY || 0) + offsetY;
                
                elementData.translateX = translateX;
                elementData.translateY = translateY;
                const bbox = elementData.element.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;
                elementData.element.setAttribute('transform',
                    `translate(${translateX} ${translateY}) rotate(${elementData.rotation} ${centerX} ${centerY})`);
            } else {
                elementData.translateX = 0;
                elementData.translateY = 0;
                // For non-rotated elements, adjust x/y attributes
                if (elementData.type === 'text' || elementData.type === 'image' || 
                    (elementData.type === 'shape' && elementData.shapeType === 'rectangle')) {
                    const x = parseFloat(elementData.element.getAttribute('x') || 0) + offsetX;
                    const y = parseFloat(elementData.element.getAttribute('y') || 0) + offsetY;
                    elementData.element.setAttribute('x', x);
                    elementData.element.setAttribute('y', y);
                } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
                    const cx = parseFloat(elementData.element.getAttribute('cx') || 0) + offsetX;
                    const cy = parseFloat(elementData.element.getAttribute('cy') || 0) + offsetY;
                    elementData.element.setAttribute('cx', cx);
                    elementData.element.setAttribute('cy', cy);
                } else if (elementData.type === 'shape' && elementData.shapeType === 'triangle') {
                    const currentPoints = (elementData.element.getAttribute('points') || '')
                        .trim()
                        .split(/\s+/)
                        .map((pair) => pair.split(',').map(Number));
                    const translatedPoints = currentPoints.map(([x, y]) => `${x + offsetX},${y + offsetY}`);
                    elementData.element.setAttribute('points', translatedPoints.join(' '));
                }
            }
        }
    }
    
    showResizeHandles(elementData) {
        const handlesContainer = document.getElementById('resize-handles');
        handlesContainer.innerHTML = '';
        handlesContainer.classList.remove('hidden');

        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapperRect = this.canvasWrapper.getBoundingClientRect();
        const bbox = elementData.element.getBBox();
        const ctm = elementData.element.getScreenCTM();

        if (!ctm) return;

        const toCanvasPoint = (x, y) => {
            const p = new DOMPoint(x, y).matrixTransform(ctm);
            return {
                // Position relative to canvas-wrapper, accounting for scroll
                x: p.x - wrapperRect.left,
                y: p.y - wrapperRect.top
            };
        };

        const mid = (a, b) => ({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        });

        const tl = toCanvasPoint(bbox.x, bbox.y);
        const tr = toCanvasPoint(bbox.x + bbox.width, bbox.y);
        const br = toCanvasPoint(bbox.x + bbox.width, bbox.y + bbox.height);
        const bl = toCanvasPoint(bbox.x, bbox.y + bbox.height);

        const tc = mid(tl, tr);
        const rc = mid(tr, br);
        const bc = mid(bl, br);
        const lc = mid(tl, bl);
        const center = {
            x: (tl.x + tr.x + br.x + bl.x) / 4,
            y: (tl.y + tr.y + br.y + bl.y) / 4
        };
        
        // Only show resize handles for non-text elements
        if (elementData.type !== 'text') {
            const handlePositions = {
                'nw': tl,
                'ne': tr,
                'sw': bl,
                'se': br,
                'n': tc,
                's': bc,
                'e': rc,
                'w': lc
            };
            
            Object.entries(handlePositions).forEach(([pos, point]) => {
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                handle.dataset.position = pos;
                handle.style.cursor = `${pos}-resize`;
                handle.style.left = (point.x - 5) + 'px';
                handle.style.top = (point.y - 5) + 'px';
                
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startResize(e, pos);
                });
                
                handlesContainer.appendChild(handle);
            });
        }

        // Add rotation handle aligned with transformed top edge
        const topDirection = {
            x: tc.x - center.x,
            y: tc.y - center.y
        };
        const magnitude = Math.hypot(topDirection.x, topDirection.y) || 1;
        const normal = {
            x: topDirection.x / magnitude,
            y: topDirection.y / magnitude
        };
        const rotateOffset = 24;
        const rotatePoint = {
            x: tc.x + normal.x * rotateOffset,
            y: tc.y + normal.y * rotateOffset
        };
        
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.style.cursor = 'grab';
        rotateHandle.style.left = (rotatePoint.x - 16) + 'px';
        rotateHandle.style.top = (rotatePoint.y - 16) + 'px';
        rotateHandle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>';
        
        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startRotate(e, elementData);
        });
        
        handlesContainer.appendChild(rotateHandle);
    }

    requestHandlesRefresh() {
        if (!this.selectedElement) return;
        if (this.handlesFrameRequest !== null) return;

        this.handlesFrameRequest = requestAnimationFrame(() => {
            this.handlesFrameRequest = null;
            if (this.selectedElement) {
                this.showResizeHandles(this.selectedElement);
            }
        });
    }
    
    hideResizeHandles() {
        document.getElementById('resize-handles').classList.add('hidden');
    }
    
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
    }
    
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
            translateX: elementData.translateX || 0,
            translateY: elementData.translateY || 0,
            snapLock: { x: null, y: null }
        };
        
        // Store current element position
        if (elementData.type === 'text' || elementData.type === 'image' || (elementData.type === 'shape' && elementData.shapeType === 'rectangle')) {
            this.dragStart.elementX = parseFloat(elementData.element.getAttribute('x') || 0);
            this.dragStart.elementY = parseFloat(elementData.element.getAttribute('y') || 0);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'circle') {
            this.dragStart.elementX = parseFloat(elementData.element.getAttribute('cx') || 0);
            this.dragStart.elementY = parseFloat(elementData.element.getAttribute('cy') || 0);
        } else if (elementData.type === 'shape' && elementData.shapeType === 'triangle') {
            this.dragStart.points = (elementData.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));
            this.dragStart.bbox = elementData.element.getBBox();
        }
    }
    
    handleMouseMove(e) {
        if (this.isDragging && this.selectedElement) {
            // Convert screen-space delta to SVG coordinates so drag speed matches cursor.
            const svgDelta = this.clientDeltaToSvgDelta(
                e.clientX - (this.dragStart.startClientX ?? this.dragStart.mouseX),
                e.clientY - (this.dragStart.startClientY ?? this.dragStart.mouseY)
            );
            let deltaX = svgDelta.dx;
            let deltaY = svgDelta.dy;

            // ===== GUIDES & SNAP ALIGNMENT (Shift only) =====
            if (e.shiftKey) {
                const guides = this.calculateGuides(this.selectedElement);
                const bbox = this.dragStart.bbox || this.selectedElement.element.getBBox();
                const proposedY = bbox.y + deltaY;
                const proposedX = bbox.x + deltaX;
                const proposedCenter = {
                    x: proposedX + bbox.width / 2,
                    y: proposedY + bbox.height / 2
                };

                const rawSnapPoints = this.findSnapPoints(
                    proposedCenter,
                    guides,
                    this.guideThreshold
                );
                const snapPoints = {
                    x: this.resolveStickySnap('x', rawSnapPoints.x, proposedCenter.x),
                    y: this.resolveStickySnap('y', rawSnapPoints.y, proposedCenter.y)
                };

                if (snapPoints.x || snapPoints.y) {
                    this.showGuideLines(snapPoints);
                } else {
                    this.hideGuideLines();
                }

                const snappedMove = this.applySnapToMove(deltaX, deltaY, snapPoints, proposedCenter);
                deltaX = snappedMove.deltaX;
                deltaY = snappedMove.deltaY;
            } else {
                if (this.dragStart?.snapLock) {
                    this.dragStart.snapLock.x = null;
                    this.dragStart.snapLock.y = null;
                }
                this.hideGuideLines();
            }
            
            this.moveElementFromDragStart(this.selectedElement, deltaX, deltaY);
            
            this.showResizeHandles(this.selectedElement);
        } else if (this.isResizing && this.selectedElement) {
            this.doResize(e);
        } else if (this.isRotating && this.selectedElement) {
            this.doRotate(e);
        }
    }
    
    handleMouseUp() {
        const wasRotating = this.isRotating;
        const wasDragging = this.isDragging;
        const wasResizing = this.isResizing;
        
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

        if (this.handlesFrameRequest !== null) {
            cancelAnimationFrame(this.handlesFrameRequest);
            this.handlesFrameRequest = null;
        }

        // ===== APPLY CROP AUTOMATICALLY =====
        if (this.cropMode && wasResizing) {
            // Auto-apply crop após reposicionar handles
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
    }
    
    handleCanvasMouseDown(e) {
        if (e.target === this.canvas || e.target === this.printArea) {
            this.clearSelection();
        }
    }

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
    }
    
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
            translateX: this.selectedElement.translateX || 0,
            translateY: this.selectedElement.translateY || 0,
            anchorCanvasPoint: this.getElementCanvasPoint(
                this.selectedElement.element,
                anchorLocalPoint.x,
                anchorLocalPoint.y
            ),
            points: this.selectedElement.shapeType === 'triangle'
                ? (this.selectedElement.element.getAttribute('points') || '')
                    .trim()
                    .split(/\s+/)
                    .map((pair) => pair.split(',').map(Number))
                : null
        };
    }
    
    doResize(e) {
        if (!this.selectedElement) return;

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

            // Garantir que o crop não sai dos limites da imagem
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
        const canvasBounds = this.getCanvasBounds();
        const resizeStateBeforeChange = this.captureResizeState(this.selectedElement);
        
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
                const widthFromHeight = Math.max(20, newHeight * ratio);
                const heightFromWidth = Math.max(20, newWidth / ratio);
                const widthDelta = Math.abs(newWidth - bbox.width);
                const heightDelta = Math.abs(newHeight - bbox.height);

                if (widthDelta >= heightDelta * ratio) {
                    newHeight = heightFromWidth;
                } else {
                    newWidth = widthFromHeight;
                }

                if (this.resizeHandle === 'nw') {
                    newX = bbox.x + (bbox.width - newWidth);
                    newY = bbox.y + (bbox.height - newHeight);
                }
                if (this.resizeHandle === 'ne') {
                    newY = bbox.y + (bbox.height - newHeight);
                }
                if (this.resizeHandle === 'sw') {
                    newX = bbox.x + (bbox.width - newWidth);
                }
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

        const constrainedRect = shouldKeepRatio
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
            );

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
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'triangle') {
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

            const transformed = this.getTransformedBounds(this.selectedElement);
            const editableBounds = this.getCanvasBounds();
            if (transformed.left < editableBounds.x ||
                transformed.right > editableBounds.x + editableBounds.width ||
                transformed.top < editableBounds.y ||
                transformed.bottom > editableBounds.y + editableBounds.height) {
                this.restoreResizeState(this.selectedElement, resizeStateBeforeChange);
                return;
            }
        }

        this.showResizeHandles(this.selectedElement);
    }
    
    // ===== ROTATION =====
    startRotate(e, elementData) {
        e.preventDefault();
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

        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        this.rotationStart = Math.atan2(mouseY - centerClient.y, mouseX - centerClient.x) * (180 / Math.PI);
        this.rotationStart -= (elementData.rotation || 0);
    }
    
    doRotate(e) {
        if (!this.selectedElement) return;

        const bbox = this.selectedElement.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

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

        // Normalize rotation to remove floating point artifacts
        rotation = this.normalizeRotation(rotation);
        
        // Test if rotation would push element too far out of bounds
        const translateX = this.selectedElement.translateX || 0;
        const translateY = this.selectedElement.translateY || 0;
        
        // Temporarily apply the new rotation to test bounds
        this.selectedElement.element.setAttribute('transform', 
            `translate(${translateX} ${translateY}) rotate(${rotation} ${centerX} ${centerY})`);
        
        const transformed = this.getTransformedBounds(this.selectedElement);
        const bounds = this.getCanvasBounds();
        
        // Check if element is completely outside bounds (all corners out on same side)
        const isCompletelyOutLeft = transformed.right < bounds.x;
        const isCompletelyOutRight = transformed.left > bounds.x + bounds.width;
        const isCompletelyOutTop = transformed.bottom < bounds.y;
        const isCompletelyOutBottom = transformed.top > bounds.y + bounds.height;
        
        if (isCompletelyOutLeft || isCompletelyOutRight || isCompletelyOutTop || isCompletelyOutBottom) {
            // Revert to previous rotation - not allowed to escape completely
            const prevRotation = this.selectedElement.rotation || 0;
            this.selectedElement.element.setAttribute('transform', 
                `translate(${translateX} ${translateY}) rotate(${prevRotation} ${centerX} ${centerY})`);
            return; // Don't update the display
        }
        
        // Rotation is valid, apply it
        this.selectedElement.rotation = rotation;
        
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

        this.requestHandlesRefresh();
    }
    
    updateRotation(value) {
        if (this.selectedElement) {
            const bbox = this.selectedElement.element.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            let rotation = this.normalizeRotation(parseFloat(value));
            
            const translateX = this.selectedElement.translateX || 0;
            const translateY = this.selectedElement.translateY || 0;
            
            // Test the new rotation
            this.selectedElement.element.setAttribute('transform', 
                `translate(${translateX} ${translateY}) rotate(${rotation} ${centerX} ${centerY})`);
            
            const transformed = this.getTransformedBounds(this.selectedElement);
            const bounds = this.getEditableBounds();
            
            // Check if element would be completely outside bounds
            const isCompletelyOutLeft = transformed.right < bounds.x;
            const isCompletelyOutRight = transformed.left > bounds.x + bounds.width;
            const isCompletelyOutTop = transformed.bottom < bounds.y;
            const isCompletelyOutBottom = transformed.top > bounds.y + bounds.height;
            
            if (isCompletelyOutLeft || isCompletelyOutRight || isCompletelyOutTop || isCompletelyOutBottom) {
                // Reject this rotation - revert to previous
                const prevRotation = this.selectedElement.rotation || 0;
                this.selectedElement.element.setAttribute('transform', 
                    `translate(${translateX} ${translateY}) rotate(${prevRotation} ${centerX} ${centerY})`);
                // Reset input to previous value
                const inputId = this.selectedElement.type === 'text' ? 'prop-text-rotation' :
                               this.selectedElement.type === 'image' ? 'prop-image-rotation' :
                               'prop-shape-rotation';
                const input = document.getElementById(inputId);
                if (input) input.value = prevRotation;
                return;
            }
            
            // Rotation is valid, apply it
            this.selectedElement.rotation = rotation;
            this.showResizeHandles(this.selectedElement);
            this.queueHistorySave();
        }
    }
    
    // ===== PROPERTY UPDATES =====
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
    }
    
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
    }
    
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
    }
    
    updateTextColor(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('fill', value);
            this.selectedElement.color = value;
            this.queueHistorySave();
        }
    }
    
    toggleTextBold() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const current = this.selectedElement.element.getAttribute('font-weight') || 'normal';
            const newWeight = current === 'bold' ? 'normal' : 'bold';
            this.selectedElement.element.setAttribute('font-weight', newWeight);
            this.selectedElement.bold = newWeight === 'bold';
            this.saveHistory();
        }
    }
    
    toggleTextItalic() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const current = this.selectedElement.element.getAttribute('font-style') || 'normal';
            const newStyle = current === 'italic' ? 'normal' : 'italic';
            this.selectedElement.element.setAttribute('font-style', newStyle);
            this.selectedElement.italic = newStyle === 'italic';
            this.saveHistory();
        }
    }
    
    updateImageOpacity(value) {
        if (this.selectedElement && this.selectedElement.type === 'image') {
            this.selectedElement.element.setAttribute('opacity', value);
            this.selectedElement.opacity = value;
            this.queueHistorySave();
        }
    }

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
    }

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
    }
    
    updateShapeFill(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextFill = this.sanitizeColorValue(value, '#3b82f6');
            this.selectedElement.element.setAttribute('fill', nextFill);
            this.selectedElement.fill = nextFill;
            this.queueHistorySave();
        }
    }
    
    updateShapeStroke(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextStroke = this.sanitizeColorValue(value, '#000000');
            this.selectedElement.element.setAttribute('stroke', nextStroke);
            this.selectedElement.stroke = nextStroke;
            this.queueHistorySave();
        }
    }
    
    updateShapeStrokeWidth(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            this.selectedElement.element.setAttribute('stroke-width', value);
            this.selectedElement.strokeWidth = value;
            this.queueHistorySave();
        }
    }
    
    // ===== DELETE =====
    deleteSelected() {
        if (this.selectedElement) {
            this.selectedElement.element.remove();
            this.elements = this.elements.filter(el => el.id !== this.selectedElement.id);
            this.clearSelection();
            this.updateLayers();
            this.saveHistory();
        }
    }

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
        } else if (clonedData.type === 'image' || (clonedData.type === 'shape' && clonedData.shapeType === 'rectangle')) {
            const x = parseFloat(clone.getAttribute('x') || '0') + offset;
            const y = parseFloat(clone.getAttribute('y') || '0') + offset;
            clone.setAttribute('x', x);
            clone.setAttribute('y', y);
        } else if (clonedData.type === 'shape' && clonedData.shapeType === 'circle') {
            const cx = parseFloat(clone.getAttribute('cx') || '0') + offset;
            const cy = parseFloat(clone.getAttribute('cy') || '0') + offset;
            clone.setAttribute('cx', cx);
            clone.setAttribute('cy', cy);
        } else if (clonedData.type === 'shape' && clonedData.shapeType === 'triangle') {
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
    }

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
    }

    nudgeSelected(dx, dy) {
        if (!this.selectedElement) return;

        this.moveElementBy(this.selectedElement, dx, dy);

        this.showResizeHandles(this.selectedElement);
        this.saveHistory();
    }

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
    }
    
    // ===== LAYERS =====
    updateLayers() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        
        if (this.elements.length === 0) {
            layersList.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Nenhuma camada ainda</p>';
            return;
        }

        const selectedId = this.selectedElement ? String(this.selectedElement.id) : null;
        
        layersList.innerHTML = this.elements.map((el, index) => `
            <div class="layer-item p-3 border rounded-lg mb-2 hover:bg-gray-50 cursor-pointer ${selectedId === String(el.id) ? 'bg-blue-50 border-blue-600' : ''}"
                 data-layer-index="${index}"
                 data-layer-id="${String(el.id)}"
                 draggable="true">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${el.type === 'text' ? 'type' : el.type === 'image' ? (el.imageKind === 'qr' ? 'qr-code' : 'image') : 'square'}" class="w-4 h-4"></i>
                        <span class="text-sm font-semibold">${el.type === 'text' ? (el.content || 'Texto').substring(0, 20) : el.type === 'image' ? (el.name || (el.imageKind === 'qr' ? 'QR Code' : 'Imagem')) : el.type.charAt(0).toUpperCase() + el.type.slice(1)}</span>
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
    }
    
    selectElementByIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.elements.length) return;
        this.selectElement(this.elements[index]);
    }

    selectElementById(layerId) {
        const targetId = String(layerId || '');
        if (!targetId) return;
        const elementData = this.elements.find((el) => String(el.id) === targetId);
        if (!elementData) return;
        this.selectElement(elementData);
    }

    syncCanvasOrderFromLayers() {
        this.elements.forEach((elementData) => {
            if (elementData?.element && elementData.element.parentNode === this.canvas) {
                this.canvas.appendChild(elementData.element);
            }
        });
        this.bringPrintAreaOverlaysToFront();
    }

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
    }
    
    moveLayer(index, direction) {
        const newIndex = index + direction;
        this.moveLayerToIndex(index, newIndex);
    }
    
    // ===== ZOOM =====
    syncCanvasViewport() {
        if (!this.canvasStage || !this.canvasWrapper) return;

        const stageWidth = this.canvasStage.clientWidth;
        const stageHeight = this.canvasStage.clientHeight;
        if (!stageWidth || !stageHeight) return;

        const needsResizeRecalc = (
            !this.initialCanvasSize ||
            this._lastViewportStageWidth !== stageWidth ||
            this._lastViewportStageHeight !== stageHeight
        );

        if (needsResizeRecalc) {
            const targetWidth = stageWidth * 0.9;
            const targetHeight = stageHeight * 0.9;
            const sourceWidth = Number(this.baseCanvasSize?.width) || 800;
            const sourceHeight = Number(this.baseCanvasSize?.height) || 600;
            const ratio = sourceWidth / sourceHeight;

            let baseWidth = targetWidth;
            let baseHeight = baseWidth / ratio;

            if (baseHeight > targetHeight) {
                baseHeight = targetHeight;
                baseWidth = baseHeight * ratio;
            }

            this.initialCanvasSize = {
                width: baseWidth,
                height: baseHeight
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
    }

    setZoom(newZoom) {
        this.zoom = Math.max(0.5, Math.min(2, newZoom));
        this.syncCanvasViewport();
        document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
    }

    getHistorySnapshot() {
        this.elements.forEach((elementData) => this.syncElementMetadata(elementData));

        return JSON.stringify({
            selectedElementId: this.selectedElement ? String(this.selectedElement.id) : null,
            elements: this.elements.map((elementData) => ({
                id: String(elementData.id),
                markup: elementData.element.outerHTML
            }))
        });
    }

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
    }

    flushPendingHistorySave() {
        if (this.historyCommitTimer === null) {
            return;
        }

        clearTimeout(this.historyCommitTimer);
        this.historyCommitTimer = null;
        this.saveHistory();
    }

    beginHistoryGesture() {
        if (this.activeHistoryGestureSnapshot !== null) {
            return;
        }

        this.flushPendingHistorySave();
        this.activeHistoryGestureSnapshot = this.getHistorySnapshot();
    }

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
    }

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
    }
    
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
    }
    
    undo() {
        this.flushPendingHistorySave();
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        } else {
            this.updateHistoryButtons();
        }
    }
    
    redo() {
        this.flushPendingHistorySave();
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        } else {
            this.updateHistoryButtons();
        }
    }
    
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
            console.error('Erro ao restaurar histórico:', error);
        } finally {
            this.isRestoringHistory = false;
            this.updateHistoryButtons();
        }
    }
    
    // ===== AUTO SAVE =====
    setupAutoSave() {
        setInterval(() => {
            if (this.elements.length > 0) {
                this.autoSave();
            }
        }, 5000);
    }
    
    autoSave() {
        const design = this.getDesignSVG();
        localStorage.setItem(this.getAutosaveKey(), design);
        this.getLegacyAutosaveKeys().forEach((key) => {
            localStorage.setItem(key, design);
        });
    }

    // ===== CROP FUNCTIONALITY =====
    startCropMode() {
        if (!this.selectedElement || this.selectedElement.type !== 'image') {
            showToast('Seleccione uma imagem para cortar', 'warning');
            return;
        }

        this.cropMode = true;
        this.isDragging = false;
        this.isResizing = false;
        
        const bbox = this.selectedElement.element.getBBox();
        this.cropBounds = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };

        showToast('Modo de corte ativo - arraste os handles para cortar', 'info');
        this.showCropHandles();
    }

    showCropHandles() {
        const handlesContainer = document.getElementById('resize-handles');
        handlesContainer.innerHTML = '';
        handlesContainer.classList.remove('hidden');

        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapperRect = this.canvasWrapper.getBoundingClientRect();
        const bbox = this.cropBounds;
        const ctm = this.selectedElement.element.getScreenCTM();

        if (!ctm) return;

        const toCanvasPoint = (x, y) => {
            const p = new DOMPoint(x, y).matrixTransform(ctm);
            return {
                x: p.x - wrapperRect.left,
                y: p.y - wrapperRect.top
            };
        };

        const tl = toCanvasPoint(bbox.x, bbox.y);
        const tr = toCanvasPoint(bbox.x + bbox.width, bbox.y);
        const br = toCanvasPoint(bbox.x + bbox.width, bbox.y + bbox.height);
        const bl = toCanvasPoint(bbox.x, bbox.y + bbox.height);

        const mid = (a, b) => ({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        });

        const tc = mid(tl, tr);
        const rc = mid(tr, br);
        const bc = mid(bl, br);
        const lc = mid(tl, bl);

        const handlePositions = {
            'nw': tl,
            'ne': tr,
            'sw': bl,
            'se': br,
            'n': tc,
            's': bc,
            'e': rc,
            'w': lc
        };

        Object.entries(handlePositions).forEach(([pos, point]) => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle crop-handle';
            handle.dataset.position = pos;
            handle.style.cursor = `${pos}-resize`;
            handle.style.left = (point.x - 5) + 'px';
            handle.style.top = (point.y - 5) + 'px';
            handle.style.backgroundColor = '#a855f7';
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startCropResize(e, pos);
            });
            
            handlesContainer.appendChild(handle);
        });
    }

    startCropResize(e, position) {
        this.isResizing = true;
        this.resizeHandle = position;
        this.dragStart = {
            x: e.clientX,
            y: e.clientY,
            startClientX: e.clientX,
            startClientY: e.clientY,
            bbox: { ...this.cropBounds }
        };
    }

    applyCrop() {
        if (!this.selectedElement || this.selectedElement.type !== 'image' || !this.cropBounds) {
            return;
        }

        const currentBbox = this.selectedElement.element.getBBox();
        const widthRatio = this.cropBounds.width / currentBbox.width;
        const heightRatio = this.cropBounds.height / currentBbox.height;
        const xRatio = (this.cropBounds.x - currentBbox.x) / currentBbox.width;
        const yRatio = (this.cropBounds.y - currentBbox.y) / currentBbox.height;

        // Armazenar crop no elementData
        this.selectedElement.cropBounds = this.cropBounds;
        this.selectedElement.cropData = {
            widthRatio,
            heightRatio,
            xRatio,
            yRatio
        };

        // Aplicar clipPath ao elemento
        const clipPathId = `crop-clip-${this.selectedElement.id}`;
        let defs = this.canvas.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.canvas.prepend(defs);
        }

        const existingClip = defs.querySelector(`#${clipPathId}`);
        if (existingClip) {
            existingClip.remove();
        }

        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipPathId);

        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', String(this.cropBounds.x));
        clipRect.setAttribute('y', String(this.cropBounds.y));
        clipRect.setAttribute('width', String(this.cropBounds.width));
        clipRect.setAttribute('height', String(this.cropBounds.height));

        clipPath.appendChild(clipRect);
        defs.appendChild(clipPath);

        this.selectedElement.element.setAttribute('clip-path', `url(#${clipPathId})`);

        this.cropMode = false;
        this.cropBounds = null;
        this.hideResizeHandles();
        this.selectElement(this.selectedElement);
        
        showToast('Imagem cortada com sucesso', 'success');
        this.saveHistory();
    }

    createExportMaskShape() {
        const shapeOutline = this.canvas.querySelector('#print-area-shape-outline');
        const maskShape = shapeOutline
            ? shapeOutline.cloneNode(true)
            : document.createElementNS('http://www.w3.org/2000/svg', 'rect');

        if (!shapeOutline) {
            const vb = this.getCanvasViewBoxSize();
            maskShape.setAttribute('x', '0');
            maskShape.setAttribute('y', '0');
            maskShape.setAttribute('width', String(vb.width));
            maskShape.setAttribute('height', String(vb.height));
        }

        maskShape.removeAttribute('id');
        maskShape.removeAttribute('pointer-events');
        maskShape.removeAttribute('opacity');
        maskShape.removeAttribute('stroke');
        maskShape.removeAttribute('stroke-width');
        maskShape.removeAttribute('stroke-dasharray');
        maskShape.setAttribute('fill', '#ffffff');

        return maskShape;
    }
    
    getDesignSVG() {
        const vb = this.getCanvasViewBoxSize();
        const exportWidth = Math.max(1, Math.round(vb.width));
        const exportHeight = Math.max(1, Math.round(vb.height));

        const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
        exportSvg.setAttribute('width', String(exportWidth));
        exportSvg.setAttribute('height', String(exportHeight));
        exportSvg.setAttribute('preserveAspectRatio', 'none');

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', 'design-export-clip');
        clipPath.appendChild(this.createExportMaskShape());
        defs.appendChild(clipPath);
        exportSvg.appendChild(defs);

        const clippedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        clippedGroup.setAttribute('clip-path', 'url(#design-export-clip)');

        Array.from(this.canvas.children)
            .filter((node) => {
                const id = node.getAttribute('id');
                return id !== 'print-area-outline' && id !== 'print-area-shape-outline' && id !== 'print-area-outside-overlay' && id !== 'print-area-outside-grid';
            })
            .forEach((node) => {
                clippedGroup.appendChild(node.cloneNode(true));
            });

        exportSvg.appendChild(clippedGroup);
        return new XMLSerializer().serializeToString(exportSvg);
    }
    
    // ===== ADD TO CART =====
    addToCart() {
        if (this.elements.length === 0) {
            showToast('Adicione pelo menos um elemento ao design', 'warning');
            return;
        }
        
        const cart = this.getCartData();
        const design = this.getDesignSVG();
        let targetIndex = this.editIndex !== null ? Number.parseInt(this.editIndex, 10) : -1;
        if (this.editDesignId) {
            const designMatchIndex = cart.findIndex((item) => String(item?.designId || item?.design_id || '') === String(this.editDesignId));
            if (designMatchIndex >= 0) {
                targetIndex = designMatchIndex;
            }
        }

        const existingCartItem = targetIndex >= 0 ? cart[targetIndex] : null;
        const designId = (existingCartItem?.designId || existingCartItem?.design_id || this.editDesignId || `dsg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        
        const cartItem = {
            id: this.currentProduct.id,
            nome: this.currentProduct.nome,
            preco: this.currentProduct.preco,
            imagem: this.currentProduct.imagem,
            quantity: Math.max(1, Number.parseInt(existingCartItem?.quantity ?? 1, 10) || 1),
            customized: true,
            designId,
            design: design,
            designPreview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(design)}`
        };
        
        if (targetIndex >= 0) {
            cart[targetIndex] = cartItem;
            showToast('Design atualizado no carrinho!', 'success');
        } else {
            cart.push(cartItem);
            showToast('Produto adicionado ao carrinho!', 'success');
        }
        
        this.saveCartData(cart);
        localStorage.removeItem(this.getAutosaveKey());
        this.getLegacyAutosaveKeys().forEach((key) => localStorage.removeItem(key));
        
        setTimeout(() => {
            window.location.href = '/produtos.html';
        }, 1000);
    }
}

// Initialize editor
let editor;
document.addEventListener('DOMContentLoaded', () => {
    editor = new DesignEditor();
});
