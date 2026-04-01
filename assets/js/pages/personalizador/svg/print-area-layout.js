// ============================================================
// PRINT AREA LAYOUT HELPERS
// ============================================================
(function attachPrintAreaLayoutHelpers(global) {
    function normalizeBounds(bounds, fallback) {
        return {
            x: Number.isFinite(bounds?.x) ? Number(bounds.x) : fallback.x,
            y: Number.isFinite(bounds?.y) ? Number(bounds.y) : fallback.y,
            width: Number.isFinite(bounds?.width) && Number(bounds.width) > 0 ? Number(bounds.width) : fallback.width,
            height: Number.isFinite(bounds?.height) && Number(bounds.height) > 0 ? Number(bounds.height) : fallback.height
        };
    }

    function measureElementBounds(element, fallbackBounds) {
        if (!element || typeof document === 'undefined') {
            return normalizeBounds(fallbackBounds, { x: 0, y: 0, width: 800, height: 600 });
        }

        const fallback = normalizeBounds(fallbackBounds, { x: 0, y: 0, width: 800, height: 600 });
        const sourceNamespace = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(sourceNamespace, 'svg');
        const tempWrapper = document.createElementNS(sourceNamespace, 'g');
        const clone = element.cloneNode(true);

        tempSvg.setAttribute('width', String(fallback.width));
        tempSvg.setAttribute('height', String(fallback.height));
        tempSvg.setAttribute('viewBox', `${fallback.x} ${fallback.y} ${fallback.width} ${fallback.height}`);
        tempSvg.setAttribute('aria-hidden', 'true');
        tempSvg.style.position = 'absolute';
        tempSvg.style.left = '-10000px';
        tempSvg.style.top = '0';
        tempSvg.style.width = `${fallback.width}px`;
        tempSvg.style.height = `${fallback.height}px`;
        tempSvg.style.overflow = 'hidden';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.pointerEvents = 'none';

        tempWrapper.appendChild(clone);
        tempSvg.appendChild(tempWrapper);

        const host = document.body || document.documentElement;
        if (!host) {
            return fallback;
        }

        host.appendChild(tempSvg);

        try {
            if (typeof clone.getBBox === 'function') {
                const bbox = clone.getBBox();
                if (
                    bbox &&
                    Number.isFinite(bbox.x) &&
                    Number.isFinite(bbox.y) &&
                    Number.isFinite(bbox.width) &&
                    Number.isFinite(bbox.height) &&
                    bbox.width > 0 &&
                    bbox.height > 0
                ) {
                    const ctm = typeof clone.getCTM === 'function' ? clone.getCTM() : null;
                    const points = [
                        { x: bbox.x, y: bbox.y },
                        { x: bbox.x + bbox.width, y: bbox.y },
                        { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
                        { x: bbox.x, y: bbox.y + bbox.height }
                    ];
                    const transformed = ctm
                        ? points.map((point) => {
                            const mapped = new DOMPoint(point.x, point.y).matrixTransform(ctm);
                            return { x: mapped.x, y: mapped.y };
                        })
                        : points;
                    const xs = transformed.map((point) => point.x);
                    const ys = transformed.map((point) => point.y);
                    const measured = {
                        x: Math.min(...xs),
                        y: Math.min(...ys),
                        width: Math.max(...xs) - Math.min(...xs),
                        height: Math.max(...ys) - Math.min(...ys)
                    };

                    if (
                        Number.isFinite(measured.x) &&
                        Number.isFinite(measured.y) &&
                        Number.isFinite(measured.width) &&
                        Number.isFinite(measured.height) &&
                        measured.width > 0 &&
                        measured.height > 0
                    ) {
                        return normalizeBounds(measured, fallback);
                    }
                }
            }
        } catch (error) {
            // Fall back to the source bounds if the element cannot be measured.
        } finally {
            tempSvg.remove();
        }

        return fallback;
    }

    function getPreferredPrintAreaBounds(workspaceBounds, sourceBounds, options = {}) {
        const normalizedWorkspace = normalizeBounds(workspaceBounds, { x: 0, y: 0, width: 800, height: 600 });
        const normalizedSource = normalizeBounds(sourceBounds, normalizedWorkspace);
        const targetHeightRatio = Number.isFinite(options.heightRatio) ? Number(options.heightRatio) : 0.9;
        const targetWidthRatio = Number.isFinite(options.widthRatio) ? Number(options.widthRatio) : 0.9;
        const targetHeight = normalizedWorkspace.height * targetHeightRatio;
        const targetWidth = normalizedWorkspace.width * targetWidthRatio;
        const heightScale = targetHeight / normalizedSource.height;
        const widthScale = targetWidth / normalizedSource.width;
        const uniformScale = Math.min(heightScale, widthScale);
        const renderedWidth = normalizedSource.width * uniformScale;
        const renderedHeight = normalizedSource.height * uniformScale;
        const frameX = normalizedWorkspace.x + ((normalizedWorkspace.width - renderedWidth) / 2);
        const frameY = normalizedWorkspace.y + ((normalizedWorkspace.height - renderedHeight) / 2);
        const offsetX = frameX - (normalizedSource.x * uniformScale);
        const offsetY = frameY - (normalizedSource.y * uniformScale);

        return {
            sourceBounds: normalizedSource,
            workspaceBounds: normalizedWorkspace,
            targetHeight,
            uniformScale,
            renderedWidth,
            renderedHeight,
            offsetX,
            offsetY,
            frameBounds: {
                x: frameX,
                y: frameY,
                width: renderedWidth,
                height: renderedHeight
            }
        };
    }

    global.DesignEditorPrintAreaLayout = {
        getPreferredPrintAreaBounds,
        measureElementBounds
    };
})(window);
