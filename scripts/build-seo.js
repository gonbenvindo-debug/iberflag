const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const SiteRoutes = require('../assets/js/core/site-routes.js');
const { getEnvValue } = require('../lib/server/env');

const ROOT_DIR = path.resolve(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT_DIR, 'produto');
const PRODUCTS_DIR = path.join(ROOT_DIR, 'produtos');
const SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const HTML_SITEMAP_DIR = path.join(ROOT_DIR, 'mapa-do-site');
const GENERATED_JS_DIR = path.join(ROOT_DIR, 'assets', 'js', 'generated');
const CANONICAL_ORIGIN = SiteRoutes.getCanonicalOrigin();

const STATIC_INDEXABLE_PAGES = [
    { path: SiteRoutes.STATIC_PATHS.home, title: 'IberFlag - Fly Banners, Roll Ups e Publicidade Física Personalizada', description: 'Especialistas em fly banners, roll ups, bandeiras, photocalls e publicidade física personalizada com operação principal em Portugal.' },
    { path: SiteRoutes.STATIC_PATHS.products, title: 'Catálogo de Produtos Publicitários | IberFlag', description: 'Explore o catálogo IberFlag com fly banners, roll ups, bandeiras, tendas, photocalls e suportes promocionais personalizados.' },
    { path: SiteRoutes.STATIC_PATHS.about, title: 'Sobre a IberFlag | Produção Publicitária para Marcas', description: 'Conheça a IberFlag, a operação, a abordagem de produção e o foco em materiais promocionais personalizados para marcas e eventos.' },
    { path: SiteRoutes.STATIC_PATHS.contact, title: 'Contacto IberFlag | Orçamentos e Apoio Comercial', description: 'Fale com a equipa IberFlag para pedir orçamento, confirmar prazos de produção ou esclarecer dúvidas sobre produtos publicitários.' },
    { path: SiteRoutes.STATIC_PATHS.faq, title: 'FAQ IberFlag | Perguntas Frequentes', description: 'Respostas a perguntas frequentes sobre prazos, personalização, pagamento, envio e funcionamento das encomendas na IberFlag.' },
    { path: SiteRoutes.STATIC_PATHS.shipping, title: 'Envios e Entregas | IberFlag', description: 'Informações sobre produção, expedição, prazos e entregas dos produtos personalizados IberFlag com foco operacional em Portugal.' },
    { path: SiteRoutes.STATIC_PATHS.returns, title: 'Devoluções e Reclamações | IberFlag', description: 'Política de devoluções, não conformidades e processo de reclamação para encomendas IberFlag.' },
    { path: SiteRoutes.STATIC_PATHS.privacy, title: 'Política de Privacidade | IberFlag', description: 'Saiba como a IberFlag trata dados pessoais, pedidos de contacto, encomendas e comunicações comerciais.' },
    { path: SiteRoutes.STATIC_PATHS.terms, title: 'Termos e Condições | IberFlag', description: 'Consulte os termos e condições de venda, produção, faturação, pagamentos e responsabilidade da IberFlag.' },
    { path: SiteRoutes.STATIC_PATHS.sitemap, title: 'Mapa do Site | IberFlag', description: 'Mapa do site IberFlag com ligações rápidas para categorias, produtos e páginas institucionais.' }
];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stripHtml(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ');
}

function normalizeText(value) {
    return stripHtml(String(value || ''))
        .replace(/\s+/g, ' ')
        .trim();
}

