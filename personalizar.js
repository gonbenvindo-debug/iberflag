// ===== PRODUCT CUSTOMIZER =====

let currentProduct = null;
let selectedElement = null;
let elements = [];
let history = [];
let historyIndex = -1;
let zoom = 1;
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragOffset = { x: 0, y: 0 };
let resizeStart = { x: 0, y: 0, width: 0, height: 0 };
let selectionBox = null;
let resizeHandles = [];

// ===== DOM ELEMENTS =====
const canvas = document.getElementById('design-canvas');
const printArea = document.getElementById('print-area');
const toolTabs = document.querySelectorAll('.tool-tab');
const toolPanels = document.querySelectorAll('.tool-panel');
const layersList = document.getElementById('layers-list');
const zoomLevel = document.getElementById('zoom-level');

// Text controls
const addTextBtn = document.getElementById('add-text-btn');
const textControls = document.getElementById('text-controls');
const textContent = document.getElementById('text-content');
const textFont = document.getElementById('text-font');
const textSize = document.getElementById('text-size');
const textSizeValue = document.getElementById('text-size-value');
const textColor = document.getElementById('text-color');
const textBold = document.getElementById('text-bold');
const textItalic = document.getElementById('text-italic');
const textUnderline = document.getElementById('text-underline');

// Image controls
const addImageBtn = document.getElementById('add-image-btn');
const imageUpload = document.getElementById('image-upload');
const imageUrl = document.getElementById('image-url');
const addImageUrlBtn = document.getElementById('add-image-url-btn');
const imageControls = document.getElementById('image-controls');
const imageOpacity = document.getElementById('image-opacity');
const imageOpacityValue = document.getElementById('image-opacity-value');

// Shape controls
const shapeBtns = document.querySelectorAll('.shape-btn');
const shapeControls = document.getElementById('shape-controls');
const shapeFill = document.getElementById('shape-fill');
const shapeStroke = document.getElementById('shape-stroke');
const shapeStrokeWidth = document.getElementById('shape-stroke-width');
const shapeStrokeValue = document.getElementById('shape-stroke-value');

// Actions
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomFitBtn = document.getElementById('zoom-fit');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const clearAllBtn = document.getElementById('clear-all');
const addToCartBtn = document.getElementById('add-to-cart-custom');
const cartBtnText = document.getElementById('cart-btn-text');

// ===== LOAD PRODUCT INFO =====
function loadProductInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('produto');
    
    if (!productId) {
        window.location.href = '/produtos.html';
        return;
    }
    
    // Find product in initialProducts
    currentProduct = initialProducts.find(p => p.id == productId);
    
    if (!currentProduct) {
        showToast('Produto não encontrado', 'error');
        setTimeout(() => window.location.href = '/produtos.html', 2000);
        return;
    }
    
    document.getElementById('product-name').textContent = currentProduct.nome;
    document.getElementById('product-info').textContent = currentProduct.nome;
    document.getElementById('product-price').textContent = `${currentProduct.preco.toFixed(2)}€`;
    
    // Check if editing existing design
    const editIndex = urlParams.get('edit');
    if (editIndex !== null) {
        loadExistingDesign(parseInt(editIndex));
        if (cartBtnText) cartBtnText.textContent = 'Atualizar no Carrinho';
    }
}

// ===== TAB SWITCHING =====
toolTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        toolTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        toolPanels.forEach(panel => panel.classList.add('hidden'));
        document.getElementById(`${tabName}-panel`).classList.remove('hidden');
    });
});

