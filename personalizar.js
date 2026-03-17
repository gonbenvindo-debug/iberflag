// ===== PRODUCT CUSTOMIZER =====

let currentProduct = null;
let selectedElement = null;
let elements = [];
let history = [];
let historyIndex = -1;
let zoom = 1;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

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

// ===== ADD TEXT =====
if (addTextBtn) {
    addTextBtn.addEventListener('click', () => {
        const text = createTextElement('Clique para editar', 400, 300);
        elements.push(text);
        canvas.appendChild(text.element);
        selectElement(text);
        textControls.classList.remove('hidden');
        saveHistory();
        updateLayers();
    });
}

function createTextElement(content, x, y) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('font-family', 'Arial');
    text.setAttribute('font-size', '24');
    text.setAttribute('fill', '#000000');
    text.textContent = content;
    text.style.cursor = 'move';
    
    const elementData = {
        type: 'text',
        element: text,
        id: Date.now(),
        content: content,
        x: x,
        y: y,
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#000000',
        bold: false,
        italic: false,
        underline: false
    };
    
    text.addEventListener('mousedown', (e) => startDrag(e, elementData));
    text.addEventListener('click', () => selectElement(elementData));
    
    return elementData;
}

// ===== TEXT CONTROLS =====
if (textContent) {
    textContent.addEventListener('input', (e) => {
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.content = e.target.value;
            selectedElement.element.textContent = e.target.value;
            saveHistory();
        }
    });
}

if (textFont) {
    textFont.addEventListener('change', (e) => {
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.fontFamily = e.target.value;
            selectedElement.element.setAttribute('font-family', e.target.value);
            saveHistory();
        }
    });
}

if (textSize) {
    textSize.addEventListener('input', (e) => {
        textSizeValue.textContent = `${e.target.value}px`;
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.fontSize = e.target.value;
            selectedElement.element.setAttribute('font-size', e.target.value);
            saveHistory();
        }
    });
}

if (textColor) {
    textColor.addEventListener('input', (e) => {
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.color = e.target.value;
            selectedElement.element.setAttribute('fill', e.target.value);
            saveHistory();
        }
    });
}

if (textBold) {
    textBold.addEventListener('click', () => {
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.bold = !selectedElement.bold;
            selectedElement.element.setAttribute('font-weight', selectedElement.bold ? 'bold' : 'normal');
            textBold.classList.toggle('bg-blue-100');
            saveHistory();
        }
    });
}

if (textItalic) {
    textItalic.addEventListener('click', () => {
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.italic = !selectedElement.italic;
            selectedElement.element.setAttribute('font-style', selectedElement.italic ? 'italic' : 'normal');
            textItalic.classList.toggle('bg-blue-100');
            saveHistory();
        }
    });
}

if (textUnderline) {
    textUnderline.addEventListener('click', () => {
        if (selectedElement && selectedElement.type === 'text') {
            selectedElement.underline = !selectedElement.underline;
            selectedElement.element.setAttribute('text-decoration', selectedElement.underline ? 'underline' : 'none');
            textUnderline.classList.toggle('bg-blue-100');
            saveHistory();
        }
    });
}

// ===== ADD IMAGE =====
if (addImageBtn) {
    addImageBtn.addEventListener('click', () => {
        imageUpload.click();
    });
}

if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                addImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}

if (addImageUrlBtn) {
    addImageUrlBtn.addEventListener('click', () => {
        const url = imageUrl.value.trim();
        if (url) {
            addImage(url);
            imageUrl.value = '';
        }
    });
}

function addImage(src) {
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', src);
    image.setAttribute('x', 200);
    image.setAttribute('y', 200);
    image.setAttribute('width', 200);
    image.setAttribute('height', 200);
    image.style.cursor = 'move';
    
    const elementData = {
        type: 'image',
        element: image,
        id: Date.now(),
        src: src,
        x: 200,
        y: 200,
        width: 200,
        height: 200,
        opacity: 1
    };
    
    image.addEventListener('mousedown', (e) => startDrag(e, elementData));
    image.addEventListener('click', () => selectElement(elementData));
    
    elements.push(elementData);
    canvas.appendChild(image);
    selectElement(elementData);
    imageControls.classList.remove('hidden');
    saveHistory();
    updateLayers();
}