function summarize(value, maxLength = 160) {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function includesNormalized(haystack, needle) {
    const normalizedHaystack = SiteRoutes.slugify(haystack).replace(/-/g, ' ');
    const normalizedNeedle = SiteRoutes.slugify(needle).replace(/-/g, ' ');
    if (!normalizedHaystack || !normalizedNeedle) return false;
    return normalizedHaystack.includes(normalizedNeedle);
}

function buildProductSeoTitle(product, category) {
    const fallbackTitle = `${product.nome} | ${category.shortLabel} | IberFlag`;
    const providedTitle = normalizeText(product.seo_title);
    if (!providedTitle) return fallbackTitle;

    const titleSegments = providedTitle
        .split('|')
        .map((segment) => normalizeText(segment))
        .filter(Boolean);

    const hasBrand = includesNormalized(providedTitle, 'IberFlag');
    const hasProductName = includesNormalized(providedTitle, product.nome);

    if (hasBrand && hasProductName && titleSegments.length >= 3) {
        return providedTitle;
    }

    return fallbackTitle;
}

function buildProductSeoDescription(product, category) {
    const productDescription = normalizeText(product.descricao);
    if (productDescription) {
        return summarize(productDescription, 155);
    }

    const providedDescription = normalizeText(product.seo_description);
    if (providedDescription) {
        return summarize(providedDescription, 155);
    }

    return summarize(`${product.nome} personalizado da categoria ${category.label}.`, 155);
}

function formatCurrency(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return 'Sob consulta';
    return `${amount.toFixed(2)}€`;
}

function isDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function dateOnly(value) {
    return isDate(value).slice(0, 10);
}

function safeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return `${CANONICAL_ORIGIN}/assets/images/template-placeholder.svg`;
    if (/^https?:\/\//i.test(raw)) return raw;
    return new URL(raw.replace(/^\/+/, '/'), CANONICAL_ORIGIN).toString();
}

function resolveSupabaseConfig() {
    const envUrl = getEnvValue(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
    const envAnon = getEnvValue(['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    if (envUrl && envAnon) {
        return { url: envUrl, anonKey: envAnon };
    }

    return {
        url: 'https://nzwfquivulxkmxrwqalz.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56d2ZxdWl2dWx4a214cndxYWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzMzODQsImV4cCI6MjA4OTM0OTM4NH0.pelN5argByWYMij-wE1GRhQ-L8bEFGMDMJliOZrBBXU'
    };
}

async function fetchCatalogProducts() {
    const { url, anonKey } = resolveSupabaseConfig();
    const client = createClient(url, anonKey);
    const baseQuery = client
        .from('produtos')
        .select('id, nome, descricao, preco, categoria, imagem, destaque, ativo, created_at, updated_at, slug, seo_title, seo_description')
        .eq('ativo', true)
        .order('id', { ascending: true });

    let result = await baseQuery;

    if (result.error?.code === '42703') {
        result = await client
            .from('produtos')
            .select('id, nome, descricao, preco, categoria, imagem, destaque, ativo, created_at, updated_at')
            .eq('ativo', true)
            .order('id', { ascending: true });
    }

    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data : [];
}

function assignUniqueProductSlugs(products) {
    const seen = new Set();
    return products.map((product) => {
        const baseSlug = SiteRoutes.inferProductSlug(product);
        let finalSlug = baseSlug || `produto-${product.id}`;
        if (seen.has(finalSlug)) finalSlug = `${finalSlug}-${product.id}`;
        seen.add(finalSlug);

        const category = SiteRoutes.getCategoryMeta(product.categoria);
        return {
            ...product,
            slug: finalSlug,
            categorySlug: category.slug,
            categoryLabel: category.label,
            categoryDescription: category.description,
            seo_title: buildProductSeoTitle(product, category),
            seo_description: buildProductSeoDescription(product, category),
            canonicalPath: SiteRoutes.buildProductPath(finalSlug),
            personalizePath: SiteRoutes.buildProductPersonalizerPath(finalSlug),
            imageUrl: safeImageUrl(product.imagem)
        };
    });
}

function buildCategoryEntries(products) {
    const grouped = new Map();
    products.forEach((product) => {
        if (!grouped.has(product.categorySlug)) grouped.set(product.categorySlug, []);
        grouped.get(product.categorySlug).push(product);
    });

    return Array.from(grouped.entries()).map(([slug, categoryProducts]) => {
        const meta = SiteRoutes.getCategoryMeta(slug);
        return {
            slug,
            label: meta.label,
            shortLabel: meta.shortLabel,
            description: meta.description,
            title: `${meta.label} Personalizados | IberFlag`,
            canonicalPath: SiteRoutes.buildCategoryPath(slug),
            products: categoryProducts.sort((left, right) => {
                const featuredDelta = Number(Boolean(right.destaque)) - Number(Boolean(left.destaque));
                if (featuredDelta !== 0) return featuredDelta;
                return String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-PT');
            }),
            updatedAt: categoryProducts.reduce((latest, product) => {
                const value = isDate(product.updated_at || product.created_at);
                return value > latest ? value : latest;
            }, isDate())
        };
    }).sort((left, right) => left.label.localeCompare(right.label, 'pt-PT'));
}

function buildStructuredDataJson(data) {
    return JSON.stringify(data, null, 2)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');
}

function renderHead({ title, description, canonicalPath, imageUrl, robots = 'index,follow', structuredData = [] }) {
    const canonicalUrl = SiteRoutes.buildPublicUrl(canonicalPath);
    const ogImage = safeImageUrl(imageUrl);
    const schemas = Array.isArray(structuredData) ? structuredData : [structuredData];

    return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_PT">
  <meta property="og:site_name" content="IberFlag">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <link rel="icon" type="image/svg+xml" href="/favicon-white.svg?v=20260415a">
  <link rel="stylesheet" href="/assets/css/tailwind.output.css?v=20260411cat1">
  <link rel="stylesheet" href="/assets/css/style.css?v=20260411cat4">
  <style>
    @media (max-width: 767px) {
      .catalog-grid-two {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 0.85rem !important;
      }

      .catalog-grid-two > * {
        min-width: 0 !important;
      }
    }
  </style>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      const catalogRootPath = '${SiteRoutes.STATIC_PATHS.products}';
      const applyCatalogTwoColumns = () => {
        const grids = document.querySelectorAll('.catalog-grid-two');
        const isMobile = window.matchMedia('(max-width: 767px)').matches;

        grids.forEach((grid) => {
          if (isMobile) {
            grid.style.setProperty('display', 'grid', 'important');
            grid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
            grid.style.setProperty('gap', '0.85rem', 'important');

            Array.from(grid.children).forEach((item) => {
              item.style.setProperty('width', 'auto', 'important');
              item.style.setProperty('max-width', 'none', 'important');
              item.style.setProperty('min-width', '0', 'important');
              item.style.setProperty('grid-column', 'span 1', 'important');
            });
            return;
          }

          grid.style.removeProperty('display');
          grid.style.removeProperty('grid-template-columns');
          grid.style.removeProperty('gap');

          Array.from(grid.children).forEach((item) => {
            item.style.removeProperty('width');
            item.style.removeProperty('max-width');
            item.style.removeProperty('min-width');
            item.style.removeProperty('grid-column');
          });
        });
      };

      const sortCatalogGrid = (grid, sortValue) => {
        if (!grid) return;
        const items = Array.from(grid.querySelectorAll('[data-catalog-item]'));
        if (!items.length) return;

        const collator = new Intl.Collator('pt-PT', { numeric: true, sensitivity: 'base' });
        items.sort((left, right) => {
          const leftPrice = Number(left.getAttribute('data-price') || 0);
          const rightPrice = Number(right.getAttribute('data-price') || 0);
          const leftName = left.getAttribute('data-name') || '';
          const rightName = right.getAttribute('data-name') || '';
          const leftOrder = Number(left.getAttribute('data-order-index') || 0);
          const rightOrder = Number(right.getAttribute('data-order-index') || 0);

          switch (sortValue) {
            case 'price-asc':
              return leftPrice - rightPrice || collator.compare(leftName, rightName);
            case 'price-desc':
              return rightPrice - leftPrice || collator.compare(leftName, rightName);
            case 'name-asc':
              return collator.compare(leftName, rightName);
            case 'name-desc':
              return collator.compare(rightName, leftName);
            default:
              return leftOrder - rightOrder;
          }
        });

        items.forEach((item) => grid.appendChild(item));
      };

      document.querySelectorAll('[data-catalog-sort-select]').forEach((select) => {
        const grid = document.querySelector('[data-catalog-grid]');
        const applySort = () => sortCatalogGrid(grid, select.value || 'default');
        select.addEventListener('change', applySort);
        applySort();
      });

      document.querySelectorAll('[data-catalog-category-select]').forEach((select) => {
        select.addEventListener('change', () => {
          const nextCategory = String(select.value || 'all').trim().toLowerCase();
          const nextPath = nextCategory && nextCategory !== 'all'
            ? catalogRootPath + '/' + encodeURIComponent(nextCategory)
            : catalogRootPath;
          window.location.assign(nextPath);
        });
      });

      applyCatalogTwoColumns();
      window.addEventListener('resize', applyCatalogTwoColumns, { passive: true });
    });
  </script>
  <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
  <script src="/assets/js/core/icon-engine.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="/assets/js/config.js"></script>
  <script src="/assets/js/core/site-routes.js?v=20260409seo1"></script>
  <script src="/assets/js/generated/catalog-seo-manifest.js?v=20260409seo1"></script>
  <script src="/assets/js/core/cart-assets.js?v=20260401a"></script>
  <script src="/assets/js/core/analytics.js?v=20260410a"></script>
  <script src="/assets/js/core/logic.js?v=20260410a"></script>
  <script src="/assets/js/core/flybanner-selection.js?v=20260420a"></script>
  ${schemas.map((entry) => `<script type="application/ld+json">\n${buildStructuredDataJson(entry)}\n</script>`).join('\n  ')}
</head>`;
}

function renderHeader(currentPath = '') {
    const links = [
        { path: SiteRoutes.STATIC_PATHS.home, label: 'Início' },
        { path: SiteRoutes.STATIC_PATHS.products, label: 'Produtos' },
        { path: SiteRoutes.STATIC_PATHS.about, label: 'Sobre Nós' },
        { path: SiteRoutes.STATIC_PATHS.faq, label: 'FAQ' },
        { path: SiteRoutes.STATIC_PATHS.contact, label: 'Contacto' }
    ];

    const renderDesktopLink = (link) => {
        const isHome = link.path === SiteRoutes.STATIC_PATHS.home;
        const isCurrent = isHome
            ? currentPath === SiteRoutes.STATIC_PATHS.home
            : currentPath === link.path || currentPath.startsWith(`${link.path}/`);
        return `<a href="${link.path}" class="nav-link${isCurrent ? ' text-blue-600' : ''}">${escapeHtml(link.label)}</a>`;
    };

    const renderMobileLink = (link) => {
        const isHome = link.path === SiteRoutes.STATIC_PATHS.home;
        const isCurrent = isHome
            ? currentPath === SiteRoutes.STATIC_PATHS.home
            : currentPath === link.path || currentPath.startsWith(`${link.path}/`);
        return `<a href="${link.path}" class="block px-4 py-3 hover:bg-gray-100 font-medium${isCurrent ? ' text-blue-600' : ''}">${escapeHtml(link.label)}</a>`;
    };

    return `<nav class="bg-white shadow-sm sticky top-0 z-50 nav-blur">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16 items-center">
      <a href="/" class="flex items-center gap-2 group" aria-label="IberFlag">
        <img src="/assets/logos/logo-completo.svg" alt="IberFlag" class="brand-logo-full">
      </a>
      <div class="hidden md:flex space-x-6 items-center">
        ${links.map(renderDesktopLink).join('')}
        <button id="cart-btn" type="button" aria-expanded="false" class="relative bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg flex items-center gap-2">
          <i data-lucide="shopping-cart" class="w-4 h-4"></i>
          <span class="hidden sm:inline">Carrinho</span>
          <span id="cart-count" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center hidden">0</span>
        </button>
      </div>
      <div class="mobile-header-actions md:hidden flex items-center gap-2">
        <a id="cart-btn-mobile" href="${SiteRoutes.STATIC_PATHS.checkout}" onclick="openCart(event)" aria-expanded="false" class="relative p-2 hover:bg-gray-100 rounded-lg" aria-label="Abrir carrinho">
          <i data-lucide="shopping-cart" class="w-5 h-5"></i>
          <span id="cart-count-mobile" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center hidden text-[10px]">0</span>
        </a>
        <button id="mobile-menu-btn" type="button" onclick="toggleMobileMenu(event)" class="p-2 hover:bg-gray-100 rounded-lg" aria-label="Abrir menu">
          <i data-lucide="menu" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  </div>
</nav>
<div id="mobile-menu" class="hidden md:hidden bg-white border-b">
  <div class="px-4 py-2 space-y-1">
    ${links.map(renderMobileLink).join('')}
  </div>
</div>`;
}

function renderFooter() {
    return `<footer class="bg-gray-900 text-gray-400 py-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
      <div class="col-span-1 md:col-span-2">
        <div class="mb-6">
          <a href="/" class="brand-logo-badge" aria-label="IberFlag">
            <img src="/assets/logos/logo-minimalista-white.svg" alt="IberFlag" class="brand-logo-footer">
          </a>
        </div>
                    <p class="max-w-sm mb-6">Especialistas em flybanners e produtos publicitários com operação principal em Portugal, produção rápida e apoio dedicado.</p>
        <div class="flex gap-4">
          <a href="#" class="social-icon" aria-label="Facebook">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          <a href="#" class="social-icon" aria-label="Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="20" x="2" y="2" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </a>
          <a href="#" class="social-icon" aria-label="LinkedIn">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect width="4" height="12" x="2" y="9" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </a>
        </div>
      </div>
      <div>
        <h4 class="text-white font-bold mb-4">Links Rápidos</h4>
        <ul class="space-y-3">
          <li><a href="/" class="hover:text-white transition">Início</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.products}" class="hover:text-white transition">Produtos</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.about}" class="hover:text-white transition">Sobre Nós</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.faq}" class="hover:text-white transition">FAQ</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.contact}" class="hover:text-white transition">Falar com a equipa</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.sitemap}" class="hover:text-white transition">Mapa do Site</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-white font-bold mb-4">Informações</h4>
        <ul class="space-y-3">
          <li><a href="${SiteRoutes.STATIC_PATHS.shipping}" class="hover:text-white transition">Envios e prazos</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.terms}" class="hover:text-white transition">Termos e Condições</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.privacy}" class="hover:text-white transition">Política de Privacidade</a></li>
          <li><a href="${SiteRoutes.STATIC_PATHS.returns}" class="hover:text-white transition">Devoluções</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-800 pt-8">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="text-sm">© 2026 IberFlag. Todos os direitos reservados.</div>
        <div class="flex items-center gap-2 text-sm">
          <i data-lucide="mail" class="w-4 h-4"></i>
          <a href="mailto:geral@iberflag.com" class="hover:text-white transition">geral@iberflag.com</a>
        </div>
      </div>
    </div>
  </div>
