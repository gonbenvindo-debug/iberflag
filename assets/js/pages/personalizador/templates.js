// ============================================================
// TEMPLATE SYSTEM MODULE - IberFlag
// ============================================================
Object.assign(DesignEditor.prototype, {

    // ===== TEMPLATE MODAL =====
    openTemplateModal() {
        const modal = document.getElementById('templates-modal');
        if (!modal) {
            this.createTemplateModal();
        }
        this.renderTemplateGallery();
        document.getElementById('templates-modal').classList.add('is-open');
        document.body.style.overflow = 'hidden';
    },

    closeTemplateModal() {
        const modal = document.getElementById('templates-modal');
        if (modal) {
            modal.classList.remove('is-open');
        }
        document.body.style.overflow = '';
    },

    createTemplateModal() {
        const modalHTML = `
            <div id="templates-modal" class="templates-modal" aria-hidden="true" role="dialog" aria-modal="true" inert>
                <div class="templates-panel">
                    <div class="templates-header">
                        <h2>Galeria de Templates</h2>
                        <button class="templates-close" id="templates-close-btn" aria-label="Fechar">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <div class="templates-body">
                        <div class="templates-sidebar">
                            <div class="templates-search">
                                <i data-lucide="search" class="w-4 h-4"></i>
                                <input type="text" id="template-search" placeholder="Pesquisar templates...">
                            </div>
                            <div class="templates-categories" id="template-categories">
                                <!-- Categorias renderizadas via JS -->
                            </div>
                        </div>
                        <div class="templates-content">
                            <div class="templates-grid" id="templates-grid">
                                <!-- Templates renderizados via JS -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHTML;
        document.body.appendChild(wrapper.firstElementChild);

        // Setup event listeners
        document.getElementById('templates-close-btn').addEventListener('click', () => this.closeTemplateModal());
        document.getElementById('templates-modal').addEventListener('click', (e) => {
            if (e.target.id === 'templates-modal') this.closeTemplateModal();
        });

        document.getElementById('template-search').addEventListener('input', (e) => {
            this.filterTemplates(e.target.value);
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeTemplateModal();
        });
    },

    renderTemplateGallery(categoryId = null, searchQuery = '') {
        const categoriesContainer = document.getElementById('template-categories');
        const gridContainer = document.getElementById('templates-grid');

        if (!categoriesContainer || !gridContainer) return;

        // Mostrar loading state
        gridContainer.innerHTML = `
            <div class="templates-loading">
                <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                <p>A carregar templates...</p>
            </div>
        `;

        // Usar requestAnimationFrame para não bloquear a UI
        requestAnimationFrame(() => {
            // Render categories
            const categories = window.DesignTemplates?.categories || [];
            categoriesContainer.innerHTML = `
                <button class="template-category ${!categoryId ? 'active' : ''}" data-category="all">
                    <i data-lucide="layout-grid" class="w-4 h-4"></i>
                    <span>Todos</span>
                </button>
                ${categories.map(cat => `
                    <button class="template-category ${categoryId === cat.id ? 'active' : ''}" data-category="${cat.id}">
                        <i data-lucide="${cat.icon}" class="w-4 h-4"></i>
                        <span>${cat.name}</span>
                    </button>
                `).join('')}
            `;

            // Setup category listeners
            categoriesContainer.querySelectorAll('.template-category').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cat = btn.dataset.category;
                    categoriesContainer.querySelectorAll('.template-category').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.renderTemplateGallery(cat === 'all' ? null : cat, searchQuery);
                });
            });

            // Get templates to show
            let templates = [];
            if (searchQuery) {
                templates = window.DesignTemplates?.search?.(searchQuery) || [];
            } else if (categoryId) {
                templates = window.DesignTemplates?.getByCategory?.(categoryId) || [];
            } else {
                templates = window.DesignTemplates?.templates || [];
            }

            // Render templates
            if (templates.length === 0) {
                gridContainer.innerHTML = `
                    <div class="templates-empty">
                        <i data-lucide="image-off" class="w-12 h-12"></i>
                        <p>Nenhum template encontrado</p>
                    </div>
                `;
            } else {
                // Renderizar com lazy loading nas imagens
                gridContainer.innerHTML = templates.map(template => `
                    <div class="template-card" data-template-id="${template.id}">
                        <div class="template-thumbnail">
                            <img src="${template.thumbnail}" alt="${template.name}" loading="lazy">
                        </div>
                        <div class="template-info">
                            <h4>${template.name}</h4>
                            <p>${template.description || ''}</p>
                        </div>
                        <button class="template-use-btn" data-template-id="${template.id}">
                            <i data-lucide="check" class="w-4 h-4"></i>
                            Usar
                        </button>
                    </div>
                `).join('');

                // Setup template listeners
                gridContainer.querySelectorAll('.template-use-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const templateId = btn.dataset.templateId;
                        this.loadTemplate(templateId);
                        this.closeTemplateModal();
                    });
                });

                gridContainer.querySelectorAll('.template-card').forEach(card => {
                    card.addEventListener('dblclick', () => {
                        const templateId = card.dataset.templateId;
                        this.loadTemplate(templateId);
                        this.closeTemplateModal();
                    });
                });
            }

            if (window.lucide) {
                window.lucide.createIcons();
            }
        });
    },

    generateTemplatePreview(template) {
        // Generate a simple SVG preview based on template elements
        const elements = template.elements || [];
        const shapes = elements.filter(e => e.type === 'shape').slice(0, 5);
        const texts = elements.filter(e => e.type === 'text').slice(0, 2);

        let svgContent = '';

        // Add background
        const bg = elements.find(e => e.type === 'shape' && e.x === 50 && e.y === 50 && e.width >= 600);
        if (bg) {
            svgContent += `<rect x="0" y="0" width="100%" height="100%" fill="${bg.fill}" />`;
        }

        // Add shapes
        shapes.forEach(shape => {
            if (shape.shapeType === 'rectangle') {
                svgContent += `<rect x="${(shape.x / 800) * 100}%" y="${(shape.y / 600) * 100}%" width="${(shape.width / 800) * 100}%" height="${(shape.height / 600) * 100}%" fill="${shape.fill}" rx="2" />`;
            } else if (shape.shapeType === 'circle') {
                const r = Math.min(shape.width, shape.height) / 2;
                const cx = shape.x + r;
                const cy = shape.y + r;
                svgContent += `<circle cx="${(cx / 800) * 100}%" cy="${(cy / 600) * 100}%" r="${(r / 800) * 100}%" fill="${shape.fill}" />`;
            }
        });

        // Add text placeholders
        texts.forEach((text, i) => {
            const fontSize = Math.min(text.size / 2, 16);
            svgContent += `<text x="${(text.x / 800) * 100}%" y="${((text.y / 600) * 100) + (i * 10)}%" text-anchor="middle" font-size="${fontSize}" fill="${text.color}" font-family="${text.font}" font-weight="${text.bold ? 'bold' : 'normal'}">${text.content.substring(0, 15)}</text>`;
        });

        return `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
    },

    filterTemplates(query) {
        const activeCategory = document.querySelector('.template-category.active')?.dataset.category;
        const categoryId = activeCategory === 'all' ? null : activeCategory;
        this.renderTemplateGallery(categoryId, query);
    },

    // ===== LOAD TEMPLATE =====
    loadTemplate(templateId) {
        const template = window.DesignTemplates?.getById?.(templateId);
        if (!template) {
            showToast('Template não encontrado', 'error');
            return;
        }

        // Confirm if canvas has content
        if (this.elements.length > 0) {
            if (!confirm('O canvas atual será limpo. Deseja continuar?')) {
                return;
            }
        }

        const svgMarkup = window.DesignSvgStore?.extractTemplateSvg(template.elements || template.elementos, {
            width: this.baseCanvasSize?.width || 800,
            height: this.baseCanvasSize?.height || 600
        });

        if (svgMarkup && window.DesignSvgStore?.importSvgIntoEditor) {
            window.DesignSvgStore.importSvgIntoEditor(this, svgMarkup);
        } else {
            this.clearCanvas();
            const elements = template.elements || [];
            elements.forEach(elData => {
                this.createElementFromTemplate(elData);
            });
            this.saveHistory();
        }

        this.closeTemplateModal();
        showToast(`Template "${template.name}" carregado!`, 'success');
    },

    normalizeTemplateElement(data = {}) {
        const properties = data.properties || {};
        const normalizedType = data.type
            || (properties.text !== undefined || properties.fontFamily !== undefined ? 'text' : null)
            || (properties.shape !== undefined ? 'shape' : null)
            || (properties.src !== undefined ? 'image' : null)
            || (properties.content !== undefined ? 'qrcode' : null)
            || 'shape';

        const normalized = {
            ...data,
            type: normalizedType,
            x: Number(data.x ?? 0),
            y: Number(data.y ?? 0),
            width: Number(data.width ?? 0),
            height: Number(data.height ?? 0),
            rotation: Number(data.rotation ?? 0)
        };

        if (normalizedType === 'text') {
            normalized.content = data.content ?? properties.text ?? 'Texto';
            normalized.font = data.font ?? properties.fontFamily ?? 'Arial';
            normalized.size = Number(data.size ?? properties.fontSize ?? 24);
            normalized.color = data.color ?? properties.color ?? '#000000';
            normalized.bold = Boolean(data.bold ?? (String(properties.fontWeight || '').toLowerCase() === 'bold'));
            normalized.italic = Boolean(data.italic ?? (String(properties.fontStyle || '').toLowerCase() === 'italic'));
            normalized.textAnchor = data.textAnchor
                ?? (properties.textAlign === 'center' ? 'middle' : properties.textAlign === 'right' ? 'end' : 'start');
        }

        if (normalizedType === 'shape') {
            normalized.shapeType = data.shapeType ?? properties.shape ?? 'rectangle';
            normalized.fill = data.fill ?? properties.fill ?? '#3b82f6';
            normalized.stroke = data.stroke ?? properties.stroke ?? 'none';
            normalized.strokeWidth = Number(data.strokeWidth ?? properties.strokeWidth ?? 0);
        }

        if (normalizedType === 'image') {
            normalized.src = data.src ?? properties.src ?? '';
            normalized.name = data.name ?? properties.name ?? 'Imagem';
            normalized.imageKind = data.imageKind ?? properties.imageKind ?? 'image';
            normalized.opacity = Number(data.opacity ?? properties.opacity ?? 1);
            normalized.objectFit = data.objectFit ?? properties.objectFit ?? 'cover';
            normalized.borderRadius = Number(data.borderRadius ?? properties.borderRadius ?? 0);
            normalized.qrContent = data.qrContent ?? properties.qrContent ?? '';
            normalized.qrColor = data.qrColor ?? properties.qrColor ?? '#111827';
        }

        if (normalizedType === 'qrcode') {
            normalized.name = data.name ?? properties.name ?? 'QR Code';
            normalized.qrContent = data.qrContent ?? properties.content ?? '';
            normalized.qrColor = data.qrColor ?? properties.color ?? '#111827';
            normalized.bgColor = data.bgColor ?? properties.bgColor ?? '#ffffff';
            normalized.imageKind = 'qr';
        }

        return normalized;
    },

    createElementFromTemplate(data) {
        const normalized = this.normalizeTemplateElement(data);

        if (normalized.type === 'text') {
            this.addTextFromTemplate(normalized);
        } else if (normalized.type === 'shape') {
            this.addShapeFromTemplate(normalized);
        } else if (normalized.type === 'image') {
            this.addImageFromTemplate(normalized);
        } else if (normalized.type === 'qrcode') {
            this.addQrFromTemplate(normalized);
        }
    },

    addTextFromTemplate(data) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        textElement.setAttribute('id', id);
        textElement.setAttribute('x', data.x);
        textElement.setAttribute('y', data.y);
        textElement.setAttribute('font-family', data.font || 'Arial');
        textElement.setAttribute('font-size', data.size || 24);
        textElement.setAttribute('fill', data.color || '#000000');
        textElement.setAttribute('font-weight', data.bold ? 'bold' : 'normal');
        textElement.setAttribute('font-style', data.italic ? 'italic' : 'normal');
        textElement.setAttribute('text-anchor', data.textAnchor || 'start');
        textElement.setAttribute('data-element-id', id);
        textElement.textContent = data.content || 'Texto';

        // Apply rotation
        if (data.rotation) {
            textElement.setAttribute('transform', `rotate(${data.rotation} ${data.x} ${data.y})`);
        }

        this.canvas.appendChild(textElement);

        const elementData = this.buildElementDataFromNode(textElement);
        this.elements.push(elementData);
        this.makeElementInteractive(elementData);
        this.selectElement(elementData);
    },

    addShapeFromTemplate(data) {
        let shapeElement;
        const id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        if (data.shapeType === 'rectangle') {
            shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shapeElement.setAttribute('x', data.x);
            shapeElement.setAttribute('y', data.y);
            shapeElement.setAttribute('width', data.width);
            shapeElement.setAttribute('height', data.height);
        } else if (data.shapeType === 'circle') {
            shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            const r = Math.min(data.width, data.height) / 2;
            shapeElement.setAttribute('cx', data.x + r);
            shapeElement.setAttribute('cy', data.y + r);
            shapeElement.setAttribute('r', r);
        } else if (data.shapeType === 'triangle') {
            shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const cx = data.x + data.width / 2;
            const cy = data.y + data.height / 2;
            const w = data.width / 2;
            const h = data.height / 2;
            shapeElement.setAttribute('points', `${cx},${cy - h} ${cx - w},${cy + h} ${cx + w},${cy + h}`);
        }

        if (shapeElement) {
            shapeElement.setAttribute('id', id);
            shapeElement.setAttribute('fill', data.fill || '#3b82f6');
            shapeElement.setAttribute('stroke', data.stroke || 'none');
            shapeElement.setAttribute('stroke-width', data.strokeWidth || 0);
            shapeElement.setAttribute('data-element-id', id);

            if (data.rotation) {
                const cx = data.x + data.width / 2;
                const cy = data.y + data.height / 2;
                shapeElement.setAttribute('transform', `rotate(${data.rotation} ${cx} ${cy})`);
            }

            this.canvas.appendChild(shapeElement);

            const elementData = this.buildElementDataFromNode(shapeElement);
            this.elements.push(elementData);
            this.makeElementInteractive(elementData);
            this.selectElement(elementData);
        }
    },

    addImageFromTemplate(data) {
        const id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const imageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const src = data.src || (data.imageKind === 'qr' && data.qrContent ? this.generateQRCodeDataUrl(data.qrContent, data.qrColor || '#111827') : '');

        imageElement.setAttribute('id', id);
        imageElement.setAttribute('x', String(data.x || 0));
        imageElement.setAttribute('y', String(data.y || 0));
        imageElement.setAttribute('width', String(data.width || 120));
        imageElement.setAttribute('height', String(data.height || 120));
        imageElement.setAttribute('data-editable', 'true');
        imageElement.setAttribute('data-element-id', id);
        imageElement.setAttribute('href', src);
        imageElement.setAttribute('opacity', String(data.opacity ?? 1));
        imageElement.dataset.name = data.name || 'Imagem';
        imageElement.dataset.imageKind = data.imageKind || 'image';

        if (data.qrContent) {
            imageElement.dataset.qrContent = data.qrContent;
        }
        if (data.qrColor) {
            imageElement.dataset.qrColor = data.qrColor;
        }

        const objectFit = String(data.objectFit || 'cover').toLowerCase();
        imageElement.setAttribute(
            'preserveAspectRatio',
            objectFit === 'contain' ? 'xMidYMid meet' : objectFit === 'fill' ? 'none' : 'xMidYMid slice'
        );

        if (data.borderRadius) {
            imageElement.dataset.borderRadius = String(data.borderRadius);
        }

        if (data.rotation) {
            const cx = (Number(data.x) || 0) + (Number(data.width) || 0) / 2;
            const cy = (Number(data.y) || 0) + (Number(data.height) || 0) / 2;
            imageElement.setAttribute('transform', `rotate(${data.rotation} ${cx} ${cy})`);
        }

        this.canvas.appendChild(imageElement);
        this.bringPrintAreaOverlaysToFront();

        const elementData = this.buildElementDataFromNode(imageElement);
        this.elements.push(elementData);
        this.makeElementInteractive(elementData);
        this.selectElement(elementData);
    },

    addQrFromTemplate(data) {
        const qrDataUrl = this.generateQRCodeDataUrl(data.qrContent || '', data.qrColor || '#111827');
        this.addImageFromTemplate({
            ...data,
            type: 'image',
            imageKind: 'qr',
            src: qrDataUrl
        });
    },

    clearCanvas() {
        // Remove all elements except print area
        this.elements.forEach(el => {
            if (el.element && el.element.parentNode) {
                el.element.remove();
            }
        });
        this.canvas.querySelectorAll('defs').forEach((defsNode) => defsNode.remove());
        this.elements = [];
        this.selectedElement = null;
        this.hideResizeHandles();
        this.updateLayers();
        this.updateSidebarMode();
    }
});
