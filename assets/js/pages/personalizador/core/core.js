// ===== MODERN PRODUCT CUSTOMIZER - CANVA STYLE =====

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

class DesignEditor {
    constructor() {
        this.canvas = document.getElementById('design-canvas');
        this.canvasStage = document.getElementById('canvas-stage');
        this.printArea = document.getElementById('print-area-outline');
        this.canvasWrapper = document.getElementById('canvas-wrapper');
        if (this.canvas) {
            this.canvas.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
        this.elements = [];
        this.selectedElement = null;
        this.history = [];
        this.historyIndex = -1;
        this.isRestoringHistory = false;
        this.maxHistoryEntries = 200;
        this.historyCommitTimer = null;
        this.historyCommitDelay = 180;
        this.activeHistoryGestureSnapshot = null;
        this.layerDragIndex = null;
        this.zoom = 1;
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandle = null;
        this.rotationStart = 0;
        this.rotationCenterClient = null;
        this.rotationHandleRadiusClient = null;
        this.moveFrameRequest = null;
        this.pendingMoveEvent = null;
        this.currentProduct = null;
        this.editIndex = null;
        this.editDesignId = null;
        this.productId = null;
        this.availableBases = [];
        this.selectedBaseId = null;
        this.cartStorageKey = 'iberflag_cart';
        this.legacyCartStorageKeys = ['iberflag_cart', 'cart'];
        this.editorState = {
            mode: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
            activeMobilePanel: 'elements',
            selectionType: null,
            quickFontOpen: false,
            quickOpacityOpen: false
        };
        this.mobileUI = null;
        // Start with the full checkerboard area; templates can still override
        // this later, but the default editor workspace should not feel inset.
        this.printAreaBounds = { x: 0, y: 0, width: 800, height: 600 };
        this.workspaceBounds = { x: 0, y: 0, width: 800, height: 600 };
        this.templateSourceBounds = { x: 0, y: 0, width: 800, height: 600 };
        this.keepAspectRatio = true;
        this.baseCanvasSize = { width: 800, height: 600 };
        this.initialCanvasSize = null; // Will store computed base size at 100% zoom
        this.handlesFrameRequest = null;

        // ===== GUIDES & SNAP =====
        this.showGuides = false;
        this.guideLines = [];
        this.guideThreshold = 10; // pixels para snap
        this.guideReleaseThreshold = 18;
        this.gridSize = 10; // para snap grid

        // ===== CROP =====
        this.cropMode = false;
        this.cropBounds = null;
        this.cropKeepAspectRatioBackup = null;

        // ===== PRE-INSERT CROP MODAL =====
        this.uploadCropState = null;
        this.uploadCropListenersReady = false;

        // ===== ADD TO CART CHECKOUT-STEPS MODAL =====
        this.cartStepsListenersReady = false;
        this.cartStepsCurrent = 1;
        this.cartStepsDesignSnapshot = null;
        this.cartStepsDesignPreview = '';

        this.init();
    }

    isMobileViewport() {
        return window.matchMedia('(max-width: 767px)').matches;
    }

    executeEditorCommand(command, payload = null) {
        switch (command) {
            case 'add-text':
                return this.addText();
            case 'add-image':
                return document.getElementById('image-upload')?.click();
            case 'add-qr':
                return this.handleAddQRCode?.();
            case 'add-shape':
                return this.addShape?.(payload);
            case 'zoom-in':
                return this.setZoom?.(this.zoom + 0.1);
            case 'zoom-out':
                return this.setZoom?.(this.zoom - 0.1);
            case 'undo':
                return this.undo?.();
            case 'redo':
                return this.redo?.();
            case 'delete':
                return this.deleteSelected?.();
            case 'duplicate':
                return this.duplicateSelected?.();
            case 'center-horizontal':
                return this.centerSelected?.('horizontal');
            case 'center-vertical':
                return this.centerSelected?.('vertical');
            case 'add-to-cart':
                if (this.isAdminMode) {
                    return this.saveDesignAsTemplate?.();
                }
                return this.openCartStepsModal?.();
            case 'toggle-keep-aspect':
                this.keepAspectRatio = !this.keepAspectRatio;
                this.syncKeepAspectControls?.();
                return this.keepAspectRatio;
            case 'toggle-quick-font':
                return this.toggleQuickFontPopover?.();
            case 'toggle-quick-opacity':
                return this.toggleQuickOpacityPopover?.();
            default:
                return null;
        }
    }

    async init() {
        // Mostrar loading state
        this.showLoadingState();

        // Carregar produto e demais inicializações em paralelo
        const [product] = await Promise.all([
            this.loadProduct(),
            this.setupEventListeners(),
            this.setupMobileUI()
        ]);

        this.setupAutoSave();
        this.saveHistory();
        this.updateSidebarMode();
        this.hideLoadingState();

        // Garantir que o layout está calculado antes de medir o stage
        requestAnimationFrame(() => this.syncCanvasViewport());
    }

    showLoadingState() {
        const loading = document.createElement('div');
        loading.id = 'editor-loading';
        loading.className = 'fixed inset-0 bg-white z-50 flex items-center justify-center';
        loading.innerHTML = `
            <div class="text-center">
                <i data-lucide="loader-2" class="w-12 h-12 animate-spin mx-auto mb-4"></i>
                <p class="text-lg font-semibold">A carregar editor...</p>
            </div>
        `;
        document.body.appendChild(loading);
        if (window.lucide) window.lucide.createIcons();
    }

    hideLoadingState() {
        const loading = document.getElementById('editor-loading');
        if (loading) loading.remove();
    }

    // ===== MOBILE UI =====
    setupMobileUI() {
        const backdrop = document.getElementById('mobile-panel-backdrop');
        const sidebarLeft = document.getElementById('editor-sidebar-left');
        const sidebarRight = document.getElementById('editor-sidebar-right');
        const tabElements = document.getElementById('mobile-tab-elements');
        const tabProperties = document.getElementById('mobile-tab-properties');
        const tabLayers = document.getElementById('mobile-tab-layers');

        if (!backdrop || !sidebarLeft || !sidebarRight) return;

        this.mobileUI = {
            backdrop,
            sidebarLeft,
            sidebarRight,
            tabElements,
            tabProperties,
            tabLayers
        };

        let isClosingProgrammatically = false;

        const closeAll = () => {
            if (isClosingProgrammatically) return;
            sidebarLeft.classList.remove('panel-open');
            sidebarRight.classList.remove('panel-open');
            backdrop.classList.remove('active');
            document.body.classList.remove('has-layers-panel-open');
            document.querySelectorAll('.editor-mobile-tab').forEach(t => t.classList.remove('active'));
            document.getElementById('elements-panel')?.classList.remove('hidden');
            document.getElementById('layers-panel')?.classList.remove('hidden');
            this.editorState.activeMobilePanel = null;
        };

        backdrop.addEventListener('click', closeAll);

        const openLeft = (panelId, tabId) => {
            const isAlreadyOpen = sidebarLeft.classList.contains('panel-open') &&
                document.getElementById(tabId)?.classList.contains('active');
            closeAll();
            if (!isAlreadyOpen) {
                const elementsPanel = document.getElementById('elements-panel');
                const layersPanel = document.getElementById('layers-panel');
                if (elementsPanel) {
                    elementsPanel.classList.toggle('hidden', panelId !== 'elements-panel');
                }
                if (layersPanel) {
                    layersPanel.classList.toggle('hidden', panelId !== 'layers-panel');
                }
                document.body.classList.toggle('has-layers-panel-open', panelId === 'layers-panel');
                sidebarLeft.classList.add('panel-open');
                backdrop.classList.add('active');
                document.getElementById(tabId)?.classList.add('active');
                this.editorState.activeMobilePanel = panelId === 'layers-panel' ? 'layers' : 'elements';
            }
        };

        const openRight = (tabId) => {
            const isAlreadyOpen = sidebarRight.classList.contains('panel-open') &&
                document.getElementById(tabId)?.classList.contains('active');
            closeAll();
            if (!isAlreadyOpen) {
                document.getElementById('properties-panel')?.classList.remove('hidden');
                document.body.classList.remove('has-layers-panel-open');
                sidebarRight.classList.add('panel-open');
                backdrop.classList.add('active');
                document.getElementById(tabId)?.classList.add('active');
                this.editorState.activeMobilePanel = 'properties';
            }
        };

        tabElements?.addEventListener('click', () => openLeft('elements-panel', 'mobile-tab-elements'));
        tabProperties?.addEventListener('click', () => openRight('mobile-tab-properties'));
        tabLayers?.addEventListener('click', () => openLeft('layers-panel', 'mobile-tab-layers'));

        // Store flag for preventing sidebar closure during element operations
        this.preventSidebarClose = () => {
            isClosingProgrammatically = true;
            setTimeout(() => { isClosingProgrammatically = false; }, 100);
        };

        this.closeMobilePanels = closeAll;
        this.openMobilePanel = (panelName) => {
            if (!this.isMobileViewport()) return;
            if (panelName === 'properties') {
                openRight('mobile-tab-properties');
                return;
            }
            if (panelName === 'layers') {
                openLeft('layers-panel', 'mobile-tab-layers');
                return;
            }
            openLeft('elements-panel', 'mobile-tab-elements');
        };
    }

    // ===== PRODUCT LOADING =====
}