// ===== CREATE RESIZE HANDLES =====
function createResizeHandles(element) {
    removeResizeHandles();
    
    if (!element || !element.element) return;
    
    const bbox = element.element.getBBox();
    const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    
    positions.forEach(pos => {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('class', `resize-handle ${pos}`);
        handle.setAttribute('r', '6');
        handle.setAttribute('fill', 'white');
        handle.setAttribute('stroke', '#2563eb');
        handle.setAttribute('stroke-width', '2');
        handle.style.cursor = `${pos}-resize`;
        
        // Position handle
        let cx, cy;
        switch(pos) {
            case 'nw': cx = bbox.x; cy = bbox.y; break;
            case 'ne': cx = bbox.x + bbox.width; cy = bbox.y; break;
            case 'sw': cx = bbox.x; cy = bbox.y + bbox.height; break;
            case 'se': cx = bbox.x + bbox.width; cy = bbox.y + bbox.height; break;
            case 'n': cx = bbox.x + bbox.width/2; cy = bbox.y; break;
            case 's': cx = bbox.x + bbox.width/2; cy = bbox.y + bbox.height; break;
            case 'e': cx = bbox.x + bbox.width; cy = bbox.y + bbox.height/2; break;
            case 'w': cx = bbox.x; cy = bbox.y + bbox.height/2; break;
        }
        
        handle.setAttribute('cx', cx);
        handle.setAttribute('cy', cy);
        
        handle.addEventListener('mousedown', (e) => startResize(e, element, pos));
        
        canvas.appendChild(handle);
        resizeHandles.push(handle);
    });
}

function removeResizeHandles() {
    resizeHandles.forEach(handle => handle.remove());
    resizeHandles = [];
}

function updateResizeHandles() {
    if (selectedElement) {
        createResizeHandles(selectedElement);
    }
}

// ===== RESIZE FUNCTIONALITY =====
function startResize(e, element, handle) {
    e.stopPropagation();
    e.preventDefault();
    
    isResizing = true;
    resizeHandle = handle;
    selectedElement = element;
    
    const bbox = element.element.getBBox();
    resizeStart = {
        x: e.clientX,
        y: e.clientY,
        width: bbox.width,
        height: bbox.height,
        elementX: bbox.x,
        elementY: bbox.y
    };
    
    canvas.style.cursor = `${handle}-resize`;
}

function doResize(e) {
    if (!isResizing || !selectedElement) return;
    
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = resizeStart.elementX;
    let newY = resizeStart.elementY;
    
    // Calculate new dimensions based on handle
    switch(resizeHandle) {
        case 'se':
            newWidth = Math.max(20, resizeStart.width + dx);
            newHeight = Math.max(20, resizeStart.height + dy);
            break;
        case 'sw':
            newWidth = Math.max(20, resizeStart.width - dx);
            newHeight = Math.max(20, resizeStart.height + dy);
            newX = resizeStart.elementX + dx;
            break;
        case 'ne':
            newWidth = Math.max(20, resizeStart.width + dx);
            newHeight = Math.max(20, resizeStart.height - dy);
            newY = resizeStart.elementY + dy;
            break;
        case 'nw':
            newWidth = Math.max(20, resizeStart.width - dx);
            newHeight = Math.max(20, resizeStart.height - dy);
            newX = resizeStart.elementX + dx;
            newY = resizeStart.elementY + dy;
            break;
        case 'e':
            newWidth = Math.max(20, resizeStart.width + dx);
            break;
        case 'w':
            newWidth = Math.max(20, resizeStart.width - dx);
            newX = resizeStart.elementX + dx;
            break;
        case 's':
            newHeight = Math.max(20, resizeStart.height + dy);
            break;
        case 'n':
            newHeight = Math.max(20, resizeStart.height - dy);
            newY = resizeStart.elementY + dy;
            break;
    }
    
    // Apply resize based on element type
    if (selectedElement.type === 'image') {
        selectedElement.element.setAttribute('width', newWidth);
        selectedElement.element.setAttribute('height', newHeight);
        selectedElement.element.setAttribute('x', newX);
        selectedElement.element.setAttribute('y', newY);
        selectedElement.width = newWidth;
        selectedElement.height = newHeight;
        selectedElement.x = newX;
        selectedElement.y = newY;
    } else if (selectedElement.type === 'shape') {
        if (selectedElement.shapeType === 'rectangle') {
            selectedElement.element.setAttribute('width', newWidth);
            selectedElement.element.setAttribute('height', newHeight);
            selectedElement.element.setAttribute('x', newX);
            selectedElement.element.setAttribute('y', newY);
        } else if (selectedElement.shapeType === 'circle') {
            const radius = Math.max(newWidth, newHeight) / 2;
            selectedElement.element.setAttribute('r', radius);
            selectedElement.element.setAttribute('cx', newX + radius);
            selectedElement.element.setAttribute('cy', newY + radius);
        }
        selectedElement.width = newWidth;
        selectedElement.height = newHeight;
        selectedElement.x = newX;
        selectedElement.y = newY;
    } else if (selectedElement.type === 'text') {
        selectedElement.element.setAttribute('font-size', Math.max(12, newHeight));
        selectedElement.element.setAttribute('x', newX);
        selectedElement.element.setAttribute('y', newY);
        selectedElement.size = Math.max(12, newHeight);
        selectedElement.x = newX;
        selectedElement.y = newY;
    }
    
    updateResizeHandles();
}