</footer>`;
}

function renderProductPage(product, categoryEntries, productEntries) {
    const related = productEntries
        .filter((candidate) => candidate.slug !== product.slug && candidate.categorySlug === product.categorySlug)
        .slice(0, 4);
    const fallbackProducts = related.length > 0 ? related : productEntries.filter((candidate) => candidate.slug !== product.slug).slice(0, 4);
    const shuffledSuggestions = productEntries
        .filter((candidate) => candidate.slug !== product.slug && !fallbackProducts.some((item) => item.slug === candidate.slug))
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.nome,
            description: product.seo_description,
            image: [product.imageUrl],
            brand: { '@type': 'Brand', name: 'IberFlag' },
            url: SiteRoutes.buildPublicUrl(product.canonicalPath),
            offers: {
                '@type': 'Offer',
                priceCurrency: 'EUR',
                price: Number(product.preco || 0).toFixed(2),
                availability: 'https://schema.org/InStock',
                url: SiteRoutes.buildPublicUrl(product.canonicalPath)
            }
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: SiteRoutes.buildPublicUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Produtos', item: SiteRoutes.buildPublicUrl(SiteRoutes.STATIC_PATHS.products) },
                { '@type': 'ListItem', position: 3, name: product.categoryLabel, item: SiteRoutes.buildPublicUrl(SiteRoutes.buildCategoryPath(product.categorySlug)) },
                { '@type': 'ListItem', position: 4, name: product.nome, item: SiteRoutes.buildPublicUrl(product.canonicalPath) }
            ]
        }
    ];

    return `${renderHead({
        title: product.seo_title,
        description: product.seo_description,
        canonicalPath: product.canonicalPath,
        imageUrl: product.imageUrl,
        structuredData
    })}
