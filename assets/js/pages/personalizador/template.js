// ============================================================
// SVG TEMPLATE & PRINT AREA
// ============================================================
const DESIGN_SVG_DEBUG_PARAM = /(?:\?|&)debug(?:=1)?(?:&|$)/i;

function isDesignSvgDebugEnabled() {
    return Boolean(
        window.DESIGN_SVG_DEBUG
        || window.localStorage?.getItem('iberflag_design_debug') === '1'
        || (window.location && DESIGN_SVG_DEBUG_PARAM.test(window.location.search || ''))
    );
}

function logTemplateDebug(channel, details) {
    if (!isDesignSvgDebugEnabled()) {
        return;
    }

    const prefix = `[personalizador] ${channel}`;
    if (typeof console.groupCollapsed === 'function') {
        console.groupCollapsed(prefix);
        console.log(details);
        console.groupEnd();
        return;
    }

    console.log(prefix, details);
}

Object.assign(DesignEditor.prototype, {

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

        this.bringPrintAreaOverlaysToFront();
    },

    configureCanvasFromSourceBounds(sourceBounds) {
        const canvasWidth = Math.max(1, Math.round(Number(sourceBounds?.width) || 800));
        const canvasHeight = Math.max(1, Math.round(Number(sourceBounds?.height) || 600));

        this.printAreaBounds = {
            x: 0,
            y: 0,
            width: canvasWidth,
            height: canvasHeight
        };
    },

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
    },

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
    },

    upsertPrintAreaBackground(maskShapeNode, transform = '') {
        if (!this.canvas || !maskShapeNode) return;

        let printAreaBackground = this.canvas.querySelector('#print-area-background');
        if (!printAreaBackground) {
            printAreaBackground = document.importNode(maskShapeNode, true);
            printAreaBackground.setAttribute('id', 'print-area-background');
            printAreaBackground.setAttribute('pointer-events', 'none');
            if (this.canvas.firstChild) {
                this.canvas.insertBefore(printAreaBackground, this.canvas.firstChild);
            } else {
                this.canvas.appendChild(printAreaBackground);
            }
        }

        const refreshedBackground = document.importNode(maskShapeNode, true);
        Array.from(refreshedBackground.attributes).forEach((attribute) => {
            printAreaBackground.setAttribute(attribute.name, attribute.value);
        });

        while (printAreaBackground.firstChild) {
            printAreaBackground.removeChild(printAreaBackground.firstChild);
        }

        Array.from(refreshedBackground.childNodes).forEach((childNode) => {
            printAreaBackground.appendChild(childNode.cloneNode(true));
        });

        printAreaBackground.removeAttribute('stroke');
        printAreaBackground.removeAttribute('stroke-width');
        printAreaBackground.removeAttribute('stroke-dasharray');
        printAreaBackground.removeAttribute('opacity');
        printAreaBackground.setAttribute('fill', '#ffffff');
        if (transform) {
            printAreaBackground.setAttribute('transform', transform);
        } else {
            printAreaBackground.removeAttribute('transform');
        }
        printAreaBackground.setAttribute('pointer-events', 'none');

        if (this.canvas.firstChild !== printAreaBackground) {
            this.canvas.insertBefore(printAreaBackground, this.canvas.firstChild);
        }
    },

    updatePrintAreaFromElement(areaElement, sourceBounds) {
        this.setDefaultPrintArea();

        if (!areaElement || !sourceBounds || !sourceBounds.width || !sourceBounds.height) {
            logTemplateDebug('updatePrintAreaFromElement:invalid-input', {
                hasAreaElement: Boolean(areaElement),
                sourceBounds
            });
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

        logTemplateDebug('print-area-geometry', {
            sourceBounds,
            contentBounds,
            uniformScale,
            renderedWidth,
            renderedHeight,
            offsetX,
            offsetY,
            areaElement: {
                tag: String(areaElement.tagName || '').toLowerCase(),
                id: areaElement.getAttribute?.('id') || '',
                class: areaElement.getAttribute?.('class') || '',
                x: areaElement.getAttribute?.('x'),
                y: areaElement.getAttribute?.('y'),
                width: areaElement.getAttribute?.('width'),
                height: areaElement.getAttribute?.('height'),
                viewBox: areaElement.getAttribute?.('viewBox'),
                transform: areaElement.getAttribute?.('transform'),
                d: areaElement.getAttribute?.('d'),
                points: areaElement.getAttribute?.('points'),
                fill: areaElement.getAttribute?.('fill'),
                stroke: areaElement.getAttribute?.('stroke')
            },
            canvasViewBox: this.canvas?.getAttribute?.('viewBox') || '',
            printAreaBounds: this.printAreaBounds
        });

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

        this.canvas.appendChild(visualArea);
        this.bringPrintAreaOverlaysToFront();
    },

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
    },

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
    },

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
    },

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

            logTemplateDebug('loadSVGTemplate', {
                sourceBounds,
                rootViewBox: root.getAttribute('viewBox') || '',
                outline: areaElement ? {
                    tag: String(areaElement.tagName || '').toLowerCase(),
                    id: areaElement.getAttribute?.('id') || '',
                    class: areaElement.getAttribute?.('class') || '',
                    x: areaElement.getAttribute?.('x'),
                    y: areaElement.getAttribute?.('y'),
                    width: areaElement.getAttribute?.('width'),
                    height: areaElement.getAttribute?.('height'),
                    transform: areaElement.getAttribute?.('transform'),
                    d: areaElement.getAttribute?.('d'),
                    points: areaElement.getAttribute?.('points'),
                    fill: areaElement.getAttribute?.('fill'),
                    stroke: areaElement.getAttribute?.('stroke')
                } : null
            });

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


});
