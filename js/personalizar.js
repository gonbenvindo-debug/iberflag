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
        this.productId = null;
        this.cartStorageKey = 'latinflag_cart';
        this.printAreaBounds = { x: 50, y: 50, width: 700, height: 500 };
        this.keepAspectRatio = true;
        this.baseCanvasSize = { width: 800, height: 600 };
        this.initialCanvasSize = null; // Will store computed base size at 100% zoom
        this.handlesFrameRequest = null;
        
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
                    .single();

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
        if (this.editIndex !== null) {
            this.loadExistingDesign(parseInt(this.editIndex));
        } else {
            this.loadAutosaveDesign();
        }
    }

    getAutosaveKey() {
        return `latinflag_autosave_${this.productId || 'default'}`;
    }

    getCartData() {
        const primary = JSON.parse(localStorage.getItem(this.cartStorageKey) || '[]');
        if (primary.length > 0) return primary;

        const legacy = JSON.parse(localStorage.getItem('cart') || '[]');
        if (legacy.length > 0) return legacy;

        return [];
    }

    saveCartData(cart) {
        localStorage.setItem(this.cartStorageKey, JSON.stringify(cart));
        // Keep legacy key for backward compatibility during migration.
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    getEditableBounds() {
        return this.printAreaBounds || { x: 0, y: 0, width: 800, height: 600 };
    }

    getCanvasBounds() {
        return this.getEditableBounds();
    }

    getEditableCenter() {
        const bounds = this.getEditableBounds();
        return {
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2)
        };
    }

    clientToSvgPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const svgWidth = 800;
        const svgHeight = 600;

        return {
            x: ((clientX - rect.left) / rect.width) * svgWidth,
            y: ((clientY - rect.top) / rect.height) * svgHeight
        };
    }

    clientDeltaToSvgDelta(deltaClientX, deltaClientY) {
        const rect = this.canvas.getBoundingClientRect();
        const svgWidth = 800;
        const svgHeight = 600;

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

        this.printAreaBounds = { x: 0, y: 0, width: 800, height: 600 };
        this.printArea.setAttribute('x', String(this.printAreaBounds.x));
        this.printArea.setAttribute('y', String(this.printAreaBounds.y));
        this.printArea.setAttribute('width', String(this.printAreaBounds.width));
        this.printArea.setAttribute('height', String(this.printAreaBounds.height));
        this.printArea.setAttribute('fill', 'none');
        this.printArea.setAttribute('stroke', '#3b82f6');
        this.printArea.setAttribute('stroke-width', '2');
        this.printArea.setAttribute('stroke-dasharray', '8,4');
        this.printArea.setAttribute('opacity', '0.5');
        this.printArea.setAttribute('pointer-events', 'none');
        this.printArea.removeAttribute('transform');
    }

    updatePrintAreaFromElement(areaElement, sourceBounds) {
        this.setDefaultPrintArea();

        if (!areaElement || !sourceBounds || !sourceBounds.width || !sourceBounds.height) {
            return;
        }

        const scaleX = 800 / sourceBounds.width;
        const scaleY = 600 / sourceBounds.height;
        const offsetX = -sourceBounds.x * scaleX;
        const offsetY = -sourceBounds.y * scaleY;

        const visualArea = document.importNode(areaElement, true);
        visualArea.setAttribute('id', 'print-area-shape-outline');
        visualArea.setAttribute('fill', 'none');
        visualArea.setAttribute('stroke', '#3b82f6');
        visualArea.setAttribute('stroke-width', '2');
        visualArea.setAttribute('stroke-dasharray', '8,4');
        visualArea.setAttribute('opacity', '0.75');
        visualArea.setAttribute('pointer-events', 'none');
        visualArea.setAttribute('transform', `translate(${offsetX} ${offsetY}) scale(${scaleX} ${scaleY})`);

        this.canvas.appendChild(visualArea);

        // Editable bounds remain exactly the same as the design-canvas.
        this.printAreaBounds = { x: 0, y: 0, width: 800, height: 600 };
    }
    
    loadSVGTemplate(svgContent) {
        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const root = svgDoc.documentElement;
            const areaElement = root.querySelector('path, polygon, rect, circle, ellipse');

            if (!areaElement) {
                this.setDefaultPrintArea();
                return;
            }

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
            id: customId ?? (Date.now() + Math.random()),
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
    
    loadExistingDesign(index) {
        const cart = this.getCartData();
        if (cart[index] && cart[index].design) {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(cart[index].design, 'image/svg+xml');
                const designElements = svgDoc.documentElement.querySelectorAll('[data-editable="true"]');
                
                designElements.forEach(el => {
                    const imported = document.importNode(el, true);
                    this.canvas.appendChild(imported);
                    const elementData = this.buildElementDataFromNode(imported);
                    
                    this.elements.push(elementData);
                    this.makeElementInteractive(elementData);
                });
                
                this.updateLayers();
                this.saveHistory();
            } catch (error) {
                console.error('Error loading existing design:', error);
            }
        }
    }

    loadAutosaveDesign() {
        const autosave = localStorage.getItem(this.getAutosaveKey());
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
        document.getElementById('shape-properties').classList.add('hidden');
    }

    clearSelection() {
        this.selectedElement = null;
        this.hideResizeHandles();
        this.elements.forEach(el => el.element.classList.remove('element-selected'));
        this.clearPropertiesSections();
        this.updateSidebarMode();
    }
    
    // ===== ADD ELEMENTS =====
    addText() {
        const center = this.getEditableCenter();
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(center.x - 80));
        text.setAttribute('y', String(center.y));
        text.setAttribute('font-family', 'Arial');
        text.setAttribute('font-size', '24');
        text.setAttribute('fill', '#000000');
        text.setAttribute('data-editable', 'true');
        text.textContent = 'Clique para editar';
        text.style.cursor = 'move';
        
        this.canvas.appendChild(text);
        
        // Get actual bounding box after adding to DOM
        const bbox = text.getBBox();
        
        const elementData = {
            id: Date.now(),
            element: text,
            type: 'text',
            content: 'Clique para editar',
            font: 'Arial',
            size: 24,
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
                const maxSize = 200;
                let width = tempImg.naturalWidth;
                let height = tempImg.naturalHeight;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = width * ratio;
                    height = height * ratio;
                }

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
    
    addShape(shapeType) {
        const center = this.getEditableCenter();
        let shape;
        
        if (shapeType === 'rectangle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', String(center.x - 75));
            shape.setAttribute('y', String(center.y - 50));
            shape.setAttribute('width', '150');
            shape.setAttribute('height', '100');
        } else if (shapeType === 'circle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', String(center.x));
            shape.setAttribute('cy', String(center.y));
            shape.setAttribute('r', '75');
        } else if (shapeType === 'triangle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const p1 = `${center.x},${center.y - 75}`;
            const p2 = `${center.x + 75},${center.y + 50}`;
            const p3 = `${center.x - 75},${center.y + 50}`;
            shape.setAttribute('points', `${p1} ${p2} ${p3}`);
        }
        
        shape.setAttribute('fill', '#3b82f6');
        shape.setAttribute('stroke', 'none');
        shape.setAttribute('stroke-width', '0');
        shape.setAttribute('data-editable', 'true');
        shape.style.cursor = 'move';
        
        this.canvas.appendChild(shape);
        
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
    
    selectElement(elementData) {
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
        this.bringElementInBounds(elementData);
        
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
            const svgX = (corner.x - svgRect.left) / svgRect.width * 800;
            const svgY = (corner.y - svgRect.top) / svgRect.height * 600;
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
            const translateX = (elementData.translateX || 0) + offsetX;
            const translateY = (elementData.translateY || 0) + offsetY;
            
            elementData.translateX = translateX;
            elementData.translateY = translateY;
            
            // Reapply transform with new translation
            if (elementData.rotation && elementData.rotation !== 0) {
                const bbox = elementData.element.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;
                elementData.element.setAttribute('transform',
                    `translate(${translateX} ${translateY}) rotate(${elementData.rotation} ${centerX} ${centerY})`);
            } else {
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
        this.isDragging = true;

        // Store the mouse position at drag start
        this.dragStart = {
            mouseX: e.clientX,
            mouseY: e.clientY
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
                e.clientX - this.dragStart.mouseX,
                e.clientY - this.dragStart.mouseY
            );
            const deltaX = svgDelta.dx;
            const deltaY = svgDelta.dy;
            
            // For rotated elements, use translate transform
            if (this.selectedElement.rotation && this.selectedElement.rotation !== 0) {
                const proposedTranslateX = (this.selectedElement.translateX || 0) + deltaX;
                const proposedTranslateY = (this.selectedElement.translateY || 0) + deltaY;
                const clampedTranslate = this.clampRotatedTranslate(
                    this.selectedElement,
                    proposedTranslateX,
                    proposedTranslateY
                );

                this.selectedElement.translateX = clampedTranslate.translateX;
                this.selectedElement.translateY = clampedTranslate.translateY;
            } else {
                // For non-rotated elements, use x/y attributes as before
                let newX;
                let newY;
                
                const canvasBounds = this.getCanvasBounds();
                
                if (this.selectedElement.type === 'text') {
                    const currentX = parseFloat(this.selectedElement.element.getAttribute('x') || 0);
                    const currentY = parseFloat(this.selectedElement.element.getAttribute('y') || 0);
                    newX = currentX + deltaX;
                    newY = currentY + deltaY;
                    newX = Math.max(canvasBounds.x, Math.min(newX, canvasBounds.x + canvasBounds.width - 50));
                    newY = Math.max(canvasBounds.y + 20, Math.min(newY, canvasBounds.y + canvasBounds.height));
                    this.selectedElement.element.setAttribute('x', newX);
                    this.selectedElement.element.setAttribute('y', newY);
                } else if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
                    const currentX = parseFloat(this.selectedElement.element.getAttribute('x') || 0);
                    const currentY = parseFloat(this.selectedElement.element.getAttribute('y') || 0);
                    newX = currentX + deltaX;
                    newY = currentY + deltaY;
                    const width = parseFloat(this.selectedElement.element.getAttribute('width'));
                    const height = parseFloat(this.selectedElement.element.getAttribute('height'));
                    newX = Math.max(canvasBounds.x, Math.min(newX, canvasBounds.x + canvasBounds.width - width));
                    newY = Math.max(canvasBounds.y, Math.min(newY, canvasBounds.y + canvasBounds.height - height));
                    this.selectedElement.element.setAttribute('x', newX);
                    this.selectedElement.element.setAttribute('y', newY);
                } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
                    const currentX = parseFloat(this.selectedElement.element.getAttribute('cx') || 0);
                    const currentY = parseFloat(this.selectedElement.element.getAttribute('cy') || 0);
                    newX = currentX + deltaX;
                    const r = parseFloat(this.selectedElement.element.getAttribute('r'));
                    newX = Math.max(canvasBounds.x + r, Math.min(newX, canvasBounds.x + canvasBounds.width - r));
                    newY = Math.max(canvasBounds.y + r, Math.min(newY, canvasBounds.y + canvasBounds.height - r));
                    this.selectedElement.element.setAttribute('cx', newX);
                    this.selectedElement.element.setAttribute('cy', newY);
                } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'triangle') {
                    const currentPoints = (this.selectedElement.element.getAttribute('points') || '')
                        .trim()
                        .split(/\s+/)
                        .map((pair) => pair.split(',').map(Number));
                    const bbox = this.selectedElement.element.getBBox();
                    let clampedDeltaX = deltaX;
                    let clampedDeltaY = deltaY;

                    if (bbox.x + clampedDeltaX < canvasBounds.x) {
                        clampedDeltaX = canvasBounds.x - bbox.x;
                    }
                    if (bbox.x + bbox.width + clampedDeltaX > canvasBounds.x + canvasBounds.width) {
                        clampedDeltaX = (canvasBounds.x + canvasBounds.width) - (bbox.x + bbox.width);
                    }
                    if (bbox.y + clampedDeltaY < canvasBounds.y) {
                        clampedDeltaY = canvasBounds.y - bbox.y;
                    }
                    if (bbox.y + bbox.height + clampedDeltaY > canvasBounds.y + canvasBounds.height) {
                        clampedDeltaY = (canvasBounds.y + canvasBounds.height) - (bbox.y + bbox.height);
                    }

                    if (currentPoints.length >= 3) {
                        const translatedPoints = currentPoints.map(([x, y]) => `${x + clampedDeltaX},${y + clampedDeltaY}`);
                        this.selectedElement.element.setAttribute('points', translatedPoints.join(' '));
                    }
                }
            }

            this.dragStart.mouseX = e.clientX;
            this.dragStart.mouseY = e.clientY;
            
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
        
        if (this.isDragging || this.isResizing || this.isRotating) {
            this.saveHistory();
        }
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.resizeHandle = null;
        this.rotationCenterClient = null;

        if (this.handlesFrameRequest !== null) {
            cancelAnimationFrame(this.handlesFrameRequest);
            this.handlesFrameRequest = null;
        }

        if (this.selectedElement) {
            // After rotation or drag, ensure element stays within bounds
            if (wasRotating || wasDragging) {
                this.bringElementInBounds(this.selectedElement);
            }
            this.showResizeHandles(this.selectedElement);
        }
    }
    
    handleCanvasMouseDown(e) {
        if (e.target === this.canvas || e.target === this.printArea) {
            this.clearSelection();
        }
    }
    
    // ===== RESIZE =====
    startResize(e, position) {
        this.isResizing = true;
        this.resizeHandle = position;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }
    
    doResize(e) {
        if (!this.selectedElement) return;

        const svgDelta = this.clientDeltaToSvgDelta(
            e.clientX - this.dragStart.x,
            e.clientY - this.dragStart.y
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
        
        const bbox = this.selectedElement.element.getBBox();
        const canvasBounds = this.getCanvasBounds();
        
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
        
        // For non-rotated elements, constrain to canvas boundaries
        if (!rotation || rotation === 0) {
            newX = Math.max(canvasBounds.x, newX);
            newY = Math.max(canvasBounds.y, newY);
            newWidth = Math.min(newWidth, canvasBounds.x + canvasBounds.width - newX);
            newHeight = Math.min(newHeight, canvasBounds.y + canvasBounds.height - newY);
        }
        
        // Ensure minimum size
        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);
        
        if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
            // Store old values
            const oldWidth = this.selectedElement.element.getAttribute('width');
            const oldHeight = this.selectedElement.element.getAttribute('height');
            const oldX = this.selectedElement.element.getAttribute('x');
            const oldY = this.selectedElement.element.getAttribute('y');
            
            // Apply new values
            this.selectedElement.element.setAttribute('width', newWidth);
            this.selectedElement.element.setAttribute('height', newHeight);
            this.selectedElement.element.setAttribute('x', newX);
            this.selectedElement.element.setAttribute('y', newY);
            
            // For rotated elements, check against the editable print area bounds
            if (rotation !== 0) {
                const transformed = this.getTransformedBounds(this.selectedElement);
                const editableBounds = this.getEditableBounds();

                if (transformed.left < editableBounds.x ||
                    transformed.right > editableBounds.x + editableBounds.width ||
                    transformed.top < editableBounds.y ||
                    transformed.bottom > editableBounds.y + editableBounds.height) {
                    // Revert to old values
                    this.selectedElement.element.setAttribute('width', oldWidth);
                    this.selectedElement.element.setAttribute('height', oldHeight);
                    this.selectedElement.element.setAttribute('x', oldX);
                    this.selectedElement.element.setAttribute('y', oldY);
                    return; // Exit early
                }
            }
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
            const currentPoints = (this.selectedElement.element.getAttribute('points') || '')
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
            const scaleX = newWidth / this.selectedElement.width;
            const scaleY = newHeight / this.selectedElement.height;
            const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio
            
            const oldFontSize = this.selectedElement.size;
            const newFontSize = Math.max(12, Math.min(120, oldFontSize * scale));
            
            // Get current baseline position
            const currentY = parseFloat(this.selectedElement.element.getAttribute('y'));
            
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
        
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.showResizeHandles(this.selectedElement);
    }
    
    // ===== ROTATION =====
    startRotate(e, elementData) {
        e.preventDefault();
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
        const bounds = this.getEditableBounds();
        
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
            this.saveHistory();
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
            this.saveHistory();
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
            this.saveHistory();
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
            this.saveHistory();
        }
    }
    
    updateTextColor(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('fill', value);
            this.selectedElement.color = value;
            this.saveHistory();
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
            this.saveHistory();
        }
    }
    
    updateShapeFill(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextFill = this.sanitizeColorValue(value, '#3b82f6');
            this.selectedElement.element.setAttribute('fill', nextFill);
            this.selectedElement.fill = nextFill;
            this.saveHistory();
        }
    }
    
    updateShapeStroke(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextStroke = this.sanitizeColorValue(value, '#000000');
            this.selectedElement.element.setAttribute('stroke', nextStroke);
            this.selectedElement.stroke = nextStroke;
            this.saveHistory();
        }
    }
    
    updateShapeStrokeWidth(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            this.selectedElement.element.setAttribute('stroke-width', value);
            this.selectedElement.strokeWidth = value;
            this.saveHistory();
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
        clonedData.element = clone;
        this.makeElementInteractive(clonedData);
        this.elements.push(clonedData);
        this.selectElement(clonedData);
        this.updateLayers();
        this.saveHistory();
    }

    centerSelected(axis) {
        if (!this.selectedElement) return;

        const bounds = this.getCanvasBounds();
        const canvasCenterX = bounds.x + (bounds.width / 2);
        const canvasCenterY = bounds.y + (bounds.height / 2);

        const bbox = this.selectedElement.element.getBBox();
        const svgCenterX = bbox.x + bbox.width / 2;
        const svgCenterY = bbox.y + bbox.height / 2;

        // Get transformed visual center using CTM
        const ctm = this.selectedElement.element.getScreenCTM();
        const visualCenter = ctm ? new DOMPoint(svgCenterX, svgCenterY).matrixTransform(ctm) : null;

        if (this.selectedElement.type === 'text') {
            if (axis === 'horizontal' && visualCenter) {
                const screenDeltaX = canvasCenterX - visualCenter.x;
                const svgDeltaX = (screenDeltaX / this.baseCanvasSize.width) * 800;
                const currentX = parseFloat(this.selectedElement.element.getAttribute('x') || 0);
                this.selectedElement.element.setAttribute('x', currentX + svgDeltaX);
            }
            if (axis === 'vertical' && visualCenter) {
                const screenDeltaY = canvasCenterY - visualCenter.y;
                const svgDeltaY = (screenDeltaY / this.baseCanvasSize.height) * 600;
                const currentY = parseFloat(this.selectedElement.element.getAttribute('y') || 0);
                this.selectedElement.element.setAttribute('y', currentY + svgDeltaY);
            }
        } else if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
            if (axis === 'horizontal' && visualCenter) {
                const screenDeltaX = canvasCenterX - visualCenter.x;
                const svgDeltaX = (screenDeltaX / this.baseCanvasSize.width) * 800;
                const currentX = parseFloat(this.selectedElement.element.getAttribute('x') || 0);
                this.selectedElement.element.setAttribute('x', currentX + svgDeltaX);
            }
            if (axis === 'vertical' && visualCenter) {
                const screenDeltaY = canvasCenterY - visualCenter.y;
                const svgDeltaY = (screenDeltaY / this.baseCanvasSize.height) * 600;
                const currentY = parseFloat(this.selectedElement.element.getAttribute('y') || 0);
                this.selectedElement.element.setAttribute('y', currentY + svgDeltaY);
            }
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
            if (axis === 'horizontal' && visualCenter) {
                const screenDeltaX = canvasCenterX - visualCenter.x;
                const svgDeltaX = (screenDeltaX / this.baseCanvasSize.width) * 800;
                const currentCx = parseFloat(this.selectedElement.element.getAttribute('cx') || 0);
                this.selectedElement.element.setAttribute('cx', currentCx + svgDeltaX);
            }
            if (axis === 'vertical' && visualCenter) {
                const screenDeltaY = canvasCenterY - visualCenter.y;
                const svgDeltaY = (screenDeltaY / this.baseCanvasSize.height) * 600;
                const currentCy = parseFloat(this.selectedElement.element.getAttribute('cy') || 0);
                this.selectedElement.element.setAttribute('cy', currentCy + svgDeltaY);
            }
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'triangle') {
            const points = (this.selectedElement.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));
            if (points.length >= 3 && visualCenter) {
                let deltaX = 0;
                let deltaY = 0;
                
                if (axis === 'horizontal') {
                    const screenDeltaX = canvasCenterX - visualCenter.x;
                    deltaX = (screenDeltaX / this.baseCanvasSize.width) * 800;
                }
                if (axis === 'vertical') {
                    const screenDeltaY = canvasCenterY - visualCenter.y;
                    deltaY = (screenDeltaY / this.baseCanvasSize.height) * 600;
                }
                
                const moved = points.map(([x, y]) => `${x + deltaX},${y + deltaY}`).join(' ');
                this.selectedElement.element.setAttribute('points', moved);
            }
        }

        this.showResizeHandles(this.selectedElement);
        this.updateLayers();
        this.saveHistory();
    }

    nudgeSelected(dx, dy) {
        if (!this.selectedElement) return;

        if (this.selectedElement.type === 'text') {
            const x = parseFloat(this.selectedElement.element.getAttribute('x') || '0') + dx;
            const y = parseFloat(this.selectedElement.element.getAttribute('y') || '0') + dy;
            this.selectedElement.element.setAttribute('x', x);
            this.selectedElement.element.setAttribute('y', y);
        } else if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
            const x = parseFloat(this.selectedElement.element.getAttribute('x') || '0') + dx;
            const y = parseFloat(this.selectedElement.element.getAttribute('y') || '0') + dy;
            this.selectedElement.element.setAttribute('x', x);
            this.selectedElement.element.setAttribute('y', y);
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
            const cx = parseFloat(this.selectedElement.element.getAttribute('cx') || '0') + dx;
            const cy = parseFloat(this.selectedElement.element.getAttribute('cy') || '0') + dy;
            this.selectedElement.element.setAttribute('cx', cx);
            this.selectedElement.element.setAttribute('cy', cy);
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'triangle') {
            const points = (this.selectedElement.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));
            if (points.length >= 3) {
                const moved = points.map(([x, y]) => `${x + dx},${y + dy}`).join(' ');
                this.selectedElement.element.setAttribute('points', moved);
            }
        }

        this.showResizeHandles(this.selectedElement);
        this.saveHistory();
    }

    handleKeyDown(e) {
        const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const isTypingContext = ['input', 'textarea', 'select'].includes(targetTag);

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
        
        if (this.elements.length === 0) {
            layersList.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Nenhuma camada ainda</p>';
            return;
        }
        
        layersList.innerHTML = this.elements.map((el, index) => `
            <div class="p-3 border rounded-lg mb-2 hover:bg-gray-50 cursor-pointer ${this.selectedElement?.id === el.id ? 'bg-blue-50 border-blue-600' : ''}" 
                 onclick="editor.selectElementByIndex(${index})">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${el.type === 'text' ? 'type' : el.type === 'image' ? 'image' : 'square'}" class="w-4 h-4"></i>
                        <span class="text-sm font-semibold">${el.type === 'text' ? el.content.substring(0, 20) : el.type.charAt(0).toUpperCase() + el.type.slice(1)}</span>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="event.stopPropagation(); editor.moveLayer(${index}, -1)" class="p-1 hover:bg-gray-200 rounded" ${index === 0 ? 'disabled' : ''}>
                            <i data-lucide="arrow-up" class="w-3 h-3"></i>
                        </button>
                        <button onclick="event.stopPropagation(); editor.moveLayer(${index}, 1)" class="p-1 hover:bg-gray-200 rounded" ${index === this.elements.length - 1 ? 'disabled' : ''}>
                            <i data-lucide="arrow-down" class="w-3 h-3"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        lucide.createIcons();
    }
    
    selectElementByIndex(index) {
        this.selectElement(this.elements[index]);
    }
    
    moveLayer(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.elements.length) return;
        
        [this.elements[index], this.elements[newIndex]] = [this.elements[newIndex], this.elements[index]];
        
        const el1 = this.elements[index].element;
        const el2 = this.elements[newIndex].element;
        
        if (direction > 0) {
            this.canvas.insertBefore(el2, el1.nextSibling);
        } else {
            this.canvas.insertBefore(el1, el2);
        }
        
        this.updateLayers();
        this.saveHistory();
    }
    
    // ===== ZOOM =====
    syncCanvasViewport() {
        if (!this.canvasStage || !this.canvasWrapper) return;

        // Compute base canvas size only once (at zoom 100%)
        if (!this.initialCanvasSize) {
            const stageWidth = this.canvasStage.clientWidth;
            const stageHeight = this.canvasStage.clientHeight;
            if (!stageWidth || !stageHeight) return;

            const targetWidth = stageWidth * 0.9;
            const targetHeight = stageHeight * 0.9;
            const ratio = 800 / 600;

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

            this.baseCanvasSize = { ...this.initialCanvasSize };
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
    
    // ===== HISTORY =====
    saveHistory() {
        const state = {
            elements: this.elements.map(el => ({
                ...el,
                element: el.element.outerHTML
            }))
        };
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.stringify(state));
        this.historyIndex++;
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    restoreState(stateStr) {
        try {
            const state = JSON.parse(stateStr);

            this.elements.forEach((el) => el.element.remove());
            this.elements = [];
            this.selectedElement = null;

            (state.elements || []).forEach((saved) => {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = saved.element;
                const restored = wrapper.firstElementChild;
                if (!restored) return;

                this.canvas.appendChild(restored);

                const rebuilt = this.buildElementDataFromNode(restored, saved.id);
                const elementData = {
                    ...rebuilt,
                    ...saved,
                    element: restored
                };

                this.elements.push(elementData);
                this.makeElementInteractive(elementData);
            });

            this.hideResizeHandles();
            this.updateLayers();
            this.clearPropertiesSections();
            this.updateSidebarMode();
        } catch (error) {
            console.error('Erro ao restaurar histórico:', error);
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
    }
    
    getDesignSVG() {
        const svgClone = this.canvas.cloneNode(true);
        return new XMLSerializer().serializeToString(svgClone);
    }
    
    // ===== ADD TO CART =====
    addToCart() {
        if (this.elements.length === 0) {
            showToast('Adicione pelo menos um elemento ao design', 'warning');
            return;
        }
        
        const cart = this.getCartData();
        const design = this.getDesignSVG();
        
        const cartItem = {
            id: this.currentProduct.id,
            nome: this.currentProduct.nome,
            preco: this.currentProduct.preco,
            imagem: this.currentProduct.imagem,
            quantity: 1,
            customized: true,
            design: design
        };
        
        if (this.editIndex !== null) {
            cart[this.editIndex] = cartItem;
            showToast('Design atualizado no carrinho!', 'success');
        } else {
            cart.push(cartItem);
            showToast('Produto adicionado ao carrinho!', 'success');
        }
        
        this.saveCartData(cart);
        localStorage.removeItem(this.getAutosaveKey());
        
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