<body class="bg-slate-50 text-slate-900" data-analytics-event="view_product" data-analytics-product-id="${escapeHtml(product.id)}" data-analytics-category-slug="${escapeHtml(product.categorySlug)}" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.nome)}" data-product-category-slug="${escapeHtml(product.categorySlug)}">
  ${renderHeader(product.canonicalPath)}
  <main>
    <div class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 pb-2 pt-3 text-sm text-slate-500 sm:px-6 sm:py-4 lg:px-8">
        <nav class="breadcrumb product-breadcrumb flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
          <a href="/" class="hover:text-slate-900">Início</a>
          <span>/</span>
          <a href="${SiteRoutes.STATIC_PATHS.products}" class="hover:text-slate-900">Produtos</a>
          <span>/</span>
          <a href="${SiteRoutes.buildCategoryPath(product.categorySlug)}" class="hover:text-slate-900">${escapeHtml(product.categoryLabel)}</a>
          <span>/</span>
          <span class="text-slate-900">${escapeHtml(product.nome)}</span>
        </nav>
      </div>
    </div>
    <section class="bg-white">
      <div class="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-0 sm:px-6 sm:pt-3 lg:grid-cols-[minmax(0,1.08fr),minmax(340px,0.92fr)] lg:px-8 lg:py-14">
        <div class="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-b from-white via-white to-slate-50 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-4">
          <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full rounded-[1.5rem] bg-white object-contain p-4 sm:p-6" width="1200" height="900" decoding="async">
        </div>
        <div class="flex flex-col gap-5 sm:gap-6">
          <div>
            <h1 class="max-w-[14ch] text-[clamp(1.9rem,7vw,3.4rem)] font-semibold leading-[0.95] tracking-tight text-slate-900 sm:max-w-none sm:text-4xl">${escapeHtml(product.nome)}</h1>
          </div>
          <div class="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6">
            <div class="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Preço base</div>
                <div class="mt-2 flex flex-wrap items-end gap-3">
                  <div class="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">${escapeHtml(formatCurrency(product.preco))}</div>
                </div>
              </div>
              <a href="${product.personalizePath}" data-personalize-link="true" ${product.categorySlug === 'fly-banner' ? 'data-flybanner-personalize-trigger="true"' : ''} data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.nome)}" data-product-category="${escapeHtml(product.categorySlug)}" data-analytics-event="start_personalization" data-analytics-product-id="${escapeHtml(product.id)}" data-analytics-category-slug="${escapeHtml(product.categorySlug)}" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto">
                <span>Personalizar produto</span>
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
            <p class="mt-4 text-sm leading-6 text-slate-500">Escolha as opções, envie o design e finalize a encomenda no passo seguinte.</p>
            <div class="product-quick-links mt-5 grid grid-cols-3 gap-2">
              <a href="${SiteRoutes.STATIC_PATHS.shipping}" class="group inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 sm:px-4 sm:text-sm">
                <span>Envios</span>
                <span aria-hidden="true" class="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900">&rarr;</span>
              </a>
              <a href="${SiteRoutes.STATIC_PATHS.faq}" class="group inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 sm:px-4 sm:text-sm">
                <span>FAQ</span>
                <span aria-hidden="true" class="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900">&rarr;</span>
              </a>
              <a href="${SiteRoutes.buildContactPath({ assunto: product.nome })}" class="group inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 sm:px-4 sm:text-sm">
                <span>Pedir apoio</span>
                <span aria-hidden="true" class="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900">&rarr;</span>
              </a>
            </div>
          </div>
          <p class="text-[0.95rem] leading-7 text-slate-600 sm:text-base">${escapeHtml(normalizeText(product.descricao || product.seo_description))}</p>
        </div>
      </div>
    </section>
    <section class="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Continue a explorar</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">Produtos relacionados</h2>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Veja mais modelos da categoria ${escapeHtml(product.categoryLabel)} e compare formatos, tamanhos e preços.</p>
          </div>
          <a href="${SiteRoutes.buildCategoryPath(product.categorySlug)}" class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
            <span>Ver categoria completa</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <div class="catalog-grid-two mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
          ${fallbackProducts.map((candidate) => `
            <article class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <a href="${candidate.canonicalPath}" class="block">
                <img src="${escapeHtml(candidate.imageUrl)}" alt="${escapeHtml(candidate.nome)}" class="aspect-[4/3] h-full w-full bg-white object-contain p-3 sm:p-5" loading="lazy" width="720" height="540" decoding="async">
              </a>
              <div class="p-4 sm:p-5">
                <p class="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">${escapeHtml(candidate.categoryLabel)}</p>
                <h3 class="mt-2 text-sm font-semibold leading-5 text-slate-900 sm:text-base"><a href="${candidate.canonicalPath}" class="hover:text-slate-700">${escapeHtml(candidate.nome)}</a></h3>
                <div class="mt-4 flex items-center justify-between gap-3">
                  <span class="text-sm font-semibold text-slate-900">${escapeHtml(formatCurrency(candidate.preco))}</span>
                  <a href="${candidate.canonicalPath}" data-product-id="${escapeHtml(candidate.id)}" data-product-name="${escapeHtml(candidate.nome)}" data-product-category="${escapeHtml(candidate.categorySlug)}" class="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm">
                    <span>Ver produto</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
        <div class="mt-12 border-t border-slate-200 pt-10">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Ver mais</p>
              <h2 class="mt-2 text-2xl font-semibold text-slate-900">Outras opções que podem interessar</h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Uma seleção rápida de produtos para explorar formatos diferentes sem voltar ao catálogo inteiro.</p>
            </div>
            <a href="${SiteRoutes.STATIC_PATHS.products}" class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
              <span>Ver tudo</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
          <div class="catalog-grid-two mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
            ${shuffledSuggestions.map((candidate) => `
              <article class="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <a href="${candidate.canonicalPath}" class="block">
                  <img src="${escapeHtml(candidate.imageUrl)}" alt="${escapeHtml(candidate.nome)}" class="aspect-[4/3] h-full w-full bg-white object-contain p-3 sm:p-5" loading="lazy" width="720" height="540" decoding="async">
                </a>
                <div class="p-4 sm:p-5">
                  <p class="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">${escapeHtml(candidate.categoryLabel)}</p>
                  <h3 class="mt-2 text-sm font-semibold leading-5 text-slate-900 sm:text-base"><a href="${candidate.canonicalPath}" class="hover:text-slate-700">${escapeHtml(candidate.nome)}</a></h3>
                  <div class="mt-4 flex items-center justify-between gap-3">
                    <span class="text-sm font-semibold text-slate-900">${escapeHtml(formatCurrency(candidate.preco))}</span>
                    <a href="${candidate.canonicalPath}" data-product-id="${escapeHtml(candidate.id)}" data-product-name="${escapeHtml(candidate.nome)}" data-product-category="${escapeHtml(candidate.categorySlug)}" class="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm">
                      <span>Ver produto</span>
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
}

function renderCatalogToolbar(categoryEntries, { selectedCategory = 'all', productCount = 0 } = {}) {
    const safeSelectedCategory = String(selectedCategory || 'all').trim().toLowerCase() || 'all';
    const categoryOptions = [
        `<option value="all"${safeSelectedCategory === 'all' ? ' selected' : ''}>Todas as categorias</option>`,
        ...categoryEntries.map((category) => `<option value="${escapeHtml(category.slug)}"${safeSelectedCategory === category.slug ? ' selected' : ''}>${escapeHtml(category.label)}</option>`)
    ].join('');

    return `
      <div class="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:items-end sm:justify-between">
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">${escapeHtml(productCount)} produto(s)</p>
        <div class="catalog-toolbar-grid grid grid-cols-2 gap-x-2 gap-y-1 sm:min-w-[30rem] sm:gap-x-3 sm:gap-y-2">
          <label for="catalog-category-select" class="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-500">
            Categoria
          </label>
          <label for="catalog-sort-select" class="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-500">
            Ordenar
          </label>
          <select id="catalog-category-select" data-catalog-category-select class="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
            ${categoryOptions}
          </select>
          <select id="catalog-sort-select" data-catalog-sort-select class="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
            <option value="default">Destaques</option>
            <option value="price-asc">Preço: menor primeiro</option>
            <option value="price-desc">Preço: maior primeiro</option>
            <option value="name-asc">Nome: A-Z</option>
            <option value="name-desc">Nome: Z-A</option>
          </select>
        </div>
      </div>
    `;
}

function renderCategoryPage(category, categoryEntries, productEntries) {
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: category.title,
            description: category.description,
            url: SiteRoutes.buildPublicUrl(category.canonicalPath)
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: SiteRoutes.buildPublicUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Produtos', item: SiteRoutes.buildPublicUrl(SiteRoutes.STATIC_PATHS.products) },
                { '@type': 'ListItem', position: 3, name: category.label, item: SiteRoutes.buildPublicUrl(category.canonicalPath) }
            ]
        },
        {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: category.products.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: product.nome,
                url: SiteRoutes.buildPublicUrl(product.canonicalPath)
            }))
        }
    ];

    return `${renderHead({
        title: category.title,
        description: category.description,
        canonicalPath: category.canonicalPath,
        imageUrl: category.products[0]?.imageUrl,
        structuredData
    })}
<body class="bg-slate-50 text-slate-900" data-analytics-event="view_category" data-analytics-category-slug="${escapeHtml(category.slug)}">
  ${renderHeader(category.canonicalPath)}
  <main>
    <section class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 pb-5 pt-0 sm:px-6 sm:py-10 lg:px-8">
        <nav class="mb-4 hidden flex-wrap items-center gap-2 text-sm text-slate-500 sm:flex" aria-label="Breadcrumb">
          <a href="/" class="hover:text-slate-900">Início</a>
          <span>/</span>
          <a href="${SiteRoutes.STATIC_PATHS.products}" class="hover:text-slate-900">Produtos</a>
          <span>/</span>
          <span class="text-slate-900">${escapeHtml(category.label)}</span>
        </nav>
        <div class="max-w-3xl">
          <h1 class="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">${escapeHtml(category.label)} personalizados</h1>
          <p class="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">${escapeHtml(category.description)}</p>
        </div>
        ${renderCatalogToolbar(categoryEntries, { selectedCategory: category.slug, productCount: category.products.length })}
      </div>
    </section>
    <section class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div data-catalog-grid class="catalog-grid-two grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        ${category.products.map((product, index) => `
          <article class="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white" data-catalog-item data-order-index="${index}" data-price="${Number(product.preco || 0)}" data-name="${escapeHtml(String(product.nome || '').toLowerCase())}">
            <a href="${product.canonicalPath}" class="block">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full bg-white object-contain p-3 sm:p-5" loading="lazy" width="720" height="540" decoding="async">
            </a>
            <div class="flex flex-1 flex-col p-3 sm:p-5">
              <div class="flex flex-1 flex-col">
                <p class="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-slate-500 sm:text-xs">${escapeHtml(product.categoryLabel)}</p>
                <h2 class="mt-1.5 text-[0.68rem] font-semibold leading-[1.02] text-slate-900 sm:mt-2 sm:text-lg sm:leading-5"><a href="${product.canonicalPath}" class="hover:text-slate-700">${escapeHtml(product.nome)}</a></h2>
                <p class="mt-3 hidden text-sm leading-6 text-slate-600 sm:block">${escapeHtml(summarize(product.descricao || product.seo_description, 160))}</p>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2 sm:mt-4">
                <span class="text-[0.85rem] font-semibold text-slate-900 sm:text-base">${escapeHtml(formatCurrency(product.preco))}</span>
                <a href="${product.canonicalPath}" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.nome)}" data-product-category="${escapeHtml(product.categorySlug)}" class="text-[0.7rem] font-medium text-slate-700 hover:text-slate-900 sm:text-sm">Ver produto</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
}