function stopResize() {
    if (isResizing) {
        isResizing = false;
        resizeHandle = null;
        canvas.style.cursor = 'default';
        saveHistory();
        autoSaveDesign();
    }
}

// ===== DRAG FUNCTIONALITY =====
function startDrag(e, element) {
    if (isResizing) return;
    
    isDragging = true;
    selectedElement = element;
    selectElement(element);
    
    const bbox = element.element.getBBox();
    dragOffset = {
        x: e.clientX - bbox.x,
        y: e.clientY - bbox.y
    };
    
    canvas.style.cursor = 'grabbing';
    element.element.style.cursor = 'grabbing';
    
    e.preventDefault();
}

document.addEventListener('mousemove', (e) => {
    if (isResizing) {
        doResize(e);
        return;
    }
    
    if (isDragging && selectedElement) {
        const canvasRect = canvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left - dragOffset.x;
        const y = e.clientY - canvasRect.top - dragOffset.y;
        
        if (selectedElement.type === 'text') {
            selectedElement.element.setAttribute('x', x);
            selectedElement.element.setAttribute('y', y);
            selectedElement.x = x;
            selectedElement.y = y;
        } else if (selectedElement.type === 'image') {
            selectedElement.element.setAttribute('x', x);
            selectedElement.element.setAttribute('y', y);
            selectedElement.x = x;
            selectedElement.y = y;
        }
        
        updateResizeHandles();
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'default';
        if (selectedElement && selectedElement.element) {
            selectedElement.element.style.cursor = 'move';
        }
        saveHistory();
        autoSaveDesign();
    }
    stopResize();
});

// ===== CANVAS CLICK - DESELECT =====
canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target === printArea) {
        selectedElement = null;
        removeResizeHandles();
        elements.forEach(el => {
            if (el.element) el.element.style.outline = 'none';
        });
        textControls.classList.add('hidden');
        imageControls.classList.add('hidden');
        shapeControls.classList.add('hidden');
    }
});

// ===== SELECT ELEMENT =====
function selectElement(element) {
    selectedElement = element;
    
    // Remove previous selection styling
    elements.forEach(el => {
        if (el.element) {
            el.element.style.outline = 'none';
        }
    });
    
    // Add selection styling
    if (element && element.element) {
        element.element.style.outline = '2px solid #2563eb';
        element.element.style.outlineOffset = '2px';
        createResizeHandles(element);
    } else {
        removeResizeHandles();
    }
    
    // Update controls based on element type
    textControls.classList.add('hidden');
    imageControls.classList.add('hidden');
    shapeControls.classList.add('hidden');
    
    if (element.type === 'text') {
        textControls.classList.remove('hidden');
        textContent.value = element.content;
        textFont.value = element.font;
        textSize.value = element.size;
        textSizeValue.textContent = element.size + 'px';
        textColor.value = element.color;
    } else if (element.type === 'image') {
        imageControls.classList.remove('hidden');
        imageOpacity.value = (element.opacity || 1) * 100;
        imageOpacityValue.textContent = Math.round((element.opacity || 1) * 100) + '%';
    } else if (element.type === 'shape') {
        shapeControls.classList.remove('hidden');
        shapeFill.value = element.fill;
        shapeStroke.value = element.stroke;
        shapeStrokeWidth.value = element.strokeWidth;
        shapeStrokeValue.textContent = element.strokeWidth + 'px';
    }
}