// ===== IMAGE CONTROLS =====
if (imageOpacity) {
    imageOpacity.addEventListener('input', (e) => {
        imageOpacityValue.textContent = `${e.target.value}%`;
        if (selectedElement && selectedElement.type === 'image') {
            selectedElement.opacity = e.target.value / 100;
            selectedElement.element.setAttribute('opacity', selectedElement.opacity);
            saveHistory();
        }
    });
}

// ===== ADD SHAPES =====
shapeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const shapeType = btn.dataset.shape;
        addShape(shapeType);
    });
});

function addShape(type) {
    let shape;
    const elementData = {
        type: 'shape',
        shapeType: type,
        id: Date.now(),
        x: 300,
        y: 250,
        fill: '#3b82f6',
        stroke: 'none',
        strokeWidth: 0
    };
    
    switch(type) {
        case 'rectangle':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', 300);
            shape.setAttribute('y', 250);
            shape.setAttribute('width', 150);
            shape.setAttribute('height', 100);
            elementData.width = 150;
            elementData.height = 100;
            break;
        case 'circle':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', 375);
            shape.setAttribute('cy', 300);
            shape.setAttribute('r', 75);
            elementData.cx = 375;
            elementData.cy = 300;
            elementData.r = 75;
            break;
        case 'triangle':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', '400,250 325,350 475,350');
            elementData.points = '400,250 325,350 475,350';
            break;
        case 'star':
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', '400,250 420,310 480,310 430,350 450,410 400,370 350,410 370,350 320,310 380,310');
            elementData.points = '400,250 420,310 480,310 430,350 450,410 400,370 350,410 370,350 320,310 380,310';
            break;
    }
    
    shape.setAttribute('fill', elementData.fill);
    if (elementData.stroke !== 'none') {
        shape.setAttribute('stroke', elementData.stroke);
        shape.setAttribute('stroke-width', elementData.strokeWidth);
    }
    shape.style.cursor = 'move';
    
    elementData.element = shape;
    
    shape.addEventListener('mousedown', (e) => startDrag(e, elementData));
    shape.addEventListener('click', () => selectElement(elementData));
    
    elements.push(elementData);
    canvas.appendChild(shape);
    selectElement(elementData);
    shapeControls.classList.remove('hidden');
    saveHistory();
    updateLayers();
}

// ===== SHAPE CONTROLS =====
if (shapeFill) {
    shapeFill.addEventListener('input', (e) => {
        if (selectedElement && selectedElement.type === 'shape') {
            selectedElement.fill = e.target.value;
            selectedElement.element.setAttribute('fill', e.target.value);
            saveHistory();
        }
    });
}

if (shapeStroke) {
    shapeStroke.addEventListener('input', (e) => {
        if (selectedElement && selectedElement.type === 'shape') {
            selectedElement.stroke = e.target.value;
            selectedElement.element.setAttribute('stroke', e.target.value);
            saveHistory();
        }
    });
}

if (shapeStrokeWidth) {
    shapeStrokeWidth.addEventListener('input', (e) => {
        shapeStrokeValue.textContent = `${e.target.value}px`;
        if (selectedElement && selectedElement.type === 'shape') {
            selectedElement.strokeWidth = e.target.value;
            selectedElement.element.setAttribute('stroke-width', e.target.value);
            saveHistory();
        }
    });
}