function renderProductsLandingPage(categoryEntries, productEntries) {
    const highlightedProducts = productEntries
        .slice()
        .sort((left, right) => {
            const featuredDelta = Number(Boolean(right.destaque)) - Number(Boolean(left.destaque));
            if (featuredDelta !== 0) return featuredDelta;
            return String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-PT');
        })
        .slice(0, 12);
    const primaryImage = highlightedProducts[0]?.imageUrl || `${CANONICAL_ORIGIN}/assets/logos/logo-completo.svg`;
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Catálogo de Produtos IberFlag',
            description: 'Catálogo IberFlag com categorias e produtos publicitários personalizados para eventos, retalho e comunica??o f?sica.',
            url: SiteRoutes.buildPublicUrl(SiteRoutes.STATIC_PATHS.products)
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: SiteRoutes.buildPublicUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Produtos', item: SiteRoutes.buildPublicUrl(SiteRoutes.STATIC_PATHS.products) }
            ]
        },
        {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: highlightedProducts.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: product.nome,
                url: SiteRoutes.buildPublicUrl(product.canonicalPath)
            }))
        }
    ];

    return `${renderHead({
        title: 'Catálogo de Produtos Publicitarios | IberFlag',
        description: 'Explore o catalogo IberFlag com fly banners, roll ups, bandeiras, photocalls, tendas e suportes promocionais personalizados.',
        canonicalPath: SiteRoutes.STATIC_PATHS.products,
        imageUrl: primaryImage,
        structuredData
    })}
<body class="bg-slate-50 text-slate-900" data-analytics-event="view_category">
  ${renderHeader(SiteRoutes.STATIC_PATHS.products)}
  <main>
    <section class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 pb-5 pt-0 sm:px-6 sm:py-10 lg:px-8">
        <nav class="mb-3 hidden flex-wrap items-center gap-2 text-sm text-slate-500 sm:flex" aria-label="Breadcrumb">
          <a href="/" class="hover:text-slate-900">Início</a>
          <span>/</span>
          <span class="text-slate-900">Produtos</span>
        </nav>
        <div class="max-w-3xl">
          <h1 class="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">Catálogo de produtos publicitários</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">Escolha a categoria certa, compare os modelos e avance para a personalizacao quando ja souber o formato ideal.</p>
        </div>
        ${renderCatalogToolbar(categoryEntries, { selectedCategory: 'all', productCount: highlightedProducts.length })}
      </div>
    </section>
    <section class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <div data-catalog-grid class="catalog-grid-two grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
        ${highlightedProducts.map((product, index) => `
          <article class="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white" data-catalog-item data-order-index="${index}" data-price="${Number(product.preco || 0)}" data-name="${escapeHtml(String(product.nome || '').toLowerCase())}">
            <a href="${product.canonicalPath}" class="block">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full bg-white object-contain p-3 sm:p-5" loading="lazy" width="720" height="540" decoding="async">
            </a>
            <div class="flex flex-1 flex-col p-3 sm:p-5">
              <div class="flex flex-1 flex-col">
                <p class="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-slate-500 sm:text-xs">${escapeHtml(product.categoryLabel)}</p>
                <h2 class="mt-1.5 text-[0.68rem] font-semibold leading-[1.02] text-slate-900 sm:mt-2 sm:text-base sm:leading-5"><a href="${product.canonicalPath}" class="hover:text-slate-700">${escapeHtml(product.nome)}</a></h2>
                <p class="mt-3 hidden text-sm leading-6 text-slate-600 sm:block">${escapeHtml(summarize(product.descricao || product.seo_description, 145))}</p>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2 sm:mt-4">
                <span class="text-[0.85rem] font-semibold text-slate-900 sm:text-base">${escapeHtml(formatCurrency(product.preco))}</span>
                <a href="${product.canonicalPath}" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.nome)}" data-product-category="${escapeHtml(product.categorySlug)}" class="text-[0.7rem] font-medium text-slate-700 hover:text-slate-900 sm:text-sm">Ver produto</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
}

