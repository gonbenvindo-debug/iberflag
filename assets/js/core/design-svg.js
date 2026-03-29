// ============================================================
// DESIGN SVG STORE
// ============================================================
(function () {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DEFAULT_SIZE = { width: 800, height: 600 };
    const EXCLUDED_IDS = new Set([
        'print-area-outline',
        'print-area-shape-outline',
        'print-area-outside-overlay',
        'print-area-outside-grid',
        'resize-handles'
    ]);
    const EXCLUDED_CLASSES = new Set([
        'resize-handle',
        'crop-handle',
        'guide-line',
        'element-selected'
    ]);
    const PREVIEW_MARKUP_CACHE = new Map();
    const PREVIEW_MARKUP_CACHE_LIMIT = 200;

    function toNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function escapeXml(value) {
        return String(value ?? '')
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
            id: String(data.id ?? properties.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            type,
            x: toNumber(data.x ?? properties.x ?? 0),
            y: toNumber(data.y ?? properties.y ?? 0),
            width: toNumber(data.width ?? properties.width ?? widthFallback),
            height: toNumber(data.height ?? properties.height ?? heightFallback),
            rotation: toNumber(data.rotation ?? properties.rotation ?? 0)
        };

        if (type === 'text') {
            normalized.content = data.content ?? properties.text ?? 'Texto';
            normalized.font = data.font ?? properties.fontFamily ?? 'Arial';
            normalized.size = toNumber(data.size ?? properties.fontSize ?? 24);
            normalized.color = data.color ?? properties.color ?? '#000000';
            normalized.bold = Boolean(data.bold ?? String(properties.fontWeight || '').toLowerCase() === 'bold');
            normalized.italic = Boolean(data.italic ?? String(properties.fontStyle || '').toLowerCase() === 'italic');
            normalized.textAlign = String(
                data.textAlign
                    ?? properties.textAlign
                    ?? properties.align
                    ?? 'center'
            ).toLowerCase();
            normalized.lineHeight = toNumber(data.lineHeight ?? properties.lineHeight ?? Math.round(normalized.size * 1.2));
        } else if (type === 'shape') {
            normalized.shapeType = String(data.shapeType ?? properties.shape ?? 'rectangle').toLowerCase();
            normalized.fill = data.fill ?? properties.fill ?? '#3b82f6';
            normalized.stroke = data.stroke ?? properties.stroke ?? 'none';
            normalized.strokeWidth = toNumber(data.strokeWidth ?? properties.strokeWidth ?? 0);
        } else if (type === 'image') {
            normalized.src = data.src ?? properties.src ?? '';
            normalized.name = data.name ?? properties.name ?? 'Imagem';
            normalized.imageKind = data.imageKind ?? properties.imageKind ?? 'image';
            normalized.opacity = toNumber(data.opacity ?? properties.opacity ?? 1);
            normalized.objectFit = String(data.objectFit ?? properties.objectFit ?? 'cover').toLowerCase();
            normalized.borderRadius = toNumber(data.borderRadius ?? properties.borderRadius ?? 0);
            normalized.qrContent = data.qrContent ?? properties.qrContent ?? '';
            normalized.qrColor = data.qrColor ?? properties.qrColor ?? '#111827';
        } else if (type === 'qrcode') {
            normalized.name = data.name ?? properties.name ?? 'QR Code';
            normalized.imageKind = 'qr';
            normalized.qrContent = data.qrContent ?? properties.content ?? '';
            normalized.qrColor = data.qrColor ?? properties.color ?? '#111827';
            normalized.bgColor = data.bgColor ?? properties.bgColor ?? '#ffffff';
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
        const lines = String(data.content ?? 'Texto').split(/\r?\n/);

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
        node.setAttribute('stroke-width', String(data.strokeWidth ?? 0));
        node.setAttribute('style', buildStyleString({
            fill: data.fill || '#3b82f6',
            stroke: data.stroke || 'none',
            'stroke-width': String(data.strokeWidth ?? 0),
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
        node.setAttribute('opacity', String(data.opacity ?? 1));
        node.setAttribute('preserveAspectRatio',
            objectFit === 'contain' ? 'xMidYMid meet'
                : objectFit === 'fill' ? 'none'
                    : 'xMidYMid slice'
        );
        node.setAttribute('style', buildStyleString({
            opacity: String(data.opacity ?? 1),
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

    function serializeEditorToSvg(editor, options = {}) {
        const canvas = editor?.canvas || editor;
        if (!canvas) {
            return '';
        }

        const { width, height } = getCanvasSize(editor, options);
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('xmlns', SVG_NS);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('preserveAspectRatio', 'none');

        const rootDefs = canvas.querySelector?.('defs');
        if (rootDefs) {
            svg.appendChild(document.importNode(rootDefs, true));
        }

        Array.from(canvas.children || [])
            .filter((node) => !shouldSkipNode(node))
            .forEach((node) => {
                const clone = node.cloneNode(true);
                if (clone.nodeType === 1) {
                    clone.classList?.remove('element-selected');
                    clone.removeAttribute?.('data-lucide');
                }
                svg.appendChild(clone);
            });

        return new XMLSerializer().serializeToString(svg);
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

    function pickMaskNode(root) {
        if (!root) return null;

        const candidates = Array.from(root.children || []).filter((node) => {
            const tagName = String(node.tagName || '').toLowerCase();
            return tagName !== 'defs' && tagName !== 'title' && tagName !== 'desc';
        });

        return candidates.find((node) => {
            const tagName = String(node.tagName || '').toLowerCase();
            return ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'].includes(tagName);
        }) || candidates[0] || null;
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
            return {
                x: Number.isFinite(xAttr) ? xAttr : 0,
                y: Number.isFinite(yAttr) ? yAttr : 0,
                width: Math.max(1, Number.isFinite(widthAttr) ? widthAttr : Number(fallback.width) || DEFAULT_SIZE.width),
                height: Math.max(1, Number.isFinite(heightAttr) ? heightAttr : Number(fallback.height) || DEFAULT_SIZE.height)
            };
        }

        if (tagName === 'circle') {
            const cx = Number.parseFloat(node.getAttribute?.('cx') || '');
            const cy = Number.parseFloat(node.getAttribute?.('cy') || '');
            const radius = Number.parseFloat(node.getAttribute?.('r') || '');
            if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(radius)) {
                return {
                    x: cx - radius,
                    y: cy - radius,
                    width: Math.max(1, radius * 2),
                    height: Math.max(1, radius * 2)
                };
            }
        }

        if (tagName === 'ellipse') {
            const cx = Number.parseFloat(node.getAttribute?.('cx') || '');
            const cy = Number.parseFloat(node.getAttribute?.('cy') || '');
            const rx = Number.parseFloat(node.getAttribute?.('rx') || '');
            const ry = Number.parseFloat(node.getAttribute?.('ry') || '');
            if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(rx) && Number.isFinite(ry)) {
                return {
                    x: cx - rx,
                    y: cy - ry,
                    width: Math.max(1, rx * 2),
                    height: Math.max(1, ry * 2)
                };
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
                    return {
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height
                    };
                }
            } catch (error) {
                // Fallback below.
            }
        }

        return {
            x: 0,
            y: 0,
            width: Math.max(1, Number(fallback.width) || DEFAULT_SIZE.width),
            height: Math.max(1, Number(fallback.height) || DEFAULT_SIZE.height)
        };
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
            return String(value ?? '');
        };

        return [
            serialize(previewValue),
            serialize(maskValue),
            serialize({
                backgroundColor: options.backgroundColor || ''
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
                cachePreviewMarkup(cacheKey, previewMarkup);
                return previewMarkup;
            }

            if (previewSource) {
                const fallbackMarkup = `<img src="${escapeXml(previewSource)}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;background-color:${escapeXml(options.backgroundColor || 'transparent')};" loading="lazy">`;
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
                cachePreviewMarkup(cacheKey, previewMarkup);
                return previewMarkup;
            }

            if (previewSource) {
                const fallbackMarkup = `<img src="${escapeXml(previewSource)}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;background-color:${escapeXml(options.backgroundColor || 'transparent')};" loading="lazy">`;
                cachePreviewMarkup(cacheKey, fallbackMarkup);
                return fallbackMarkup;
            }

            return '';
        }

        const maskBox = getSvgBox(maskRoot, options);
        const maskNode = pickMaskNode(maskRoot);
        if (!maskNode) {
            if (previewMarkup) {
                cachePreviewMarkup(cacheKey, previewMarkup);
                return previewMarkup;
            }

            const fallbackMarkup = `<img src="${escapeXml(previewHref)}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;background-color:${escapeXml(options.backgroundColor || 'transparent')};" loading="lazy">`;
            cachePreviewMarkup(cacheKey, fallbackMarkup);
            return fallbackMarkup;
        }

        const wrapperViewBox = maskRoot.getAttribute('viewBox')
            || previewRoot?.getAttribute?.('viewBox')
            || `0 0 ${maskBox.width} ${maskBox.height}`;
        const clipId = `design-preview-clip-${Math.random().toString(36).slice(2, 10)}`;
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
            'background-color': options.backgroundColor || 'transparent'
        }));

        const defs = document.createElementNS(SVG_NS, 'defs');
        const clipPath = document.createElementNS(SVG_NS, 'clipPath');
        clipPath.setAttribute('id', clipId);
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
        if (String(maskNode.tagName || '').toLowerCase() === 'g') {
            Array.from(maskNode.children || []).forEach((child) => {
                clipPath.appendChild(child.cloneNode(true));
            });
        } else {
            clipPath.appendChild(maskNode.cloneNode(true));
        }
        defs.appendChild(clipPath);
        wrapper.appendChild(defs);

        if (previewRoot) {
            const nestedSvg = document.createElementNS(SVG_NS, 'svg');
            nestedSvg.setAttribute('xmlns', SVG_NS);
            nestedSvg.setAttribute('x', '0');
            nestedSvg.setAttribute('y', '0');
            nestedSvg.setAttribute('width', '100%');
            nestedSvg.setAttribute('height', '100%');
            nestedSvg.setAttribute('viewBox', previewRoot.getAttribute('viewBox') || wrapperViewBox);
            nestedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            nestedSvg.setAttribute('overflow', 'visible');
            nestedSvg.setAttribute('clip-path', `url(#${clipId})`);

            const previewDefs = previewRoot.querySelector('defs');
            if (previewDefs) {
                nestedSvg.appendChild(document.importNode(previewDefs, true));
            }

            Array.from(previewRoot.children || []).forEach((child) => {
                const tagName = String(child.tagName || '').toLowerCase();
                if (tagName === 'defs' || tagName === 'title' || tagName === 'desc') {
                    return;
                }
                nestedSvg.appendChild(document.importNode(child, true));
            });

            wrapper.appendChild(nestedSvg);
        } else {
            const image = document.createElementNS(SVG_NS, 'image');
            image.setAttribute('href', previewHref);
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', previewHref);
            image.setAttribute('x', '0');
            image.setAttribute('y', '0');
            image.setAttribute('width', '100%');
            image.setAttribute('height', '100%');
            image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            image.setAttribute('clip-path', `url(#${clipId})`);
            wrapper.appendChild(image);
        }

        const serialized = new XMLSerializer().serializeToString(wrapper);
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

    window.DesignSvgStore = {
        DEFAULT_SIZE,
        escapeXml,
        normalizeTemplateElement,
        buildTemplateSvgFromElements,
        buildPreviewSvgMarkup,
        serializeEditorToSvg,
        extractTemplateSvg,
        importSvgIntoEditor
    };
}());
