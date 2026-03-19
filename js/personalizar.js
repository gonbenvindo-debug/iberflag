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
        this.currentProduct = null;
        this.editIndex = null;
        this.productId = null;
        this.cartStorageKey = 'latinflag_cart';
        this.printAreaBounds = { x: 50, y: 50, width: 700, height: 500 };
        this.keepAspectRatio = true;
        this.baseCanvasSize = { width: 800, height: 600 };
        
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
        return { x: 0, y: 0, width: 800, height: 600 };
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

    setDefaultPrintArea() {
        this.printAreaBounds = { x: 50, y: 50, width: 700, height: 500 };
        this.printArea.setAttribute('x', String(this.printAreaBounds.x));
        this.printArea.setAttribute('y', String(this.printAreaBounds.y));
        this.printArea.setAttribute('width', String(this.printAreaBounds.width));
        this.printArea.setAttribute('height', String(this.printAreaBounds.height));
    }

    updatePrintAreaFromElement(areaElement, sourceBounds) {
        const scaleX = 800 / sourceBounds.width;
        const scaleY = 600 / sourceBounds.height;
        const offsetX = -sourceBounds.x * scaleX;
        const offsetY = -sourceBounds.y * scaleY;

        const areaClone = document.importNode(areaElement, true);
        areaClone.setAttribute('id', 'print-area-outline');
        areaClone.setAttribute('fill', 'none');
        areaClone.setAttribute('stroke', '#3b82f6');
        areaClone.setAttribute('stroke-width', '2');
        areaClone.setAttribute('stroke-dasharray', '8,4');
        areaClone.setAttribute('opacity', '0.5');
        areaClone.setAttribute('transform', `translate(${offsetX} ${offsetY}) scale(${scaleX} ${scaleY})`);

        this.printArea.replaceWith(areaClone);
        this.printArea = areaClone;

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('viewBox', '0 0 800 600');
        tempSvg.setAttribute('width', '800');
        tempSvg.setAttribute('height', '600');
        tempSvg.style.position = 'absolute';
        tempSvg.style.left = '-9999px';
        tempSvg.style.top = '-9999px';
        tempSvg.style.visibility = 'hidden';
        const measureElement = document.importNode(areaClone, true);
        tempSvg.appendChild(measureElement);
        document.body.appendChild(tempSvg);
        const bbox = measureElement.getBBox();
        document.body.removeChild(tempSvg);

        this.printAreaBounds = {
            x: Math.max(0, bbox.x),
            y: Math.max(0, bbox.y),
            width: Math.min(800, bbox.width),
            height: Math.min(600, bbox.height)
        };
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
        
        // Show resize handles
        this.showResizeHandles(elementData);
        
        // Update properties panel
        this.updatePropertiesPanel(elementData);
        this.updateSidebarMode();

        // Bring attention to properties automatically.
        this.focusPropertiesPanel();
    }
    
    showResizeHandles(elementData) {
        const handlesContainer = document.getElementById('resize-handles');
        handlesContainer.innerHTML = '';
        handlesContainer.classList.remove('hidden');
        
        // Get element's actual screen position (includes all transforms)
        const canvasRect = this.canvas.getBoundingClientRect();
        const elementRect = elementData.element.getBoundingClientRect();
        
        // Calculate position relative to canvas
        const left = elementRect.left - canvasRect.left;
        const top = elementRect.top - canvasRect.top;
        const width = elementRect.width;
        const height = elementRect.height;
        const rotation = elementData.rotation || 0;
        
        // Get unrotated bbox for calculating handle positions in local space
        const bbox = elementData.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        
        // Only show resize handles for non-text elements
        if (elementData.type !== 'text') {
            // Use screen coordinates directly from getBoundingClientRect
            const handlePositions = {
                'nw': { x: left, y: top },
                'ne': { x: left + width, y: top },
                'sw': { x: left, y: top + height },
                'se': { x: left + width, y: top + height },
                'n': { x: left + width/2, y: top },
                's': { x: left + width/2, y: top + height },
                'e': { x: left + width, y: top + height/2 },
                'w': { x: left, y: top + height/2 }
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
        
        // Add rotation handle
        const rotRad = rotation * Math.PI / 180;
        const centerScreenX = left + width / 2;
        const centerScreenY = top + height / 2;
        
        // Position 35px above center in local space
        const localRotateX = centerX;
        const localRotateY = bbox.y - 35;
        const dx = localRotateX - centerX;
        const dy = localRotateY - centerY;
        const rotX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
        const rotY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
        
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.style.cursor = 'grab';
        rotateHandle.style.left = (centerScreenX + rotX - 16) + 'px';
        rotateHandle.style.top = (centerScreenY + rotY - 16) + 'px';
        rotateHandle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>';
        
        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startRotate(e, elementData);
        });
        
        handlesContainer.appendChild(rotateHandle);
    }
    
    hideResizeHandles() {
        document.getElementById('resize-handles').classList.add('hidden');
    }
    
    updatePropertiesPanel(elementData) {
        // Hide all property panels
        document.getElementById('no-selection').classList.add('hidden');
        document.getElementById('text-properties').classList.add('hidden');
        document.getElementById('image-properties').classList.add('hidden');
        document.getElementById('shape-properties').classList.add('hidden');
        
        if (elementData.type === 'text') {
            document.getElementById('text-properties').classList.remove('hidden');
            document.getElementById('prop-text-content').value = elementData.content;
            document.getElementById('prop-text-font').value = elementData.font;
            document.getElementById('prop-text-size').value = elementData.size;
            document.getElementById('prop-text-size-val').textContent = elementData.size;
            document.getElementById('prop-text-color').value = elementData.color;
            document.getElementById('prop-text-rotation').value = elementData.rotation || 0;
            document.getElementById('prop-text-rotation-val').textContent = elementData.rotation || 0;
        } else if (elementData.type === 'image') {
            document.getElementById('image-properties').classList.remove('hidden');
            document.getElementById('prop-image-opacity').value = (elementData.opacity || 1) * 100;
            document.getElementById('prop-image-opacity-val').textContent = Math.round((elementData.opacity || 1) * 100);
            document.getElementById('prop-image-rotation').value = elementData.rotation || 0;
            document.getElementById('prop-image-rotation-val').textContent = elementData.rotation || 0;
        } else if (elementData.type === 'shape') {
            document.getElementById('shape-properties').classList.remove('hidden');
            document.getElementById('prop-shape-fill').value = elementData.fill;
            document.getElementById('prop-shape-stroke').value = elementData.stroke;
            document.getElementById('prop-shape-stroke-width').value = elementData.strokeWidth;
            document.getElementById('prop-shape-stroke-val').textContent = elementData.strokeWidth;
            document.getElementById('prop-shape-rotation').value = elementData.rotation || 0;
            document.getElementById('prop-shape-rotation-val').textContent = elementData.rotation || 0;
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
            // Calculate mouse delta in screen space
            const deltaX = (e.clientX - this.dragStart.mouseX) / this.zoom;
            const deltaY = (e.clientY - this.dragStart.mouseY) / this.zoom;
            
            // For rotated elements, use translate transform
            if (this.selectedElement.rotation && this.selectedElement.rotation !== 0) {
                // Calculate new translate values
                let translateX = (this.selectedElement.translateX || 0) + deltaX;
                let translateY = (this.selectedElement.translateY || 0) + deltaY;
                
                // Apply translate temporarily to check boundaries
                const bbox = this.selectedElement.element.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;
                this.selectedElement.element.setAttribute('transform', 
                    `translate(${translateX} ${translateY}) rotate(${this.selectedElement.rotation} ${centerX} ${centerY})`);
                
                // Check if element exceeds canvas boundaries
                const elementRect = this.selectedElement.element.getBoundingClientRect();
                const canvasRect = this.canvas.getBoundingClientRect();
                
                // If exceeds boundaries, revert to previous translate
                if (elementRect.left < canvasRect.left ||
                    elementRect.right > canvasRect.right ||
                    elementRect.top < canvasRect.top ||
                    elementRect.bottom > canvasRect.bottom) {
                    // Revert to previous position
                    translateX = this.selectedElement.translateX || 0;
                    translateY = this.selectedElement.translateY || 0;
                    this.selectedElement.element.setAttribute('transform', 
                        `translate(${translateX} ${translateY}) rotate(${this.selectedElement.rotation} ${centerX} ${centerY})`);
                } else {
                    // Accept new position
                    this.selectedElement.translateX = translateX;
                    this.selectedElement.translateY = translateY;
                    this.dragStart.mouseX = e.clientX;
                    this.dragStart.mouseY = e.clientY;
                }
            } else {
                // For non-rotated elements, use x/y attributes as before
                let newX = this.dragStart.elementX + deltaX;
                let newY = this.dragStart.elementY + deltaY;
                
                const canvasBounds = this.getCanvasBounds();
                
                if (this.selectedElement.type === 'text') {
                    newX = Math.max(canvasBounds.x, Math.min(newX, canvasBounds.x + canvasBounds.width - 50));
                    newY = Math.max(canvasBounds.y + 20, Math.min(newY, canvasBounds.y + canvasBounds.height));
                    this.selectedElement.element.setAttribute('x', newX);
                    this.selectedElement.element.setAttribute('y', newY);
                } else if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
                    const width = parseFloat(this.selectedElement.element.getAttribute('width'));
                    const height = parseFloat(this.selectedElement.element.getAttribute('height'));
                    newX = Math.max(canvasBounds.x, Math.min(newX, canvasBounds.x + canvasBounds.width - width));
                    newY = Math.max(canvasBounds.y, Math.min(newY, canvasBounds.y + canvasBounds.height - height));
                    this.selectedElement.element.setAttribute('x', newX);
                    this.selectedElement.element.setAttribute('y', newY);
                } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
                    const r = parseFloat(this.selectedElement.element.getAttribute('r'));
                    newX = Math.max(canvasBounds.x + r, Math.min(newX, canvasBounds.x + canvasBounds.width - r));
                    newY = Math.max(canvasBounds.y + r, Math.min(newY, canvasBounds.y + canvasBounds.height - r));
                    this.selectedElement.element.setAttribute('cx', newX);
                    this.selectedElement.element.setAttribute('cy', newY);
                } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'triangle' && this.dragStart.points) {
                    const bbox = this.dragStart.bbox;
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

                    const translatedPoints = this.dragStart.points.map(([x, y]) => `${x + clampedDeltaX},${y + clampedDeltaY}`);
                    this.selectedElement.element.setAttribute('points', translatedPoints.join(' '));
                }
            }
            
            this.showResizeHandles(this.selectedElement);
        } else if (this.isResizing && this.selectedElement) {
            this.doResize(e);
        } else if (this.isRotating && this.selectedElement) {
            this.doRotate(e);
        }
    }
    
    handleMouseUp() {
        if (this.isDragging || this.isResizing || this.isRotating) {
            this.saveHistory();
        }
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.resizeHandle = null;
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
        
        let dx = (e.clientX - this.dragStart.x) / this.zoom;
        let dy = (e.clientY - this.dragStart.y) / this.zoom;
        
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
            
            // For rotated elements, check boundaries
            if (rotation !== 0) {
                const elementRect = this.selectedElement.element.getBoundingClientRect();
                const canvasRect = this.canvas.getBoundingClientRect();
                
                if (elementRect.left < canvasRect.left ||
                    elementRect.right > canvasRect.right ||
                    elementRect.top < canvasRect.top ||
                    elementRect.bottom > canvasRect.bottom) {
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
        this.isRotating = true;
        const bbox = elementData.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const mouse = this.clientToSvgPoint(e.clientX, e.clientY);
        const mouseX = mouse.x;
        const mouseY = mouse.y;
        
        this.rotationStart = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
        this.rotationStart -= (elementData.rotation || 0);
    }
    
    doRotate(e) {
        if (!this.selectedElement) return;
        
        const bbox = this.selectedElement.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const mouse = this.clientToSvgPoint(e.clientX, e.clientY);
        const mouseX = mouse.x;
        const mouseY = mouse.y;
        
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
        let rotation = angle - this.rotationStart;
        
        // Snap to 15 degree increments if shift is held
        if (e.shiftKey) {
            rotation = Math.round(rotation / 15) * 15;
        }
        
        this.selectedElement.rotation = rotation;
        
        // Use translate to keep rotation center at element center
        const translateX = this.selectedElement.translateX || 0;
        const translateY = this.selectedElement.translateY || 0;
        this.selectedElement.element.setAttribute('transform', 
            `translate(${translateX} ${translateY}) rotate(${rotation} ${centerX} ${centerY})`);
        this.showResizeHandles(this.selectedElement);
    }
    
    updateRotation(value) {
        if (this.selectedElement) {
            const bbox = this.selectedElement.element.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            this.selectedElement.rotation = parseFloat(value);
            
            const translateX = this.selectedElement.translateX || 0;
            const translateY = this.selectedElement.translateY || 0;
            this.selectedElement.element.setAttribute('transform', 
                `translate(${translateX} ${translateY}) rotate(${value} ${centerX} ${centerY})`);
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
            this.selectedElement.element.setAttribute('fill', value);
            this.selectedElement.fill = value;
            this.saveHistory();
        }
    }
    
    updateShapeStroke(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            this.selectedElement.element.setAttribute('stroke', value);
            this.selectedElement.stroke = value;
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
        const bbox = this.selectedElement.element.getBBox();
        const centerX = bounds.x + (bounds.width / 2);
        const centerY = bounds.y + (bounds.height / 2);

        if (this.selectedElement.type === 'text') {
            if (axis === 'horizontal') {
                this.selectedElement.element.setAttribute('x', centerX - (bbox.width / 2));
            }
            if (axis === 'vertical') {
                this.selectedElement.element.setAttribute('y', centerY + (bbox.height / 2));
            }
        } else if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
            if (axis === 'horizontal') {
                this.selectedElement.element.setAttribute('x', centerX - (bbox.width / 2));
            }
            if (axis === 'vertical') {
                this.selectedElement.element.setAttribute('y', centerY - (bbox.height / 2));
            }
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
            if (axis === 'horizontal') {
                this.selectedElement.element.setAttribute('cx', centerX);
            }
            if (axis === 'vertical') {
                this.selectedElement.element.setAttribute('cy', centerY);
            }
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'triangle') {
            const points = (this.selectedElement.element.getAttribute('points') || '')
                .trim()
                .split(/\s+/)
                .map((pair) => pair.split(',').map(Number));
            if (points.length >= 3) {
                const deltaX = axis === 'horizontal' ? centerX - (bbox.x + bbox.width / 2) : 0;
                const deltaY = axis === 'vertical' ? centerY - (bbox.y + bbox.height / 2) : 0;
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

        this.baseCanvasSize = {
            width: baseWidth,
            height: baseHeight
        };

        const scaledWidth = this.baseCanvasSize.width * this.zoom;
        const scaledHeight = this.baseCanvasSize.height * this.zoom;

        this.canvasWrapper.style.width = `${scaledWidth}px`;
        this.canvasWrapper.style.height = `${scaledHeight}px`;
        this.canvasWrapper.style.transform = 'none';

        this.canvasStage.style.overflow = this.zoom <= 1 ? 'hidden' : 'auto';
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