function moveLayer(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= elements.length) return;
    
    // Swap elements in array
    [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
    
    // Reorder in SVG
    const element1 = elements[index].element;
    const element2 = elements[newIndex].element;
    
    if (direction > 0) {
        canvas.insertBefore(element2, element1.nextSibling);
    } else {
        canvas.insertBefore(element1, element2);
    }
    
    updateLayers();
    saveHistory();
    autoSaveDesign();
}

// ===== HISTORY =====
function saveHistory() {
    const state = JSON.stringify(elements.map(el => ({
        ...el,
        element: null
    })));
    
    history = history.slice(0, historyIndex + 1);
    history.push(state);
    historyIndex++;
}

// ===== ZOOM =====
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        zoom = Math.min(zoom + 0.1, 2);
        updateZoom();
    });
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        zoom = Math.max(zoom - 0.1, 0.5);
        updateZoom();
    });
}

if (zoomFitBtn) {
    zoomFitBtn.addEventListener('click', () => {
        zoom = 1;
        updateZoom();
    });
}

function updateZoom() {
    canvas.style.transform = `scale(${zoom})`;
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
}

// ===== CLEAR ALL =====
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        if (confirm('Tem a certeza que deseja limpar todo o design?')) {
            elements.forEach(el => el.element.remove());
            elements = [];
            selectedElement = null;
            updateLayers();
            saveHistory();
        }
    });
}

// ===== AUTO SAVE DESIGN =====
function autoSaveDesign() {
    if (!currentProduct) return;
    
    const svgData = new XMLSerializer().serializeToString(canvas);
    const design = {
        productId: currentProduct.id,
        svgData: svgData,
        elements: elements.map(el => ({
            ...el,
            element: null
        })),
        timestamp: Date.now()
    };
    
    localStorage.setItem(`design_${currentProduct.id}`, JSON.stringify(design));
}

// ===== LOAD EXISTING DESIGN =====
function loadExistingDesign(cartIndex) {
    const item = cart[cartIndex];
    if (!item || !item.customDesign) return;
    
    // TODO: Restore design from SVG
    showToast('Design carregado!', 'success');
}

// ===== ADD TO CART =====
if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
        if (elements.length === 0) {
            showToast('Por favor, personalize o produto antes de adicionar ao carrinho', 'error');
            return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const editIndex = urlParams.get('edit');
        const svgData = new XMLSerializer().serializeToString(canvas);
        
        if (editIndex !== null) {
            // Update existing cart item
            const index = parseInt(editIndex);
            if (cart[index]) {
                cart[index].customDesign = svgData;
                updateCart();
                showToast('Design atualizado!', 'success');
                setTimeout(() => {
                    window.location.href = '/produtos.html';
                }, 1000);
            }
        } else {
            // Add new item to cart
            cart.push({
                id: currentProduct.id,
                nome: currentProduct.nome,
                preco: currentProduct.preco,
                imagem: currentProduct.imagem,
                quantity: 1,
                customDesign: svgData,
                customized: true
            });
            
            updateCart();
            showToast('Produto personalizado adicionado ao carrinho!', 'success');
            
            setTimeout(() => {
                window.location.href = '/produtos.html';
            }, 1500);
        }
    });
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedElement) {
        const index = elements.indexOf(selectedElement);
        if (index > -1) deleteLayer(index);
    }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    loadProductInfo();
    
    // Auto-save on changes
    setInterval(() => {
        if (elements.length > 0) {
            autoSaveDesign();
        }
    }, 5000); // Auto-save every 5 seconds
});
