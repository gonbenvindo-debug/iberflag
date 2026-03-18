// ===== MODERN PRODUCT CUSTOMIZER - CANVA STYLE =====

class DesignEditor {
    constructor() {
        this.canvas = document.getElementById('design-canvas');
        this.printArea = document.getElementById('print-area');
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
        
        this.init();
    }
    
    init() {
        this.loadProduct();
        this.setupEventListeners();
        this.setupAutoSave();
    }
    
    // ===== PRODUCT LOADING =====
    loadProduct() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('produto');
        this.editIndex = urlParams.get('edit');
        
        if (!productId) {
            window.location.href = '/produtos.html';
            return;
        }
        
        this.currentProduct = initialProducts.find(p => p.id == productId);
        
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
        }
        
        // Load existing design if editing
        if (this.editIndex !== null) {
            this.loadExistingDesign(parseInt(this.editIndex));
        }
    }
    
    loadSVGTemplate(svgContent) {
        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const templateElements = svgDoc.documentElement.children;
            
            // Clear current canvas except print area
            while (this.canvas.firstChild && this.canvas.firstChild !== this.printArea) {
                this.canvas.removeChild(this.canvas.firstChild);
            }
            
            // Insert template before print area
            Array.from(templateElements).forEach(el => {
                const imported = document.importNode(el, true);
                this.canvas.insertBefore(imported, this.printArea);
            });
        } catch (error) {
            console.error('Error loading SVG template:', error);
        }
    }
    
    loadExistingDesign(index) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (cart[index] && cart[index].design) {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(cart[index].design, 'image/svg+xml');
                const designElements = svgDoc.documentElement.querySelectorAll('[data-editable="true"]');
                
                designElements.forEach(el => {
                    const imported = document.importNode(el, true);
                    this.canvas.appendChild(imported);
                    
                    const elementData = {
                        id: Date.now() + Math.random(),
                        element: imported,
                        type: imported.tagName.toLowerCase()
                    };
                    
                    this.elements.push(elementData);
                    this.makeElementInteractive(elementData);
                });
                
                this.updateLayers();
            } catch (error) {
                console.error('Error loading existing design:', error);
            }
        }
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Tool tabs
        document.querySelectorAll('.tool-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
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
        
        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        
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
    
    // ===== TAB SWITCHING =====
    switchTab(tabName) {
        document.querySelectorAll('.tool-tab-btn').forEach(btn => {
            btn.classList.remove('border-blue-600', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-600');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        activeBtn.classList.add('border-blue-600', 'text-blue-600');
        activeBtn.classList.remove('border-transparent', 'text-gray-600');
        
        document.getElementById('elements-tab').classList.toggle('hidden', tabName !== 'elements');
        document.getElementById('properties-tab').classList.toggle('hidden', tabName !== 'properties');
    }
    
    // ===== ADD ELEMENTS =====
    addText() {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '200');
        text.setAttribute('y', '224'); // y is baseline, so y = top + fontSize
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
            const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            img.setAttribute('x', '200');
            img.setAttribute('y', '200');
            img.setAttribute('width', '200');
            img.setAttribute('height', '200');
            img.setAttribute('href', event.target.result);
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
        reader.readAsDataURL(file);
        e.target.value = '';
    }
    
    addShape(shapeType) {
        let shape;
        
        if (shapeType === 'rectangle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', '200');
            shape.setAttribute('y', '200');
            shape.setAttribute('width', '150');
            shape.setAttribute('height', '100');
        } else if (shapeType === 'circle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', '275');
            shape.setAttribute('cy', '250');
            shape.setAttribute('r', '75');
        } else if (shapeType === 'triangle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', '275,175 350,300 200,300');
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
        
        // Add double-click to edit text
        if (elementData.type === 'text') {
            elementData.element.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startTextEdit(elementData);
            });
        }
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
        
        // Switch to properties tab
        this.switchTab('properties');
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
            // Calculate handle positions in screen space
            const rotRad = rotation * Math.PI / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);
            
            // Center of element in screen space
            const centerScreenX = left + width / 2;
            const centerScreenY = top + height / 2;
            
            // Helper to rotate a point around screen center
            const rotateScreenPoint = (localX, localY) => {
                // Convert local bbox coords to offset from center
                const dx = localX - centerX;
                const dy = localY - centerY;
                // Rotate around origin
                const rotX = dx * cos - dy * sin;
                const rotY = dx * sin + dy * cos;
                // Translate to screen position
                return {
                    x: centerScreenX + rotX,
                    y: centerScreenY + rotY
                };
            };
            
            const handlePositions = {
                'nw': { x: bbox.x, y: bbox.y },
                'ne': { x: bbox.x + bbox.width, y: bbox.y },
                'sw': { x: bbox.x, y: bbox.y + bbox.height },
                'se': { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
                'n': { x: bbox.x + bbox.width/2, y: bbox.y },
                's': { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height },
                'e': { x: bbox.x + bbox.width, y: bbox.y + bbox.height/2 },
                'w': { x: bbox.x, y: bbox.y + bbox.height/2 }
            };
            
            Object.entries(handlePositions).forEach(([pos, point]) => {
                const screenPos = rotateScreenPoint(point.x, point.y);
                
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                handle.dataset.position = pos;
                handle.style.cursor = `${pos}-resize`;
                handle.style.left = (screenPos.x - 5) + 'px';
                handle.style.top = (screenPos.y - 5) + 'px';
                
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
        const canvasRect = this.canvas.getBoundingClientRect();
        
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
        }
    }
    
    handleMouseMove(e) {
        if (this.isDragging && this.selectedElement) {
            const canvasRect = this.canvas.getBoundingClientRect();
            
            // Calculate mouse delta in screen space
            const deltaX = e.clientX - this.dragStart.mouseX;
            const deltaY = e.clientY - this.dragStart.mouseY;
            
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
                
                // Get canvas-wrapper boundaries (entire visible area)
                const wrapperRect = document.querySelector('.canvas-wrapper').getBoundingClientRect();
                const canvasRect = this.canvas.getBoundingClientRect();
                const canvasBounds = { 
                    x: -(wrapperRect.width - canvasRect.width) / 2, 
                    y: -(wrapperRect.height - canvasRect.height) / 2, 
                    width: wrapperRect.width, 
                    height: wrapperRect.height 
                };
                
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
            this.selectedElement = null;
            this.hideResizeHandles();
            this.elements.forEach(el => el.element.classList.remove('element-selected'));
            
            document.getElementById('no-selection').classList.remove('hidden');
            document.getElementById('text-properties').classList.add('hidden');
            document.getElementById('image-properties').classList.add('hidden');
            document.getElementById('shape-properties').classList.add('hidden');
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
        
        let dx = e.clientX - this.dragStart.x;
        let dy = e.clientY - this.dragStart.y;
        
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
        const wrapperRect = document.querySelector('.canvas-wrapper').getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasBounds = { 
            x: -(wrapperRect.width - canvasRect.width) / 2, 
            y: -(wrapperRect.height - canvasRect.height) / 2, 
            width: wrapperRect.width, 
            height: wrapperRect.height 
        };
        
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
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
        this.rotationStart = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
        this.rotationStart -= (elementData.rotation || 0);
    }
    
    doRotate(e) {
        if (!this.selectedElement) return;
        
        const bbox = this.selectedElement.element.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
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
    
    // ===== TEXT EDITING =====
    startTextEdit(elementData) {
        if (elementData.type !== 'text') return;
        
        // Hide resize handles during editing
        this.hideResizeHandles();
        
        // Create a temporary input overlay
        const textElement = elementData.element;
        const bbox = textElement.getBBox();
        
        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.value = elementData.content;
        input.style.position = 'absolute';
        input.style.left = (bbox.x) + 'px';
        input.style.top = (bbox.y - elementData.size * 0.8) + 'px';
        input.style.width = Math.max(100, bbox.width + 20) + 'px';
        input.style.fontSize = elementData.size + 'px';
        input.style.fontFamily = elementData.font;
        input.style.color = elementData.color;
        input.style.background = 'rgba(255, 255, 255, 0.9)';
        input.style.border = '2px solid #3b82f6';
        input.style.padding = '2px 4px';
        input.style.zIndex = '1000';
        input.className = 'text-edit-input';
        
        // Add to canvas wrapper
        const wrapper = document.querySelector('.canvas-wrapper');
        wrapper.appendChild(input);
        
        // Focus and select
        input.focus();
        input.select();
        
        // Handle finish editing
        const finishEdit = () => {
            const newValue = input.value.trim();
            if (newValue && newValue !== elementData.content) {
                this.updateTextContent(newValue);
                document.getElementById('prop-text-content').value = newValue;
            }
            input.remove();
            this.showResizeHandles(elementData);
        };
        
        // Event listeners
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                input.remove();
                this.showResizeHandles(elementData);
            }
        });
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
            this.selectedElement = null;
            this.hideResizeHandles();
            this.updateLayers();
            this.saveHistory();
            
            document.getElementById('no-selection').classList.remove('hidden');
            document.getElementById('text-properties').classList.add('hidden');
            document.getElementById('image-properties').classList.add('hidden');
            document.getElementById('shape-properties').classList.add('hidden');
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
    setZoom(newZoom) {
        this.zoom = Math.max(0.5, Math.min(2, newZoom));
        this.canvasWrapper.style.transform = `scale(${this.zoom})`;
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
        // Implementation for restoring state
        console.log('Restore state:', stateStr);
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
        localStorage.setItem('autosave_design', design);
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
        
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
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
        
        localStorage.setItem('cart', JSON.stringify(cart));
        
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
