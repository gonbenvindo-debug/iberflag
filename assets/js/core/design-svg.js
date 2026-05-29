// ============================================================
// DESIGN SVG STORE
// ============================================================
(function () {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DEFAULT_SIZE = { width: 800, height: 600 };
    const EXCLUDED_IDS = new Set([
        'print-area-outline',
        'print-area-shape-outline',
        'print-area-shape-outline-border',
        'print-area-background',
        'print-area-outside-overlay',
        'print-area-outside-grid',
        'resize-handles'
    ]);
    const EXCLUDED_CLASSES = new Set([
        'resize-handle',
        'crop-handle',
        'guide-line'
    ]);
    const PREVIEW_MARKUP_CACHE = new Map();
    const PREVIEW_MARKUP_CACHE_LIMIT = 200;
    const PREVIEW_MARKUP_CACHE_VERSION = 'outline-v7';
    const PREVIEW_CANVAS_MARGIN = 50;
    const PREVIEW_CONTENT_LONGEST_SIDE = 700;
    const DESIGN_DOCUMENT_V2_FORMAT = 'design-document-v2';
    const SUPPORTED_V2_SHAPES = new Set([
        'rectangle',
        'rounded',
        'pill',
        'line',
        'circle',
        'triangle',
        'diamond',
        'hexagon',
        'arrow',
        'star'
    ]);

    function toNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function escapeXml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function buildStyleString(styleMap = {}) {
        return Object.entries(styleMap)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `${key}:${value}`)
            .join(';');
    }

    function normalizeTemplateElement(data = {}) {
        const properties = data.properties || {};
        const inferredType = data.type
            || (properties.text !== undefined ? 'text' : null)
            || (properties.src !== undefined ? 'image' : null)
            || (properties.shape !== undefined ? 'shape' : null)
            || (properties.content !== undefined ? 'qrcode' : null)
            || 'shape';
        const type = String(inferredType).toLowerCase();
        const widthFallback = type === 'text' ? 200 : type === 'qrcode' ? 120 : 150;
        const heightFallback = type === 'text' ? 60 : type === 'qrcode' ? 120 : 150;

        const normalized = {
            id: String(data.id || properties.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            type,
            x: toNumber(data.x ?? properties.x ?? 0),
            y: toNumber(data.y ?? properties.y ?? 0),
            width: toNumber(data.width ?? properties.width ?? widthFallback),
            height: toNumber(data.height ?? properties.height ?? heightFallback),
            rotation: toNumber(data.rotation ?? properties.rotation ?? 0)
        };

        if (type === 'text') {
            normalized.content = data.content || properties.text || 'Texto';
            normalized.font = data.font || properties.fontFamily || 'Arial';
            normalized.size = toNumber(data.size ?? properties.fontSize ?? 24);
            normalized.color = data.color || properties.color || '#000000';
            normalized.bold = Boolean(data.bold ?? (String(properties.fontWeight || '').toLowerCase() === 'bold'));
            normalized.italic = Boolean(data.italic ?? (String(properties.fontStyle || '').toLowerCase() === 'italic'));
            normalized.textAlign = String(
                data.textAlign
                    || properties.textAlign
                    || properties.align
                    || 'center'
            ).toLowerCase();
            normalized.lineHeight = toNumber(data.lineHeight ?? properties.lineHeight ?? Math.round(normalized.size * 1.2));
        } else if (type === 'shape') {
            normalized.shapeType = String(data.shapeType || properties.shape || 'rectangle').toLowerCase();
            normalized.fill = data.fill || properties.fill || '#3b82f6';
            normalized.stroke = data.stroke || properties.stroke || 'none';
            normalized.strokeWidth = toNumber(data.strokeWidth ?? properties.strokeWidth ?? 0);
        } else if (type === 'image') {
            normalized.src = data.src || properties.src || '';
            normalized.name = data.name || properties.name || 'Imagem';
            normalized.imageKind = data.imageKind || properties.imageKind || 'image';
            normalized.opacity = toNumber(data.opacity ?? properties.opacity ?? 1);
            normalized.objectFit = String(data.objectFit || properties.objectFit || 'cover').toLowerCase();
            normalized.borderRadius = toNumber(data.borderRadius ?? properties.borderRadius ?? 0);
            normalized.qrContent = data.qrContent || properties.qrContent || '';
            normalized.qrColor = data.qrColor || properties.qrColor || '#111827';
        } else if (type === 'qrcode') {
            normalized.name = data.name || properties.name || 'QR Code';
            normalized.imageKind = 'qr';
            normalized.qrContent = data.qrContent || properties.content || '';
            normalized.qrColor = data.qrColor || properties.color || '#111827';
            normalized.bgColor = data.bgColor || properties.bgColor || '#ffffff';
        }

        return normalized;
    }

    function getCanvasSize(editor, options = {}) {
        const editorViewBox = typeof editor?.getCanvasViewBoxSize === 'function'
            ? editor.getCanvasViewBoxSize()
            : null;

        const width = toNumber(
            options.width
            ?? options.viewBoxWidth
            ?? editor?.baseCanvasSize?.width
            ?? editorViewBox?.width
            ?? DEFAULT_SIZE.width,
            DEFAULT_SIZE.width
        );
        const height = toNumber(
            options.height
            ?? options.viewBoxHeight
            ?? editor?.baseCanvasSize?.height
            ?? editorViewBox?.height
            ?? DEFAULT_SIZE.height,
            DEFAULT_SIZE.height
        );

        return {
            width: Math.max(1, Math.round(width)),
            height: Math.max(1, Math.round(height))
        };
    }

    function getCanvasViewBoxBounds(editor, options = {}) {
        const canvas = editor?.canvas || editor;
        const editorViewBox = typeof editor?.getCanvasViewBoxSize === 'function'
            ? editor.getCanvasViewBoxSize()
            : null;
        const viewBoxAttr = String(canvas?.getAttribute?.('viewBox') || '').trim();
        const parsedViewBox = viewBoxAttr
            ? viewBoxAttr.split(/\s+/).map(Number)
            : [];
        const size = getCanvasSize(editor, options);

        if (parsedViewBox.length === 4 && parsedViewBox.every(Number.isFinite) && parsedViewBox[2] > 0 && parsedViewBox[3] > 0) {
            return {
                x: parsedViewBox[0],
                y: parsedViewBox[1],
                width: parsedViewBox[2],
                height: parsedViewBox[3]
            };
        }

        return {
            x: Number(options.x ?? options.viewBoxX ?? editorViewBox?.x) || 0,
            y: Number(options.y ?? options.viewBoxY ?? editorViewBox?.y) || 0,
            width: Math.max(1, Number(options.width ?? options.viewBoxWidth ?? editorViewBox?.width ?? size.width) || size.width),
            height: Math.max(1, Number(options.height ?? options.viewBoxHeight ?? editorViewBox?.height ?? size.height) || size.height)
        };
    }

    function shouldSkipNode(node) {
        if (!node || node.nodeType !== 1) return true;

        const tagName = String(node.tagName || '').toLowerCase();
        const id = node.getAttribute?.('id') || '';
        const className = node.getAttribute?.('class') || '';

        if (tagName === 'defs') return false;
        if (EXCLUDED_IDS.has(id)) return true;
        if (className.split(/\s+/).some((classToken) => EXCLUDED_CLASSES.has(classToken))) return true;
        if (tagName === 'g' && id && id.startsWith('print-area-')) return true;
        return false;
    }

    function appendRotation(node, data) {
        if (!data.rotation) return;

        const cx = data.x + (data.width / 2);
        const cy = data.y + (data.height / 2);
        node.setAttribute('transform', `rotate(${data.rotation} ${cx} ${cy})`);
    }

    function buildTextNode(data) {
        const textNode = document.createElementNS(SVG_NS, 'text');
        const align = data.textAlign === 'left' ? 'start' : data.textAlign === 'right' ? 'end' : 'middle';
        const x = data.x + (align === 'middle' ? data.width / 2 : align === 'end' ? data.width : 0);
        const y = data.y + (data.height > 0 ? data.height / 2 : data.size);
        const lines = String(data.content || 'Texto').split(/\r?\n/);

        textNode.setAttribute('id', data.id);
        textNode.setAttribute('data-editable', 'true');
        textNode.setAttribute('data-element-id', data.id);
        textNode.setAttribute('x', String(x));
        textNode.setAttribute('y', String(y));
        textNode.setAttribute('font-family', data.font || 'Arial');
        textNode.setAttribute('font-size', String(data.size || 24));
        textNode.setAttribute('fill', data.color || '#000000');
        textNode.setAttribute('font-weight', data.bold ? 'bold' : 'normal');
        textNode.setAttribute('font-style', data.italic ? 'italic' : 'normal');
        textNode.setAttribute('text-anchor', align);
        textNode.setAttribute('dominant-baseline', 'middle');
        textNode.setAttribute('xml:space', 'preserve');
        textNode.setAttribute('style', buildStyleString({
            'font-family': data.font || 'Arial',
            'font-size': `${data.size || 24}px`,
            fill: data.color || '#000000',
            'font-weight': data.bold ? 'bold' : 'normal',
            'font-style': data.italic ? 'italic' : 'normal',
            'text-anchor': align,
            'dominant-baseline': 'middle',
            'user-select': 'none',
            'white-space': 'pre'
        }));
        textNode.style.cursor = 'move';

        if (lines.length <= 1) {
            textNode.textContent = lines[0] || '';
        } else {
            const lineHeight = data.lineHeight || Math.round((data.size || 24) * 1.2);
            lines.forEach((line, index) => {
                const tspan = document.createElementNS(SVG_NS, 'tspan');
                if (index === 0) {
                    tspan.setAttribute('x', String(x));
                    tspan.setAttribute('dy', '0');
                } else {
                    tspan.setAttribute('x', String(x));
                    tspan.setAttribute('dy', String(lineHeight));
                }
                tspan.textContent = line;
                textNode.appendChild(tspan);
            });
        }

        appendRotation(textNode, data);
        return textNode;
    }

    function buildShapeNode(data) {
        const shapeType = String(data.shapeType || 'rectangle').toLowerCase();
        let node = null;

        if (shapeType === 'circle') {
            node = document.createElementNS(SVG_NS, 'circle');
            const radius = Math.min(data.width, data.height) / 2;
            node.setAttribute('cx', String(data.x + radius));
            node.setAttribute('cy', String(data.y + radius));
            node.setAttribute('r', String(radius));
        } else if (shapeType === 'triangle') {
            node = document.createElementNS(SVG_NS, 'polygon');
            const cx = data.x + (data.width / 2);
            const cy = data.y + (data.height / 2);
            const halfWidth = data.width / 2;
            const halfHeight = data.height / 2;
            node.setAttribute('points', `${cx},${cy - halfHeight} ${cx - halfWidth},${cy + halfHeight} ${cx + halfWidth},${cy + halfHeight}`);
        } else {
            node = document.createElementNS(SVG_NS, 'rect');
            node.setAttribute('x', String(data.x));
            node.setAttribute('y', String(data.y));
            node.setAttribute('width', String(data.width));
            node.setAttribute('height', String(data.height));
            if (shapeType === 'rounded') {
                node.setAttribute('rx', '12');
                node.setAttribute('ry', '12');
            }
        }

        node.setAttribute('id', data.id);
        node.setAttribute('data-editable', 'true');
        node.setAttribute('data-element-id', data.id);
        node.setAttribute('fill', data.fill || '#3b82f6');
        node.setAttribute('stroke', data.stroke || 'none');
        node.setAttribute('stroke-width', String(data.strokeWidth || 0));
        node.setAttribute('style', buildStyleString({
            fill: data.fill || '#3b82f6',
            stroke: data.stroke || 'none',
            'stroke-width': String(data.strokeWidth || 0),
            'user-select': 'none'
        }));
        node.style.cursor = 'move';

        appendRotation(node, data);
        return node;
    }

    function generateQrDataUrl(content, color = '#111827') {
        if (typeof window.qrcode !== 'function') {
            return '';
        }

        try {
            const qr = window.qrcode(0, 'M');
            qr.addData(String(content || ''));
            qr.make();

            const moduleCount = qr.getModuleCount();
            const margin = 2;
            const size = moduleCount + (margin * 2);
            const fill = escapeXml(color);
            const pathSegments = [];

            for (let row = 0; row < moduleCount; row += 1) {
                for (let col = 0; col < moduleCount; col += 1) {
                    if (!qr.isDark(row, col)) continue;
                    const x = col + margin;
                    const y = row + margin;
                    pathSegments.push(`M${x} ${y}h1v1H${x}z`);
                }
            }

            const svgMarkup = `<svg xmlns="${SVG_NS}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="${fill}" d="${pathSegments.join('')}"/></svg>`;
            return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
        } catch (error) {
            console.warn('Falha ao gerar QR Code:', error);
            return '';
        }
    }

    function buildImageNode(data) {
        const node = document.createElementNS(SVG_NS, 'image');
        const objectFit = String(data.objectFit || 'cover').toLowerCase();
        const href = data.src || (data.imageKind === 'qr' ? generateQrDataUrl(data.qrContent, data.qrColor) : '');

        node.setAttribute('id', data.id);
        node.setAttribute('data-editable', 'true');
        node.setAttribute('data-element-id', data.id);
        node.setAttribute('x', String(data.x));
        node.setAttribute('y', String(data.y));
        node.setAttribute('width', String(data.width));
        node.setAttribute('height', String(data.height));
        node.setAttribute('href', href);
        node.setAttribute('opacity', String(data.opacity || 1));
        node.setAttribute('preserveAspectRatio',
            objectFit === 'contain' ? 'xMidYMid meet'
                : objectFit === 'fill' ? 'none'
                    : 'xMidYMid slice'
        );
        node.setAttribute('style', buildStyleString({
            opacity: String(data.opacity || 1),
            'user-select': 'none'
        }));
        node.style.cursor = 'move';

        if (data.name) {
            node.dataset.name = data.name;
        }
        if (data.imageKind) {
            node.dataset.imageKind = data.imageKind;
        }
        if (data.qrContent) {
            node.dataset.qrContent = data.qrContent;
        }
        if (data.qrColor) {
            node.dataset.qrColor = data.qrColor;
        }

        appendRotation(node, data);
        return node;
    }

    function buildTemplateNode(data = {}, defsBucket = []) {
        const normalized = normalizeTemplateElement(data);

        if (normalized.type === 'text') {
            return buildTextNode(normalized);
        }

        if (normalized.type === 'image') {
            return buildImageNode(normalized);
        }

        if (normalized.type === 'qrcode') {
            return buildImageNode({
                ...normalized,
                type: 'image',
                imageKind: 'qr',
                src: generateQrDataUrl(normalized.qrContent, normalized.qrColor)
            });
        }

        if (normalized.type === 'shape') {
            return buildShapeNode(normalized);
        }

        return null;
    }

    function buildTemplateSvgFromElements(elements, options = {}) {
        const { width, height } = getCanvasSize(null, options);
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('xmlns', SVG_NS);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('style', buildStyleString({
            'background-color': options.backgroundColor || 'transparent'
        }));

        const defs = [];
        (Array.isArray(elements) ? elements : []).forEach((element) => {
            const node = buildTemplateNode(element, defs);
            if (node) {
                svg.appendChild(node);
            }
        });

        return new XMLSerializer().serializeToString(svg);
    }

    function roundNumber(value, precision = 6) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return 0;
        }
        const factor = 10 ** precision;
        return Math.round(numeric * factor) / factor;
    }

    function normalizeBounds(bounds, fallback = DEFAULT_SIZE) {
        const safeFallback = {
            x: Number.isFinite(Number(fallback?.x)) ? Number(fallback.x) : 0,
            y: Number.isFinite(Number(fallback?.y)) ? Number(fallback.y) : 0,
            width: Math.max(1, Number(fallback?.width) || DEFAULT_SIZE.width),
            height: Math.max(1, Number(fallback?.height) || DEFAULT_SIZE.height)
        };

        if (!bounds) {
            return safeFallback;
        }

        const width = Number(bounds.width);
        const height = Number(bounds.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return safeFallback;
        }

        return {
            x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : safeFallback.x,
            y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : safeFallback.y,
            width,
            height
        };
    }

    function isUsableBounds(bounds) {
        return Boolean(
            bounds
            && Number.isFinite(Number(bounds.x))
            && Number.isFinite(Number(bounds.y))
            && Number.isFinite(Number(bounds.width))
            && Number.isFinite(Number(bounds.height))
            && Number(bounds.width) > 0
            && Number(bounds.height) > 0
        );
    }

    function measureSvgNodeBounds(node, fallbackBounds = null) {
        if (!node || typeof node.getBBox !== 'function') {
            return fallbackBounds;
        }

        try {
            const bbox = node.getBBox();
            if (!isUsableBounds(bbox)) {
                return fallbackBounds;
            }

            const ctm = typeof node.getCTM === 'function' ? node.getCTM() : null;
            if (!ctm || typeof DOMPoint !== 'function') {
                return normalizeBounds(bbox, fallbackBounds || DEFAULT_SIZE);
            }

            const corners = [
                new DOMPoint(bbox.x, bbox.y).matrixTransform(ctm),
                new DOMPoint(bbox.x + bbox.width, bbox.y).matrixTransform(ctm),
                new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(ctm),
                new DOMPoint(bbox.x, bbox.y + bbox.height).matrixTransform(ctm)
            ];

            const xs = corners.map((point) => point.x);
            const ys = corners.map((point) => point.y);
            const measured = {
                x: Math.min(...xs),
                y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            };

            return isUsableBounds(measured)
                ? normalizeBounds(measured, fallbackBounds || DEFAULT_SIZE)
                : fallbackBounds;
        } catch (error) {
            return fallbackBounds;
        }
    }

    function getEditorPrintAreaBounds(editor, fallback = null) {
        const fallbackBounds = fallback || getCanvasViewBoxBounds(editor, {});
        const projectGuideBounds = editor?.getProjectGuideFrame?.()?.bounds;
        if (isUsableBounds(projectGuideBounds)) {
            return normalizeBounds(projectGuideBounds, fallbackBounds);
        }

        const outlineCandidates = [
            '#print-area-shape-outline-border',
            '#print-area-shape-outline',
            '#print-area-outline'
        ];
        for (const selector of outlineCandidates) {
            const outline = editor?.canvas?.querySelector?.(selector);
            const measured = measureSvgNodeBounds(outline, null);
            if (isUsableBounds(measured)) {
                return normalizeBounds(measured, fallbackBounds);
            }
        }

        const sourceBounds = editor?.printAreaBounds;
        if (isUsableBounds(sourceBounds)) {
            return normalizeBounds(sourceBounds, fallbackBounds);
        }

        const printAreaNode = editor?.printArea || editor?.canvas?.querySelector?.('#print-area-outline');
        if (printAreaNode) {
            const nodeBounds = {
                x: Number(printAreaNode.getAttribute?.('x')),
                y: Number(printAreaNode.getAttribute?.('y')),
                width: Number(printAreaNode.getAttribute?.('width')),
                height: Number(printAreaNode.getAttribute?.('height'))
            };
            if (isUsableBounds(nodeBounds)) {
                return normalizeBounds(nodeBounds, fallbackBounds);
            }
        }

        return fallbackBounds;
    }

    function normalizeFrameToBounds(frame, bounds) {
        const safeBounds = normalizeBounds(bounds, DEFAULT_SIZE);
        const source = normalizeBounds(frame, { x: safeBounds.x, y: safeBounds.y, width: 1, height: 1 });
        return {
            x: roundNumber((source.x - safeBounds.x) / safeBounds.width),
            y: roundNumber((source.y - safeBounds.y) / safeBounds.height),
            width: roundNumber(source.width / safeBounds.width),
            height: roundNumber(source.height / safeBounds.height)
        };
    }

    function resolveFrameFromBounds(frame, bounds) {
        const safeBounds = normalizeBounds(bounds, DEFAULT_SIZE);
        const safeFrame = frame && typeof frame === 'object' ? frame : {};
        return {
            x: safeBounds.x + (toNumber(safeFrame.x, 0) * safeBounds.width),
            y: safeBounds.y + (toNumber(safeFrame.y, 0) * safeBounds.height),
            width: Math.max(1, toNumber(safeFrame.width, 0) * safeBounds.width),
            height: Math.max(1, toNumber(safeFrame.height, 0) * safeBounds.height)
        };
    }

    function serializeTextDecoration(node, fallback = '') {
        return String(node?.getAttribute?.('text-decoration') || fallback || '').trim();
    }

    function getElementFrameForDocument(editor, elementData) {
        const node = elementData?.element || null;
        if (!node) {
            return null;
        }

        const tagName = String(node.tagName || '').toLowerCase();
        if (tagName === 'text') {
            try {
                const bbox = typeof node.getBBox === 'function' ? node.getBBox() : null;
                if (bbox && Number.isFinite(Number(bbox.width)) && Number.isFinite(Number(bbox.height)) && Number(bbox.width) > 0 && Number(bbox.height) > 0) {
                    return {
                        x: Number(bbox.x) || 0,
                        y: Number(bbox.y) || 0,
                        width: Math.max(1, Number(bbox.width) || 1),
                        height: Math.max(1, Number(bbox.height) || 1)
                    };
                }
            } catch (error) {
                // fall through to attribute-based fallback
            }

            const xAttr = toNumber(node.getAttribute('x'), 0);
            const yAttr = toNumber(node.getAttribute('y'), 0);
            const fallbackWidth = Math.max(1, toNumber(elementData?.width, 120));
            const fallbackHeight = Math.max(1, toNumber(elementData?.height, 40));
            return {
                x: xAttr,
                y: yAttr - fallbackHeight,
                width: fallbackWidth,
                height: fallbackHeight
            };
        }

        if (tagName === 'image' || tagName === 'rect') {
            const width = Math.max(1, toNumber(node.getAttribute('width'), toNumber(elementData?.width, 1)));
            const height = Math.max(1, toNumber(node.getAttribute('height'), toNumber(elementData?.height, 1)));
            return {
                x: toNumber(node.getAttribute('x'), toNumber(elementData?.x, 0)),
                y: toNumber(node.getAttribute('y'), toNumber(elementData?.y, 0)),
                width,
                height
            };
        }

        if (tagName === 'circle') {
            const radius = Math.max(1, toNumber(node.getAttribute('r'), toNumber(elementData?.r || elementData?.radius, 1)));
            const cx = toNumber(node.getAttribute('cx'), toNumber(elementData?.cx ?? elementData?.x, 0));
            const cy = toNumber(node.getAttribute('cy'), toNumber(elementData?.cy ?? elementData?.y, 0));
            return {
                x: cx - radius,
                y: cy - radius,
                width: radius * 2,
                height: radius * 2
            };
        }

        if (tagName === 'polygon' || tagName === 'path') {
            try {
                const bbox = typeof node.getBBox === 'function' ? node.getBBox() : null;
                if (bbox && Number.isFinite(Number(bbox.width)) && Number.isFinite(Number(bbox.height)) && Number(bbox.width) > 0 && Number(bbox.height) > 0) {
                    return {
                        x: Number(bbox.x) || 0,
                        y: Number(bbox.y) || 0,
                        width: Math.max(1, Number(bbox.width) || 1),
                        height: Math.max(1, Number(bbox.height) || 1)
                    };
                }
            } catch (error) {
                // ignore and use elementData fallback
            }
            return {
                x: toNumber(elementData?.x, 0),
                y: toNumber(elementData?.y, 0),
                width: Math.max(1, toNumber(elementData?.width, 1)),
                height: Math.max(1, toNumber(elementData?.height, 1))
            };
        }

        return null;
    }

    function parseRotationFromTransformValue(transformValue) {
        const transform = String(transformValue || '');
        const match = transform.match(/rotate\(([-\d.]+)/);
        if (!match) {
            return 0;
        }
        return toNumber(match[1], 0);
    }

    function serializeElementToDesignDocument(editor, elementData, printAreaBounds, index) {
        if (!elementData?.element) {
            return null;
        }

        const type = String(elementData.type || '').toLowerCase();
        const frame = getElementFrameForDocument(editor, elementData);
        if (!frame) {
            return null;
        }

        const normalizedFrame = normalizeFrameToBounds(frame, printAreaBounds);
        const rotationFromNode = parseRotationFromTransformValue(elementData.element.getAttribute?.('transform'));
        const baseRecord = {
            id: String(elementData.id || elementData.element.dataset?.elementId || `element-${index + 1}`),
            type,
            frame: normalizedFrame,
            rotationDeg: roundNumber(Number(elementData.rotation ?? rotationFromNode) || rotationFromNode || 0, 3),
            flipX: Boolean(elementData.flipX),
            flipY: Boolean(elementData.flipY),
            zIndex: index
        };

        if (type === 'text') {
            const anchorX = toNumber(elementData.element.getAttribute('x'), toNumber(elementData.x, frame.x));
            const anchorY = toNumber(elementData.element.getAttribute('y'), toNumber(elementData.y, frame.y + frame.height));
            const width = Math.max(1, frame.width || 1);
            const height = Math.max(1, frame.height || 1);
            const fontSize = Math.max(1, toNumber(elementData.element.getAttribute('font-size'), toNumber(elementData.size, 24)));
            return {
                ...baseRecord,
                rawContent: String(elementData.rawContent ?? elementData.content ?? elementData.element.dataset?.rawContent ?? ''),
                content: String(elementData.content ?? elementData.rawContent ?? elementData.element.dataset?.rawContent ?? ''),
                capsLock: String(elementData.element.dataset?.capsLock || 'false') === 'true' || elementData.capsLock === true,
                fontFamily: String(elementData.font || elementData.element.getAttribute('font-family') || 'Arial'),
                fontSizeRatio: roundNumber(fontSize / Math.max(1, printAreaBounds.height)),
                fontWeight: String(elementData.bold ? 'bold' : (elementData.element.getAttribute('font-weight') || 'normal')),
                fontStyle: String(elementData.italic ? 'italic' : (elementData.element.getAttribute('font-style') || 'normal')),
                textDecoration: serializeTextDecoration(elementData.element, elementData.underline ? 'underline' : ''),
                fill: String(elementData.color || elementData.element.getAttribute('fill') || '#000000'),
                textAnchor: String(elementData.textAnchor || elementData.element.getAttribute('text-anchor') || 'start'),
                dominantBaseline: String(elementData.dominantBaseline || elementData.element.getAttribute('dominant-baseline') || ''),
                anchorOffset: {
                    xRatio: roundNumber((anchorX - frame.x) / width),
                    yRatio: roundNumber((anchorY - frame.y) / height)
                },
                lineHeightRatio: 1.2
            };
        }

        if (type === 'image') {
            const crop = elementData.cropData && typeof elementData.cropData === 'object'
                ? {
                    x: roundNumber(toNumber(elementData.cropData.x, 0)),
                    y: roundNumber(toNumber(elementData.cropData.y, 0)),
                    width: roundNumber(toNumber(elementData.cropData.width, 1)),
                    height: roundNumber(toNumber(elementData.cropData.height, 1))
                }
                : null;

            return {
                ...baseRecord,
                src: String(elementData.src || elementData.element.getAttribute('href') || ''),
                name: String(elementData.name || elementData.element.dataset?.name || 'Imagem'),
                imageKind: String(elementData.imageKind || elementData.element.dataset?.imageKind || 'image'),
                opacity: roundNumber(toNumber(elementData.opacity, 1), 4),
                objectFit: String(elementData.objectFit || elementData.element.dataset?.objectFit || 'contain'),
                borderRadius: roundNumber(toNumber(elementData.borderRadius ?? elementData.element.dataset?.borderRadius, 0)),
                crop,
                fullWidth: Number(elementData.fullWidth) || null,
                fullHeight: Number(elementData.fullHeight) || null,
                qrContent: String(elementData.qrContent || elementData.element.dataset?.qrContent || ''),
                qrColor: String(elementData.qrColor || elementData.element.dataset?.qrColor || '#111827'),
                originalSrc: String(elementData.originalSrc || elementData.element.dataset?.originalSrc || ''),
                layerLabel: String(elementData.layerLabel || elementData.element.dataset?.layerLabel || '')
            };
        }

        if (type === 'shape') {
            const shapeType = String(elementData.shapeType || '').toLowerCase();
            if (!SUPPORTED_V2_SHAPES.has(shapeType)) {
                console.warn('Elemento ignorado no design-document-v2 por shapeType nao suportado:', shapeType, elementData);
                return null;
            }

            return {
                ...baseRecord,
                shapeType,
                fill: String(elementData.fill || elementData.element.getAttribute('fill') || '#3b82f6'),
                stroke: String(elementData.stroke || elementData.element.getAttribute('stroke') || 'none'),
                strokeWidth: roundNumber(toNumber(elementData.strokeWidth || elementData.element.getAttribute('stroke-width'), 0), 4)
            };
        }

        console.warn('Elemento ignorado no design-document-v2 por tipo nao suportado:', type, elementData);
        return null;
    }

    function serializeDesignDocumentV2(editor, options = {}) {
        const canvas = editor?.canvas || editor;
        if (!canvas) {
            return null;
        }

        const viewBoxBounds = getCanvasViewBoxBounds(editor, options);
        const printAreaBounds = getEditorPrintAreaBounds(editor, viewBoxBounds);
        const elements = Array.from(editor?.elements || [])
            .map((elementData, index) => serializeElementToDesignDocument(editor, elementData, printAreaBounds, index))
            .filter(Boolean);

        return {
            format: DESIGN_DOCUMENT_V2_FORMAT,
            version: 2,
            productId: editor?.productId ? String(editor.productId) : null,
            selectedBaseId: Number.isFinite(Number(editor?.selectedBaseId)) ? Number(editor.selectedBaseId) : null,
            viewBox: {
                x: roundNumber(viewBoxBounds.x),
                y: roundNumber(viewBoxBounds.y),
                width: roundNumber(viewBoxBounds.width),
                height: roundNumber(viewBoxBounds.height)
            },
            printAreaRef: {
                x: roundNumber(printAreaBounds.x),
                y: roundNumber(printAreaBounds.y),
                width: roundNumber(printAreaBounds.width),
                height: roundNumber(printAreaBounds.height)
            },
            elements
        };
    }

    function unwrapDesignDocumentV2(input) {
        if (!input) {
            return null;
        }

        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (!trimmed) return null;
            try {
                return unwrapDesignDocumentV2(JSON.parse(trimmed));
            } catch (error) {
                return null;
            }
        }

        if (typeof input !== 'object') {
            return null;
        }

        if (input.format === DESIGN_DOCUMENT_V2_FORMAT && Array.isArray(input.elements)) {
            return input;
        }

        if (input.design_document_v2) {
            return unwrapDesignDocumentV2(input.design_document_v2);
        }

        if (input.designDocumentV2) {
            return unwrapDesignDocumentV2(input.designDocumentV2);
        }

        return null;
    }

    function getRenderedTextValue(rawText, capsLock) {
        const content = String(rawText || '');
        return capsLock ? content.toLocaleUpperCase() : content;
    }

    function buildDesignElementTransform(bounds, rotationDeg = 0, flipX = false, flipY = false) {
        const safeRotation = Number(rotationDeg) || 0;
        if (!safeRotation && !flipX && !flipY) {
            return '';
        }

        const centerX = bounds.x + (bounds.width / 2);
        const centerY = bounds.y + (bounds.height / 2);
        const scaleX = flipX ? -1 : 1;
        const scaleY = flipY ? -1 : 1;

        return [
            `translate(${centerX} ${centerY})`,
            safeRotation ? `rotate(${safeRotation})` : '',
            (flipX || flipY) ? `scale(${scaleX} ${scaleY})` : '',
            `translate(${-centerX} ${-centerY})`
        ].filter(Boolean).join(' ');
    }

    function buildAbsoluteTextNode(element, printAreaBounds) {
        const frame = resolveFrameFromBounds(element.frame, printAreaBounds);
        const anchorOffset = element.anchorOffset && typeof element.anchorOffset === 'object'
            ? element.anchorOffset
            : {};
        const anchorX = frame.x + (frame.width * toNumber(anchorOffset.xRatio, 0));
        const anchorY = frame.y + (frame.height * toNumber(anchorOffset.yRatio, 1));
        const fontSize = Math.max(1, toNumber(element.fontSizeRatio, 24 / Math.max(1, printAreaBounds.height)) * printAreaBounds.height);
        const lineHeightRatio = Math.max(0.8, toNumber(element.lineHeightRatio, 1.2));
        const lines = getRenderedTextValue(element.rawContent ?? element.content ?? '', element.capsLock)
            .split(/\r?\n/);
        const textNode = document.createElementNS(SVG_NS, 'text');

        textNode.setAttribute('data-editable', 'true');
        textNode.setAttribute('data-element-id', String(element.id || ''));
        textNode.setAttribute('x', String(anchorX));
        textNode.setAttribute('y', String(anchorY));
        textNode.setAttribute('font-family', String(element.fontFamily || 'Arial'));
        textNode.setAttribute('font-size', String(fontSize));
        textNode.setAttribute('fill', String(element.fill || '#000000'));
        textNode.setAttribute('font-weight', String(element.fontWeight || 'normal'));
        textNode.setAttribute('font-style', String(element.fontStyle || 'normal'));
        textNode.setAttribute('text-anchor', String(element.textAnchor || 'start'));
        textNode.setAttribute('dominant-baseline', String(element.dominantBaseline || ''));
        textNode.setAttribute('xml:space', 'preserve');
        if (element.textDecoration) {
            textNode.setAttribute('text-decoration', String(element.textDecoration));
        }

        if (lines.length <= 1) {
            textNode.textContent = lines[0] || '';
        } else {
            const lineHeight = fontSize * lineHeightRatio;
            lines.forEach((line, index) => {
                const tspan = document.createElementNS(SVG_NS, 'tspan');
                tspan.setAttribute('x', String(anchorX));
                tspan.setAttribute('dy', index === 0 ? '0' : String(lineHeight));
                tspan.textContent = line;
                textNode.appendChild(tspan);
            });
        }

        const transform = buildDesignElementTransform(frame, element.rotationDeg, element.flipX, element.flipY);
        if (transform) {
            textNode.setAttribute('transform', transform);
        }

        return textNode;
    }

    function buildAbsoluteImageNode(element, printAreaBounds) {
        const frame = resolveFrameFromBounds(element.frame, printAreaBounds);
        const imageNode = document.createElementNS(SVG_NS, 'image');
        const href = String(element.src || '');
        const objectFit = String(element.objectFit || 'contain').toLowerCase();

        imageNode.setAttribute('data-editable', 'true');
        imageNode.setAttribute('data-element-id', String(element.id || ''));
        imageNode.setAttribute('x', String(frame.x));
        imageNode.setAttribute('y', String(frame.y));
        imageNode.setAttribute('width', String(frame.width));
        imageNode.setAttribute('height', String(frame.height));
        imageNode.setAttribute('href', href);
        imageNode.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
        imageNode.setAttribute('opacity', String(toNumber(element.opacity, 1)));
        imageNode.setAttribute('preserveAspectRatio', objectFit === 'contain' ? 'xMidYMid meet' : objectFit === 'fill' ? 'none' : 'xMidYMid slice');

        const transform = buildDesignElementTransform(frame, element.rotationDeg, element.flipX, element.flipY);
        if (transform) {
            imageNode.setAttribute('transform', transform);
        }

        return imageNode;
    }

    function buildShapePointsWithinFrame(shapeType, frame) {
        const cx = frame.x + (frame.width / 2);
        const cy = frame.y + (frame.height / 2);
        const halfWidth = frame.width / 2;
        const halfHeight = frame.height / 2;

        if (shapeType === 'triangle') {
            return `${cx},${frame.y} ${frame.x},${frame.y + frame.height} ${frame.x + frame.width},${frame.y + frame.height}`;
        }

        if (shapeType === 'diamond') {
            return `${cx},${frame.y} ${frame.x + frame.width},${cy} ${cx},${frame.y + frame.height} ${frame.x},${cy}`;
        }

        if (shapeType === 'hexagon') {
            const inset = frame.width * 0.22;
            return `${frame.x + inset},${frame.y} ${frame.x + frame.width - inset},${frame.y} ${frame.x + frame.width},${cy} ${frame.x + frame.width - inset},${frame.y + frame.height} ${frame.x + inset},${frame.y + frame.height} ${frame.x},${cy}`;
        }

        if (shapeType === 'arrow') {
            const shaftWidth = frame.width * 0.55;
            const shaftTop = frame.y + (frame.height * 0.3);
            const shaftBottom = frame.y + (frame.height * 0.7);
            return `${frame.x},${shaftTop} ${frame.x + shaftWidth},${shaftTop} ${frame.x + shaftWidth},${frame.y} ${frame.x + frame.width},${cy} ${frame.x + shaftWidth},${frame.y + frame.height} ${frame.x + shaftWidth},${shaftBottom} ${frame.x},${shaftBottom}`;
        }

        if (shapeType === 'star') {
            const outer = Math.min(halfWidth, halfHeight);
            const inner = outer * 0.45;
            const points = [];
            for (let i = 0; i < 10; i += 1) {
                const angle = (-90 + (i * 36)) * (Math.PI / 180);
                const radius = i % 2 === 0 ? outer : inner;
                points.push(`${cx + (Math.cos(angle) * radius)},${cy + (Math.sin(angle) * radius)}`);
            }
            return points.join(' ');
        }

        return `${cx},${frame.y} ${frame.x + frame.width},${frame.y + frame.height} ${frame.x},${frame.y + frame.height}`;
    }

    function buildAbsoluteShapeNode(element, printAreaBounds) {
        const frame = resolveFrameFromBounds(element.frame, printAreaBounds);
        const shapeType = String(element.shapeType || 'rectangle').toLowerCase();
        let node = null;

        if (shapeType === 'circle') {
            const radius = Math.min(frame.width, frame.height) / 2;
            node = document.createElementNS(SVG_NS, 'circle');
            node.setAttribute('cx', String(frame.x + (frame.width / 2)));
            node.setAttribute('cy', String(frame.y + (frame.height / 2)));
            node.setAttribute('r', String(radius));
        } else if (['triangle', 'diamond', 'hexagon', 'arrow', 'star'].includes(shapeType)) {
            node = document.createElementNS(SVG_NS, 'polygon');
            node.setAttribute('points', buildShapePointsWithinFrame(shapeType, frame));
        } else {
            node = document.createElementNS(SVG_NS, 'rect');
            node.setAttribute('x', String(frame.x));
            node.setAttribute('y', String(frame.y));
            node.setAttribute('width', String(frame.width));
            node.setAttribute('height', String(frame.height));
            if (shapeType === 'rounded' || shapeType === 'pill' || shapeType === 'line') {
                const radius = shapeType === 'line'
                    ? Math.max(1, frame.height / 2)
                    : Math.max(1, Math.min(frame.width, frame.height) / (shapeType === 'pill' ? 2 : 4));
                node.setAttribute('rx', String(radius));
                node.setAttribute('ry', String(radius));
            }
        }

        node.setAttribute('data-editable', 'true');
        node.setAttribute('data-element-id', String(element.id || ''));
        node.setAttribute('fill', String(element.fill || '#3b82f6'));
        node.setAttribute('stroke', String(element.stroke || 'none'));
        node.setAttribute('stroke-width', String(toNumber(element.strokeWidth, 0)));

        const transform = buildDesignElementTransform(frame, element.rotationDeg, element.flipX, element.flipY);
        if (transform) {
            node.setAttribute('transform', transform);
        }

        return node;
    }

    function buildAbsoluteNodeFromDesignElement(element, printAreaBounds) {
        const type = String(element?.type || '').toLowerCase();
        if (type === 'text') {
            return buildAbsoluteTextNode(element, printAreaBounds);
        }
        if (type === 'image') {
            return buildAbsoluteImageNode(element, printAreaBounds);
        }
        if (type === 'shape') {
            return buildAbsoluteShapeNode(element, printAreaBounds);
        }
        return null;
    }

    function appendDesignDocumentElements(parentNode, designDocument, printAreaBounds) {
        const elements = Array.isArray(designDocument?.elements) ? [...designDocument.elements] : [];
        elements
            .sort((left, right) => toNumber(left?.zIndex, 0) - toNumber(right?.zIndex, 0))
            .forEach((element) => {
                const node = buildAbsoluteNodeFromDesignElement(element, printAreaBounds);
                if (node) {
                    parentNode.appendChild(node);
                }
            });
    }

    function resolveMaskShapeSource(productContext = {}, printAreaBounds) {
        if (productContext.maskNode?.cloneNode) {
            return {
                maskNode: productContext.maskNode.cloneNode(true),
                sourceBounds: normalizeBounds(productContext.viewBoxBounds || printAreaBounds, printAreaBounds)
            };
        }

        const productMarkup = extractTemplateSvg(productContext.productSvg || productContext.svgTemplate || '', {});
        const productRoot = productMarkup ? parseSvgMarkup(productMarkup) : null;
        if (productRoot) {
            const maskNode = pickMaskNode(productRoot);
            if (maskNode) {
                const sourceBounds = getSvgSourceBounds(productRoot, printAreaBounds);
                return {
                    maskNode,
                    sourceBounds
                };
            }
        }

        const fallbackMask = document.createElementNS(SVG_NS, 'rect');
        fallbackMask.setAttribute('x', String(printAreaBounds.x));
        fallbackMask.setAttribute('y', String(printAreaBounds.y));
        fallbackMask.setAttribute('width', String(printAreaBounds.width));
        fallbackMask.setAttribute('height', String(printAreaBounds.height));
        return {
            maskNode: fallbackMask,
            sourceBounds: normalizeBounds(productContext.viewBoxBounds || printAreaBounds, printAreaBounds)
        };
    }

    function resolveViewBoxBoundsForDocument(designDocument, productContext = {}, printAreaBounds) {
        if (productContext.viewBoxBounds) {
            return normalizeBounds(productContext.viewBoxBounds, printAreaBounds);
        }

        const productMarkup = extractTemplateSvg(productContext.productSvg || productContext.svgTemplate || '', {});
        const productRoot = productMarkup ? parseSvgMarkup(productMarkup) : null;
        if (productRoot) {
            return normalizeBounds(getSvgSourceBounds(productRoot, printAreaBounds), printAreaBounds);
        }

        return normalizeBounds(designDocument?.viewBox || designDocument?.printAreaRef, printAreaBounds);
    }

    function renderDesignDocumentV2ToSvg(designDocumentInput, productContext = {}) {
        const designDocument = unwrapDesignDocumentV2(designDocumentInput);
        if (!designDocument) {
            return '';
        }

        const fallbackPrintArea = normalizeBounds(designDocument.printAreaRef, DEFAULT_SIZE);
        const printAreaBounds = normalizeBounds(productContext.printAreaBounds || designDocument.printAreaRef, fallbackPrintArea);
        const viewBoxBounds = resolveViewBoxBoundsForDocument(designDocument, productContext, printAreaBounds);
        const maskSource = resolveMaskShapeSource(productContext, printAreaBounds);
        const svg = document.createElementNS(SVG_NS, 'svg');
        const defs = document.createElementNS(SVG_NS, 'defs');
        const clipPath = document.createElementNS(SVG_NS, 'clipPath');
        const clipPathId = `design-document-clip-${Math.random().toString(36).slice(2, 10)}`;

        svg.setAttribute('xmlns', SVG_NS);
        svg.setAttribute('viewBox', `${viewBoxBounds.x} ${viewBoxBounds.y} ${viewBoxBounds.width} ${viewBoxBounds.height}`);
        svg.setAttribute('width', String(viewBoxBounds.width));
        svg.setAttribute('height', String(viewBoxBounds.height));
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('data-design-document-format', DESIGN_DOCUMENT_V2_FORMAT);
        svg.setAttribute('data-print-area-bounds', `${printAreaBounds.x} ${printAreaBounds.y} ${printAreaBounds.width} ${printAreaBounds.height}`);

        clipPath.setAttribute('id', clipPathId);
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clipPath.appendChild(buildEditorExportMaskShape({ querySelector: () => null }, printAreaBounds.width, printAreaBounds.height, printAreaBounds));
        if (maskSource.maskNode) {
            const shape = maskSource.maskNode.cloneNode(true);
            shape.removeAttribute?.('id');
            shape.removeAttribute?.('class');
            shape.removeAttribute?.('opacity');
            shape.removeAttribute?.('stroke');
            shape.removeAttribute?.('stroke-width');
            shape.removeAttribute?.('stroke-dasharray');
            shape.setAttribute?.('fill', '#ffffff');
            clipPath.replaceChildren(shape);
        }
        defs.appendChild(clipPath);
        svg.appendChild(defs);

        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('clip-path', `url(#${clipPathId})`);

        const whiteBase = document.createElementNS(SVG_NS, 'rect');
        whiteBase.setAttribute('x', String(printAreaBounds.x));
        whiteBase.setAttribute('y', String(printAreaBounds.y));
        whiteBase.setAttribute('width', String(printAreaBounds.width));
        whiteBase.setAttribute('height', String(printAreaBounds.height));
        whiteBase.setAttribute('fill', '#ffffff');
        group.appendChild(whiteBase);

        appendDesignDocumentElements(group, designDocument, printAreaBounds);
        svg.appendChild(group);

        return new XMLSerializer().serializeToString(svg);
    }

    function serializeEditorToSvg(editor, options = {}) {
        const canvas = editor?.canvas || editor;
        if (!canvas) {
            return '';
        }

        const useDesignDocument = options?.forceLiveSnapshot !== true;
        if (useDesignDocument) {
            const designDocument = serializeDesignDocumentV2(editor, options);
            if (designDocument) {
                const rendered = renderDesignDocumentV2ToSvg(designDocument, {
                    productSvg: editor?.currentProduct?.svg_template || '',
                    viewBoxBounds: getCanvasViewBoxBounds(editor, options),
                    printAreaBounds: getEditorPrintAreaBounds(editor),
                    maskNode: editor?.canvas?.querySelector?.('#print-area-shape-outline, #print-area-outline') || null
                });
                if (rendered) {
                    return rendered;
                }
            }
        }

        const { x, y, width, height } = getCanvasViewBoxBounds(editor, options);
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('xmlns', SVG_NS);
        svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('preserveAspectRatio', 'none');

        const defs = document.createElementNS(SVG_NS, 'defs');
        const rootDefs = canvas.querySelector?.('defs');
        if (rootDefs) {
            Array.from(rootDefs.children || []).forEach((child) => {
                defs.appendChild(document.importNode(child, true));
            });
        }

        const clipPathId = `design-export-clip-${Math.random().toString(36).slice(2, 10)}`;
        const clipPath = document.createElementNS(SVG_NS, 'clipPath');
        clipPath.setAttribute('id', clipPathId);
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clipPath.appendChild(buildEditorExportMaskShape(canvas, width, height, { x, y }));
        defs.appendChild(clipPath);
        svg.appendChild(defs);

        const clippedGroup = document.createElementNS(SVG_NS, 'g');
        clippedGroup.setAttribute('clip-path', `url(#${clipPathId})`);

        const whiteBase = document.createElementNS(SVG_NS, 'rect');
        whiteBase.setAttribute('x', String(x));
        whiteBase.setAttribute('y', String(y));
        whiteBase.setAttribute('width', String(width));
        whiteBase.setAttribute('height', String(height));
        whiteBase.setAttribute('fill', '#ffffff');
        clippedGroup.appendChild(whiteBase);

        Array.from(canvas.children || [])
            .filter((node) => {
                if (shouldSkipNode(node)) return false;
                const tagName = String(node.tagName || '').toLowerCase();
                return tagName !== 'defs';
            })
            .forEach((node) => {
                const clone = node.cloneNode(true);
                if (clone.nodeType === 1) {
                    clone.classList?.remove('element-selected');
                    clone.removeAttribute?.('data-lucide');
                }
                clippedGroup.appendChild(clone);
            });

        svg.appendChild(clippedGroup);
        return new XMLSerializer().serializeToString(svg);
    }

    function buildEditorExportMaskShape(canvas, width, height, origin = {}) {
        const shapeOutline = canvas.querySelector?.('#print-area-shape-outline');
        const printOutline = canvas.querySelector?.('#print-area-outline');
        let maskShape = null;

        if (shapeOutline) {
            maskShape = shapeOutline.cloneNode(true);
        } else if (printOutline) {
            maskShape = printOutline.cloneNode(true);
        } else {
            maskShape = document.createElementNS(SVG_NS, 'rect');
            maskShape.setAttribute('x', String(Number(origin.x) || 0));
            maskShape.setAttribute('y', String(Number(origin.y) || 0));
            maskShape.setAttribute('width', String(width));
            maskShape.setAttribute('height', String(height));
        }

        maskShape.removeAttribute?.('id');
        maskShape.removeAttribute?.('pointer-events');
        maskShape.removeAttribute?.('opacity');
        maskShape.removeAttribute?.('stroke');
        maskShape.removeAttribute?.('stroke-width');
        maskShape.removeAttribute?.('stroke-dasharray');
        maskShape.setAttribute?.('fill', '#ffffff');
        maskShape.setAttribute?.('stroke', 'none');

        return maskShape;
    }

    function extractTemplateSvg(templateValue, options = {}) {
        if (!templateValue) {
            return '';
        }

        if (typeof templateValue === 'string') {
            const trimmed = templateValue.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('data:image/svg+xml')) {
                return decodeURIComponent(trimmed.split(',')[1] || '');
            }
            if (trimmed.includes('<svg')) {
                return trimmed;
            }
            return '';
        }

        if (Array.isArray(templateValue)) {
            return buildTemplateSvgFromElements(templateValue, options);
        }

        if (typeof templateValue === 'object') {
            if (typeof templateValue.design_svg === 'string' && templateValue.design_svg.trim()) {
                return templateValue.design_svg.trim();
            }

            if (typeof templateValue.svg === 'string' && templateValue.svg.trim()) {
                return templateValue.svg.trim();
            }

            if (Array.isArray(templateValue.elements)) {
                return buildTemplateSvgFromElements(templateValue.elements, options);
            }
        }

        return '';
    }

    function parseSvgMarkup(svgMarkup) {
        if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return null;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
        const root = doc.documentElement;
        if (!root || root.tagName.toLowerCase() !== 'svg') {
            return null;
        }

        return root;
    }

    function getSvgBox(root, fallback = DEFAULT_SIZE) {
        if (!root) {
            return {
                width: Math.max(1, Number(fallback.width) || DEFAULT_SIZE.width),
                height: Math.max(1, Number(fallback.height) || DEFAULT_SIZE.height)
            };
        }

        const viewBox = String(root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
        if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
            return {
                width: Math.max(1, viewBox[2]),
                height: Math.max(1, viewBox[3])
            };
        }

        const width = Number.parseFloat(root.getAttribute('width') || '');
        const height = Number.parseFloat(root.getAttribute('height') || '');

        return {
            width: Math.max(1, Number.isFinite(width) ? width : Number(fallback.width) || DEFAULT_SIZE.width),
            height: Math.max(1, Number.isFinite(height) ? height : Number(fallback.height) || DEFAULT_SIZE.height)
        };
    }

    function parseBoundsAttribute(value, fallback = null) {
        if (!value) return fallback;
        const parts = String(value).trim().split(/[\s,]+/).map(Number);
        if (parts.length !== 4 || !parts.every(Number.isFinite)) return fallback;
        const [x, y, width, height] = parts;
        if (width <= 0 || height <= 0) return fallback;
        return { x, y, width, height };
    }

    function multiplySvgMatrix(left, right) {
        return {
            a: (left.a * right.a) + (left.c * right.b),
            b: (left.b * right.a) + (left.d * right.b),
            c: (left.a * right.c) + (left.c * right.d),
            d: (left.b * right.c) + (left.d * right.d),
            e: (left.a * right.e) + (left.c * right.f) + left.e,
            f: (left.b * right.e) + (left.d * right.f) + left.f
        };
    }

    function parseSvgTransformMatrix(transformValue) {
        const transform = String(transformValue || '').trim();
        if (!transform) {
            return null;
        }

        let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const transformPattern = /([a-z]+)\(([^)]*)\)/gi;
        let match = null;

        while ((match = transformPattern.exec(transform))) {
            const type = String(match[1] || '').toLowerCase();
            const values = String(match[2] || '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
            if (!values.every(Number.isFinite)) {
                continue;
            }

            let next = null;
            if (type === 'matrix' && values.length >= 6) {
                next = { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
            } else if (type === 'translate') {
                next = { a: 1, b: 0, c: 0, d: 1, e: values[0] || 0, f: values.length > 1 ? values[1] || 0 : 0 };
            } else if (type === 'scale') {
                const sx = values[0] || 1;
                const sy = values.length > 1 ? values[1] || 1 : sx;
                next = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
            }

            if (next) {
                matrix = multiplySvgMatrix(matrix, next);
            }
        }

        return matrix;
    }

    function applyTransformToBounds(bounds, transformValue) {
        const matrix = parseSvgTransformMatrix(transformValue);
        if (!matrix || !bounds) {
            return bounds;
        }

        const x = Number(bounds.x) || 0;
        const y = Number(bounds.y) || 0;
        const width = Math.max(1, Number(bounds.width) || 1);
        const height = Math.max(1, Number(bounds.height) || 1);
        const points = [
            { x, y },
            { x: x + width, y },
            { x, y: y + height },
            { x: x + width, y: y + height }
        ].map((point) => ({
            x: (matrix.a * point.x) + (matrix.c * point.y) + matrix.e,
            y: (matrix.b * point.x) + (matrix.d * point.y) + matrix.f
        }));
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);

        return {
            x: left,
            y: top,
            width: Math.max(1, Math.max(...xs) - left),
            height: Math.max(1, Math.max(...ys) - top)
        };
    }

    function finalizeNodeBounds(node, bounds) {
        return applyTransformToBounds(bounds, node?.getAttribute?.('transform'));
    }

    function pickMaskNode(root) {
        if (!root) return null;

        const geometryTags = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);
        const collectNodes = (node) => {
            if (!node || !node.children) {
                return [];
            }

            return Array.from(node.children).flatMap((child) => {
                const tagName = String(child.tagName || '').toLowerCase();
                if (tagName === 'defs' || tagName === 'title' || tagName === 'desc' || tagName === 'style') {
                    return [];
                }

                return [
                    child,
                    ...collectNodes(child)
                ];
            });
        };

        const candidates = collectNodes(root).filter(Boolean);
        const scored = candidates
            .filter((node) => {
                const tagName = String(node.tagName || '').toLowerCase();
                return geometryTags.has(tagName);
            })
            .map((node) => {
                const tagName = String(node.tagName || '').toLowerCase();
                const id = String(node.getAttribute?.('id') || '').toLowerCase();
                const className = String(node.getAttribute?.('class') || '').toLowerCase();
                const d = String(node.getAttribute?.('d') || '').trim();
                const points = String(node.getAttribute?.('points') || '').trim();
                const stroke = String(node.getAttribute?.('stroke') || '').trim().toLowerCase();
                const fill = String(node.getAttribute?.('fill') || '').trim().toLowerCase();
                const areaLike = tagName === 'path' ? Math.max(1, d.length) : Math.max(1, points.length);
                let score = areaLike;

                if (id.includes('print') || id.includes('shape') || id.includes('outline') || id.includes('mask')) {
                    score += 1000000;
                }

                if (className.includes('cls-1') || className.includes('outline') || className.includes('shape')) {
                    score += 500000;
                }

                if (stroke && stroke !== 'none') {
                    score += 200000;
                }

                if (fill === 'none') {
                    score += 50000;
                }

                return { node, score };
            })
            .sort((left, right) => right.score - left.score);

        return scored.length > 0 ? scored[0].node : candidates[0] || null;
    }

    function getSvgNodeBounds(node, fallback = DEFAULT_SIZE) {
        if (!node) {
            return {
                x: 0,
                y: 0,
                width: Math.max(1, Number(fallback.width) || DEFAULT_SIZE.width),
                height: Math.max(1, Number(fallback.height) || DEFAULT_SIZE.height)
            };
        }

        const tagName = String(node.tagName || '').toLowerCase();
        const xAttr = Number.parseFloat(node.getAttribute?.('x') || '');
        const yAttr = Number.parseFloat(node.getAttribute?.('y') || '');
        const widthAttr = Number.parseFloat(node.getAttribute?.('width') || '');
        const heightAttr = Number.parseFloat(node.getAttribute?.('height') || '');

        if (tagName === 'rect') {
            return finalizeNodeBounds(node, {
                x: Number.isFinite(xAttr) ? xAttr : 0,
                y: Number.isFinite(yAttr) ? yAttr : 0,
                width: Math.max(1, Number.isFinite(widthAttr) ? widthAttr : Number(fallback.width) || DEFAULT_SIZE.width),
                height: Math.max(1, Number.isFinite(heightAttr) ? heightAttr : Number(fallback.height) || DEFAULT_SIZE.height)
            });
        }

        if (tagName === 'circle') {
            const cx = Number.parseFloat(node.getAttribute?.('cx') || '');
            const cy = Number.parseFloat(node.getAttribute?.('cy') || '');
            const radius = Number.parseFloat(node.getAttribute?.('r') || '');
            if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(radius)) {
                return finalizeNodeBounds(node, {
                    x: cx - radius,
                    y: cy - radius,
                    width: Math.max(1, radius * 2),
                    height: Math.max(1, radius * 2)
                });
            }
        }

        if (tagName === 'ellipse') {
            const cx = Number.parseFloat(node.getAttribute?.('cx') || '');
            const cy = Number.parseFloat(node.getAttribute?.('cy') || '');
            const rx = Number.parseFloat(node.getAttribute?.('rx') || '');
            const ry = Number.parseFloat(node.getAttribute?.('ry') || '');
            if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(rx) && Number.isFinite(ry)) {
                return finalizeNodeBounds(node, {
                    x: cx - rx,
                    y: cy - ry,
                    width: Math.max(1, rx * 2),
                    height: Math.max(1, ry * 2)
                });
            }
        }

        if (typeof document !== 'undefined' && document.body && typeof node.cloneNode === 'function') {
            try {
                const tempSvg = document.createElementNS(SVG_NS, 'svg');
                tempSvg.setAttribute('xmlns', SVG_NS);
                tempSvg.setAttribute('width', '0');
                tempSvg.setAttribute('height', '0');
                tempSvg.setAttribute('aria-hidden', 'true');
                tempSvg.style.position = 'absolute';
                tempSvg.style.left = '-99999px';
                tempSvg.style.top = '-99999px';
                tempSvg.style.width = '0';
                tempSvg.style.height = '0';
                tempSvg.style.overflow = 'hidden';

                const clone = node.cloneNode(true);
                tempSvg.appendChild(clone);
                document.body.appendChild(tempSvg);

                const box = typeof clone.getBBox === 'function' ? clone.getBBox() : null;
                tempSvg.remove();

                if (box && Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width) && Number.isFinite(box.height) && box.width > 0 && box.height > 0) {
                    return finalizeNodeBounds(node, {
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height
                    });
                }
            } catch (error) {
                // Fallback below.
            }
        }

        return finalizeNodeBounds(node, {
            x: 0,
            y: 0,
            width: Math.max(1, Number(fallback.width) || DEFAULT_SIZE.width),
            height: Math.max(1, Number(fallback.height) || DEFAULT_SIZE.height)
        });
    }

    function getSvgSourceBounds(root, fallback = DEFAULT_SIZE) {
        if (!root) {
            return {
                x: 0,
                y: 0,
                width: Math.max(1, Number(fallback.width) || DEFAULT_SIZE.width),
                height: Math.max(1, Number(fallback.height) || DEFAULT_SIZE.height)
            };
        }

        const explicitBounds = [
            root.getAttribute('data-personalizable-bounds'),
            root.getAttribute('data-template-bounds'),
            root.getAttribute('data-print-area-bounds'),
            root.dataset?.personalizableBounds,
            root.dataset?.templateBounds,
            root.dataset?.printAreaBounds
        ].map((value) => parseBoundsAttribute(value, null)).find(Boolean);

        if (explicitBounds) {
            return explicitBounds;
        }

        const viewBoxAttr = String(root.getAttribute('viewBox') || '').trim();
        if (viewBoxAttr) {
            const parts = viewBoxAttr.split(/\s+/).map(Number);
            if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
                return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }
        }

        const width = Number.parseFloat(root.getAttribute('width') || '');
        const height = Number.parseFloat(root.getAttribute('height') || '');

        return {
            x: 0,
            y: 0,
            width: Math.max(1, Number.isFinite(width) ? width : Number(fallback.width) || DEFAULT_SIZE.width),
            height: Math.max(1, Number.isFinite(height) ? height : Number(fallback.height) || DEFAULT_SIZE.height)
        };
    }

    function buildPreviewCanvasGeometry(sourceBounds, options = {}) {
        const safeWidth = Math.max(1, Number(sourceBounds?.width) || DEFAULT_SIZE.width);
        const safeHeight = Math.max(1, Number(sourceBounds?.height) || DEFAULT_SIZE.height);
        const ratio = safeWidth / safeHeight;
        const contentLongestSide = PREVIEW_CONTENT_LONGEST_SIDE;
        const requestedFillRatio = Number(options?.contentFillRatio);
        const fillRatio = requestedFillRatio > 0 && requestedFillRatio < 1
            ? requestedFillRatio
            : null;
        const margin = fillRatio
            ? Math.max(12, (contentLongestSide * ((1 / fillRatio) - 1)) / 2)
            : PREVIEW_CANVAS_MARGIN;

        let contentWidth = contentLongestSide;
        let contentHeight = contentLongestSide;

        if (ratio >= 1) {
            contentWidth = contentLongestSide;
            contentHeight = contentLongestSide / ratio;
        } else {
            contentHeight = contentLongestSide;
            contentWidth = contentLongestSide * ratio;
        }

        const canvasWidth = Math.max(200, Math.round(contentWidth + (margin * 2)));
        const canvasHeight = Math.max(200, Math.round(contentHeight + (margin * 2)));
        const uniformScale = Math.min(
            contentWidth / safeWidth,
            contentHeight / safeHeight
        );

        const offsetX = margin + ((contentWidth - (safeWidth * uniformScale)) / 2) - ((Number(sourceBounds?.x) || 0) * uniformScale);
        const offsetY = margin + ((contentHeight - (safeHeight * uniformScale)) / 2) - ((Number(sourceBounds?.y) || 0) * uniformScale);

        return {
            canvasWidth,
            canvasHeight,
            x: offsetX,
            y: offsetY,
            width: safeWidth * uniformScale,
            height: safeHeight * uniformScale,
            scale: uniformScale,
            transform: `translate(${offsetX} ${offsetY}) scale(${uniformScale} ${uniformScale})`
        };
    }

    function buildContainTransform(sourceBounds, targetBounds) {
        const safeSourceWidth = Math.max(1, Number(sourceBounds?.width) || DEFAULT_SIZE.width);
        const safeSourceHeight = Math.max(1, Number(sourceBounds?.height) || DEFAULT_SIZE.height);
        const safeTargetWidth = Math.max(1, Number(targetBounds?.width) || DEFAULT_SIZE.width);
        const safeTargetHeight = Math.max(1, Number(targetBounds?.height) || DEFAULT_SIZE.height);
        const safeTargetX = Number(targetBounds?.x) || 0;
        const safeTargetY = Number(targetBounds?.y) || 0;
        const safeSourceX = Number(sourceBounds?.x) || 0;
        const safeSourceY = Number(sourceBounds?.y) || 0;

        const scale = Math.min(
            safeTargetWidth / safeSourceWidth,
            safeTargetHeight / safeSourceHeight
        );

        const renderedWidth = safeSourceWidth * scale;
        const renderedHeight = safeSourceHeight * scale;
        const offsetX = safeTargetX + ((safeTargetWidth - renderedWidth) / 2) - (safeSourceX * scale);
        const offsetY = safeTargetY + ((safeTargetHeight - renderedHeight) / 2) - (safeSourceY * scale);

        return `translate(${offsetX} ${offsetY}) scale(${scale} ${scale})`;
    }

    function composeSvgTransforms(outerTransform, innerTransform) {
        return [outerTransform, innerTransform]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .join(' ');
    }

    function buildPreviewOutlineNode(maskNode, transform) {
        const outlineNode = maskNode.cloneNode(true);
        const originalTransform = outlineNode.getAttribute?.('transform') || '';
        outlineNode.removeAttribute?.('id');
        outlineNode.removeAttribute?.('pointer-events');
        outlineNode.removeAttribute?.('opacity');
        outlineNode.removeAttribute?.('fill');
        outlineNode.removeAttribute?.('stroke');
        outlineNode.removeAttribute?.('stroke-width');
        outlineNode.removeAttribute?.('stroke-dasharray');
        outlineNode.setAttribute?.('fill', 'none');
        outlineNode.setAttribute?.('stroke', '#ef4825');
        outlineNode.setAttribute?.('stroke-width', '2');
        outlineNode.setAttribute?.('vector-effect', 'non-scaling-stroke');
        outlineNode.setAttribute?.('opacity', '0.9');
        outlineNode.setAttribute?.('stroke-linecap', 'round');
        outlineNode.setAttribute?.('stroke-linejoin', 'round');
        outlineNode.setAttribute?.('pointer-events', 'none');
        const combinedTransform = composeSvgTransforms(transform, originalTransform);
        if (combinedTransform) {
            outlineNode.setAttribute?.('transform', combinedTransform);
        } else {
            outlineNode.removeAttribute?.('transform');
        }
        return outlineNode;
    }

    function buildPreviewOutlineHaloNode(maskNode, transform) {
        const haloNode = maskNode.cloneNode(true);
        const originalTransform = haloNode.getAttribute?.('transform') || '';
        haloNode.removeAttribute?.('id');
        haloNode.removeAttribute?.('pointer-events');
        haloNode.removeAttribute?.('opacity');
        haloNode.removeAttribute?.('fill');
        haloNode.removeAttribute?.('stroke');
        haloNode.removeAttribute?.('stroke-width');
        haloNode.removeAttribute?.('stroke-dasharray');
        haloNode.setAttribute?.('fill', 'none');
        haloNode.setAttribute?.('stroke', '#ffffff');
        haloNode.setAttribute?.('stroke-width', '4');
        haloNode.setAttribute?.('vector-effect', 'non-scaling-stroke');
        haloNode.setAttribute?.('opacity', '0.85');
        haloNode.setAttribute?.('stroke-linecap', 'round');
        haloNode.setAttribute?.('stroke-linejoin', 'round');
        haloNode.setAttribute?.('pointer-events', 'none');
        const combinedTransform = composeSvgTransforms(transform, originalTransform);
        if (combinedTransform) {
            haloNode.setAttribute?.('transform', combinedTransform);
        } else {
            haloNode.removeAttribute?.('transform');
        }
        return haloNode;
    }

    function buildPreviewMaskNode(maskNode, transform) {
        const maskNodeClone = maskNode.cloneNode(true);
        const originalTransform = maskNodeClone.getAttribute?.('transform') || '';
        maskNodeClone.removeAttribute?.('id');
        maskNodeClone.removeAttribute?.('pointer-events');
        maskNodeClone.removeAttribute?.('opacity');
        maskNodeClone.removeAttribute?.('stroke');
        maskNodeClone.removeAttribute?.('stroke-width');
        maskNodeClone.removeAttribute?.('stroke-dasharray');
        maskNodeClone.setAttribute?.('fill', '#ffffff');
        maskNodeClone.setAttribute?.('stroke', 'none');
        maskNodeClone.setAttribute?.('pointer-events', 'none');
        const combinedTransform = composeSvgTransforms(transform, originalTransform);
        if (combinedTransform) {
            maskNodeClone.setAttribute?.('transform', combinedTransform);
        } else {
            maskNodeClone.removeAttribute?.('transform');
        }
        return maskNodeClone;
    }

    function isMaskedExportSvgRoot(root) {
        if (!root) return false;
        const clip = root.querySelector('clipPath[id^="design-export-clip"]');
        const clippedGroup = root.querySelector('g[clip-path*="design-export-clip"]');
        return Boolean(clip && clippedGroup);
    }

    function getMaskedExportClipNode(root) {
        if (!root) {
            return null;
        }

        const clip = root.querySelector('clipPath[id^="design-export-clip"], clipPath#design-export-clip');
        if (!clip) {
            return null;
        }

        return Array.from(clip.children || []).find((child) => {
            const tagName = String(child?.tagName || '').toLowerCase();
            return tagName && tagName !== 'title' && tagName !== 'desc' && tagName !== 'metadata';
        }) || null;
    }

    function getMaskedExportClippedGroup(root) {
        if (!root) {
            return null;
        }

        return root.querySelector('g[clip-path*="design-export-clip"]');
    }

    function getMaskedExportClipBounds(root, fallback = null) {
        const clipShape = getMaskedExportClipNode(root);
        return clipShape
            ? getSvgNodeBounds(clipShape, fallback || DEFAULT_SIZE)
            : fallback;
    }

    function buildMaskedExportPreviewMarkup(root, fallback = DEFAULT_SIZE) {
        if (!root || typeof document === 'undefined' || typeof XMLSerializer === 'undefined') {
            return '';
        }

        const clippedGroup = getMaskedExportClippedGroup(root);
        const clipBounds = getMaskedExportClipBounds(root, fallback || DEFAULT_SIZE);

        if (!clippedGroup || !clipBounds) {
            return '';
        }

        const previewSvg = document.createElementNS(SVG_NS, 'svg');
        previewSvg.setAttribute('xmlns', SVG_NS);
        previewSvg.setAttribute('viewBox', `${clipBounds.x} ${clipBounds.y} ${clipBounds.width} ${clipBounds.height}`);
        previewSvg.setAttribute('width', String(Math.max(1, clipBounds.width)));
        previewSvg.setAttribute('height', String(Math.max(1, clipBounds.height)));
        previewSvg.setAttribute('preserveAspectRatio', 'none');
        previewSvg.setAttribute('data-personalizable-bounds', `${clipBounds.x} ${clipBounds.y} ${clipBounds.width} ${clipBounds.height}`);

        const rootDefs = root.querySelector('defs');
        if (rootDefs) {
            const defs = document.createElementNS(SVG_NS, 'defs');
            Array.from(rootDefs.children || []).forEach((child) => {
                defs.appendChild(document.importNode(child, true));
            });

            if (defs.children.length > 0) {
                previewSvg.appendChild(defs);
            }
        }

        previewSvg.appendChild(document.importNode(clippedGroup, true));

        return new XMLSerializer().serializeToString(previewSvg);
    }

    function buildMaskedExportPreviewDataUrl(designSvg, fallback = DEFAULT_SIZE) {
        const previewMarkup = extractTemplateSvg(designSvg, {});
        const previewRoot = previewMarkup ? parseSvgMarkup(previewMarkup) : null;
        if (!previewRoot || !isMaskedExportSvgRoot(previewRoot)) {
            return '';
        }

        const croppedMarkup = buildMaskedExportPreviewMarkup(previewRoot, fallback);
        return croppedMarkup ? toDataUrlFromSvgMarkup(croppedMarkup) : '';
    }

    function getSvgAspectRatio(svgMarkup, fallback = 1) {
        const root = parseSvgMarkup(typeof svgMarkup === 'string' ? svgMarkup : '');
        if (!root) {
            return fallback;
        }

        const box = getSvgBox(root, DEFAULT_SIZE);
        if (!box.width || !box.height) {
            return fallback;
        }

        return box.width / box.height;
    }

    function toDataUrlFromSvgMarkup(svgMarkup) {
        if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return '';
        }

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup.trim())}`;
    }

    function toPreviewImageSource(previewValue, options = {}) {
        if (typeof previewValue !== 'string') {
            return '';
        }

        const trimmed = previewValue.trim();
        if (!trimmed) {
            return '';
        }

        if (trimmed.startsWith('data:image/svg+xml')) {
            return trimmed;
        }

        if (trimmed.includes('<svg')) {
            const svgMarkup = extractTemplateSvg(trimmed, options) || trimmed;
            return toDataUrlFromSvgMarkup(svgMarkup);
        }

        return trimmed;
    }

    function buildFramedPreviewSvgMarkup(previewValue, options = {}) {
        const previewMarkup = extractTemplateSvg(previewValue, options);
        const previewRoot = previewMarkup ? parseSvgMarkup(previewMarkup) : null;
        if (!previewRoot) {
            return '';
        }

        const fallbackSourceBounds = getSvgSourceBounds(previewRoot, DEFAULT_SIZE);
        const sourceBounds = normalizeBounds(options.sourceBounds || fallbackSourceBounds, fallbackSourceBounds);
        const fillRatioCandidate = Number(options.contentFillRatio);
        const fillRatio = fillRatioCandidate > 0 && fillRatioCandidate < 1
            ? fillRatioCandidate
            : 0.9;
        const previewGeometry = buildPreviewCanvasGeometry(sourceBounds, { contentFillRatio: fillRatio });
        const previewTargetBounds = {
            x: previewGeometry.x,
            y: previewGeometry.y,
            width: previewGeometry.width,
            height: previewGeometry.height
        };
        const previewTransform = buildContainTransform(sourceBounds, previewTargetBounds);
        const wrapper = document.createElementNS(SVG_NS, 'svg');
        const defs = document.createElementNS(SVG_NS, 'defs');

        wrapper.setAttribute('xmlns', SVG_NS);
        wrapper.setAttribute('viewBox', `0 0 ${previewGeometry.canvasWidth} ${previewGeometry.canvasHeight}`);
        wrapper.setAttribute('width', String(previewGeometry.canvasWidth));
        wrapper.setAttribute('height', String(previewGeometry.canvasHeight));
        wrapper.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        wrapper.setAttribute('style', buildStyleString({
            display: 'block',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            'background-color': options.backgroundColor || 'transparent'
        }));

        const background = document.createElementNS(SVG_NS, 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', String(previewGeometry.canvasWidth));
        background.setAttribute('height', String(previewGeometry.canvasHeight));
        background.setAttribute('fill', options.backgroundColor || 'transparent');
        wrapper.appendChild(background);

        const previewDefs = previewRoot.querySelector('defs');
        if (previewDefs) {
            Array.from(previewDefs.children || []).forEach((child) => {
                defs.appendChild(document.importNode(child, true));
            });
        }
        if (defs.children.length > 0) {
            wrapper.appendChild(defs);
        }

        const previewGroup = document.createElementNS(SVG_NS, 'g');
        previewGroup.setAttribute('transform', previewTransform);
        Array.from(previewRoot.children || []).forEach((child) => {
            const tagName = String(child.tagName || '').toLowerCase();
            if (tagName === 'defs' || tagName === 'title' || tagName === 'desc') {
                return;
            }
            previewGroup.appendChild(document.importNode(child, true));
        });
        wrapper.appendChild(previewGroup);

        if (options.includeOutline && options.outlineNode?.cloneNode) {
            const outlineNode = buildPreviewOutlineNode(options.outlineNode, previewTransform);
            wrapper.appendChild(outlineNode);
        }

        return new XMLSerializer().serializeToString(wrapper);
    }

    function buildPreviewCacheKey(previewValue, maskValue, options = {}) {
        const serialize = (value) => {
            if (typeof value === 'string') return value;
            if (Array.isArray(value)) return JSON.stringify(value);
            if (value && typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch (error) {
                    return String(value);
                }
            }
            return String(value || '');
        };

        return [
            PREVIEW_MARKUP_CACHE_VERSION,
            serialize(previewValue),
            serialize(maskValue),
            serialize({
                backgroundColor: options.backgroundColor || '',
                contentFillRatio: Number(options.contentFillRatio) || '',
                includeOutline: options.includeOutline === false ? '0' : '1'
            })
        ].join('||');
    }

    function cachePreviewMarkup(cacheKey, markup) {
        if (!cacheKey || typeof markup !== 'string') {
            return;
        }

        if (PREVIEW_MARKUP_CACHE.size >= PREVIEW_MARKUP_CACHE_LIMIT) {
            const firstKey = PREVIEW_MARKUP_CACHE.keys().next().value;
            if (firstKey) {
                PREVIEW_MARKUP_CACHE.delete(firstKey);
            }
        }

        PREVIEW_MARKUP_CACHE.set(cacheKey, markup);
    }

    function buildNormalizedProductPreviewSvg({
        designSvg,
        designDocument,
        productSvg,
        fillRatio = 0.9,
        includeOutline = true,
        backgroundColor = 'transparent'
    } = {}) {
        const normalizedDocument = unwrapDesignDocumentV2(designDocument || designSvg);
        if (normalizedDocument) {
            return buildMaskedProductPreview({
                designDocument: normalizedDocument,
                productSvg,
                fillRatio,
                includeOutline,
                backgroundColor
            });
        }

        const extractedPreviewMarkup = extractTemplateSvg(designSvg, {});
        const extractedPreviewRoot = extractedPreviewMarkup ? parseSvgMarkup(extractedPreviewMarkup) : null;
        const isPreClippedPreview = Boolean(extractedPreviewRoot && isMaskedExportSvgRoot(extractedPreviewRoot));
        // Editor exports keep original canvas coordinates plus a clipPath; crop them to the print area first
        // so downstream thumbnail scaling works from the visible design bounds instead of the full canvas.
        const previewMarkup = isPreClippedPreview
            ? (buildMaskedExportPreviewMarkup(extractedPreviewRoot, DEFAULT_SIZE) || extractedPreviewMarkup)
            : extractedPreviewMarkup;
        const previewRoot = previewMarkup ? parseSvgMarkup(previewMarkup) : null;
        const previewSource = previewMarkup
            ? toDataUrlFromSvgMarkup(previewMarkup)
            : toPreviewImageSource(designSvg, {});
        const maskMarkup = extractTemplateSvg(productSvg, {});
        const maskRoot = maskMarkup ? parseSvgMarkup(maskMarkup) : null;
        const previewHref = previewMarkup
            ? toDataUrlFromSvgMarkup(previewMarkup)
            : previewSource;

        if (!maskRoot || !previewHref) {
            return '';
        }

        const maskNode = pickMaskNode(maskRoot);
        if (!maskNode) {
            return '';
        }

        const maskSourceBounds = getSvgSourceBounds(maskRoot, DEFAULT_SIZE);
        const printAreaBounds = getSvgNodeBounds(maskNode, maskSourceBounds);
        const previewSourceBounds = previewRoot
            ? getSvgSourceBounds(previewRoot, printAreaBounds)
            : printAreaBounds;

        const previewGeometry = buildPreviewCanvasGeometry(printAreaBounds, { contentFillRatio: fillRatio });
        const previewTargetBounds = {
            x: previewGeometry.x,
            y: previewGeometry.y,
            width: previewGeometry.width,
            height: previewGeometry.height
        };
        const maskTransform = buildContainTransform(printAreaBounds, previewTargetBounds);
        const previewTransform = buildContainTransform(previewSourceBounds, previewTargetBounds);
        const wrapperViewBox = `0 0 ${previewGeometry.canvasWidth} ${previewGeometry.canvasHeight}`;
        const wrapper = document.createElementNS(SVG_NS, 'svg');
        wrapper.setAttribute('xmlns', SVG_NS);
        wrapper.setAttribute('viewBox', wrapperViewBox);
        wrapper.setAttribute('width', '100%');
        wrapper.setAttribute('height', '100%');
        wrapper.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        wrapper.setAttribute('style', buildStyleString({
            display: 'block',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            'background-color': backgroundColor || 'transparent'
        }));

        const background = document.createElementNS(SVG_NS, 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', String(previewGeometry.canvasWidth));
        background.setAttribute('height', String(previewGeometry.canvasHeight));
        background.setAttribute('fill', backgroundColor || 'transparent');
        wrapper.appendChild(background);

        const defs = document.createElementNS(SVG_NS, 'defs');
        const maskId = `design-preview-mask-${Math.random().toString(36).slice(2, 10)}`;
        const mask = document.createElementNS(SVG_NS, 'mask');
        mask.setAttribute('id', maskId);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('maskContentUnits', 'userSpaceOnUse');

        const blackRect = document.createElementNS(SVG_NS, 'rect');
        blackRect.setAttribute('x', '0');
        blackRect.setAttribute('y', '0');
        blackRect.setAttribute('width', String(previewGeometry.canvasWidth));
        blackRect.setAttribute('height', String(previewGeometry.canvasHeight));
        blackRect.setAttribute('fill', '#000000');
        mask.appendChild(blackRect);

        const previewMaskNode = buildPreviewMaskNode(maskNode, maskTransform);
        mask.appendChild(previewMaskNode);
        defs.appendChild(mask);
        wrapper.appendChild(defs);

        const maskedWhiteBase = document.createElementNS(SVG_NS, 'rect');
        maskedWhiteBase.setAttribute('x', '0');
        maskedWhiteBase.setAttribute('y', '0');
        maskedWhiteBase.setAttribute('width', String(previewGeometry.canvasWidth));
        maskedWhiteBase.setAttribute('height', String(previewGeometry.canvasHeight));
        maskedWhiteBase.setAttribute('fill', '#ffffff');
        maskedWhiteBase.setAttribute('mask', `url(#${maskId})`);
        wrapper.appendChild(maskedWhiteBase);

        if (previewRoot && !isPreClippedPreview) {
            const previewDefs = previewRoot.querySelector('defs');
            if (previewDefs) {
                Array.from(previewDefs.children || []).forEach((child) => {
                    defs.appendChild(document.importNode(child, true));
                });
            }

            const previewGroup = document.createElementNS(SVG_NS, 'g');
            previewGroup.setAttribute('mask', `url(#${maskId})`);
            previewGroup.setAttribute('transform', previewTransform);

            Array.from(previewRoot.children || []).forEach((child) => {
                const tagName = String(child.tagName || '').toLowerCase();
                if (tagName === 'defs' || tagName === 'title' || tagName === 'desc') {
                    return;
                }
                previewGroup.appendChild(document.importNode(child, true));
            });

            wrapper.appendChild(previewGroup);
        } else {
            const image = document.createElementNS(SVG_NS, 'image');
            image.setAttribute('href', previewHref);
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', previewHref);
            image.setAttribute('x', String(previewSourceBounds.x));
            image.setAttribute('y', String(previewSourceBounds.y));
            image.setAttribute('width', String(previewSourceBounds.width));
            image.setAttribute('height', String(previewSourceBounds.height));
            image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            image.setAttribute('mask', `url(#${maskId})`);
            image.setAttribute('transform', previewTransform);
            wrapper.appendChild(image);
        }

        if (includeOutline) {
            const previewOutlineNode = buildPreviewOutlineNode(maskNode, maskTransform);
            wrapper.appendChild(previewOutlineNode);
        }

        return new XMLSerializer().serializeToString(wrapper);
    }

    function buildNormalizedProductPreviewDataUrl(options = {}) {
        const markup = buildNormalizedProductPreviewSvg(options);
        return markup ? toDataUrlFromSvgMarkup(markup) : '';
    }

    function buildMaskedProductPreview({
        designDocument,
        productSvg,
        fillRatio = 0.9,
        includeOutline = true,
        backgroundColor = 'transparent'
    } = {}) {
        const normalizedDocument = unwrapDesignDocumentV2(designDocument);
        if (!normalizedDocument) {
            return '';
        }

        const fallbackPrintArea = normalizeBounds(normalizedDocument.printAreaRef, DEFAULT_SIZE);
        const maskMarkup = extractTemplateSvg(productSvg, {});
        const maskRoot = maskMarkup ? parseSvgMarkup(maskMarkup) : null;
        const maskNode = maskRoot ? pickMaskNode(maskRoot) : null;
        if (!maskNode) {
            return '';
        }

        const maskSourceBounds = getSvgSourceBounds(maskRoot, fallbackPrintArea);
        const printAreaBounds = getSvgNodeBounds(maskNode, maskSourceBounds);
        const sourceBounds = normalizeBounds(printAreaBounds, fallbackPrintArea);
        const previewGeometry = buildPreviewCanvasGeometry(sourceBounds, { contentFillRatio: fillRatio });
        const previewTargetBounds = {
            x: previewGeometry.x,
            y: previewGeometry.y,
            width: previewGeometry.width,
            height: previewGeometry.height
        };
        const sourceTransform = buildContainTransform(sourceBounds, previewTargetBounds);
        const wrapper = document.createElementNS(SVG_NS, 'svg');
        const defs = document.createElementNS(SVG_NS, 'defs');
        const maskId = `design-preview-mask-${Math.random().toString(36).slice(2, 10)}`;
        const mask = document.createElementNS(SVG_NS, 'mask');

        wrapper.setAttribute('xmlns', SVG_NS);
        wrapper.setAttribute('viewBox', `0 0 ${previewGeometry.canvasWidth} ${previewGeometry.canvasHeight}`);
        wrapper.setAttribute('width', '100%');
        wrapper.setAttribute('height', '100%');
        wrapper.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        wrapper.setAttribute('style', buildStyleString({
            display: 'block',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            'background-color': backgroundColor || 'transparent'
        }));

        const background = document.createElementNS(SVG_NS, 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', String(previewGeometry.canvasWidth));
        background.setAttribute('height', String(previewGeometry.canvasHeight));
        background.setAttribute('fill', backgroundColor || 'transparent');
        wrapper.appendChild(background);

        mask.setAttribute('id', maskId);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('maskContentUnits', 'userSpaceOnUse');

        const blackRect = document.createElementNS(SVG_NS, 'rect');
        blackRect.setAttribute('x', '0');
        blackRect.setAttribute('y', '0');
        blackRect.setAttribute('width', String(previewGeometry.canvasWidth));
        blackRect.setAttribute('height', String(previewGeometry.canvasHeight));
        blackRect.setAttribute('fill', '#000000');
        mask.appendChild(blackRect);
        mask.appendChild(buildPreviewMaskNode(maskNode, sourceTransform));
        defs.appendChild(mask);
        wrapper.appendChild(defs);

        const whiteBase = document.createElementNS(SVG_NS, 'rect');
        whiteBase.setAttribute('x', '0');
        whiteBase.setAttribute('y', '0');
        whiteBase.setAttribute('width', String(previewGeometry.canvasWidth));
        whiteBase.setAttribute('height', String(previewGeometry.canvasHeight));
        whiteBase.setAttribute('fill', '#ffffff');
        whiteBase.setAttribute('mask', `url(#${maskId})`);
        wrapper.appendChild(whiteBase);

        const contentGroup = document.createElementNS(SVG_NS, 'g');
        contentGroup.setAttribute('mask', `url(#${maskId})`);
        contentGroup.setAttribute('transform', sourceTransform);
        appendDesignDocumentElements(contentGroup, normalizedDocument, printAreaBounds);
        wrapper.appendChild(contentGroup);

        if (includeOutline) {
            wrapper.appendChild(buildPreviewOutlineNode(maskNode, sourceTransform));
        }

        return new XMLSerializer().serializeToString(wrapper);
    }

    function buildPreviewSvgMarkup(previewValue, maskValue = null, options = {}) {
        const cacheKey = buildPreviewCacheKey(previewValue, maskValue, options);
        if (PREVIEW_MARKUP_CACHE.has(cacheKey)) {
            return PREVIEW_MARKUP_CACHE.get(cacheKey);
        }

        const previewMarkup = extractTemplateSvg(previewValue, options);
        const previewSource = toPreviewImageSource(previewValue, options);
        const previewRoot = previewMarkup ? parseSvgMarkup(previewMarkup) : null;
        const maskMarkup = maskValue ? extractTemplateSvg(maskValue, options) : '';

        if (!maskMarkup) {
            if (previewMarkup) {
                const framedPreviewMarkup = buildFramedPreviewSvgMarkup(previewMarkup, {
                    backgroundColor: options.backgroundColor || 'transparent',
                    contentFillRatio: Number(options.contentFillRatio) || 0.9,
                    includeOutline: false
                }) || previewMarkup;
                cachePreviewMarkup(cacheKey, framedPreviewMarkup);
                return framedPreviewMarkup;
            }

            if (previewSource) {
                const fallbackMarkup = `<img src="${escapeXml(previewSource)}" alt="" style="display:block;width:90%;height:90%;margin:5%;object-fit:contain;background-color:${escapeXml(options.backgroundColor || 'transparent')};" loading="lazy">`;
                cachePreviewMarkup(cacheKey, fallbackMarkup);
                return fallbackMarkup;
            }

            return '';
        }

        const maskRoot = parseSvgMarkup(maskMarkup);
        const previewHref = previewMarkup
            ? toDataUrlFromSvgMarkup(previewMarkup)
            : previewSource;

        if (!maskRoot || !previewHref) {
            if (previewMarkup) {
                const framedPreviewMarkup = buildFramedPreviewSvgMarkup(previewMarkup, {
                    backgroundColor: options.backgroundColor || 'transparent',
                    contentFillRatio: Number(options.contentFillRatio) || 0.9,
                    includeOutline: false
                }) || previewMarkup;
                cachePreviewMarkup(cacheKey, framedPreviewMarkup);
                return framedPreviewMarkup;
            }

            if (previewSource) {
                const fallbackMarkup = `<img src="${escapeXml(previewSource)}" alt="" style="display:block;width:90%;height:90%;margin:5%;object-fit:contain;background-color:${escapeXml(options.backgroundColor || 'transparent')};" loading="lazy">`;
                cachePreviewMarkup(cacheKey, fallbackMarkup);
                return fallbackMarkup;
            }

            return '';
        }

        const serialized = buildNormalizedProductPreviewSvg({
            designSvg: previewValue,
            productSvg: maskValue,
            fillRatio: Number(options.contentFillRatio) || 0.9,
            includeOutline: options.includeOutline !== false,
            backgroundColor: options.backgroundColor || 'transparent'
        });

        if (!serialized) {
            if (previewMarkup) {
                const framedPreviewMarkup = buildFramedPreviewSvgMarkup(previewMarkup, {
                    backgroundColor: options.backgroundColor || 'transparent',
                    contentFillRatio: Number(options.contentFillRatio) || 0.9,
                    includeOutline: false
                }) || previewMarkup;
                cachePreviewMarkup(cacheKey, framedPreviewMarkup);
                return framedPreviewMarkup;
            }

            const fallbackMarkup = `<img src="${escapeXml(previewHref)}" alt="" style="display:block;width:90%;height:90%;margin:5%;object-fit:contain;background-color:${escapeXml(options.backgroundColor || 'transparent')};" loading="lazy">`;
            cachePreviewMarkup(cacheKey, fallbackMarkup);
            return fallbackMarkup;
        }

        cachePreviewMarkup(cacheKey, serialized);
        return serialized;
    }

    function importSvgIntoEditor(editor, svgMarkup, options = {}) {
        const canvas = editor?.canvas;
        if (!canvas || typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return false;
        }

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgMarkup, 'image/svg+xml');
        const root = svgDoc.documentElement;
        if (!root || root.tagName.toLowerCase() !== 'svg') {
            return false;
        }

        const sourceBounds = getSvgSourceBounds(root, editor?.getCanvasViewBoxSize?.() || DEFAULT_SIZE);
        if (typeof editor?.setCanvasViewBoxFromBounds === 'function') {
            editor.setCanvasViewBoxFromBounds(sourceBounds);
        }

        if (typeof editor.clearCanvas === 'function') {
            editor.clearCanvas();
        }

        const importedDefs = root.querySelector('defs');
        if (importedDefs) {
            canvas.appendChild(document.importNode(importedDefs, true));
        }

        const editableNodes = Array.from(root.querySelectorAll('[data-editable="true"]'));
        if (editableNodes.length === 0) {
            Array.from(root.children).forEach((node) => {
                if (shouldSkipNode(node) || node.tagName.toLowerCase() === 'defs') {
                    return;
                }
                editableNodes.push(node);
            });
        }

        editableNodes.forEach((node) => {
            const imported = document.importNode(node, true);
            canvas.appendChild(imported);

            if (typeof editor.buildElementDataFromNode === 'function') {
                const elementData = editor.buildElementDataFromNode(imported);
                editor.elements.push(elementData);
                if (typeof editor.makeElementInteractive === 'function') {
                    editor.makeElementInteractive(elementData);
                }
            }
        });

        if (typeof editor.bringPrintAreaOverlaysToFront === 'function') {
            editor.bringPrintAreaOverlaysToFront();
        }

        if (typeof editor.updateLayers === 'function') {
            editor.updateLayers();
        }

        if (typeof editor.saveHistory === 'function') {
            editor.saveHistory();
        }

        return true;
    }

    function buildTemplateDataFromDesignDocumentElement(element, printAreaBounds) {
        const frame = resolveFrameFromBounds(element?.frame, printAreaBounds);
        const rotation = toNumber(element?.rotationDeg, 0);
        const flipX = Boolean(element?.flipX);
        const flipY = Boolean(element?.flipY);
        const type = String(element?.type || '').toLowerCase();

        if (type === 'text') {
            const anchorOffset = element.anchorOffset && typeof element.anchorOffset === 'object'
                ? element.anchorOffset
                : {};
            const fontSize = Math.max(1, toNumber(element.fontSizeRatio, 24 / Math.max(1, printAreaBounds.height)) * printAreaBounds.height);
            return {
                id: element.id,
                type: 'text',
                x: frame.x + (frame.width * toNumber(anchorOffset.xRatio, 0)),
                y: frame.y + (frame.height * toNumber(anchorOffset.yRatio, 1)),
                width: frame.width,
                height: frame.height,
                rotation,
                flipX,
                flipY,
                rawContent: String(element.rawContent ?? element.content ?? ''),
                content: String(element.content ?? element.rawContent ?? ''),
                capsLock: Boolean(element.capsLock),
                font: String(element.fontFamily || 'Arial'),
                size: fontSize,
                color: String(element.fill || '#000000'),
                bold: String(element.fontWeight || '').toLowerCase() === 'bold',
                italic: String(element.fontStyle || '').toLowerCase() === 'italic',
                underline: String(element.textDecoration || '').toLowerCase().includes('underline'),
                textAnchor: String(element.textAnchor || 'start'),
                dominantBaseline: String(element.dominantBaseline || '')
            };
        }

        if (type === 'image') {
            return {
                id: element.id,
                type: 'image',
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
                rotation,
                flipX,
                flipY,
                src: String(element.src || ''),
                name: String(element.name || 'Imagem'),
                imageKind: String(element.imageKind || 'image'),
                opacity: toNumber(element.opacity, 1),
                objectFit: String(element.objectFit || 'contain'),
                borderRadius: toNumber(element.borderRadius, 0),
                cropData: element.crop && typeof element.crop === 'object' ? element.crop : null,
                fullWidth: Number(element.fullWidth) || 0,
                fullHeight: Number(element.fullHeight) || 0,
                qrContent: String(element.qrContent || ''),
                qrColor: String(element.qrColor || '#111827'),
                originalSrc: String(element.originalSrc || element.src || ''),
                layerLabel: String(element.layerLabel || '')
            };
        }

        if (type === 'shape') {
            return {
                id: element.id,
                type: 'shape',
                shapeType: String(element.shapeType || 'rectangle'),
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
                rotation,
                flipX,
                flipY,
                fill: String(element.fill || '#3b82f6'),
                stroke: String(element.stroke || 'none'),
                strokeWidth: toNumber(element.strokeWidth, 0)
            };
        }

        return null;
    }

    function importDesignDocumentV2IntoEditor(editor, designDocumentInput, options = {}) {
        const designDocument = unwrapDesignDocumentV2(designDocumentInput);
        if (!editor?.canvas || !designDocument) {
            return false;
        }

        const printAreaBounds = getEditorPrintAreaBounds(editor);
        if (typeof editor.clearCanvas === 'function') {
            editor.clearCanvas();
        }

        const elements = Array.isArray(designDocument.elements) ? [...designDocument.elements] : [];
        elements
            .sort((left, right) => toNumber(left?.zIndex, 0) - toNumber(right?.zIndex, 0))
            .forEach((element) => {
                const templateData = buildTemplateDataFromDesignDocumentElement(element, printAreaBounds);
                if (!templateData || typeof editor.createElementFromTemplate !== 'function') {
                    return;
                }

                const created = editor.createElementFromTemplate(templateData, {
                    skipHistory: true,
                    skipSelection: true
                });
                if (created) {
                    created.flipX = Boolean(templateData.flipX);
                    created.flipY = Boolean(templateData.flipY);
                    editor.syncElementMetadata?.(created);
                    editor.applyElementRotation?.(created, created.rotation || 0);
                }
            });

        if (Number.isFinite(Number(designDocument.selectedBaseId))) {
            editor.selectedBaseId = Number(designDocument.selectedBaseId);
            editor.renderProductBaseOptions?.();
            editor.updateProductPriceDisplay?.();
        }

        editor.bringPrintAreaOverlaysToFront?.();
        editor.updateLayers?.();
        if (!options.skipHistory) {
            editor.saveHistory?.();
        }

        return true;
    }

    window.DesignSvgStore = {
        DEFAULT_SIZE,
        DESIGN_DOCUMENT_V2_FORMAT,
        escapeXml,
        normalizeTemplateElement,
        buildTemplateSvgFromElements,
        getSvgAspectRatio,
        serializeDesignDocumentV2,
        renderDesignDocumentV2ToSvg,
        buildMaskedProductPreview,
        buildMaskedExportPreviewDataUrl,
        buildNormalizedProductPreviewSvg,
        buildNormalizedProductPreviewDataUrl,
        buildFramedPreviewSvgMarkup,
        buildPreviewSvgMarkup,
        serializeEditorToSvg,
        extractTemplateSvg,
        importSvgIntoEditor,
        importDesignDocumentV2IntoEditor,
        unwrapDesignDocumentV2
    };
}());
