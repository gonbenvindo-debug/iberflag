const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const SiteRoutes = require('../assets/js/core/site-routes.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT_DIR, 'produto');
const PRODUCTS_DIR = path.join(ROOT_DIR, 'produtos');
const SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const HTML_SITEMAP_DIR = path.join(ROOT_DIR, 'mapa-do-site');
const GENERATED_JS_DIR = path.join(ROOT_DIR, 'assets', 'js', 'generated');
const CANONICAL_ORIGIN = SiteRoutes.getCanonicalOrigin();

const STATIC_INDEXABLE_PAGES = [
    { path: SiteRoutes.STATIC_PATHS.home, title: 'IberFlag - Fly Banners, Roll Ups e Publicidade Fisica Personalizada', description: 'Especialistas em fly banners, roll ups, bandeiras, photocalls e publicidade fisica personalizada para Portugal e Espanha.' },
    { path: SiteRoutes.STATIC_PATHS.products, title: 'Catalogo de Produtos Publicitarios | IberFlag', description: 'Explore o catalogo IberFlag com fly banners, roll ups, bandeiras, tendas, photocalls e suportes promocionais personalizados.' },
    { path: SiteRoutes.STATIC_PATHS.about, title: 'Sobre a IberFlag | Producao Publicitaria para Marcas', description: 'Conheca a IberFlag, a operacao, a abordagem de producao e o foco em materiais promocionais personalizados para marcas e eventos.' },
    { path: SiteRoutes.STATIC_PATHS.contact, title: 'Contacto IberFlag | Orcamentos e Apoio Comercial', description: 'Fale com a equipa IberFlag para pedir orcamento, confirmar prazos de producao ou esclarecer duvidas sobre produtos publicitarios.' },
    { path: SiteRoutes.STATIC_PATHS.faq, title: 'FAQ IberFlag | Perguntas Frequentes', description: 'Respostas a perguntas frequentes sobre prazos, personalizacao, pagamento, envio e funcionamento das encomendas na IberFlag.' },
    { path: SiteRoutes.STATIC_PATHS.shipping, title: 'Envios e Entregas | IberFlag', description: 'Informacoes sobre producao, expedicao, prazos e entregas dos produtos personalizados IberFlag em Portugal e Espanha.' },
    { path: SiteRoutes.STATIC_PATHS.returns, title: 'Devolucoes e Reclamacoes | IberFlag', description: 'Politica de devolucoes, nao conformidades e processo de reclamacao para encomendas IberFlag.' },
    { path: SiteRoutes.STATIC_PATHS.privacy, title: 'Politica de Privacidade | IberFlag', description: 'Saiba como a IberFlag trata dados pessoais, pedidos de contacto, encomendas e comunicacoes comerciais.' },
    { path: SiteRoutes.STATIC_PATHS.terms, title: 'Termos e Condicoes | IberFlag', description: 'Consulte os termos e condicoes de venda, producao, faturacao, pagamentos e responsabilidade da IberFlag.' },
    { path: SiteRoutes.STATIC_PATHS.sitemap, title: 'Mapa do Site | IberFlag', description: 'Mapa do site IberFlag com ligacoes rapidas para categorias, produtos e paginas institucionais.' }
];

function escapeHtml(value) {
    return String(value ?? '')
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

function isoDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function dateOnly(value) {
    return isoDate(value).slice(0, 10);
}

function safeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return `${CANONICAL_ORIGIN}/assets/images/template-placeholder.svg`;
    if (/^https?:\/\//i.test(raw)) return raw;
    return new URL(raw.replace(/^\/+/, '/'), CANONICAL_ORIGIN).toString();
}

function resolveSupabaseConfig() {
    const envUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const envAnon = String(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
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
                const value = isoDate(product.updated_at || product.created_at);
                return value > latest ? value : latest;
            }, isoDate())
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
  <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20260401b">
  <link rel="stylesheet" href="/assets/css/tailwind.output.css?v=20260409seo2">
  <link rel="stylesheet" href="/assets/css/style.css?v=20260409seo2">
  ${schemas.map((entry) => `<script type="application/ld+json">\n${buildStructuredDataJson(entry)}\n</script>`).join('\n  ')}
</head>`;
}

function renderHeader(currentPath = '') {
    const links = [
        { path: SiteRoutes.STATIC_PATHS.products, label: 'Produtos' },
        { path: SiteRoutes.STATIC_PATHS.about, label: 'Sobre' },
        { path: SiteRoutes.STATIC_PATHS.faq, label: 'FAQ' },
        { path: SiteRoutes.STATIC_PATHS.contact, label: 'Contacto' }
    ];

    return `<header class="border-b border-slate-200 bg-white">
  <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
    <a href="/" class="flex items-center gap-3" aria-label="IberFlag">
      <img src="/assets/logos/logo-completo.svg" alt="IberFlag" class="h-10 w-auto">
    </a>
    <nav class="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
      ${links.map((link) => {
            const isCurrent = currentPath === link.path || currentPath.startsWith(`${link.path}/`);
            return `<a href="${link.path}" class="${isCurrent ? 'text-slate-900' : 'hover:text-slate-900'}">${escapeHtml(link.label)}</a>`;
        }).join('')}
    </nav>
  </div>
</header>`;
}

function renderFooter(categoryEntries, productEntries) {
    const featuredCategories = categoryEntries.slice(0, 6);
    const featuredProducts = productEntries.slice(0, 6);

    return `<footer class="border-t border-slate-200 bg-white">
  <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr,1fr,1fr] lg:px-8">
    <div>
      <img src="/assets/logos/logo-completo.svg" alt="IberFlag" class="mb-4 h-10 w-auto">
      <p class="max-w-md text-sm leading-6 text-slate-600">Producao publicitaria personalizada para marcas, eventos e espacos comerciais em Portugal e Espanha.</p>
    </div>
    <div>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-900">Categorias</h2>
      <ul class="mt-4 space-y-3 text-sm text-slate-600">
        ${featuredCategories.map((category) => `<li><a href="${category.canonicalPath}" class="hover:text-slate-900">${escapeHtml(category.label)}</a></li>`).join('')}
      </ul>
    </div>
    <div>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-900">Acesso rapido</h2>
      <ul class="mt-4 space-y-3 text-sm text-slate-600">
        <li><a href="${SiteRoutes.STATIC_PATHS.contact}" class="hover:text-slate-900">Contacto</a></li>
        <li><a href="${SiteRoutes.STATIC_PATHS.shipping}" class="hover:text-slate-900">Envios</a></li>
        <li><a href="${SiteRoutes.STATIC_PATHS.faq}" class="hover:text-slate-900">FAQ</a></li>
        <li><a href="${SiteRoutes.STATIC_PATHS.sitemap}" class="hover:text-slate-900">Mapa do site</a></li>
        <li><a href="${SiteRoutes.STATIC_PATHS.products}" class="hover:text-slate-900">Catalogo</a></li>
      </ul>
    </div>
  </div>
  <div class="border-t border-slate-200">
    <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <span>© 2026 IberFlag</span>
      <div class="flex flex-wrap gap-4">
        ${featuredProducts.map((product) => `<a href="${product.canonicalPath}" class="hover:text-slate-900">${escapeHtml(product.nome)}</a>`).join('')}
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
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: SiteRoutes.buildPublicUrl('/') },
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
<body class="bg-slate-50 text-slate-900">
  ${renderHeader(product.canonicalPath)}
  <main>
    <div class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-4 text-sm text-slate-500 sm:px-6 lg:px-8">
        <nav class="flex flex-wrap items-center gap-2" aria-label="Breadcrumb">
          <a href="/" class="hover:text-slate-900">Inicio</a>
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
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.1fr),minmax(320px,0.9fr)] lg:px-8 lg:py-14">
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full object-cover" width="1200" height="900" decoding="async">
        </div>
        <div class="flex flex-col gap-6">
          <div>
            <a href="${SiteRoutes.buildCategoryPath(product.categorySlug)}" class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">${escapeHtml(product.categoryLabel)}</a>
            <h1 class="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">${escapeHtml(product.nome)}</h1>
            <p class="mt-4 max-w-2xl text-base leading-7 text-slate-600">${escapeHtml(normalizeText(product.descricao || product.seo_description))}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div class="flex items-end justify-between gap-4">
              <div>
                <div class="text-sm font-medium uppercase tracking-wide text-slate-500">Preco base</div>
                <div class="mt-2 text-3xl font-semibold text-slate-900">${escapeHtml(formatCurrency(product.preco))}</div>
              </div>
              <a href="${product.personalizePath}" class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Personalizar produto</a>
            </div>
            <p class="mt-4 text-sm leading-6 text-slate-500">Escolha as opcoes, envie o design e finalize a encomenda no passo seguinte.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <a href="${SiteRoutes.STATIC_PATHS.shipping}" class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-900"><strong class="block text-slate-900">Envios</strong>Prazos, expedicao e entrega.</a>
            <a href="${SiteRoutes.STATIC_PATHS.faq}" class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-900"><strong class="block text-slate-900">FAQ</strong>Duvidas sobre producao e compra.</a>
            <a href="${SiteRoutes.buildContactPath({ assunto: product.nome })}" class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-900"><strong class="block text-slate-900">Pedir apoio</strong>Falar com a equipa comercial.</a>
          </div>
        </div>
      </div>
    </section>
    <section class="border-t border-slate-200 bg-slate-50">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-2xl font-semibold text-slate-900">Produtos relacionados</h2>
            <p class="mt-2 text-sm text-slate-600">Veja mais modelos da categoria ${escapeHtml(product.categoryLabel)} e compare formatos, tamanhos e precos.</p>
          </div>
          <a href="${SiteRoutes.buildCategoryPath(product.categorySlug)}" class="text-sm font-medium text-slate-700 hover:text-slate-900">Ver categoria completa</a>
        </div>
        <div class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          ${fallbackProducts.map((candidate) => `
            <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <a href="${candidate.canonicalPath}" class="block">
                <img src="${escapeHtml(candidate.imageUrl)}" alt="${escapeHtml(candidate.nome)}" class="aspect-[4/3] h-full w-full object-cover" loading="lazy" width="720" height="540" decoding="async">
              </a>
              <div class="p-5">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">${escapeHtml(candidate.categoryLabel)}</p>
                <h3 class="mt-2 text-base font-semibold text-slate-900"><a href="${candidate.canonicalPath}" class="hover:text-slate-700">${escapeHtml(candidate.nome)}</a></h3>
                <div class="mt-4 flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900">${escapeHtml(formatCurrency(candidate.preco))}</span>
                  <a href="${candidate.canonicalPath}" class="text-sm font-medium text-slate-700 hover:text-slate-900">Ver produto</a>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
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
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: SiteRoutes.buildPublicUrl('/') },
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
<body class="bg-slate-50 text-slate-900">
  ${renderHeader(category.canonicalPath)}
  <main>
    <section class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
          <a href="/" class="hover:text-slate-900">Inicio</a>
          <span>/</span>
          <a href="${SiteRoutes.STATIC_PATHS.products}" class="hover:text-slate-900">Produtos</a>
          <span>/</span>
          <span class="text-slate-900">${escapeHtml(category.label)}</span>
        </nav>
        <div class="max-w-3xl">
          <h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">${escapeHtml(category.label)} personalizados</h1>
          <p class="mt-4 text-base leading-7 text-slate-600">${escapeHtml(category.description)}</p>
        </div>
      </div>
    </section>
    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        ${category.products.map((product) => `
          <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <a href="${product.canonicalPath}" class="block">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full object-cover" loading="lazy" width="720" height="540" decoding="async">
            </a>
            <div class="p-6">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">${escapeHtml(product.categoryLabel)}</p>
              <h2 class="mt-2 text-xl font-semibold text-slate-900"><a href="${product.canonicalPath}" class="hover:text-slate-700">${escapeHtml(product.nome)}</a></h2>
              <p class="mt-3 text-sm leading-6 text-slate-600">${escapeHtml(summarize(product.descricao || product.seo_description, 160))}</p>
              <div class="mt-5 flex items-center justify-between">
                <span class="text-base font-semibold text-slate-900">${escapeHtml(formatCurrency(product.preco))}</span>
                <a href="${product.canonicalPath}" class="text-sm font-medium text-slate-700 hover:text-slate-900">Ver produto</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
      <section class="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-xl font-semibold text-slate-900">Ligacoes uteis</h2>
        <div class="mt-5 grid gap-4 md:grid-cols-3">
          <a href="${SiteRoutes.STATIC_PATHS.products}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Voltar ao catalogo geral</a>
          <a href="${SiteRoutes.STATIC_PATHS.shipping}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Consultar envios e prazos</a>
          <a href="${SiteRoutes.STATIC_PATHS.contact}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Pedir ajuda comercial</a>
        </div>
      </section>
    </section>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
}

function renderProductsLandingPage(categoryEntries, productEntries) {
    const featuredCategories = categoryEntries.slice(0, 8);
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
            name: 'Catalogo de Produtos IberFlag',
            description: 'Catalogo IberFlag com categorias e produtos publicitarios personalizados para eventos, retail e comunicacao fisica.',
            url: SiteRoutes.buildPublicUrl(SiteRoutes.STATIC_PATHS.products)
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: SiteRoutes.buildPublicUrl('/') },
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
        title: 'Catalogo de Produtos Publicitarios | IberFlag',
        description: 'Explore o catalogo IberFlag com fly banners, roll ups, bandeiras, photocalls, tendas e suportes promocionais personalizados.',
        canonicalPath: SiteRoutes.STATIC_PATHS.products,
        imageUrl: primaryImage,
        structuredData
    })}
