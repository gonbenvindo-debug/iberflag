// EDITOR WORKSPACE BOUNDS
// ============================================================
Object.assign(DesignEditor.prototype, {

    getWorkspaceBounds() {
        const bounds = this.workspaceBounds;
        if (
            bounds &&
            Number.isFinite(bounds.x) &&
            Number.isFinite(bounds.y) &&
            Number.isFinite(bounds.width) &&
            Number.isFinite(bounds.height) &&
            bounds.width > 0 &&
            bounds.height > 0
        ) {
            return bounds;
        }

        return this.syncWorkspaceBounds();
    },

    setWorkspaceBounds(bounds) {
        const fallback = this.getCanvasBounds();
        const normalized = {
            x: Number.isFinite(bounds?.x) ? Number(bounds.x) : fallback.x,
            y: Number.isFinite(bounds?.y) ? Number(bounds.y) : fallback.y,
            width: Number.isFinite(bounds?.width) && Number(bounds.width) > 0 ? Number(bounds.width) : fallback.width,
            height: Number.isFinite(bounds?.height) && Number(bounds.height) > 0 ? Number(bounds.height) : fallback.height
        };

        this.workspaceBounds = normalized;
        return normalized;
    },

    syncWorkspaceBounds() {
        return this.setWorkspaceBounds(this.getCanvasBounds());
    },

    resetWorkspaceBounds() {
        this.workspaceBounds = null;
        return this.syncWorkspaceBounds();
    }

});
