(function (root, factory) {
    root.IberFlagI18n = factory(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    const ES_STATIC_URL = '/data/i18n/es-static.json';
    const ES_CATALOG_URL = '/data/i18n/es-catalog.json';
    const TRANSLATABLE_ATTRIBUTES = ['alt', 'title', 'placeholder', 'aria-label', 'content'];
    const state = {
        staticData: null,
        catalogData: null,
        replacements: [],
        observer: null,
        ready: null,
        applying: false
    };

    function getLocale() {
        if (root.SiteRoutes?.getLocaleFromPathname && root.location?.pathname) {
            return root.SiteRoutes.getLocaleFromPathname(root.location.pathname);
        }

        return root.location?.pathname === '/es' || root.location?.pathname?.startsWith('/es/') ? 'es' : 'pt';
    }

    function isSpanish() {
        return getLocale() === 'es';
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalizeSpaces(value) {
        return String(value || '').replace(/\s+/g, ' ');
    }

    function translateText(value) {
        const raw = String(value || '');
        if (!isSpanish() || !raw.trim() || state.replacements.length === 0) {
            return raw;
        }

        const leading = raw.match(/^\s*/)?.[0] || '';
        const trailing = raw.match(/\s*$/)?.[0] || '';
        let output = normalizeSpaces(raw.trim());
        for (const [source, target] of state.replacements) {
            output = output.replace(new RegExp(escapeRegExp(source), 'g'), target);
        }
        return `${leading}${output}${trailing}`;
    }

    function slugify(value) {
        if (root.SiteRoutes?.slugify) {
            return root.SiteRoutes.slugify(value);
        }

        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/&/g, ' e ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
    }

    function findProductTranslation(productOrSlug) {
        const products = state.catalogData?.products || {};
        if (!products || !Object.keys(products).length) return null;

        const explicitSlug = typeof productOrSlug === 'string'
            ? productOrSlug
            : productOrSlug?.slug || productOrSlug?.canonicalPath?.split('/produto/')[1] || productOrSlug?.nome || productOrSlug?.name;
        const slug = slugify(explicitSlug);
        return products[slug] || null;
    }

    function localizeProduct(product) {
        if (!isSpanish() || !product || typeof product !== 'object') {
            return product;
        }

        const dbName = String(product.nome_es || product.nomeEs || '').trim();
        const dbDescription = String(product.descricao_es || product.descricaoEs || '').trim();
        const translation = findProductTranslation(product);
        if (!translation && (dbName || dbDescription)) {
            return {
                ...product,
                nome: dbName || product.nome,
                name: dbName || product.name || product.nome,
                descricao: dbDescription || product.descricao,
                description: dbDescription || product.description || product.descricao,
                seoTitle: translateText(product.seoTitle || product.seo_title || dbName || ''),
                seo_title: translateText(product.seo_title || product.seoTitle || dbName || ''),
                seoDescription: translateText(product.seoDescription || product.seo_description || dbDescription || ''),
                seo_description: translateText(product.seo_description || product.seoDescription || dbDescription || '')
            };
        }

        if (!translation) {
            return {
                ...product,
                nome: translateText(dbName || product.nome || product.name || ''),
                name: translateText(dbName || product.name || product.nome || ''),
                descricao: translateText(dbDescription || product.descricao || product.description || ''),
                description: translateText(dbDescription || product.description || product.descricao || ''),
                seoTitle: translateText(product.seoTitle || product.seo_title || ''),
                seoDescription: translateText(product.seoDescription || product.seo_description || ''),
                seo_title: translateText(product.seo_title || product.seoTitle || ''),
                seo_description: translateText(product.seo_description || product.seoDescription || '')
            };
        }

        return {
            ...product,
            nome: dbName || translation.name || product.nome,
            name: dbName || translation.name || product.name || product.nome,
            descricao: dbDescription || translation.description || product.descricao,
            description: dbDescription || translation.description || product.description || product.descricao,
            seoTitle: translation.seoTitle || product.seoTitle,
            seo_title: translation.seoTitle || product.seo_title,
            seoDescription: translation.seoDescription || product.seoDescription,
            seo_description: translation.seoDescription || product.seo_description
        };
    }

    function localizeCategory(categoryOrSlug) {
        if (!isSpanish()) return categoryOrSlug;
        const slug = slugify(typeof categoryOrSlug === 'string' ? categoryOrSlug : categoryOrSlug?.slug || categoryOrSlug?.label);
        const translation = state.catalogData?.categories?.[slug];
        if (!translation || typeof categoryOrSlug === 'string') {
            return translation || categoryOrSlug;
        }

        return {
            ...categoryOrSlug,
            label: translation.label || categoryOrSlug.label,
            shortLabel: translation.shortLabel || categoryOrSlug.shortLabel,
            description: translation.description || categoryOrSlug.description
        };
    }

    function patchCatalogManifest() {
        const manifest = root.CatalogSeoManifest;
        if (!isSpanish() || !manifest || !Array.isArray(manifest.products)) return;

        manifest.products = manifest.products.map(localizeProduct);
        if (Array.isArray(manifest.categories)) {
            manifest.categories = manifest.categories.map(localizeCategory);
        }
    }

    function translateAttributes(element) {
        if (!(element instanceof Element)) return;
        TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
            const value = element.getAttribute(attribute);
            if (!value || /^https?:\/\//i.test(value)) return;
            const nextValue = translateText(value);
            if (nextValue !== value) {
                element.setAttribute(attribute, nextValue);
            }
        });
    }

    function translateNode(node) {
        if (!node || !isSpanish() || state.applying) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const value = node.nodeValue || '';
            const nextValue = translateText(value);
            if (nextValue !== value) {
                node.nodeValue = nextValue;
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node;
        const tagName = String(element.tagName || '').toLowerCase();
        if (['script', 'style', 'noscript', 'textarea'].includes(tagName)) return;

        translateAttributes(element);
        element.childNodes.forEach(translateNode);
    }

    function translateDom(scope) {
        if (!isSpanish()) return;
        state.applying = true;
        try {
            translateNode(scope || root.document?.body);
        } finally {
            state.applying = false;
        }
    }

    function observeDom() {
        if (!root.document?.body || state.observer || !isSpanish()) return;
        state.observer = new MutationObserver((mutations) => {
            if (state.applying) return;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => translateDom(node));
                if (mutation.type === 'attributes' && mutation.target) {
                    translateDom(mutation.target);
                }
            });
        });
        state.observer.observe(root.document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: TRANSLATABLE_ATTRIBUTES
        });
    }

    async function fetchJson(url) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Unable to load ${url}`);
        }
        return response.json();
    }

    function applyLoadedData(staticData, catalogData) {
        state.staticData = staticData || {};
        state.catalogData = catalogData || {};
        state.replacements = Array.isArray(state.staticData.replacements)
            ? state.staticData.replacements.slice().sort((left, right) => String(right[0] || '').length - String(left[0] || '').length)
            : [];
        patchCatalogManifest();
        root.setTimeout?.(patchCatalogManifest, 0);
        root.setTimeout?.(patchCatalogManifest, 250);
        root.addEventListener?.('load', patchCatalogManifest, { once: true });
        translateDom(root.document?.documentElement);
        observeDom();
    }

    function load() {
        if (state.ready) return state.ready;
        if (!isSpanish()) {
            state.ready = Promise.resolve(false);
            return state.ready;
        }

        state.ready = Promise.all([
            fetchJson(ES_STATIC_URL),
            fetchJson(ES_CATALOG_URL)
        ]).then(([staticData, catalogData]) => {
            applyLoadedData(staticData, catalogData);
            return true;
        }).catch((error) => {
            console.warn('IberFlag i18n failed to load:', error);
            return false;
        });

        return state.ready;
    }

    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', load, { once: true });
        } else {
            load();
        }
    }

    return {
        getLocale,
        isSpanish,
        ready: load,
        translateText,
        translateDom,
        localizeProduct,
        localizeCategory,
        findProductTranslation
    };
}));
