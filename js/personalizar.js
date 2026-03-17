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
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandle = null;
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
        
        // Image properties
        const imageOpacity = document.getElementById('prop-image-opacity');
        if (imageOpacity) imageOpacity.addEventListener('input', (e) => {
            this.updateImageOpacity(e.target.value / 100);
            document.getElementById('prop-image-opacity-val').textContent = e.target.value;
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
        text.setAttribute('y', '200');
        text.setAttribute('font-family', 'Arial');
        text.setAttribute('font-size', '24');
        text.setAttribute('fill', '#000000');
        text.setAttribute('data-editable', 'true');
        text.textContent = 'Clique para editar';
        text.style.cursor = 'move';
        
        this.canvas.appendChild(text);
        
        const elementData = {
            id: Date.now(),
            element: text,
            type: 'text',
            content: 'Clique para editar',
            font: 'Arial',
            size: 24,
            color: '#000000',
            bold: false,
            italic: false
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
                opacity: 1
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
        elementData.element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.selectElement(elementData);
            this.startDrag(e, elementData);
        });
    }
    
    selectElement(elementData) {
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
        
        const bbox = elementData.element.getBBox();
        const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
        
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.dataset.position = pos;
            handle.style.cursor = `${pos}-resize`;
            
            // Position handle
            let left, top;
            switch(pos) {
                case 'nw': left = bbox.x - 5; top = bbox.y - 5; break;
                case 'ne': left = bbox.x + bbox.width - 5; top = bbox.y - 5; break;
                case 'sw': left = bbox.x - 5; top = bbox.y + bbox.height - 5; break;
                case 'se': left = bbox.x + bbox.width - 5; top = bbox.y + bbox.height - 5; break;
                case 'n': left = bbox.x + bbox.width/2 - 5; top = bbox.y - 5; break;
                case 's': left = bbox.x + bbox.width/2 - 5; top = bbox.y + bbox.height - 5; break;
                case 'e': left = bbox.x + bbox.width - 5; top = bbox.y + bbox.height/2 - 5; break;
                case 'w': left = bbox.x - 5; top = bbox.y + bbox.height/2 - 5; break;
            }
            
            handle.style.left = left + 'px';
            handle.style.top = top + 'px';
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, pos);
            });
            
            handlesContainer.appendChild(handle);
        });
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
        } else if (elementData.type === 'image') {
            document.getElementById('image-properties').classList.remove('hidden');
            document.getElementById('prop-image-opacity').value = (elementData.opacity || 1) * 100;
            document.getElementById('prop-image-opacity-val').textContent = Math.round((elementData.opacity || 1) * 100);
        } else if (elementData.type === 'shape') {
            document.getElementById('shape-properties').classList.remove('hidden');
            document.getElementById('prop-shape-fill').value = elementData.fill;
            document.getElementById('prop-shape-stroke').value = elementData.stroke;
            document.getElementById('prop-shape-stroke-width').value = elementData.strokeWidth;
            document.getElementById('prop-shape-stroke-val').textContent = elementData.strokeWidth;
        }
    }
    
    // ===== DRAG & DROP =====
    startDrag(e, elementData) {
        this.isDragging = true;
        const bbox = elementData.element.getBBox();
        this.dragStart = {
            x: e.clientX - bbox.x,
            y: e.clientY - bbox.y
        };
    }
    
    handleMouseMove(e) {
        if (this.isDragging && this.selectedElement) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left - this.dragStart.x;
            const y = e.clientY - canvasRect.top - this.dragStart.y;
            
            if (this.selectedElement.type === 'text') {
                this.selectedElement.element.setAttribute('x', x);
                this.selectedElement.element.setAttribute('y', y);
            } else if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
                this.selectedElement.element.setAttribute('x', x);
                this.selectedElement.element.setAttribute('y', y);
            } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
                const r = parseFloat(this.selectedElement.element.getAttribute('r'));
                this.selectedElement.element.setAttribute('cx', x + r);
                this.selectedElement.element.setAttribute('cy', y + r);
            }
            
            this.showResizeHandles(this.selectedElement);
        } else if (this.isResizing && this.selectedElement) {
            this.doResize(e);
        }
    }
    
    handleMouseUp() {
        if (this.isDragging || this.isResizing) {
            this.saveHistory();
        }
        this.isDragging = false;
        this.isResizing = false;
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
        
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        const bbox = this.selectedElement.element.getBBox();
        
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
        
        if (this.selectedElement.type === 'image' || (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'rectangle')) {
            this.selectedElement.element.setAttribute('width', newWidth);
            this.selectedElement.element.setAttribute('height', newHeight);
            this.selectedElement.element.setAttribute('x', newX);
            this.selectedElement.element.setAttribute('y', newY);
        } else if (this.selectedElement.type === 'shape' && this.selectedElement.shapeType === 'circle') {
            const radius = Math.max(newWidth, newHeight) / 2;
            this.selectedElement.element.setAttribute('r', radius);
            this.selectedElement.element.setAttribute('cx', newX + radius);
            this.selectedElement.element.setAttribute('cy', newY + radius);
        } else if (this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('font-size', Math.max(12, newHeight));
            this.selectedElement.size = Math.max(12, newHeight);
        }
        
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.showResizeHandles(this.selectedElement);
    }
    
    // ===== PROPERTY UPDATES =====
    updateTextContent(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.textContent = value;
            this.selectedElement.content = value;
            this.saveHistory();
        }
    }
    
    updateTextFont(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('font-family', value);
            this.selectedElement.font = value;
            this.saveHistory();
        }
    }
    
    updateTextSize(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('font-size', value);
            this.selectedElement.size = value;
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
