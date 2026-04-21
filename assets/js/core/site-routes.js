(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }

    root.SiteRoutes = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const CANONICAL_ORIGIN = 'https://iberflag.com';
    const CATEGORY_META = {
        'balcao-promocional': {
            label: 'Balcão Promocional',
            shortLabel: 'Balcões',
            description: 'Balcões promocionais para feiras, ativações de marca e pontos de venda com montagem rápida e imagem profissional.'
        },
        'bandeiras': {
            label: 'Bandeiras',
            shortLabel: 'Bandeiras',
            description: 'Bandeiras promocionais, institucionais e de mesa para exterior, interior e eventos com impressão personalizada.'
        },
        'bandeirolas-esportivas': {
            label: 'Bandeirolas Desportivas',
            shortLabel: 'Bandeirolas',
            description: 'Bandeirolas desportivas personalizadas para clubes, eventos, premiações e merchandising institucional.'
        },
        'cubo-publicitario': {
            label: 'Cubo Publicitário',
            shortLabel: 'Cubos',
            description: 'Cubos publicitários personalizados para campanhas promocionais, pontos de venda e eventos de marca.'
        },
        'fly-banner': {
            label: 'Fly Banner',
            shortLabel: 'Fly Banners',
            description: 'Fly banners personalizados para exterior e eventos com forte impacto visual, várias bases e formatos profissionais.'
        },
        'mastros': {
            label: 'Mastros',
            shortLabel: 'Mastros',
            description: 'Mastros publicitários e institucionais para bandeiras de exterior com resistência e boa visibilidade.'
        },
        'photocall': {
            label: 'Photocall',
            shortLabel: 'Photocalls',
            description: 'Photocalls e backdrops personalizados para eventos, stands, conferências e zonas de fotografia.'
        },
        'roll-up': {
            label: 'Roll Up',
            shortLabel: 'Roll Ups',
            description: 'Roll ups personalizados para feiras, lojas e apresentações com estrutura compacta e instalação simples.'
        },
        'tenda-publicitaria': {
            label: 'Tenda Publicitária',
            shortLabel: 'Tendas',
            description: 'Tendas publicitárias personalizadas para eventos, ativações de marca e presença exterior de grande formato.'
        },
        'wall-banner': {
            label: 'Wall Banner',
            shortLabel: 'Wall Banners',
            description: 'Wall banners, lonas e estruturas de fundo para cenografia, stands, eventos e comunicação de grande formato.'
        },
        'x-banner': {
            label: 'X-Banner',
            shortLabel: 'X-Banners',
            description: 'X-banners promocionais leves e portáteis para campanhas, montras e comunicação de interior.'
        }
    };

    const STATIC_PATHS = {
        home: '/',
        products: '/produtos',
        about: '/sobre',
        contact: '/contacto',
        faq: '/faq',
        shipping: '/envios',
        returns: '/devolucoes',
        privacy: '/privacidade',
        terms: '/termos',
        checkout: '/checkout',
        checkoutSuccess: '/checkout/sucesso',
        orders: '/encomendas',
        sitemap: '/mapa-do-site',
        templates: '/modelos',
        admin: '/admin',
        adminTemplateEditor: '/admin-template-editor'
    };

    function stripDiacritics(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function slugify(value) {
        return stripDiacritics(value)
            .toLowerCase()
            .replace(/&/g, ' e ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
    }

    function normalizePath(pathname) {
        const trimmed = String(pathname || '/').trim() || '/';
        if (trimmed === '/') return '/';
        return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
    }

    function withQuery(pathname, params) {
        const url = new URL(normalizePath(pathname), CANONICAL_ORIGIN);
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            url.searchParams.set(key, String(value));
        });
        return `${url.pathname}${url.search}`;
    }

    function buildPublicUrl(pathname, params) {
        return new URL(withQuery(pathname, params), CANONICAL_ORIGIN).toString();
    }

    function normalizeCategorySlug(value) {
        const candidate = slugify(value);
        return candidate || 'produtos';
    }

    function getCategoryMeta(value) {
        const slug = normalizeCategorySlug(value);
        const meta = CATEGORY_META[slug];
        if (meta) {
            return {
                slug,
                label: meta.label,
                shortLabel: meta.shortLabel || meta.label,
                description: meta.description
            };
        }

        const fallbackLabel = String(value || slug)
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, function (character) {
                return character.toUpperCase();
            }) || 'Produtos';

        return {
            slug,
            label: fallbackLabel,
            shortLabel: fallbackLabel,
            description: 'Produtos publicitários personalizados para comunicação física, eventos e presença de marca.'
        };
    }

    function inferProductSlug(productOrValue) {
        if (!productOrValue) return '';
        if (typeof productOrValue === 'string') {
            return slugify(productOrValue);
        }

        const manifestMatchById = findProductById(productOrValue.id);
        if (manifestMatchById?.slug) {
            return manifestMatchById.slug;
        }

        const explicit = String(productOrValue.slug || '').trim();
        if (explicit) {
            return slugify(explicit);
        }

        const fromName = slugify(productOrValue.nome || productOrValue.name || productOrValue.titulo || '');
        if (fromName) {
            return fromName;
        }

        const fallbackId = String(productOrValue.id || '').trim();
        return fallbackId ? `produto-${fallbackId}` : '';
    }

    function getCatalogManifest() {
        if (typeof globalThis === 'undefined') return null;
        const manifest = globalThis.CatalogSeoManifest;
        return manifest && Array.isArray(manifest.products) ? manifest : null;
    }

    function findProductById(id) {
        const manifest = getCatalogManifest();
        if (!manifest) return null;
        const target = String(id || '').trim();
        return manifest.products.find(function (product) {
            return String(product.id || '').trim() === target;
        }) || null;
    }

    function findProductBySlug(slug) {
        const manifest = getCatalogManifest();
        if (!manifest) return null;
        const target = slugify(slug);
        return manifest.products.find(function (product) {
            return slugify(product.slug) === target;
        }) || null;
    }

    function buildProductPath(productOrSlug) {
        const slug = typeof productOrSlug === 'string'
            ? inferProductSlug(productOrSlug)
            : inferProductSlug(productOrSlug);
        return `/produto/${encodeURIComponent(slug)}`;
    }

    function buildProductPersonalizerPath(productOrSlug, params) {
        return withQuery(`${buildProductPath(productOrSlug)}/personalizar`, params);
    }

    function buildCategoryPath(category) {
        return `/produtos/${encodeURIComponent(normalizeCategorySlug(category))}`;
    }

    function buildOrderPath(code) {
        return `/encomenda/${encodeURIComponent(String(code || '').trim().toUpperCase())}`;
    }

    function buildContactPath(params) {
        return withQuery(STATIC_PATHS.contact, params);
    }

    function buildCheckoutSuccessPath(params) {
        return withQuery(STATIC_PATHS.checkoutSuccess, params);
    }

    function buildTemplatesPath(params) {
        return withQuery(STATIC_PATHS.templates, params);
    }

    function getCanonicalOrigin() {
        return CANONICAL_ORIGIN;
    }

    function parseLocationPath(pathname) {
        const normalized = normalizePath(pathname);
        const productMatch = normalized.match(/^\/produto\/([^/]+)(?:\/personalizar)?$/i);
        const orderMatch = normalized.match(/^\/encomenda\/([^/]+)$/i);
        const categoryMatch = normalized.match(/^\/produtos\/([^/]+)$/i);

        return {
            pathname: normalized,
            productSlug: productMatch ? decodeURIComponent(productMatch[1]) : '',
            isProductPersonalizer: /^\/produto\/[^/]+\/personalizar$/i.test(normalized),
            orderCode: orderMatch ? decodeURIComponent(orderMatch[1]) : '',
            categorySlug: categoryMatch ? decodeURIComponent(categoryMatch[1]) : ''
        };
    }

    function isIndexablePublicPath(pathname) {
        const normalized = normalizePath(pathname);
        if (normalized === STATIC_PATHS.home) return true;

        return [
            STATIC_PATHS.products,
            STATIC_PATHS.about,
            STATIC_PATHS.contact,
            STATIC_PATHS.faq,
            STATIC_PATHS.shipping,
            STATIC_PATHS.returns,
            STATIC_PATHS.privacy,
            STATIC_PATHS.terms
        ].includes(normalized)
            || /^\/produto\/[^/]+$/i.test(normalized)
            || /^\/produtos\/[^/]+$/i.test(normalized)
            || normalized === STATIC_PATHS.sitemap;
    }

    return {
        CANONICAL_ORIGIN,
        CATEGORY_META,
        STATIC_PATHS,
        slugify,
        normalizePath,
        normalizeCategorySlug,
        getCategoryMeta,
        inferProductSlug,
        buildPublicUrl,
        buildProductPath,
        buildProductPersonalizerPath,
        buildCategoryPath,
        buildOrderPath,
        buildContactPath,
        buildCheckoutSuccessPath,
        buildTemplatesPath,
        getCanonicalOrigin,
        getCatalogManifest,
        findProductById,
        findProductBySlug,
        parseLocationPath,
        withQuery,
        isIndexablePublicPath
    };
}));
