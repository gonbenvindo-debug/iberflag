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

    function getPreferredPrintAreaBounds(workspaceBounds, sourceBounds, options = {}) {
        const normalizedWorkspace = normalizeBounds(workspaceBounds, { x: 0, y: 0, width: 800, height: 600 });
        const normalizedSource = normalizeBounds(sourceBounds, normalizedWorkspace);
        const targetHeightRatio = Number.isFinite(options.heightRatio) ? Number(options.heightRatio) : 0.9;
        const targetHeight = normalizedWorkspace.height * targetHeightRatio;
        const heightScale = targetHeight / normalizedSource.height;
        const widthScale = normalizedWorkspace.width / normalizedSource.width;
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
        getPreferredPrintAreaBounds
    };
})(window);
