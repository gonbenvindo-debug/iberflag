// ===== DESIGN EDITOR — Entry Point =====
// The DesignEditor class is built by loading the modules in personalizador/ first.
// See pages/personalizar.html for the <script> load order.

document.addEventListener('DOMContentLoaded', () => {
    const closeEditorLink = document.getElementById('close-editor-btn');
    if (closeEditorLink && window.personalizerProductsPath) {
        closeEditorLink.href = window.personalizerProductsPath();
    }
    window.editor = new DesignEditor();
});
