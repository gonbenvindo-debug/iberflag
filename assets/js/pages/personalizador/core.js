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
        this.printAreaBounds = { x: 50, y: 50, width: 700, height: 500 };
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

        let isClosingProgrammatically = false;

        const closeAll = () => {
            if (isClosingProgrammatically) return;
            sidebarLeft.classList.remove('panel-open');
            sidebarRight.classList.remove('panel-open');
            backdrop.classList.remove('active');
            document.querySelectorAll('.editor-mobile-tab').forEach(t => t.classList.remove('active'));
        };

        backdrop.addEventListener('click', closeAll);

        const openLeft = (panelId, tabId) => {
            const isAlreadyOpen = sidebarLeft.classList.contains('panel-open') &&
                document.getElementById(tabId)?.classList.contains('active');
            closeAll();
            if (!isAlreadyOpen) {
                document.getElementById('elements-panel')?.classList.toggle('hidden', panelId !== 'elements-panel');
                document.getElementById('properties-panel')?.classList.toggle('hidden', panelId !== 'properties-panel');
                sidebarLeft.classList.add('panel-open');
                backdrop.classList.add('active');
                document.getElementById(tabId)?.classList.add('active');
            }
        };

        tabElements?.addEventListener('click', () => openLeft('elements-panel', 'mobile-tab-elements'));
        tabProperties?.addEventListener('click', () => openLeft('properties-panel', 'mobile-tab-properties'));
        tabLayers?.addEventListener('click', () => {
            const isAlreadyOpen = sidebarRight.classList.contains('panel-open') &&
                tabLayers?.classList.contains('active');
            closeAll();
            if (!isAlreadyOpen) {
                sidebarRight.classList.add('panel-open');
                backdrop.classList.add('active');
                tabLayers?.classList.add('active');
            }
        });

        // Store flag for preventing sidebar closure during element operations
        this.preventSidebarClose = () => {
            isClosingProgrammatically = true;
            setTimeout(() => { isClosingProgrammatically = false; }, 100);
        };
    }

    // ===== PRODUCT LOADING =====
}
