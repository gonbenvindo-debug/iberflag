// CART ASSET STORE
// ============================================================
(function (global) {
    const DB_NAME = 'iberflag_cart_assets';
    const DB_VERSION = 2;
    const STORE_NAME = 'design_assets';
    const IMAGE_STORE_NAME = 'image_assets';
    const REMOTE_DESIGNS_ENDPOINT = '/api/designs';

    const memoryCache = new Map();
    const imageMemoryCache = new Map();
    let dbPromise = null;

    function buildSvgDataUrl(svgMarkup) {
        if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return '';
        }

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    }

    function blobToDataUrl(blob) {
        if (!(blob instanceof Blob)) {
            return Promise.resolve('');
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    }

    function normalizeDesignRecord(record, fallbackId = '') {
        const id = String(record?.id || record?.design_id || fallbackId || '').trim();
        const svg = String(record?.svg || record?.design_svg || '').trim();
        if (!id || !svg) {
            return null;
        }
        const designSceneV1 = (record?.designSceneV1 && typeof record.designSceneV1 === 'object')
            ? record.designSceneV1
            : (record?.design_scene_v1 && typeof record.design_scene_v1 === 'object')
                ? record.design_scene_v1
                : (record?.design_document_v3 && typeof record.design_document_v3 === 'object')
                    ? record.design_document_v3
                    : null;

        return {
            id,
            svg,
            preview: String(record?.preview || record?.design_preview || '').trim() || '',
            designSceneV1: compactSceneImageSources(designSceneV1),
            createdAt: Number(record?.createdAt || Date.now()),
            updatedAt: Number(record?.updatedAt || Date.now()),
            productId: Number.isFinite(Number(record?.productId || record?.product_id))
                ? Number(record.productId || record.product_id)
                : null
        };
    }

    function compactSceneImageSources(sceneLike = null) {
        if (!sceneLike || typeof sceneLike !== 'object' || !Array.isArray(sceneLike.elements)) {
            return sceneLike || null;
        }

        const cloned = JSON.parse(JSON.stringify(sceneLike));
        cloned.elements = cloned.elements.map((element) => {
            if (!element || typeof element !== 'object' || String(element.type || '').toLowerCase() !== 'image') {
                return element;
            }

            const assetId = String(element?.assetRef?.assetId || element?.assetId || '').trim();
            if (!assetId) {
                return element;
            }

            const next = {
                ...element,
                assetId,
                assetRef: {
                    ...(element.assetRef && typeof element.assetRef === 'object' ? element.assetRef : {}),
                    assetId
                }
            };

            const src = String(next.src || '').trim();
            if (src.startsWith('data:image/') || src.startsWith('blob:')) {
                next.src = '';
            }

            const originalSrc = String(next.originalSrc || '').trim();
            if (originalSrc.startsWith('data:image/') || originalSrc.startsWith('blob:')) {
                next.originalSrc = '';
            }

            return next;
        });

        return cloned;
    }

    function openDatabase() {
        if (typeof indexedDB === 'undefined') {
            return Promise.resolve(null);
        }

        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
                        db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
                    }
                };

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB'));
                request.onblocked = () => {
                    console.warn('IndexedDB do carrinho bloqueado por outra aba.');
                };
            });
        }

        return dbPromise;
    }

    function runTransaction(storeName, mode, handler) {
        return openDatabase().then((db) => {
            if (!db) return null;

            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                const result = handler(store, tx);

                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error || new Error('Falha na transacao IndexedDB'));
                tx.onabort = () => reject(tx.error || new Error('Transacao IndexedDB abortada'));
            });
        });
    }

    async function saveDesignLocally(record) {
        const normalized = normalizeDesignRecord(record);
        if (!normalized) {
            return null;
        }

        await runTransaction(STORE_NAME, 'readwrite', (store) => {
            store.put(normalized);
        });

        memoryCache.set(normalized.id, normalized);
        return normalized;
    }

    async function saveDesignRemotely(record) {
        const normalized = normalizeDesignRecord(record);
        if (!normalized || typeof fetch !== 'function') {
            return false;
        }

        const response = await fetch(REMOTE_DESIGNS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                designId: normalized.id,
                designSvg: normalized.svg,
                preview: normalized.preview,
                designSceneV1: normalized.designSceneV1,
                design_scene_v1: normalized.designSceneV1,
                productId: normalized.productId
            })
        });

        if (!response.ok) {
            throw new Error(`Falha ao guardar design na base de dados (${response.status})`);
        }

        return true;
    }

    async function fetchDesignRemotely(designId) {
        const id = String(designId || '').trim();
        if (!id || typeof fetch !== 'function') {
            return null;
        }

        const response = await fetch(`${REMOTE_DESIGNS_ENDPOINT}?designId=${encodeURIComponent(id)}`, {
            method: 'GET'
        });
        if (!response.ok) {
            throw new Error(`Falha ao ler design da base de dados (${response.status})`);
        }

        const payload = await response.json().catch(() => ({}));
        return normalizeDesignRecord(payload?.design || null, id);
    }

    async function saveDesign(designId, svgMarkup, meta = {}) {
        const designSceneV1 = meta.scene && typeof meta.scene === 'object'
            ? meta.scene
            : null;
        const record = normalizeDesignRecord({
            id: designId,
            svg: svgMarkup,
            preview: String(meta.preview || '').trim() || '',
            designSceneV1,
            createdAt: Number(meta.createdAt || Date.now()),
            updatedAt: Date.now(),
            productId: Number.isFinite(Number(meta.productId)) ? Number(meta.productId) : null
        });

        if (!record) {
            return null;
        }

        try {
            await saveDesignRemotely(record);
        } catch (error) {
            console.warn('Falha ao guardar design remotamente. A usar cache local.', error);
        }

        await saveDesignLocally(record);
        return record;
    }

    async function getDesign(designId) {
        const id = String(designId || '').trim();
        if (!id) {
            return null;
        }

        if (memoryCache.has(id)) {
            return memoryCache.get(id);
        }

        const localRecord = await runTransaction(STORE_NAME, 'readonly', (store) => new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Falha ao ler design do carrinho'));
        }));

        if (localRecord) {
            memoryCache.set(id, localRecord);
            return localRecord;
        }

        try {
            const remoteRecord = await fetchDesignRemotely(id);
            if (!remoteRecord) {
                return null;
            }

            await saveDesignLocally(remoteRecord);
            return remoteRecord;
        } catch (error) {
            console.warn('Falha ao hidratar design da base de dados:', error);
            return null;
        }
    }

    async function deleteDesign(designId) {
        const id = String(designId || '').trim();
        if (!id) {
            return;
        }

        memoryCache.delete(id);
        await runTransaction(STORE_NAME, 'readwrite', (store) => {
            store.delete(id);
        });
    }

    function generateImageAssetId() {
        const randomPart = Math.random().toString(36).slice(2, 10);
        return `img_${Date.now()}_${randomPart}`;
    }

    function normalizeImageAssetRecord(record, fallbackId = '') {
        const id = String(record?.id || record?.assetId || fallbackId || '').trim() || generateImageAssetId();
        const blob = record?.blob instanceof Blob ? record.blob : null;
        if (!blob) {
            return null;
        }

        const mime = String(record?.mime || blob.type || '').trim() || 'application/octet-stream';
        const width = Number.isFinite(Number(record?.width)) ? Number(record.width) : null;
        const height = Number.isFinite(Number(record?.height)) ? Number(record.height) : null;
        const bytes = Number.isFinite(Number(record?.bytes)) ? Number(record.bytes) : blob.size;
        const createdAt = Number(record?.createdAt || Date.now());
        const updatedAt = Number(record?.updatedAt || Date.now());

        return {
            id,
            blob,
            mime,
            width,
            height,
            bytes,
            createdAt,
            updatedAt
        };
    }

    async function saveImageAsset(blob, meta = {}) {
        const normalized = normalizeImageAssetRecord({
            id: meta.assetId || meta.id,
            blob,
            mime: meta.mime,
            width: meta.width,
            height: meta.height,
            bytes: meta.bytes,
            createdAt: meta.createdAt,
            updatedAt: Date.now()
        });
        if (!normalized) {
            return null;
        }

        await runTransaction(IMAGE_STORE_NAME, 'readwrite', (store) => {
            store.put(normalized);
        });
        imageMemoryCache.set(normalized.id, normalized);
        return {
            assetId: normalized.id,
            id: normalized.id,
            mime: normalized.mime,
            width: normalized.width,
            height: normalized.height,
            bytes: normalized.bytes
        };
    }

    async function getImageAsset(assetId) {
        const id = String(assetId || '').trim();
        if (!id) {
            return null;
        }

        if (imageMemoryCache.has(id)) {
            return imageMemoryCache.get(id);
        }

        const localRecord = await runTransaction(IMAGE_STORE_NAME, 'readonly', (store) => new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Falha ao ler image asset'));
        }));

        if (!localRecord) {
            return null;
        }

        imageMemoryCache.set(id, localRecord);
        return localRecord;
    }

    async function deleteImageAsset(assetId) {
        const id = String(assetId || '').trim();
        if (!id) {
            return;
        }

        imageMemoryCache.delete(id);
        await runTransaction(IMAGE_STORE_NAME, 'readwrite', (store) => {
            store.delete(id);
        });
    }

    async function cleanupUnusedImageAssets(activeAssetIds = []) {
        const active = new Set(
            Array.isArray(activeAssetIds)
                ? activeAssetIds.map((value) => String(value || '').trim()).filter(Boolean)
                : []
        );

        const db = await openDatabase();
        if (!db || !db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
            return;
        }

        await new Promise((resolve, reject) => {
            const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
            const store = tx.objectStore(IMAGE_STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                const keys = Array.isArray(request.result) ? request.result : [];
                keys.forEach((key) => {
                    const normalized = String(key || '').trim();
                    if (normalized && !active.has(normalized)) {
                        store.delete(normalized);
                        imageMemoryCache.delete(normalized);
                    }
                });
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Falha ao limpar image assets antigos'));
        });
    }

    async function hydrateSceneImageSources(sceneLike = null) {
        if (!sceneLike || typeof sceneLike !== 'object' || !Array.isArray(sceneLike.elements)) {
            return sceneLike || null;
        }

        const clonedScene = JSON.parse(JSON.stringify(sceneLike));

        for (const element of clonedScene.elements) {
            if (!element || typeof element !== 'object' || String(element.type || '').toLowerCase() !== 'image') {
                continue;
            }

            const assetId = String(element?.assetRef?.assetId || element?.assetId || '').trim();
            if (!assetId) {
                continue;
            }

            const currentSrc = String(element.src || '').trim();
            if (currentSrc && !currentSrc.startsWith('blob:')) {
                continue;
            }

            try {
                const assetRecord = await getImageAsset(assetId);
                const blob = assetRecord?.blob instanceof Blob ? assetRecord.blob : null;
                if (!blob) {
                    continue;
                }

                const dataUrl = await blobToDataUrl(blob);
                if (!dataUrl) {
                    continue;
                }

                element.src = dataUrl;
                if (!String(element.originalSrc || '').trim() || String(element.originalSrc || '').startsWith('blob:')) {
                    element.originalSrc = dataUrl;
                }
                if (!Number.isFinite(Number(element.fullWidth)) && Number.isFinite(Number(assetRecord?.width))) {
                    element.fullWidth = Number(assetRecord.width);
                }
                if (!Number.isFinite(Number(element.fullHeight)) && Number.isFinite(Number(assetRecord?.height))) {
                    element.fullHeight = Number(assetRecord.height);
                }
            } catch (error) {
                console.warn('Falha ao hidratar image asset do scene do carrinho:', error);
            }
        }

        return clonedScene;
    }

    async function cleanupUnusedDesigns(activeDesignIds = []) {
        const active = new Set(
            Array.isArray(activeDesignIds)
                ? activeDesignIds.map((value) => String(value || '').trim()).filter(Boolean)
                : []
        );

        const db = await openDatabase();
        if (!db) {
            return;
        }

        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                const keys = Array.isArray(request.result) ? request.result : [];
                keys.forEach((key) => {
                    const normalized = String(key || '').trim();
                    if (normalized && !active.has(normalized)) {
                        store.delete(normalized);
                        memoryCache.delete(normalized);
                    }
                });
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Falha ao limpar designs antigos'));
        });
    }

    async function hydrateCartItems(items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const hydrated = [];
        for (const item of items) {
            const next = { ...item };
            const designId = String(next.designId || next.design_id || '').trim();

            if (designId && !next.design) {
                const record = await getDesign(designId);
                if (record?.svg) {
                    next.design = record.svg;
                    if (!next.designPreview) {
                        next.designPreview = record.preview || buildSvgDataUrl(record.svg);
                    }
                    if (!next.designSceneV1 && record.designSceneV1) {
                        next.designSceneV1 = record.designSceneV1;
                        next.design_scene_v1 = record.designSceneV1;
                    }
                }
            }

            const rawScene = next.designSceneV1 || next.design_scene_v1 || null;
            if (rawScene) {
                const hydratedScene = await hydrateSceneImageSources(rawScene);
                if (hydratedScene) {
                    next.designSceneV1 = hydratedScene;
                    next.design_scene_v1 = hydratedScene;
                }
            }

            hydrated.push(next);
        }

        return hydrated;
    }

    async function migrateLegacyCartItems(items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const migrated = [];
        for (const item of items) {
            const next = { ...item };
            const designId = String(next.designId || next.design_id || '').trim();

            if (designId && typeof next.design === 'string' && next.design.trim()) {
                await saveDesign(designId, next.design, {
                    preview: next.designPreview || '',
                    productId: next.id || null,
                    scene: next.designSceneV1
                        || next.design_scene_v1
                        || null
                });
            }

            migrated.push(next);
        }

        return migrated;
    }

    global.CartAssetStore = {
        buildSvgDataUrl,
        saveDesign,
        getDesign,
        deleteDesign,
        saveImageAsset,
        getImageAsset,
        deleteImageAsset,
        cleanupUnusedImageAssets,
        cleanupUnusedDesigns,
        hydrateCartItems,
        migrateLegacyCartItems
    };
})(window);
