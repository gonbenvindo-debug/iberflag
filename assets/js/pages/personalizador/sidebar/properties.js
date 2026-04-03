// ============================================================
// PROPERTIES, LAYERS & HISTORY
// ============================================================
Object.assign(DesignEditor.prototype, {

    updateTextContent(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const rawValue = String(value ?? '');
            this.selectedElement.rawContent = rawValue;
            this.selectedElement.content = rawValue;
            this.selectedElement.element.dataset.rawContent = rawValue;
            const displayValue = this.selectedElement.capsLock ? rawValue.toUpperCase() : rawValue;
            this.selectedElement.element.textContent = displayValue;
            
            // Update stored dimensions
            const bbox = this.selectedElement.element.getBBox();
            this.selectedElement.width = bbox.width;
            this.selectedElement.height = bbox.height;
            
            this.showResizeHandles(this.selectedElement);
            this.queueHistorySave(250);
        }
    },
    
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
            this.renderQuickFontPopover?.();
        }
    },
    
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
            this.renderQuickFontPopover?.();
        }
    },
    
    updateTextColor(value) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.element.setAttribute('fill', value);
            this.selectedElement.color = value;
            const desktopTextColor = document.getElementById('desktop-text-color');
            if (desktopTextColor) desktopTextColor.value = value;
            this.queueHistorySave();
            this.renderQuickFontPopover?.();
        }
    },

    updateTextUnderline(enabled) {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const isEnabled = Boolean(enabled);
            if (isEnabled) {
                this.selectedElement.element.setAttribute('text-decoration', 'underline');
            } else {
                this.selectedElement.element.removeAttribute('text-decoration');
            }
            this.selectedElement.underline = isEnabled;
            this.saveHistory();
            this.renderQuickFontPopover?.();
            this.syncExpandedPropertiesControls?.(this.selectedElement);
        }
    },
    
    toggleTextBold() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const current = this.selectedElement.element.getAttribute('font-weight') || 'normal';
            const newWeight = current === 'bold' ? 'normal' : 'bold';
            this.selectedElement.element.setAttribute('font-weight', newWeight);
            this.selectedElement.bold = newWeight === 'bold';
            this.saveHistory();
            this.renderQuickFontPopover?.();
            this.syncExpandedPropertiesControls?.(this.selectedElement);
        }
    },

    toggleTextCapsLock() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const nextState = !this.selectedElement.capsLock;
            this.selectedElement.capsLock = nextState;
            this.selectedElement.element.dataset.capsLock = nextState ? 'true' : 'false';
            const rawContent = this.selectedElement.rawContent ?? this.selectedElement.content ?? this.selectedElement.element.textContent ?? '';
            const displayValue = nextState ? String(rawContent).toUpperCase() : String(rawContent);
            this.selectedElement.element.textContent = displayValue;
            const bbox = this.selectedElement.element.getBBox();
            this.selectedElement.width = bbox.width;
            this.selectedElement.height = bbox.height;
            this.showResizeHandles(this.selectedElement);
            this.saveHistory();
            this.renderQuickFontPopover?.();
            this.syncExpandedPropertiesControls?.(this.selectedElement);
        }
    },
    
    toggleTextItalic() {
        if (this.selectedElement && this.selectedElement.type === 'text') {
            const current = this.selectedElement.element.getAttribute('font-style') || 'normal';
            const newStyle = current === 'italic' ? 'normal' : 'italic';
            this.selectedElement.element.setAttribute('font-style', newStyle);
            this.selectedElement.italic = newStyle === 'italic';
            this.saveHistory();
            this.renderQuickFontPopover?.();
            this.syncExpandedPropertiesControls?.(this.selectedElement);
        }
    },
    
    updateImageOpacity(value) {
        if (this.selectedElement && this.selectedElement.type === 'image') {
            this.selectedElement.element.setAttribute('opacity', value);
            this.selectedElement.opacity = value;
            this.queueHistorySave();
        }
    },

    cycleQuickTextFont(direction = 1) {
        if (!this.selectedElement || this.selectedElement.type !== 'text') return;

        const fontSelect = document.getElementById('prop-text-font');
        if (!fontSelect || fontSelect.options.length === 0) return;

        const options = Array.from(fontSelect.options)
            .map((option) => option.value)
            .filter(Boolean);
        if (options.length === 0) return;

        const currentFont = this.selectedElement.font || fontSelect.value || options[0];
        const currentIndex = Math.max(0, options.findIndex((font) => font === currentFont));
        const nextIndex = (currentIndex + direction + options.length) % options.length;
        const nextFont = options[nextIndex];

        fontSelect.value = nextFont;
        this.updateTextFont(nextFont);
        this.updateContextualToolbar(this.selectedElement);
    },

    cycleQuickImageOpacity(direction = 1) {
        if (!this.selectedElement || this.selectedElement.type !== 'image') return;

        const presets = [100, 85, 70, 55, 40, 25];
        const currentValue = Math.round((this.selectedElement.opacity ?? 1) * 100);
        const currentIndex = presets.indexOf(currentValue);
        const nextIndex = (currentIndex < 0 ? 0 : currentIndex + direction + presets.length) % presets.length;
        const nextValue = presets[nextIndex];

        this.applyQuickOpacityValue(nextValue);
    },

    getQuickFontOptions() {
        const fontSelect = document.getElementById('prop-text-font');
        if (!fontSelect) return [];

        return Array.from(fontSelect.options)
            .map((option) => ({
                value: option.value,
                label: option.textContent?.trim() || option.value,
                family: option.style?.fontFamily || option.value
            }))
            .filter((option) => Boolean(option.value));
    },

    renderQuickFontPopover() {
        const textContentInput = document.getElementById('quick-text-content');
        const fontSelect = document.getElementById('quick-font-select');
        const topFontSelect = document.getElementById('top-font-select');
        const boldBtn = document.getElementById('quick-font-bold-btn');
        const topBoldBtn = document.getElementById('top-font-bold-btn');
        const italicBtn = document.getElementById('quick-font-italic-btn');
        const topItalicBtn = document.getElementById('top-font-italic-btn');
        const underlineBtn = document.getElementById('quick-font-underline-btn');
        const topUnderlineBtn = document.getElementById('top-font-underline-btn');
        const capsBtn = document.getElementById('quick-font-caps-btn');
        const topCapsBtn = document.getElementById('top-font-caps-btn');
        const topSizeLabel = document.getElementById('top-text-size-label');
        const topSizeDecreaseBtn = document.getElementById('top-text-size-decrease');
        const topSizeIncreaseBtn = document.getElementById('top-text-size-increase');
        const desktopFontSelect = document.getElementById('desktop-font-select');
        const desktopBoldBtn = document.getElementById('desktop-font-bold-btn');
        const desktopItalicBtn = document.getElementById('desktop-font-italic-btn');
        const desktopUnderlineBtn = document.getElementById('desktop-font-underline-btn');
        const desktopCapsBtn = document.getElementById('desktop-font-caps-btn');
        const desktopSizeLabel = document.getElementById('desktop-text-size-label');
        const desktopSizeDecreaseBtn = document.getElementById('desktop-text-size-decrease');
        const desktopSizeIncreaseBtn = document.getElementById('desktop-text-size-increase');
        const desktopTextColor = document.getElementById('desktop-text-color');
        const quickSizeDecreaseBtn = document.getElementById('quick-text-size-decrease');
        const quickSizeIncreaseBtn = document.getElementById('quick-text-size-increase');
        const textFont = document.getElementById('prop-text-font');
        const textSize = document.getElementById('prop-text-size');
        if (!fontSelect) return;

        const fontOptions = this.getQuickFontOptions();
        const hasText = Boolean(this.selectedElement && this.selectedElement.type === 'text');
        const currentFont = this.selectedElement?.type === 'text'
            ? (this.selectedElement.font || textFont?.value || fontOptions[0]?.value || 'Arial')
            : (textFont?.value || fontOptions[0]?.value || 'Arial');
        const isBold = Boolean(hasText && this.selectedElement.bold);
        const isItalic = Boolean(hasText && this.selectedElement.italic);
        const isUnderline = Boolean(hasText && this.selectedElement.underline);
        const isCapsLock = Boolean(hasText && this.selectedElement.capsLock);
        const sizeValue = Math.round(Number(this.selectedElement?.size || textSize?.value || 24));
        const rawContent = hasText
            ? String(this.selectedElement.rawContent ?? this.selectedElement.content ?? this.selectedElement.element.textContent ?? '')
            : '';

        if (textContentInput) {
            textContentInput.value = rawContent;
            textContentInput.disabled = !hasText;
            textContentInput.classList.toggle('is-disabled', !hasText);
        }
        if (boldBtn) {
            boldBtn.classList.toggle('active', isBold);
            boldBtn.setAttribute('aria-pressed', String(isBold));
        }
        if (topBoldBtn) {
            topBoldBtn.classList.toggle('active', isBold);
            topBoldBtn.setAttribute('aria-pressed', String(isBold));
            topBoldBtn.disabled = !hasText;
            topBoldBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopBoldBtn) {
            desktopBoldBtn.classList.toggle('active', isBold);
            desktopBoldBtn.setAttribute('aria-pressed', String(isBold));
            desktopBoldBtn.disabled = !hasText;
            desktopBoldBtn.classList.toggle('is-disabled', !hasText);
        }
        if (italicBtn) {
            italicBtn.classList.toggle('active', isItalic);
            italicBtn.setAttribute('aria-pressed', String(isItalic));
        }
        if (topItalicBtn) {
            topItalicBtn.classList.toggle('active', isItalic);
            topItalicBtn.setAttribute('aria-pressed', String(isItalic));
            topItalicBtn.disabled = !hasText;
            topItalicBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopItalicBtn) {
            desktopItalicBtn.classList.toggle('active', isItalic);
            desktopItalicBtn.setAttribute('aria-pressed', String(isItalic));
            desktopItalicBtn.disabled = !hasText;
            desktopItalicBtn.classList.toggle('is-disabled', !hasText);
        }
        if (underlineBtn) {
            underlineBtn.classList.toggle('active', isUnderline);
            underlineBtn.setAttribute('aria-pressed', String(isUnderline));
            underlineBtn.disabled = !hasText;
            underlineBtn.classList.toggle('is-disabled', !hasText);
        }
        if (topUnderlineBtn) {
            topUnderlineBtn.classList.toggle('active', isUnderline);
            topUnderlineBtn.setAttribute('aria-pressed', String(isUnderline));
            topUnderlineBtn.disabled = !hasText;
            topUnderlineBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopUnderlineBtn) {
            desktopUnderlineBtn.classList.toggle('active', isUnderline);
            desktopUnderlineBtn.setAttribute('aria-pressed', String(isUnderline));
            desktopUnderlineBtn.disabled = !hasText;
            desktopUnderlineBtn.classList.toggle('is-disabled', !hasText);
        }
        if (capsBtn) {
            capsBtn.classList.toggle('active', isCapsLock);
            capsBtn.setAttribute('aria-pressed', String(isCapsLock));
            capsBtn.disabled = !hasText;
            capsBtn.classList.toggle('is-disabled', !hasText);
        }
        if (topCapsBtn) {
            topCapsBtn.classList.toggle('active', isCapsLock);
            topCapsBtn.setAttribute('aria-pressed', String(isCapsLock));
            topCapsBtn.disabled = !hasText;
            topCapsBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopCapsBtn) {
            desktopCapsBtn.classList.toggle('active', isCapsLock);
            desktopCapsBtn.setAttribute('aria-pressed', String(isCapsLock));
            desktopCapsBtn.disabled = !hasText;
            desktopCapsBtn.classList.toggle('is-disabled', !hasText);
        }
        if (topSizeLabel) {
            topSizeLabel.textContent = String(sizeValue);
        }
        if (desktopSizeLabel) {
            desktopSizeLabel.textContent = String(sizeValue);
        }
        if (quickSizeDecreaseBtn) {
            quickSizeDecreaseBtn.disabled = !hasText;
            quickSizeDecreaseBtn.classList.toggle('is-disabled', !hasText);
        }
        if (quickSizeIncreaseBtn) {
            quickSizeIncreaseBtn.disabled = !hasText;
            quickSizeIncreaseBtn.classList.toggle('is-disabled', !hasText);
        }
        if (topSizeDecreaseBtn) {
            topSizeDecreaseBtn.disabled = !hasText;
            topSizeDecreaseBtn.classList.toggle('is-disabled', !hasText);
        }
        if (topSizeIncreaseBtn) {
            topSizeIncreaseBtn.disabled = !hasText;
            topSizeIncreaseBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopSizeDecreaseBtn) {
            desktopSizeDecreaseBtn.disabled = !hasText;
            desktopSizeDecreaseBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopSizeIncreaseBtn) {
            desktopSizeIncreaseBtn.disabled = !hasText;
            desktopSizeIncreaseBtn.classList.toggle('is-disabled', !hasText);
        }
        if (desktopTextColor) {
            desktopTextColor.disabled = !hasText;
            desktopTextColor.classList.toggle('is-disabled', !hasText);
            desktopTextColor.value = hasText ? (this.selectedElement.color || '#000000') : '#000000';
        }

        fontSelect.disabled = !hasText;
        fontSelect.classList.toggle('is-disabled', !hasText);
        const optionsHtml = fontOptions.map((option) => {
            const safeValue = String(option.value).replace(/"/g, '&quot;');
            const family = String(option.family || option.value).replace(/"/g, '&quot;');
            const selected = option.value === currentFont;
            return `<option value="${safeValue}" style="font-family: ${family};" ${selected ? 'selected' : ''}>${option.label}</option>`;
        }).join('');
        fontSelect.innerHTML = optionsHtml;
        fontSelect.value = fontOptions.some((option) => option.value === currentFont)
            ? currentFont
            : (fontOptions[0]?.value || '');
        if (topFontSelect) {
            topFontSelect.disabled = !hasText;
            topFontSelect.classList.toggle('is-disabled', !hasText);
            topFontSelect.innerHTML = optionsHtml;
            topFontSelect.value = fontSelect.value;
        }
        if (desktopFontSelect) {
            desktopFontSelect.disabled = !hasText;
            desktopFontSelect.classList.toggle('is-disabled', !hasText);
            desktopFontSelect.innerHTML = optionsHtml;
            desktopFontSelect.value = fontSelect.value;
        }
    },

    selectQuickFontFamily(font) {
        if (!this.selectedElement || this.selectedElement.type !== 'text') return;

        const textFont = document.getElementById('prop-text-font');
        const quickFontSelect = document.getElementById('quick-font-select');
        const topFontSelect = document.getElementById('top-font-select');
        const desktopFontSelect = document.getElementById('desktop-font-select');
        if (textFont && font) {
            textFont.value = font;
        }
        if (quickFontSelect && font) {
            quickFontSelect.value = font;
        }
        if (topFontSelect && font) {
            topFontSelect.value = font;
        }
        if (desktopFontSelect && font) {
            desktopFontSelect.value = font;
        }
        if (font) {
            this.updateTextFont(font);
        }
        this.renderQuickFontPopover();
        this.updateContextualToolbar(this.selectedElement);
    },

    stepQuickTextSize(delta = 2) {
        if (!this.selectedElement || this.selectedElement.type !== 'text') return;

        const textSize = document.getElementById('prop-text-size');
        const currentSize = Number(this.selectedElement.size || textSize?.value || 24);
        const nextSize = Math.max(12, Math.min(120, Math.round(currentSize + delta)));

        if (textSize) {
            textSize.value = String(nextSize);
        }
        this.updateTextSize(String(nextSize));
        const sizeValue = document.getElementById('prop-text-size-val');
        if (sizeValue) {
            sizeValue.textContent = String(nextSize);
        }
        const topSizeValue = document.getElementById('top-text-size-label');
        if (topSizeValue) {
            topSizeValue.textContent = String(nextSize);
        }
        const desktopSizeValue = document.getElementById('desktop-text-size-label');
        if (desktopSizeValue) {
            desktopSizeValue.textContent = String(nextSize);
        }
        this.renderQuickFontPopover();
        this.updateContextualToolbar(this.selectedElement);
    },

    openQuickFontPopover() {
        const anchor = document.getElementById('quick-font-anchor');
        const btn = document.getElementById('quick-font-btn');
        const popover = document.getElementById('quick-font-popover');
        if (!anchor || !btn || !popover || anchor.classList.contains('hidden')) return;
        if (!this.selectedElement || this.selectedElement.type !== 'text') return;

        this.renderQuickFontPopover();
        popover.classList.remove('hidden');
        popover.classList.add('is-open');
        popover.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('active');
        this.editorState = this.editorState || {};
        this.editorState.quickFontOpen = true;
    },

    closeQuickFontPopover() {
        const btn = document.getElementById('quick-font-btn');
        const popover = document.getElementById('quick-font-popover');
        if (popover) {
            popover.classList.remove('is-open');
            popover.setAttribute('aria-hidden', 'true');
            popover.classList.add('hidden');
        }
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('active');
        }
        this.editorState = this.editorState || {};
        this.editorState.quickFontOpen = false;
    },

    toggleQuickFontPopover() {
        const anchor = document.getElementById('quick-font-anchor');
        const popover = document.getElementById('quick-font-popover');
        if (!anchor || !popover || anchor.classList.contains('hidden')) return;
        if (!this.selectedElement || this.selectedElement.type !== 'text') return;

        if (popover.classList.contains('is-open')) {
            this.closeQuickFontPopover();
        } else {
            this.openQuickFontPopover();
        }
    },

    applyQuickOpacityValue(value, shouldApply = true) {
        const nextValue = Math.max(0, Math.min(100, Number(value) || 0));
        const opacityRange = document.getElementById('quick-opacity-range');
        const opacityValue = document.getElementById('quick-opacity-value');
        const opacityBtn = document.getElementById('quick-opacity-btn');
        const imageOpacity = document.getElementById('prop-image-opacity');
        const imageOpacityValue = document.getElementById('prop-image-opacity-val');
        const desktopOpacityRange = document.getElementById('desktop-opacity-range');
        const desktopOpacityValue = document.getElementById('desktop-opacity-value');

        if (opacityRange) opacityRange.value = String(nextValue);
        if (opacityValue) opacityValue.textContent = `${nextValue}%`;
        if (imageOpacity) imageOpacity.value = String(nextValue);
        if (imageOpacityValue) imageOpacityValue.textContent = String(nextValue);
        if (desktopOpacityRange) desktopOpacityRange.value = String(nextValue);
        if (desktopOpacityValue) desktopOpacityValue.textContent = `${nextValue}%`;
        if (opacityBtn) {
            opacityBtn.title = `Opacidade: ${nextValue}%`;
            opacityBtn.setAttribute('aria-label', `Opacidade: ${nextValue}%`);
            opacityBtn.classList.toggle('active', nextValue < 100);
        }

        if (shouldApply) {
            this.updateImageOpacity(nextValue / 100);
        }
    },

    openQuickOpacityPopover() {
        const anchor = document.getElementById('quick-opacity-anchor');
        const btn = document.getElementById('quick-opacity-btn');
        const popover = document.getElementById('quick-opacity-popover');
        if (!anchor || !btn || !popover || anchor.classList.contains('hidden')) return;

        if (this.selectedElement && this.selectedElement.type === 'image') {
            this.applyQuickOpacityValue(Math.round((this.selectedElement.opacity ?? 1) * 100), false);
        }

        popover.classList.add('is-open');
        popover.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        this.editorState = this.editorState || {};
        this.editorState.quickOpacityOpen = true;
    },

    closeQuickOpacityPopover() {
        const btn = document.getElementById('quick-opacity-btn');
        const popover = document.getElementById('quick-opacity-popover');
        if (popover) {
            popover.classList.remove('is-open');
            popover.setAttribute('aria-hidden', 'true');
        }
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
        }
        this.editorState = this.editorState || {};
        this.editorState.quickOpacityOpen = false;
    },

    toggleQuickOpacityPopover() {
        const anchor = document.getElementById('quick-opacity-anchor');
        const popover = document.getElementById('quick-opacity-popover');
        if (!anchor || !popover || anchor.classList.contains('hidden')) return;

        if (popover.classList.contains('is-open')) {
            this.closeQuickOpacityPopover();
        } else {
            this.openQuickOpacityPopover();
        }
    },

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
    },

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
    },
    
    updateShapeFill(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextFill = this.sanitizeColorValue(value, '#3b82f6');
            this.selectedElement.element.setAttribute('fill', nextFill);
            this.selectedElement.fill = nextFill;
            const desktopShapeFillColor = document.getElementById('desktop-shape-fill-color');
            if (desktopShapeFillColor) desktopShapeFillColor.value = nextFill;
            this.queueHistorySave();
        }
    },
    
    updateShapeStroke(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            const nextStroke = this.sanitizeColorValue(value, '#000000');
            this.selectedElement.element.setAttribute('stroke', nextStroke);
            this.selectedElement.stroke = nextStroke;
            const desktopShapeStrokeColor = document.getElementById('desktop-shape-stroke-color');
            if (desktopShapeStrokeColor) desktopShapeStrokeColor.value = nextStroke;
            this.queueHistorySave();
        }
    },
    
    updateShapeStrokeWidth(value) {
        if (this.selectedElement && this.selectedElement.type === 'shape') {
            this.selectedElement.element.setAttribute('stroke-width', value);
            this.selectedElement.strokeWidth = value;
            this.queueHistorySave();
        }
    },

    updateImageObjectFit(objectFit) {
        if (!this.selectedElement || this.selectedElement.type !== 'image') return;
        this.setImageObjectFitMode?.(this.selectedElement, objectFit);
        this.showResizeHandles(this.selectedElement);
        this.saveHistory();
        this.updatePropertiesPanel?.(this.selectedElement);
    },

    centerSelectedBoth() {
        if (!this.selectedElement) return;

        const bounds = this.getEditableBounds();
        const bbox = this.selectedElement.element.getBBox();
        const currentCenterX = bbox.x + (bbox.width / 2);
        const currentCenterY = bbox.y + (bbox.height / 2);
        const targetCenterX = bounds.x + (bounds.width / 2);
        const targetCenterY = bounds.y + (bounds.height / 2);

        const deltaX = targetCenterX - currentCenterX;
        const deltaY = targetCenterY - currentCenterY;

        this.offsetElementGeometry(this.selectedElement, deltaX, deltaY);
        this.applyElementRotation(this.selectedElement);
        this.showResizeHandles(this.selectedElement);
        this.updateLayers();
        this.saveHistory();
    },

    moveSelectedLayer(direction = 1) {
        if (!this.selectedElement) return;
        const selectedId = String(this.selectedElement.id);
        const currentIndex = this.elements.findIndex((el) => String(el.id) === selectedId);
        if (!Number.isInteger(currentIndex) || currentIndex < 0) return;

        const targetIndex = currentIndex + Number(direction || 0);
        if (targetIndex < 0 || targetIndex >= this.elements.length) return;

        this.moveLayer(currentIndex, direction);
        this.selectElementById(selectedId);
    },

    syncExpandedPropertiesControls(elementData) {
        const hasSelection = Boolean(elementData);
        const isText = hasSelection && elementData.type === 'text';
        const isImage = hasSelection && elementData.type === 'image';
        const isImageWithFit = isImage && elementData.imageKind !== 'qr';
        const isShape = hasSelection && elementData.type === 'shape';

        const setDisabled = (id, disabled) => {
            const button = document.getElementById(id);
            if (!button) return;
            button.disabled = disabled;
            button.classList.toggle('is-disabled', disabled);
            button.setAttribute('aria-disabled', String(disabled));
        };

        const setActive = (id, active) => {
            const button = document.getElementById(id);
            if (!button) return;
            button.classList.toggle('active', Boolean(active));
            button.setAttribute('aria-pressed', String(Boolean(active)));
        };

        ['move-layer-up-btn', 'move-layer-down-btn', 'nudge-up-btn', 'nudge-left-btn', 'nudge-right-btn', 'nudge-down-btn', 'center-both-btn']
            .forEach((id) => setDisabled(id, !hasSelection));

        ['prop-text-bold', 'prop-text-italic', 'prop-text-underline', 'prop-text-caps']
            .forEach((id) => setDisabled(id, !isText));
        ['desktop-text-color'].forEach((id) => setDisabled(id, !isText));

        ['prop-image-fit-contain', 'prop-image-fit-cover', 'prop-image-fit-fill']
            .forEach((id) => setDisabled(id, !isImage));
        ['desktop-image-fit-contain', 'desktop-image-fit-cover', 'desktop-image-fit-fill']
            .forEach((id) => setDisabled(id, !isImageWithFit));
        ['desktop-opacity-range']
            .forEach((id) => setDisabled(id, !isImage));
        ['desktop-shape-fill-color', 'desktop-shape-stroke-color']
            .forEach((id) => setDisabled(id, !isShape));

        setActive('prop-text-bold', isText && Boolean(elementData.bold));
        setActive('prop-text-italic', isText && Boolean(elementData.italic));
        setActive('prop-text-underline', isText && Boolean(elementData.underline));
        setActive('prop-text-caps', isText && Boolean(elementData.capsLock));

        const imageFit = isImage ? (this.getImageObjectFitMode?.(elementData) || 'contain') : null;
        setActive('prop-image-fit-contain', isImage && imageFit === 'contain');
        setActive('prop-image-fit-cover', isImage && imageFit === 'cover');
        setActive('prop-image-fit-fill', isImage && imageFit === 'fill');
        setActive('desktop-image-fit-contain', isImageWithFit && imageFit === 'contain');
        setActive('desktop-image-fit-cover', isImageWithFit && imageFit === 'cover');
        setActive('desktop-image-fit-fill', isImageWithFit && imageFit === 'fill');
    },
    
    // ===== DELETE =====
    deleteSelected() {
        if (this.selectedElement) {
            this.selectedElement.element.remove();
            this.elements = this.elements.filter(el => el.id !== this.selectedElement.id);
            this.clearSelection();
            this.updateLayers();
            this.saveHistory();
        }
    },

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
        } else if (clonedData.type === 'image' || (clonedData.type === 'shape' && this.isRectLikeShapeType?.(clonedData.shapeType))) {
            const x = parseFloat(clone.getAttribute('x') || '0') + offset;
            const y = parseFloat(clone.getAttribute('y') || '0') + offset;
            clone.setAttribute('x', x);
            clone.setAttribute('y', y);
        } else if (clonedData.type === 'shape' && clonedData.shapeType === 'circle') {
            const cx = parseFloat(clone.getAttribute('cx') || '0') + offset;
            const cy = parseFloat(clone.getAttribute('cy') || '0') + offset;
            clone.setAttribute('cx', cx);
            clone.setAttribute('cy', cy);
        } else if (clonedData.type === 'shape' && this.isPolygonShapeType?.(clonedData.shapeType)) {
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
    },

    centerSelected(axis) {
        if (!this.selectedElement) return;

        const bounds = this.getEditableBounds();
        const bbox = this.selectedElement.element.getBBox();
        const currentCenterX = bbox.x + (bbox.width / 2);
        const currentCenterY = bbox.y + (bbox.height / 2);
        const targetCenterX = bounds.x + (bounds.width / 2);
        const targetCenterY = bounds.y + (bounds.height / 2);

        const deltaX = axis === 'horizontal' ? (targetCenterX - currentCenterX) : 0;
        const deltaY = axis === 'vertical' ? (targetCenterY - currentCenterY) : 0;

        this.offsetElementGeometry(this.selectedElement, deltaX, deltaY);
        this.applyElementRotation(this.selectedElement);

        this.showResizeHandles(this.selectedElement);
        this.updateLayers();
        this.saveHistory();
    },

    nudgeSelected(dx, dy) {
        if (!this.selectedElement) return;

        this.moveElementBy(this.selectedElement, dx, dy);

        this.showResizeHandles(this.selectedElement);
        this.saveHistory();
    },

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
    },

    syncKeepAspectControls() {
        const active = Boolean(this.keepAspectRatio);
        const buttons = [
            document.getElementById('keep-aspect-ratio'),
            document.getElementById('quick-keep-aspect-btn'),
            document.getElementById('top-keep-aspect-btn')
        ].filter(Boolean);

        buttons.forEach((button) => {
            const shouldShowActive = active && !button.disabled;
            button.classList.toggle('active', shouldShowActive);
            button.setAttribute('aria-pressed', String(shouldShowActive));
        });
    },

    updateDesktopFloatingToolbarPosition() {
        const isDesktop = !window.matchMedia('(max-width: 767px)').matches;
        if (!isDesktop) return;

        const sidebarRight = document.getElementById('editor-sidebar-right');
        const editorBodyLayout = document.getElementById('editor-body-layout');
        const stage = this.canvasStage || document.getElementById('canvas-stage');
        const canvas = this.canvas || document.getElementById('design-canvas');
        if (!sidebarRight || !editorBodyLayout || !stage) return;

        const layoutRect = editorBodyLayout.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const canvasRect = canvas?.getBoundingClientRect?.();
        const referenceRect = canvasRect && canvasRect.width > 0 ? canvasRect : stageRect;
        const centerX = referenceRect.left + (referenceRect.width / 2);
        const relativeLeft = centerX - layoutRect.left;

        sidebarRight.style.left = `${relativeLeft}px`;
    },

    updateContextualToolbar(elementData) {
        const toolbar = document.getElementById('element-quick-toolbar');
        if (!toolbar) return;
        const floatingBar = document.getElementById('editor-floating-context-bar');
        const bottomBar = document.getElementById('editor-bottom-context-bar');
        const topFontGroup = document.getElementById('top-font-group');
        const topDeleteBtn = document.getElementById('top-delete-btn');
        const topDuplicateBtn = document.getElementById('top-duplicate-btn');
        const topCenterHBtn = document.getElementById('top-center-h-btn');
        const topCenterVBtn = document.getElementById('top-center-v-btn');
        const topKeepAspectBtn = document.getElementById('top-keep-aspect-btn');
        const topMoreBtn = document.getElementById('top-more-btn');
        const panelDeleteBtn = document.getElementById('delete-element-btn');
        const panelDuplicateBtn = document.getElementById('duplicate-element-btn');
        const panelCenterHBtn = document.getElementById('center-h-btn');
        const panelCenterVBtn = document.getElementById('center-v-btn');
        const panelKeepAspectBtn = document.getElementById('keep-aspect-ratio');
        const desktopCommonActions = document.getElementById('desktop-common-actions');
        const desktopSelectionToolbar = document.getElementById('desktop-selection-toolbar');
        const desktopTextGroup = document.getElementById('desktop-text-group');
        const desktopShapeGroup = document.getElementById('desktop-shape-group');
        const desktopImageGroup = document.getElementById('desktop-image-group');
        const desktopImageFitGroup = document.getElementById('desktop-image-fit-group');
        const sidebarRight = document.getElementById('editor-sidebar-right');

        this.editorState = this.editorState || {};
        this.editorState.selectionType = elementData?.type || null;

        const duplicateBtn = document.getElementById('quick-duplicate-btn');
        const centerHBtn = document.getElementById('quick-center-h-btn');
        const centerVBtn = document.getElementById('quick-center-v-btn');
        const keepAspectBtn = document.getElementById('quick-keep-aspect-btn');
        const fontAnchor = document.getElementById('quick-font-anchor');
        const fontBtn = document.getElementById('quick-font-btn');
        const fontPopover = document.getElementById('quick-font-popover');
        const opacityAnchor = document.getElementById('quick-opacity-anchor');
        const opacityBtn = document.getElementById('quick-opacity-btn');
        const opacityRange = document.getElementById('quick-opacity-range');
        const opacityValue = document.getElementById('quick-opacity-value');
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const hasSelection = Boolean(elementData);
        const isText = hasSelection && elementData.type === 'text';
        const isShape = hasSelection && elementData.type === 'shape';
        const isImage = hasSelection && elementData.type === 'image';
        const isImageWithFit = isImage && elementData.imageKind !== 'qr';
        const opacityPercent = isImage ? Math.round((elementData.opacity ?? 1) * 100) : 100;

        this.syncExpandedPropertiesControls?.(elementData);

        const setDisabledState = (button, disabled) => {
            if (!button) return;
            button.disabled = disabled;
            button.classList.toggle('is-disabled', disabled);
            button.setAttribute('aria-disabled', String(disabled));
        };

        const setHiddenState = (item, hidden) => {
            if (!item) return;
            item.classList.toggle('hidden', hidden);
        };

        if (isMobile) {
            if (sidebarRight) {
                sidebarRight.classList.remove('toolbar-visible');
                sidebarRight.removeAttribute('aria-hidden');
                sidebarRight.style.left = '';
            }
            if (floatingBar) floatingBar.classList.toggle('hidden', !hasSelection);
            if (bottomBar) bottomBar.classList.add('hidden');
            toolbar.classList.add('hidden');
            setHiddenState(topFontGroup, true);
            setHiddenState(desktopSelectionToolbar, true);
            setHiddenState(desktopTextGroup, true);
            setHiddenState(desktopShapeGroup, true);
            setHiddenState(desktopImageGroup, true);
            setHiddenState(desktopCommonActions, true);
            setHiddenState(desktopImageFitGroup, true);

            setHiddenState(duplicateBtn, false);
            setHiddenState(centerHBtn, false);
            setHiddenState(centerVBtn, false);
            setHiddenState(keepAspectBtn, false);
            setHiddenState(fontAnchor, true);
            setHiddenState(fontBtn, true);
            setHiddenState(fontPopover, true);
            setHiddenState(opacityAnchor, true);

            setDisabledState(document.getElementById('quick-delete-btn'), !hasSelection);
            setDisabledState(duplicateBtn, !hasSelection);
            setDisabledState(centerHBtn, !hasSelection);
            setDisabledState(centerVBtn, !hasSelection);
            setDisabledState(keepAspectBtn, !hasSelection);
            setDisabledState(fontBtn, !isText);
            setDisabledState(opacityBtn, !isImage);
            setDisabledState(topDeleteBtn, !hasSelection);
            setDisabledState(topDuplicateBtn, !hasSelection);
            setDisabledState(topCenterHBtn, !hasSelection);
            setDisabledState(topCenterVBtn, !hasSelection);
            setDisabledState(topKeepAspectBtn, !hasSelection);
            setDisabledState(topMoreBtn, !hasSelection);
            setDisabledState(panelDeleteBtn, !hasSelection);
            setDisabledState(panelDuplicateBtn, !hasSelection);
            setDisabledState(panelCenterHBtn, !hasSelection);
            setDisabledState(panelCenterVBtn, !hasSelection);
            setDisabledState(panelKeepAspectBtn, !hasSelection);
            if (topMoreBtn) {
                const mobileDetailsOpen = Boolean(document.getElementById('editor-sidebar-right')?.classList.contains('panel-open'));
                topMoreBtn.classList.toggle('active', hasSelection && mobileDetailsOpen);
                topMoreBtn.setAttribute('aria-expanded', String(hasSelection && mobileDetailsOpen));
            }

            if (fontBtn) {
                fontBtn.classList.remove('active');
                fontBtn.setAttribute('aria-expanded', 'false');
            }
            if (opacityBtn) {
                opacityBtn.classList.remove('active');
                opacityBtn.setAttribute('aria-expanded', 'false');
            }

            if (isImage) {
                this.applyQuickOpacityValue(opacityPercent, false);
            } else {
                if (opacityRange) opacityRange.value = '100';
                if (opacityValue) opacityValue.textContent = '100%';
            }

            if (isText) {
                this.renderQuickFontPopover();
            } else {
                this.renderQuickFontPopover();
            }
            this.closeQuickOpacityPopover();
            this.closeQuickFontPopover();

            if (!hasSelection && keepAspectBtn) {
                keepAspectBtn.classList.remove('active');
                keepAspectBtn.setAttribute('aria-pressed', 'false');
            }

            this.editorState.quickFontOpen = Boolean(isText && fontPopover?.classList.contains('is-open'));
            this.editorState.quickOpacityOpen = Boolean(isImage && opacityBtn?.getAttribute('aria-expanded') === 'true');
            this.syncKeepAspectControls();
            return;
        }

        if (floatingBar) floatingBar.classList.add('hidden');
        if (bottomBar) bottomBar.classList.add('hidden');
        toolbar.classList.add('hidden');
        this.updateDesktopFloatingToolbarPosition?.();
        if (sidebarRight) {
            sidebarRight.classList.toggle('toolbar-visible', hasSelection);
            sidebarRight.setAttribute('aria-hidden', String(!hasSelection));
        }
        setHiddenState(topFontGroup, true);
        setHiddenState(desktopCommonActions, !hasSelection);
        setHiddenState(desktopSelectionToolbar, !hasSelection);
        setHiddenState(desktopTextGroup, !isText);
        setHiddenState(desktopShapeGroup, !isShape);
        setHiddenState(desktopImageGroup, !isImage);
        setHiddenState(desktopImageFitGroup, !isImageWithFit);

        if (!hasSelection) {
            this.closeQuickOpacityPopover();
            this.closeQuickFontPopover();
            this.editorState.quickFontOpen = false;
            this.editorState.quickOpacityOpen = false;
            setDisabledState(topDeleteBtn, true);
            setDisabledState(topDuplicateBtn, true);
            setDisabledState(topCenterHBtn, true);
            setDisabledState(topCenterVBtn, true);
            setDisabledState(topKeepAspectBtn, true);
            setDisabledState(topMoreBtn, true);
            setDisabledState(panelDeleteBtn, true);
            setDisabledState(panelDuplicateBtn, true);
            setDisabledState(panelCenterHBtn, true);
            setDisabledState(panelCenterVBtn, true);
            setDisabledState(panelKeepAspectBtn, false);
            this.applyQuickOpacityValue(100, false);
            if (topMoreBtn) {
                topMoreBtn.classList.remove('active');
                topMoreBtn.setAttribute('aria-expanded', 'false');
            }
            this.syncKeepAspectControls();
            return;
        }

        setDisabledState(document.getElementById('quick-delete-btn'), true);
        setDisabledState(duplicateBtn, true);
        setDisabledState(centerHBtn, true);
        setDisabledState(centerVBtn, true);
        setDisabledState(keepAspectBtn, true);
        setDisabledState(topDeleteBtn, false);
        setDisabledState(topDuplicateBtn, false);
        setDisabledState(topCenterHBtn, false);
        setDisabledState(topCenterVBtn, false);
        setDisabledState(topKeepAspectBtn, false);
        setDisabledState(topMoreBtn, true);
        setDisabledState(panelDeleteBtn, false);
        setDisabledState(panelDuplicateBtn, false);
        setDisabledState(panelCenterHBtn, false);
        setDisabledState(panelCenterVBtn, false);
        setDisabledState(panelKeepAspectBtn, false);
        if (topMoreBtn) {
            topMoreBtn.classList.remove('active');
            topMoreBtn.setAttribute('aria-expanded', 'false');
        }

        if (isImage) {
            this.applyQuickOpacityValue(opacityPercent, false);
        }
        if (isText) {
            this.renderQuickFontPopover();
        }

        if (fontBtn) {
            setHiddenState(fontAnchor, true);
            setHiddenState(fontBtn, true);
            setHiddenState(fontPopover, true);
            setDisabledState(fontBtn, true);
            fontBtn.classList.remove('active');
            fontBtn.setAttribute('aria-expanded', 'false');
        }

        if (opacityAnchor) {
            setHiddenState(opacityAnchor, true);
        }
        if (opacityBtn) {
            setDisabledState(opacityBtn, true);
            opacityBtn.classList.remove('active');
            opacityBtn.setAttribute('aria-expanded', 'false');
        }
        this.closeQuickOpacityPopover();
        this.closeQuickFontPopover();

        this.syncKeepAspectControls();
    },

    getLayerBaseLabel(elementData) {
        if (!elementData) return 'Camada';

        if (elementData.type === 'text') return 'Texto';
        if (elementData.type === 'image') {
            return elementData.imageKind === 'qr' ? 'QR Code' : 'Imagem';
        }

        if (elementData.type === 'shape') {
            const shapeType = String(elementData.shapeType || '').toLowerCase();
            const shapeLabels = {
                rectangle: 'Quadrado',
                rounded: 'Quadrado',
                pill: 'Quadrado',
                circle: 'Circulo',
                triangle: 'Triangulo',
                diamond: 'Losango',
                line: 'Linha',
                star: 'Estrela',
                hexagon: 'Hexagono',
                arrow: 'Seta',
                path: 'Forma'
            };

            return shapeLabels[shapeType] || 'Forma';
        }

        return 'Camada';
    },
    
    // ===== LAYERS =====
    updateLayers() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        const previousScrollTop = layersList.scrollTop;
        const previousScrollLeft = layersList.scrollLeft;
        
        if (this.elements.length === 0) {
            layersList.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Nenhuma camada ainda</p>';
            return;
        }

        const selectedId = this.selectedElement ? String(this.selectedElement.id) : null;
        const labelCounters = new Map();

        const getLayerLabel = (elementData) => {
            const baseLabel = this.getLayerBaseLabel(elementData);
            const key = baseLabel.toLowerCase();
            const nextCount = (labelCounters.get(key) || 0) + 1;
            labelCounters.set(key, nextCount);
            return `${baseLabel} ${nextCount}`;
        };
        
        layersList.innerHTML = this.elements.map((el, index) => `
            <div class="layer-item p-3 border rounded-lg mb-2 hover:bg-gray-50 cursor-pointer ${selectedId === String(el.id) ? 'bg-blue-50 border-blue-600' : ''}"
                 data-layer-index="${index}"
                 data-layer-id="${String(el.id)}"
                 draggable="true">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${el.type === 'text' ? 'type' : el.type === 'image' ? (el.imageKind === 'qr' ? 'qr-code' : 'image') : 'square'}" class="w-4 h-4"></i>
                        <span class="text-sm font-semibold">${getLayerLabel(el)}</span>
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
        layersList.scrollTop = previousScrollTop;
        layersList.scrollLeft = previousScrollLeft;
    },
    
    selectElementByIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.elements.length) return;
        this.selectElement(this.elements[index]);
    },

    selectElementById(layerId) {
        const targetId = String(layerId || '');
        if (!targetId) return;
        const elementData = this.elements.find((el) => String(el.id) === targetId);
        if (!elementData) return;
        this.selectElement(elementData);
    },

    syncCanvasOrderFromLayers() {
        this.elements.forEach((elementData) => {
            if (elementData?.element && elementData.element.parentNode === this.canvas) {
                this.canvas.appendChild(elementData.element);
            }
        });
        this.bringPrintAreaOverlaysToFront();
    },

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
    },
    
    moveLayer(index, direction) {
        const newIndex = index + direction;
        this.moveLayerToIndex(index, newIndex);
    },
    
    // ===== ZOOM =====
    syncCanvasViewport() {
        if (!this.canvasStage || !this.canvasWrapper) return;

        const stageRect = this.canvasStage.getBoundingClientRect();
        const stageWidth = Number(stageRect?.width) || this.canvasStage.clientWidth || 0;
        const stageHeight = Number(stageRect?.height) || this.canvasStage.clientHeight || 0;
        const stageStyle = window.getComputedStyle(this.canvasStage);
        const paddingX = (parseFloat(stageStyle.paddingLeft) || 0) + (parseFloat(stageStyle.paddingRight) || 0);
        const paddingY = (parseFloat(stageStyle.paddingTop) || 0) + (parseFloat(stageStyle.paddingBottom) || 0);
        const availableWidth = Math.max(0, stageWidth - paddingX);
        const availableHeight = Math.max(0, stageHeight - paddingY);

        if (!availableWidth || !availableHeight) {
            if (!this.initialCanvasSize) {
                this.initialCanvasSize = {
                    width: Math.max(1, stageWidth || Number(this.baseCanvasSize?.width) || 800),
                    height: Math.max(1, stageHeight || Number(this.baseCanvasSize?.height) || 600)
                };
            }

            const fallbackWidth = this.initialCanvasSize.width * this.zoom;
            const fallbackHeight = this.initialCanvasSize.height * this.zoom;
            this.syncCanvasWrapperToStage?.(fallbackWidth, fallbackHeight);
            if (this.selectedElement) {
                this.requestHandlesRefresh?.();
            }
            this.updateDesktopFloatingToolbarPosition?.();
            return;
        }

        const needsResizeRecalc = (
            !this.initialCanvasSize ||
            this._lastViewportStageWidth !== stageWidth ||
            this._lastViewportStageHeight !== stageHeight
        );

        if (needsResizeRecalc) {
            this.initialCanvasSize = {
                width: Math.max(1, availableWidth),
                height: Math.max(1, availableHeight)
            };
            this._lastViewportStageWidth = stageWidth;
            this._lastViewportStageHeight = stageHeight;
        }

        // Apply zoom to base size
        const scaledWidth = this.initialCanvasSize.width * this.zoom;
        const scaledHeight = this.initialCanvasSize.height * this.zoom;

        this.syncCanvasWrapperToStage?.(scaledWidth, scaledHeight);
        this.syncWorkspaceBounds?.();

        if (
            this._loadedSvgTemplateContent &&
            this._templateLayoutNeedsReflow &&
            !this._isReflowingSvgTemplate
        ) {
            this._isReflowingSvgTemplate = true;
            this._templateLayoutNeedsReflow = false;
            this.loadSVGTemplate(this._loadedSvgTemplateContent, { skipViewportReflow: true });
            this._isReflowingSvgTemplate = false;
        }

        if (this.selectedElement) {
            this.requestHandlesRefresh?.();
        }
        this.updateDesktopFloatingToolbarPosition?.();
    },

    setZoom(newZoom, options = {}) {
        const nextZoom = Math.max(0.5, Math.min(2, Number(newZoom) || (Number(this.zoom) || 1)));
        const hasAnchor = Number.isFinite(Number(options?.clientX)) && Number.isFinite(Number(options?.clientY));

        let anchorData = null;
        if (hasAnchor && this.canvasStage) {
            const stageRect = this.canvasStage.getBoundingClientRect();
            const wrapperWidth = Math.max(1, parseFloat(this.canvasWrapper?.style?.width || '') || this.canvasWrapper?.clientWidth || 1);
            const wrapperHeight = Math.max(1, parseFloat(this.canvasWrapper?.style?.height || '') || this.canvasWrapper?.clientHeight || 1);
            const offsetX = Number(this.cameraOffset?.x) || 0;
            const offsetY = Number(this.cameraOffset?.y) || 0;
            const stageLocalX = Number(options.clientX) - stageRect.left;
            const stageLocalY = Number(options.clientY) - stageRect.top;
            const wrapperStartX = ((stageRect.width - wrapperWidth) / 2) + offsetX;
            const wrapperStartY = ((stageRect.height - wrapperHeight) / 2) + offsetY;
            anchorData = {
                stageRect,
                stageLocalX,
                stageLocalY,
                ratioX: (stageLocalX - wrapperStartX) / wrapperWidth,
                ratioY: (stageLocalY - wrapperStartY) / wrapperHeight
            };
        }

        this.zoom = nextZoom;
        this.syncCanvasViewport();

        if (anchorData && this.canvasStage) {
            const nextWrapperWidth = Math.max(1, parseFloat(this.canvasWrapper?.style?.width || '') || this.canvasWrapper?.clientWidth || 1);
            const nextWrapperHeight = Math.max(1, parseFloat(this.canvasWrapper?.style?.height || '') || this.canvasWrapper?.clientHeight || 1);
            const nextOffsetX = anchorData.stageLocalX
                - ((anchorData.stageRect.width - nextWrapperWidth) / 2)
                - (anchorData.ratioX * nextWrapperWidth);
            const nextOffsetY = anchorData.stageLocalY
                - ((anchorData.stageRect.height - nextWrapperHeight) / 2)
                - (anchorData.ratioY * nextWrapperHeight);
            this.setCameraOffset?.(nextOffsetX, nextOffsetY, { refreshHandles: Boolean(this.selectedElement) });
        }

        document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
        if (this.selectedElement) {
            this.requestHandlesRefresh?.();
        }
    },

    getHistorySnapshot() {
        this.elements.forEach((elementData) => this.syncElementMetadata(elementData));

        const serializableElements = this.elements
            .map((elementData) => {
                if (!elementData?.element || typeof elementData.element.outerHTML !== 'string') {
                    return null;
                }

                return {
                    id: String(elementData.id),
                    markup: elementData.element.outerHTML
                };
            })
            .filter(Boolean);

        return JSON.stringify({
            selectedElementId: this.selectedElement ? String(this.selectedElement.id) : null,
            elements: serializableElements
        });
    },

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
    },

    flushPendingHistorySave() {
        if (this.historyCommitTimer === null) {
            return;
        }

        clearTimeout(this.historyCommitTimer);
        this.historyCommitTimer = null;
        this.saveHistory();
    },

    beginHistoryGesture() {
        if (this.activeHistoryGestureSnapshot !== null) {
            return;
        }

        this.flushPendingHistorySave();
        this.activeHistoryGestureSnapshot = this.getHistorySnapshot();
    },

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
    },

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
    },
    
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
    },
    
    undo() {
        this.flushPendingHistorySave();
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        } else {
            this.updateHistoryButtons();
        }
    },
    
    redo() {
        this.flushPendingHistorySave();
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        } else {
            this.updateHistoryButtons();
        }
    },
    
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
            console.error('Erro ao restaurar hist├│rico:', error);
        } finally {
            this.isRestoringHistory = false;
            this.updateHistoryButtons();
        }
    },
    
    // ===== AUTO SAVE =====
    setupAutoSave() {
        setInterval(() => {
            if (this.elements.length > 0) {
                this.autoSave();
            }
        }, 5000);
    },
    
    autoSave() {
        const saveKeys = [this.getAutosaveKey(), ...this.getLegacyAutosaveKeys()];
        const svgDesign = this.getDesignSVG();
        const payload = {
            format: 'elements-v1',
            productId: this.productId || null,
            selectedBaseId: this.selectedBaseId || null,
            elements: this.elements.map((elementData) => {
                const { element, ...serializable } = elementData || {};
                return serializable;
            })
        };
        const compactDesign = JSON.stringify(payload);

        const candidates = svgDesign && svgDesign.length <= 180000
            ? [svgDesign, compactDesign]
            : [compactDesign, svgDesign];

        let stored = false;
        for (const value of candidates) {
            if (!value) continue;

            try {
                saveKeys.forEach((key) => {
                    localStorage.setItem(key, value);
                });
                stored = true;
                break;
            } catch (error) {
                if (error && error.name !== 'QuotaExceededError') {
                    console.warn('Falha ao gravar autosave:', error);
                }
            }
        }

        if (!stored) {
            console.warn('Autosave indisponivel: armazenamento cheio.');
        }
    },

    // ===== CROP FUNCTIONALITY =====

});