function renderHtmlSitemap(categoryEntries, productEntries) {
    return `${renderHead({
        title: 'Mapa do Site | IberFlag',
        description: 'Encontre rapidamente categorias, produtos e p?ginas principais da IberFlag.',
        canonicalPath: SiteRoutes.STATIC_PATHS.sitemap,
        imageUrl: `${CANONICAL_ORIGIN}/assets/logos/logo-completo.svg`,
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Mapa do Site IberFlag',
            url: SiteRoutes.buildPublicUrl(SiteRoutes.STATIC_PATHS.sitemap)
        }
    })}
<body class="bg-slate-50 text-slate-900">
  ${renderHeader(SiteRoutes.STATIC_PATHS.sitemap)}
  <main class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="max-w-3xl">
      <h1 class="text-3xl font-semibold tracking-tight text-slate-900">Mapa do site</h1>
      <p class="mt-4 text-base leading-7 text-slate-600">Encontre num s? lugar as categorias, os produtos e as p?ginas mais ?teis do site.</p>
    </div>
    <div class="mt-10 grid gap-8 lg:grid-cols-3">
      <section class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-semibold text-slate-900">Paginas principais</h2>
        <ul class="mt-5 space-y-3 text-sm text-slate-600">
          ${STATIC_INDEXABLE_PAGES.filter((page) => page.path !== SiteRoutes.STATIC_PATHS.sitemap).map((page) => `<li><a href="${page.path}" class="hover:text-slate-900">${escapeHtml(page.title)}</a></li>`).join('')}
        </ul>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-semibold text-slate-900">Categorias</h2>
        <ul class="mt-5 space-y-3 text-sm text-slate-600">
          ${categoryEntries.map((category) => `<li><a href="${category.canonicalPath}" class="hover:text-slate-900">${escapeHtml(category.label)}</a></li>`).join('')}
        </ul>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-semibold text-slate-900">Produtos</h2>
        <ul class="mt-5 space-y-3 text-sm text-slate-600">
          ${productEntries.map((product) => `<li><a href="${product.canonicalPath}" class="hover:text-slate-900">${escapeHtml(product.nome)}</a></li>`).join('')}
        </ul>
      </section>
    </div>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
}

function renderSitemapXml(entries) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${escapeHtml(entry.lastmod || dateOnly())}</lastmod>
  </url>`).join('\n')}
