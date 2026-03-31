// CART ASSET STORE
// ============================================================
(function (global) {
    const DB_NAME = 'iberflag_cart_assets';
    const DB_VERSION = 1;
    const STORE_NAME = 'design_assets';

    const memoryCache = new Map();
    let dbPromise = null;

    function buildSvgDataUrl(svgMarkup) {
        if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return '';
        }

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
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

    async function saveDesign(designId, svgMarkup, meta = {}) {
        const id = String(designId || '').trim();
        const svg = String(svgMarkup || '').trim();

        if (!id || !svg) {
            return null;
        }

        const record = {
            id,
            svg,
            preview: String(meta.preview || '').trim() || '',
            createdAt: Number(meta.createdAt || Date.now()),
            updatedAt: Date.now(),
            productId: Number.isFinite(Number(meta.productId)) ? Number(meta.productId) : null
        };

        await runTransaction(STORE_NAME, 'readwrite', (store) => {
            store.put(record);
        });

        memoryCache.set(id, record);
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

        const record = await runTransaction(STORE_NAME, 'readonly', (store) => new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Falha ao ler design do carrinho'));
        }));

        if (record) {
            memoryCache.set(id, record);
        }

        return record;
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
                    productId: next.id || null
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
