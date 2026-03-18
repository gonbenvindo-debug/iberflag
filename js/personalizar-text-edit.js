// Add text editing method to PersonalizadorBandeira class
PersonalizadorBandeira.prototype.startTextEdit = function(elementData) {
    if (elementData.type !== 'text') return;
    
    // Hide resize handles during editing
    this.hideResizeHandles();
    
    // Create a temporary input overlay
    const textElement = elementData.element;
    const bbox = textElement.getBBox();
    const canvasRect = this.canvas.getBoundingClientRect();
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = elementData.content;
    input.style.position = 'absolute';
    input.style.left = (bbox.x) + 'px';
    input.style.top = (bbox.y) + 'px';
    input.style.width = Math.max(100, bbox.width) + 'px';
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
};