</urlset>
`;
}

function renderSitemapIndex(entries) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <sitemap>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${escapeHtml(entry.lastmod || dateOnly())}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>
`;
}

function renderRobotsTxt() {
    return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml
`;
}

function renderCatalogManifest(products, categories) {
    const manifest = {
        canonicalOrigin: CANONICAL_ORIGIN,
        products: products.map((product) => ({
            id: product.id,
            slug: product.slug,
            nome: product.nome,
            categoria: product.categoria,
            categorySlug: product.categorySlug,
            canonicalPath: product.canonicalPath,
            personalizePath: product.personalizePath,
            preco: Number(product.preco || 0),
            imagem: product.imageUrl,
            seoTitle: product.seo_title,
            seoDescription: product.seo_description
        })),
        categories: categories.map((category) => ({
            slug: category.slug,
            label: category.label,
            canonicalPath: category.canonicalPath,
            description: category.description
        }))
    };

    return `(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.CatalogSeoManifest = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return ${JSON.stringify(manifest, null, 2)};
}));\n`;
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function removeGeneratedPath(targetPath) {
    try {
        await fs.rm(targetPath, { recursive: true, force: true });
    } catch (error) {
        if (error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'ENOENT') {
            return;
        }
        throw error;
    }
}

async function writeFile(targetPath, content) {
    await ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, content, 'utf8');
}

async function buildSeoArtifacts() {
    const rawProducts = await fetchCatalogProducts();
    const products = assignUniqueProductSlugs(rawProducts);
    const categories = buildCategoryEntries(products);

    await Promise.all([
        removeGeneratedPath(PRODUCT_DIR),
        removeGeneratedPath(PRODUCTS_DIR),
        removeGeneratedPath(SITEMAPS_DIR),
        removeGeneratedPath(HTML_SITEMAP_DIR),
        ensureDir(PRODUCT_DIR),
        ensureDir(PRODUCTS_DIR),
        ensureDir(SITEMAPS_DIR),
        ensureDir(HTML_SITEMAP_DIR),
        ensureDir(GENERATED_JS_DIR)
    ]);

    await Promise.all(categories.map((category) => ensureDir(path.join(PRODUCTS_DIR, category.slug))));

    await Promise.all(products.map((product) => {
        const filePath = path.join(PRODUCT_DIR, product.slug, 'index.html');
        return writeFile(filePath, renderProductPage(product, categories, products));
    }));

    await Promise.all(categories.map((category) => {
        const filePath = path.join(PRODUCTS_DIR, category.slug, 'index.html');
        return writeFile(filePath, renderCategoryPage(category, categories, products));
    }));

    await writeFile(path.join(HTML_SITEMAP_DIR, 'index.html'), renderHtmlSitemap(categories, products));
    await writeFile(path.join(GENERATED_JS_DIR, 'catalog-seo-manifest.js'), renderCatalogManifest(products, categories));

    const pageSitemapEntries = STATIC_INDEXABLE_PAGES.map((page) => ({
        loc: SiteRoutes.buildPublicUrl(page.path),
        lastmod: dateOnly()
    }));
    const categorySitemapEntries = categories.map((category) => ({
        loc: SiteRoutes.buildPublicUrl(category.canonicalPath),
        lastmod: dateOnly(category.updatedAt)
    }));
    const productSitemapEntries = products.map((product) => ({
        loc: SiteRoutes.buildPublicUrl(product.canonicalPath),
        lastmod: dateOnly(product.updated_at || product.created_at)
    }));

    await writeFile(path.join(SITEMAPS_DIR, 'pages.xml'), renderSitemapXml(pageSitemapEntries));
    await writeFile(path.join(SITEMAPS_DIR, 'categories.xml'), renderSitemapXml(categorySitemapEntries));
    await writeFile(path.join(SITEMAPS_DIR, 'products.xml'), renderSitemapXml(productSitemapEntries));
    await writeFile(path.join(ROOT_DIR, 'sitemap.xml'), renderSitemapIndex([
        { loc: `${CANONICAL_ORIGIN}/sitemaps/pages.xml`, lastmod: dateOnly() },
        { loc: `${CANONICAL_ORIGIN}/sitemaps/categories.xml`, lastmod: dateOnly() },
        { loc: `${CANONICAL_ORIGIN}/sitemaps/products.xml`, lastmod: dateOnly() }
    ]));
    await writeFile(path.join(ROOT_DIR, 'robots.txt'), renderRobotsTxt());

    return { products: products.length, categories: categories.length };
}

buildSeoArtifacts()
    .then((result) => {
        console.log(`SEO build complete. Products: ${result.products}. Categories: ${result.categories}.`);
    })
    .catch((error) => {
        console.error('SEO build failed:', error);
        process.exitCode = 1;
    });