// ===== DRAG & DROP =====
function startDrag(e, elementData) {
    e.preventDefault();
    isDragging = true;
    selectedElement = elementData;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (elementData.type === 'text') {
        dragOffset.x = mouseX - parseFloat(elementData.element.getAttribute('x'));
        dragOffset.y = mouseY - parseFloat(elementData.element.getAttribute('y'));
    } else if (elementData.type === 'image') {
        dragOffset.x = mouseX - parseFloat(elementData.element.getAttribute('x'));
        dragOffset.y = mouseY - parseFloat(elementData.element.getAttribute('y'));
    }
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
    if (!isDragging || !selectedElement) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newX = mouseX - dragOffset.x;
    const newY = mouseY - dragOffset.y;
    
    if (selectedElement.type === 'text') {
        selectedElement.element.setAttribute('x', newX);
        selectedElement.element.setAttribute('y', newY);
        selectedElement.x = newX;
        selectedElement.y = newY;
    } else if (selectedElement.type === 'image') {
        selectedElement.element.setAttribute('x', newX);
        selectedElement.element.setAttribute('y', newY);
        selectedElement.x = newX;
        selectedElement.y = newY;
    }
}

function stopDrag() {
    if (isDragging) {
        isDragging = false;
        saveHistory();
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

// ===== SELECT ELEMENT =====
function selectElement(elementData) {
    selectedElement = elementData;
    
    // Update controls based on type
    if (elementData.type === 'text') {
        textControls.classList.remove('hidden');
        textContent.value = elementData.content;
        textFont.value = elementData.fontFamily;
        textSize.value = elementData.fontSize;
        textSizeValue.textContent = `${elementData.fontSize}px`;
        textColor.value = elementData.color;
    } else if (elementData.type === 'image') {
        imageControls.classList.remove('hidden');
        imageOpacity.value = elementData.opacity * 100;
        imageOpacityValue.textContent = `${Math.round(elementData.opacity * 100)}%`;
    } else if (elementData.type === 'shape') {
        shapeControls.classList.remove('hidden');
        shapeFill.value = elementData.fill;
        shapeStroke.value = elementData.stroke;
        shapeStrokeWidth.value = elementData.strokeWidth;
        shapeStrokeValue.textContent = `${elementData.strokeWidth}px`;
    }
}

// ===== LAYERS =====
function updateLayers() {
    if (elements.length === 0) {
        layersList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhuma camada ainda</p>';
        return;
    }
    
    layersList.innerHTML = elements.map((el, index) => `
        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100" data-layer-id="${el.id}">
            <div class="flex flex-col gap-1">
                <button class="layer-move-up text-gray-600 hover:text-blue-600" data-layer-index="${index}" ${index === elements.length - 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-up" class="w-3 h-3"></i>
                </button>
                <button class="layer-move-down text-gray-600 hover:text-blue-600" data-layer-index="${index}" ${index === 0 ? 'disabled' : ''}>
                    <i data-lucide="chevron-down" class="w-3 h-3"></i>
                </button>
            </div>
            <div class="flex items-center gap-2 flex-1 cursor-pointer">
                <i data-lucide="${el.type === 'text' ? 'type' : el.type === 'image' ? 'image' : 'square'}" class="w-4 h-4"></i>
                <span class="text-sm">${el.type === 'text' ? el.content.substring(0, 20) : el.type.charAt(0).toUpperCase() + el.type.slice(1)}</span>
            </div>
            <button class="delete-layer text-red-600 hover:text-red-700" data-layer-index="${index}">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).reverse().join('');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Add event listeners
    document.querySelectorAll('.delete-layer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.layerIndex);
            deleteLayer(index);
        });
    });
    
    document.querySelectorAll('.layer-move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.layerIndex);
            moveLayer(index, 1);
        });
    });
    
    document.querySelectorAll('.layer-move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.layerIndex);
            moveLayer(index, -1);
        });
    });
    
    document.querySelectorAll('[data-layer-id]').forEach(layer => {
        const clickableArea = layer.querySelector('.flex-1');
        if (clickableArea) {
            clickableArea.addEventListener('click', () => {
                const id = parseInt(layer.dataset.layerId);
                const element = elements.find(el => el.id === id);
                if (element) selectElement(element);
            });
        }
    });
}

function deleteLayer(index) {
    const element = elements[index];
    element.element.remove();
    elements.splice(index, 1);
    if (selectedElement === element) {
        selectedElement = null;
        textControls.classList.add('hidden');
        imageControls.classList.add('hidden');
        shapeControls.classList.add('hidden');
    }
    updateLayers();
    saveHistory();
    autoSaveDesign();
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
