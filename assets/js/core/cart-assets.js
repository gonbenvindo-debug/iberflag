// CART ASSET STORE
// ============================================================
(function (global) {
    const DB_NAME = 'iberflag_cart_assets';
    const DB_VERSION = 1;
    const STORE_NAME = 'design_assets';
    const REMOTE_DESIGNS_ENDPOINT = '/api/designs';

    const memoryCache = new Map();
    let dbPromise = null;

    function buildSvgDataUrl(svgMarkup) {
        if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return '';
        }

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
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
            designSceneV1,
            createdAt: Number(record?.createdAt || Date.now()),
            updatedAt: Number(record?.updatedAt || Date.now()),
            productId: Number.isFinite(Number(record?.productId || record?.product_id))
                ? Number(record.productId || record.product_id)
                : null
        };
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
        cleanupUnusedDesigns,
        hydrateCartItems,
        migrateLegacyCartItems
    };
})(window);