<body class="bg-slate-50 text-slate-900">
  ${renderHeader(SiteRoutes.STATIC_PATHS.products)}
  <main>
    <section class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
          <a href="/" class="hover:text-slate-900">Inicio</a>
          <span>/</span>
          <span class="text-slate-900">Produtos</span>
        </nav>
        <div class="max-w-3xl">
          <h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Catalogo de produtos publicitarios</h1>
          <p class="mt-4 text-base leading-7 text-slate-600">Escolha a categoria certa, compare os modelos e avance para a personalizacao quando ja souber o formato ideal.</p>
        </div>
        <div class="mt-8 flex flex-wrap gap-3">
          ${featuredCategories.map((category) => `
            <a href="${category.canonicalPath}" class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-900">${escapeHtml(category.label)}</a>
          `).join('')}
        </div>
      </div>
    </section>
    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        ${highlightedProducts.map((product) => `
          <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <a href="${product.canonicalPath}" class="block">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full object-cover" loading="lazy" width="720" height="540" decoding="async">
            </a>
            <div class="p-6">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">${escapeHtml(product.categoryLabel)}</p>
              <h2 class="mt-2 text-lg font-semibold text-slate-900"><a href="${product.canonicalPath}" class="hover:text-slate-700">${escapeHtml(product.nome)}</a></h2>
              <p class="mt-3 text-sm leading-6 text-slate-600">${escapeHtml(summarize(product.descricao || product.seo_description, 145))}</p>
              <div class="mt-5 flex items-center justify-between">
                <span class="text-base font-semibold text-slate-900">${escapeHtml(formatCurrency(product.preco))}</span>
                <a href="${product.canonicalPath}" class="text-sm font-medium text-slate-700 hover:text-slate-900">Ver produto</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
      <section class="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
        <div class="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">Categorias principais</h2>
            <p class="mt-2 text-sm leading-6 text-slate-600">Cada categoria junta os modelos mais procurados para encontrar rapidamente a opcao certa.</p>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              ${categoryEntries.map((category) => `
                <a href="${category.canonicalPath}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">
                  <strong class="block text-slate-900">${escapeHtml(category.label)}</strong>
                  <span class="mt-1 block text-slate-500">${escapeHtml(category.products.length)} produto(s)</span>
                </a>
              `).join('')}
            </div>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-slate-900">Ligacoes uteis</h2>
            <div class="mt-5 grid gap-3">
              <a href="${SiteRoutes.STATIC_PATHS.shipping}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Consultar envios e prazos</a>
              <a href="${SiteRoutes.STATIC_PATHS.faq}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Perguntas frequentes</a>
              <a href="${SiteRoutes.STATIC_PATHS.contact}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Falar com apoio comercial</a>
              <a href="${SiteRoutes.STATIC_PATHS.sitemap}" class="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">Abrir mapa do site</a>
            </div>
          </div>
        </div>
      </section>
    </section>
  </main>
  ${renderFooter(categoryEntries, productEntries)}
</body>
</html>`;
}

function renderHtmlSitemap(categoryEntries, productEntries) {
    return `${renderHead({
        title: 'Mapa do Site | IberFlag',
        description: 'Encontre rapidamente categorias, produtos e paginas principais da IberFlag.',
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
      <p class="mt-4 text-base leading-7 text-slate-600">Encontre num so lugar as categorias, os produtos e as paginas mais uteis do site.</p>
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
    await fs.rm(targetPath, { recursive: true, force: true });
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

    await writeFile(path.join(PRODUCTS_DIR, 'index.html'), renderProductsLandingPage(categories, products));
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
