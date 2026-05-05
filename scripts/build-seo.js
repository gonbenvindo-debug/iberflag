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
const SOCIAL_LINKS = SiteRoutes.getSocialLinks();

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

const PRODUCT_SEO_OVERRIDES = {
    'bandeiras-de-mesa-15-x-25-cm': {
        description: 'Bandeiras de mesa personalizadas para escritorios, rececoes, feiras e espacos institucionais, com presenca formal e acabamento profissional.',
        seoDescription: 'Bandeiras de mesa personalizadas para escritorios, rececoes, feiras e espacos institucionais com acabamento profissional.'
    },
    'bandeiras-horizontais-medida-personalizada': {
        description: 'Bandeiras horizontais personalizadas para exterior, empresas, instituicoes e eventos, com medidas e designs personalizaveis.',
        seoDescription: 'Bandeiras horizontais personalizadas para exterior, empresas e instituicoes, com medidas e designs personalizaveis.'
    },
    'bandeiras-para-despacho-150-x-100-cm': {
        description: 'Bandeiras para despacho e salas institucionais com impressao personalizada, pensadas para ambientes corporativos, escritorios e apresentacoes formais.',
        seoDescription: 'Bandeiras personalizadas para despachos, escritorios e salas institucionais com imagem corporativa profissional.'
    },
    'bandeiras-para-manifestacoes-20-x-30-cm': {
        description: 'Bandeiras de mao personalizadas em formato compacto para manifestacoes, campanhas, eventos e acoes coletivas com distribuicao simples.',
        seoDescription: 'Bandeiras de mao personalizadas 20 x 30 cm para manifestacoes, campanhas e eventos coletivos.'
    },
    'bandeiras-para-manifestacoes-30-x-45-cm': {
        description: 'Bandeiras personalizadas para manifestacoes, campanhas e eventos coletivos, com formato pratico e boa leitura em movimento.',
        seoDescription: 'Bandeiras personalizadas 30 x 45 cm para manifestacoes, campanhas, eventos e acoes coletivas.'
    },
    'bandeiras-para-manifestacoes-45-x-70-cm': {
        description: 'Bandeiras personalizadas para manifestacoes e eventos com maior presenca visual, pensadas para comunicar mensagens em espacos publicos.',
        seoDescription: 'Bandeiras personalizadas 45 x 70 cm para manifestacoes e eventos com boa visibilidade.'
    },
    'bandeiras-para-manifestacoes-70-x-100-cm': {
        description: 'Bandeiras de grande visibilidade para manifestacoes, campanhas e atos publicos, preparadas para destacar mensagens, simbolos ou identidade visual.',
        seoDescription: 'Bandeiras personalizadas 70 x 100 cm para manifestacoes, campanhas e atos publicos.'
    },
    'bandeiras-para-manifestacoes-100-x-150-cm': {
        seoTitle: 'Bandeiras para manifestacoes 100 x 150 cm | IberFlag',
        description: 'Bandeiras personalizadas de grande formato para manifestacoes, campanhas e eventos onde a mensagem precisa de impacto e leitura a distancia.',
        seoDescription: 'Bandeiras 100 x 150 cm para manifestacoes, campanhas e eventos com impressao personalizada.'
    },
    'bandeiras-de-parede-150-x-100-cm': {
        description: 'Bandeiras de parede personalizadas para fachadas, interiores corporativos e espacos institucionais, ideais para reforcar identidade visual.',
        seoDescription: 'Bandeiras de parede personalizadas para fachadas, interiores corporativos e espacos institucionais.'
    },
    'bandeiras-verticais-medida-personalizada': {
        description: 'Bandeiras verticais personalizadas para comunicacao exterior, pontos de venda e acoes promocionais, com medidas e designs personalizaveis.',
        seoDescription: 'Bandeiras verticais personalizadas para comunicacao exterior, pontos de venda e acoes promocionais.'
    },
    'bandeirolas-esportivas-20-x-27-cm': {
        description: 'Bandeirolas desportivas personalizadas para clubes, eventos, premios e merchandising, com formato classico para escudos e mensagens institucionais.',
        seoDescription: 'Bandeirolas desportivas personalizadas para clubes, eventos, premios e merchandising institucional.'
    },
    'tenda-personalizada-5-x-1-m': {
        description: 'Tenda publicitaria personalizada 5 x 1 m para feiras, eventos e ativacoes de marca, com presenca exterior visivel e funcional.',
        seoDescription: 'Tenda publicitaria personalizada 5 x 1 m para feiras, eventos e ativacoes de marca.'
    },
    'tenda-personalizada-3-x-3-m': {
        description: 'Tenda publicitaria personalizada 3 x 3 m para stands, feiras e eventos, versatil para criar uma zona de marca visivel e protegida.',
        seoDescription: 'Tenda personalizada 3 x 3 m para stands, feiras, eventos e ativacoes de marca.'
    },
    'tenda-personalizada-3-x-4-m': {
        description: 'Tenda publicitaria personalizada 3 x 4 m para eventos e acoes promocionais que precisam de mais espaco operativo e presenca visual.',
        seoDescription: 'Tenda publicitaria personalizada 3 x 4 m para eventos, feiras e acoes promocionais.'
    },
    'tenda-personalizada-3-x-6-m': {
        description: 'Tenda publicitaria personalizada 3 x 6 m de grande formato para eventos, feiras e ativacoes com cobertura ampla e maxima visibilidade.',
        seoDescription: 'Tenda personalizada 3 x 6 m para eventos, feiras e ativacoes de marca de grande formato.'
    },
    'fly-banner-drop-75-x-194-cm': {
        description: 'Fly Banner Drop personalizado 75 x 194 cm com forma de gota, ideal para promocoes, pontos de venda e eventos com presenca dinamica.',
        seoDescription: 'Fly Banner Drop 75 x 194 cm personalizado para eventos, exterior, promocoes e pontos de venda.'
    },
    'fly-banner-drop-92-x-228-cm': {
        description: 'Fly Banner Drop personalizado 92 x 228 cm com maior altura, pensado para destacar mensagens de marca em exterior, eventos e acessos.',
        seoDescription: 'Fly Banner Drop 92 x 228 cm personalizado para exterior e eventos com impressao profissional.'
    },
    'fly-banner-drop-103-x-298-cm': {
        description: 'Fly Banner Drop personalizado 103 x 298 cm de grande visibilidade para campanhas, ativacoes e espacos exteriores com trafego de pessoas.',
        seoDescription: 'Fly Banner Drop 103 x 298 cm personalizado para campanhas, eventos e comunicacao exterior.'
    },
    'fly-banner-drop-132-x-352-cm': {
        description: 'Fly Banner Drop personalizado 132 x 352 cm de grande formato para reforcar presenca de marca em eventos, acessos e zonas exteriores.',
        seoDescription: 'Fly Banner Drop 132 x 352 cm de grande formato para eventos, promocoes e exterior.'
    },
    'fly-banner-drop-145-x-446-cm': {
        description: 'Fly Banner Drop personalizado 145 x 446 cm extra alto para maxima presenca visual em exterior, campanhas, eventos e acessos principais.',
        seoDescription: 'Fly Banner Drop 145 x 446 cm extra alto para maxima visibilidade em exterior e eventos.'
    },
    'fly-banner-retangular-70-x-180-cm': {
        description: 'Fly Banner retangular personalizado 70 x 180 cm com superficie visual ampla para mensagens promocionais claras em exterior e feiras.',
        seoDescription: 'Fly Banner retangular 70 x 180 cm personalizado para mensagens promocionais em exterior e eventos.'
    },
    'fly-banner-retangular-70-x-280-cm': {
        description: 'Fly Banner retangular personalizado 70 x 280 cm de maior altura para campanhas que precisam de leitura vertical e presenca de marca.',
        seoDescription: 'Fly Banner retangular 70 x 280 cm personalizado para exterior, feiras e eventos.'
    },
    'fly-banner-surf-55-x-226-cm': {
        description: 'Fly Banner Surf personalizado 55 x 226 cm com forma de vela, leve e chamativo para campanhas, eventos e comunicacao exterior.',
        seoDescription: 'Fly Banner Surf 55 x 226 cm personalizado com forma de vela para campanhas e eventos.'
    },
    'fly-banner-surf-65-x-272-cm': {
        description: 'Fly Banner Surf personalizado 65 x 272 cm com presenca vertical e desenho dinamico para eventos, promocoes e sinalizacao exterior.',
        seoDescription: 'Fly Banner Surf 65 x 272 cm personalizado para eventos, promocoes e sinalizacao exterior.'
    },
    'fly-banner-surf-75-5-x-351-cm': {
        description: 'Fly Banner Surf personalizado 75,5 x 351 cm de grande altura para campanhas com forte presenca visual em exterior e feiras.',
        seoDescription: 'Fly Banner Surf 75,5 x 351 cm personalizado para exterior, feiras e ativacoes de marca.'
    },
    'fly-banner-surf-75-5-x-417-cm': {
        description: 'Fly Banner Surf personalizado 75,5 x 417 cm extra visivel para eventos e espacos exteriores onde a marca precisa de destaque a distancia.',
        seoDescription: 'Fly Banner Surf 75,5 x 417 cm personalizado para eventos e espacos exteriores.'
    },
    'fly-banner-surf-90-x-516-cm': {
        description: 'Fly Banner Surf personalizado 90 x 516 cm de formato maximo para campanhas exteriores, acessos, eventos e ativacoes de grande impacto.',
        seoDescription: 'Fly Banner Surf 90 x 516 cm personalizado para campanhas exteriores e eventos de grande impacto.'
    },
    'cubo-publicitario-40-x-40-x-40-8-cm': {
        description: 'Cubo publicitario personalizado 40 x 40 x 40,8 cm, leve e facil de montar, para pontos de venda, eventos, promocoes e zonas de ativacao de marca.',
        seoDescription: 'Cubo publicitario personalizado 40 x 40 x 40,8 cm para pontos de venda, eventos, promocoes e ativacoes de marca.'
    },
    'mastro-de-aluminio-6-metros': {
        seoTitle: 'Mastro de Aluminio 6 m | Mastros | IberFlag',
        description: 'Mastro de aluminio de 6 metros para bandeiras exteriores, resistente e indicado para comunicacao institucional ou promocional.',
        seoDescription: 'Mastro de aluminio 6 m para bandeiras exteriores, comunicacao institucional e promocional.'
    },
    'photocall-extensivel-1-40-a-2-40-m': {
        description: 'Photocall extensivel personalizado com tecido ajustavel de 1,40 m a 2,40 m, ideal para eventos, stands, conferencias e zonas de fotografia.',
        seoDescription: 'Photocall extensivel personalizado com tecido de 1,40 m a 2,40 m para eventos, marcas e zonas de fotografia.'
    },
    'mini-fly-banner-drop-60-cm-surf-73-cm': {
        description: 'Mini Fly Banner personalizado em formatos Drop 60 cm e Surf 73 cm para balcoes, rececoes e acoes promocionais compactas.',
        seoDescription: 'Mini Fly Banner personalizado em formatos Drop 60 cm e Surf 73 cm para balcoes, rececoes e acoes promocionais.'
    },
    'x-banner-80-x-180-cm': {
        description: 'X-Banner personalizado 80 x 180 cm, leve e portatil, para campanhas de interior, lojas, montras, feiras e comunicacao promocional.',
        seoDescription: 'X-Banner 80 x 180 cm personalizado para campanhas de interior, lojas, feiras e montras.'
    },
    'roll-up-85-x-200-cm': {
        description: 'Roll Up personalizado 85 x 200 cm com estrutura enrolavel e montagem simples, ideal para feiras, lojas, apresentacoes e comunicacao interior.',
        seoDescription: 'Roll Up 85 x 200 cm personalizado para feiras, lojas, apresentacoes e comunicacao interior.'
    },
    'photocall-286-x-217-cm': {
        description: 'Photocall personalizado 286 x 217 cm em lona frontlit, indicado para eventos, stands, apresentacoes, fotografias e fundos promocionais.',
        seoDescription: 'Photocall 286 x 217 cm personalizado para eventos, stands, apresentacoes e fundos promocionais.'
    },
    'wall-banner-60-x-230-cm': {
        description: 'Wall Banner 60 x 230 cm personalizado, leve e desmontavel, para eventos, exposicoes, pontos de venda e comunicacao vertical.',
        seoDescription: 'Wall Banner 60 x 230 cm personalizado para eventos, exposicoes e pontos de venda.'
    },
    'wall-banner-90-x-230-cm': {
        description: 'Wall Banner 90 x 230 cm personalizado para comunicacao vertical em eventos, lojas, exposicoes e zonas promocionais.',
        seoDescription: 'Wall Banner 90 x 230 cm personalizado para eventos, lojas, exposicoes e promocoes.'
    },
    'wall-banner-120-x-230-cm': {
        description: 'Wall Banner 120 x 230 cm personalizado com maior area visual para stands, eventos, exposicoes e comunicacao de marca.',
        seoDescription: 'Wall Banner 120 x 230 cm personalizado para stands, eventos, exposicoes e comunicacao de marca.'
    },
    'wall-banner-150-x-230-cm': {
        description: 'Wall Banner 150 x 230 cm personalizado de grande largura para fundos promocionais, eventos, exposicoes e comunicacao de impacto.',
        seoDescription: 'Wall Banner 150 x 230 cm personalizado para eventos, exposicoes e comunicacao promocional.'
    }
};

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

function buildProductSeoTitle(product, category, override = {}) {
    if (override.seoTitle) {
        return normalizeText(override.seoTitle);
    }

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

function buildProductSeoDescription(product, category, override = {}) {
    if (override.seoDescription) {
        return summarize(override.seoDescription, 155);
    }

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

function buildProductDisplayDescription(product, override = {}) {
    return normalizeText(override.description || product.descricao || product.seo_description);
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
    let result = await client
        .from('produtos')
        .select('id, nome, nome_es, descricao, descricao_es, preco, categoria, imagem, destaque, ativo, created_at, updated_at, slug, seo_title, seo_description')
        .eq('ativo', true)
        .order('id', { ascending: true });

    if (result.error?.code === '42703') {
        result = await client
            .from('produtos')
            .select('id, nome, descricao, preco, categoria, imagem, destaque, ativo, created_at, updated_at, slug, seo_title, seo_description')
            .eq('ativo', true)
            .order('id', { ascending: true });
    }

    if (result.error?.code === '42703') {
        result = await client
            .from('produtos')
            .select('id, nome, descricao, preco, categoria, imagem, destaque, ativo, created_at, updated_at')
            .eq('ativo', true)
            .order('id', { ascending: true });
    }

    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data.map(applyCatalogTextCorrections) : [];
}

function applyCatalogTextCorrections(product) {
    const fixText = (value) => String(value || '')
        .replace(/Cubo publcitário/g, 'Cubo publicitário')
        .replace(/cubo publcitário/g, 'cubo publicitário');

    return {
        ...product,
        nome: fixText(product.nome),
        seo_title: product.seo_title ? fixText(product.seo_title) : product.seo_title
    };
}

function assignUniqueProductSlugs(products) {
    const seen = new Set();
    return products.map((product) => {
        const sourceSlug = String(product.slug || '').trim();
        const sourceName = String(product.nome || '').trim();
        let correctedSlug = sourceSlug;
        let correctedName = sourceName;
        let correctedNameEs = String(product.nome_es || '').trim();

        if (sourceSlug === 'tenda-personalizada-5-x-1-cm' || /\(5 x 1 cm\)/i.test(sourceName)) {
            correctedSlug = 'tenda-personalizada-5-x-1-m';
            correctedName = 'Tenda personalizada (5 x 1 m)';
            if (!correctedNameEs) correctedNameEs = 'Carpa personalizada (5 x 1 m)';
        } else if (sourceSlug === 'tenda-personalizada-3-x-4-cm' || /\(3 x 4 cm\)/i.test(sourceName)) {
            correctedSlug = 'tenda-personalizada-3-x-4-m';
            correctedName = 'Tenda personalizada (3 x 4 m)';
            if (!correctedNameEs) correctedNameEs = 'Carpa personalizada (3 x 4 m)';
        } else if (sourceSlug === 'cubo-publcitario-tamanho-unico' || sourceSlug === 'cubo-publicitario-tamanho-unico' || /cubo publcit/i.test(sourceName)) {
            correctedSlug = 'cubo-publicitario-40-x-40-x-40-8-cm';
            correctedName = 'Cubo publicitario (40 x 40 x 40,8 cm)';
            if (!correctedNameEs) correctedNameEs = 'Cubo publicitario (40 x 40 x 40,8 cm)';
        }

        const correctedProduct = {
            ...product,
            slug: correctedSlug,
            nome: correctedName,
            nome_es: correctedNameEs || null
        };

        const baseSlug = SiteRoutes.inferProductSlug(correctedProduct);
        let finalSlug = baseSlug || `produto-${product.id}`;
        if (seen.has(finalSlug)) finalSlug = `${finalSlug}-${product.id}`;
        seen.add(finalSlug);

        const category = SiteRoutes.getCategoryMeta(correctedProduct.categoria);
        const seoOverride = PRODUCT_SEO_OVERRIDES[finalSlug] || {};
        return {
            ...correctedProduct,
            slug: finalSlug,
            categorySlug: category.slug,
            categoryLabel: category.label,
            categoryDescription: category.description,
            seo_title: buildProductSeoTitle(correctedProduct, category, seoOverride),
            seo_description: buildProductSeoDescription(correctedProduct, category, seoOverride),
            display_description: buildProductDisplayDescription(correctedProduct, seoOverride),
            canonicalPath: SiteRoutes.buildProductPath(finalSlug),
            personalizePath: SiteRoutes.buildProductPersonalizerPath(finalSlug),
            imageUrl: safeImageUrl(correctedProduct.imagem)
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
    const localizedUrl = SiteRoutes.buildPublicUrl(SiteRoutes.getLocalizedPath(canonicalPath, 'es'));
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
  <link rel="alternate" hreflang="pt-PT" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="es-ES" href="${escapeHtml(localizedUrl)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}">
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
  <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20260428logo">
  <link rel="shortcut icon" href="/favicon.svg?v=20260428logo">
  <link rel="stylesheet" href="/assets/css/tailwind.output.css?v=20260411cat1">
  <link rel="stylesheet" href="/assets/css/style.css?v=20260505cart-controls1">
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
  <script defer src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
  <script defer src="/assets/js/core/icon-engine.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script defer src="/assets/js/config.js"></script>
  <script defer src="/assets/js/core/site-routes.js?v=20260409seo1"></script>
  <script defer src="/assets/js/generated/catalog-seo-manifest.js?v=20260409seo1"></script>
  <script defer src="/assets/js/core/cart-assets.js?v=20260401a"></script>
  <script defer src="/assets/js/core/analytics.js?v=20260410a"></script>
  <script defer src="/assets/js/core/logic.js?v=20260429q2"></script>
  <script defer src="/assets/js/core/flybanner-selection.js?v=20260420a"></script>
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
          <a href="${SOCIAL_LINKS.facebook}" class="social-icon" aria-label="Facebook">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          <a href="${SOCIAL_LINKS.instagram}" class="social-icon" aria-label="Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="20" x="2" y="2" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </a>
          <a href="${SOCIAL_LINKS.linkedin}" class="social-icon" aria-label="LinkedIn">
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

const PRODUCT_DECISION_CONTENT = {
    'fly-banner': {
        lead: 'Pensado para criar presença vertical em eventos, entradas e pontos de passagem, com montagem simples, transporte fácil e boa leitura à distância.',
        useCases: ['Feiras e eventos', 'Montras e entradas', 'Pontos de venda', 'Ações de rua'],
        included: ['Produto impresso personalizado', 'Escolha da base compatível no passo seguinte', 'Pronto para encomendar depois de validar opções'],
        format: 'Suporte vertical portátil'
    },
    'wall-banner': {
        lead: 'Indicado para fundos de marca, montras e espaços promocionais onde a comunicação precisa de escala e leitura limpa.',
        useCases: ['Stands e exposições', 'Fundos de palco', 'Montras', 'Campanhas de grande formato'],
        included: ['Impressão personalizada para fundo ou parede', 'Formato preparado para comunicação de impacto', 'Pronto para encomendar depois de validar opções'],
        format: 'Fundo promocional vertical'
    },
    'roll-up': {
        lead: 'Uma solução compacta para comunicação profissional em feiras, receções e apresentações, pronta para montar e transportar com facilidade.',
        useCases: ['Feiras', 'Receções', 'Apresentações', 'Pontos de venda'],
        included: ['Impressão personalizada do roll up', 'Formato pensado para transporte e montagem rápida', 'Pronto para encomendar depois de validar opções'],
        format: 'Sistema retrátil'
    },
    'x-banner': {
        lead: 'Leve, direto e fácil de instalar, funciona bem em campanhas temporárias, ações interiores e espaços comerciais com rotação frequente.',
        useCases: ['Promoções interiores', 'Campanhas temporárias', 'Feiras', 'Lojas'],
        included: ['Impressão personalizada do X-Banner', 'Formato leve para montagem rápida', 'Pronto para encomendar depois de validar opções'],
        format: 'Estrutura leve em X'
    },
    'bandeiras': {
        lead: 'Feita para dar visibilidade a marcas, instituições e mensagens em contexto formal, promocional ou coletivo.',
        useCases: ['Eventos e campanhas', 'Institucional', 'Desporto e escolas', 'Manifestações'],
        included: ['Bandeira personalizada no formato escolhido', 'Impressão orientada para boa leitura', 'Pronto para encomendar depois de validar opções'],
        format: 'Bandeira personalizada'
    },
    'bandeirolas-esportivas': {
        lead: 'Formato prático para clubes, torneios e momentos de prémio, com leitura clara e presença visual em ambientes desportivos.',
        useCases: ['Clubes e torneios', 'Bancadas', 'Entregas de prémios', 'Merchandising'],
        included: ['Bandeirola personalizada', 'Formato adequado para contexto desportivo', 'Pronto para encomendar depois de validar opções'],
        format: 'Bandeirola desportiva'
    },
    'photocall': {
        lead: 'Cria um fundo de marca para fotografia, imprensa e ativações, ajudando o espaço do evento a parecer mais profissional.',
        useCases: ['Eventos corporativos', 'Conferências', 'Zonas de fotografia', 'Lançamentos de marca'],
        included: ['Photocall personalizado', 'Formato preparado para imagem de marca', 'Pronto para encomendar depois de validar opções'],
        format: 'Backdrop de evento'
    },
    'cubo-publicitario': {
        lead: 'Uma peça compacta para destacar marca, campanha ou mensagem em balcões, montras e pontos de contacto com o cliente.',
        useCases: ['Ativações de marca', 'Montras', 'Pontos de venda', 'Exposições'],
        included: ['Cubo publicitário personalizado', 'Comunicação visível em várias faces', 'Pronto para encomendar depois de validar opções'],
        format: 'Peça promocional 360 graus'
    },
    'mastros': {
        lead: 'Solução para elevar bandeiras em espaços exteriores, fachadas e zonas institucionais com presença clara e duradoura.',
        useCases: ['Exterior institucional', 'Fachadas', 'Recintos', 'Sinalização de bandeiras'],
        included: ['Mastro indicado para suporte de bandeira', 'Formato preparado para presença exterior', 'Pronto para encomendar depois de validar opções'],
        format: 'Suporte exterior para bandeira'
    },
    'tenda-publicitaria': {
        lead: 'Indicada para eventos exteriores e ativações onde a marca precisa de cobertura, presença e identificação imediata.',
        useCases: ['Eventos exteriores', 'Feiras', 'Ações de marca', 'Zonas promocionais'],
        included: ['Tenda personalizada no formato escolhido', 'Comunicação preparada para exterior', 'Pronto para encomendar depois de validar opções'],
        format: 'Estrutura promocional exterior'
    },
    default: {
        lead: 'Produto personalizável para comunicação física, pensado para tornar a marca mais visível no ponto certo.',
        useCases: ['Eventos', 'Lojas', 'Campanhas', 'Feiras'],
        included: ['Produto impresso personalizado', 'Formato configurado para encomenda online', 'Pronto para encomendar depois de validar opções'],
        format: 'Produto publicitário personalizado'
    }
};

function getProductDecisionContent(product) {
    return PRODUCT_DECISION_CONTENT[product.categorySlug] || PRODUCT_DECISION_CONTENT.default;
}

function getProductUseCases(product) {
    return getProductDecisionContent(product).useCases;
}

function getProductIncludedItems(product) {
    return getProductDecisionContent(product).included;
}

function getProductBuyingNotes() {
    return [
        { title: 'Produção rápida', icon: 'clock' },
        { title: 'Editor online', icon: 'pencil-ruler' },
        { title: 'Apoio antes de produzir', icon: 'message-circle' },
        { title: 'Entrega em Portugal e Espanha', icon: 'truck' }
    ];
}

function extractProductDimension(product) {
    const match = String(product.nome || '').match(/\(([^)]*\d[^)]*)\)/);
    return match ? normalizeText(match[1]) : 'Formato indicado no produto';
}

function getProductTechnicalRows(product) {
    return [
        { label: 'Dimensão', value: extractProductDimension(product) },
        { label: 'Categoria', value: product.categoryLabel },
        { label: 'Formato', value: getProductDecisionContent(product).format },
        { label: 'Preço base', value: formatCurrency(product.preco) }
    ];
}

function renderProductBuyingNotes(product) {
    return `<div class="product-buying-notes grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
              ${getProductBuyingNotes(product).map((note) => `
                <div class="product-buying-note flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <i data-lucide="${escapeHtml(note.icon)}" class="h-4 w-4 flex-none text-slate-700"></i>
                  <span class="min-w-0 text-sm font-medium leading-5 text-slate-700">${escapeHtml(note.title)}</span>
                </div>
              `).join('')}
            </div>`;
}

function renderProductInfoPanel(title, summary, body, open = false) {
    return `<details class="product-info-panel border-t border-slate-200 py-4 first:border-t-0"${open ? ' open' : ''}>
              <summary class="product-info-summary flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900">
                <span class="min-w-0">${escapeHtml(title)}</span>
                <span class="product-info-summary-meta ml-auto hidden min-w-0 text-right text-xs font-medium text-slate-500 sm:block">${escapeHtml(summary)}</span>
                <i data-lucide="chevron-down" class="product-info-chevron h-4 w-4 flex-none text-slate-500"></i>
              </summary>
              <div class="product-info-panel-body pt-4">
                ${body}
              </div>
            </details>`;
}

function renderProductDecisionBlocks(product) {
    const includedItems = getProductIncludedItems(product);
    const technicalRows = getProductTechnicalRows(product);
    const includedMarkup = includedItems.map((item) => `
                <li class="product-detail-list-row flex min-w-0 gap-2.5">
                  <i data-lucide="check" class="mt-0.5 h-4 w-4 flex-none text-slate-900"></i>
                  <span class="min-w-0 text-sm leading-6 text-slate-700">${escapeHtml(item)}</span>
                </li>
              `).join('');
    const processMarkup = `
              <li class="product-detail-list-row flex min-w-0 items-start gap-3"><span class="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">1</span><span class="min-w-0 text-sm leading-6 text-slate-700">Personalize online ou envie o design.</span></li>
              <li class="product-detail-list-row flex min-w-0 items-start gap-3"><span class="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">2</span><span class="min-w-0 text-sm leading-6 text-slate-700">Confirme opções, preço e pré-visualização.</span></li>
              <li class="product-detail-list-row flex min-w-0 items-start gap-3"><span class="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">3</span><span class="min-w-0 text-sm leading-6 text-slate-700">Finalize a encomenda e a produção fica encaminhada.</span></li>
            `;
    const technicalMarkup = technicalRows.map((row) => `
                <div class="grid grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
                  <dt class="text-sm text-slate-500">${escapeHtml(row.label)}</dt>
                  <dd class="min-w-0 text-right text-sm font-medium text-slate-900">${escapeHtml(row.value)}</dd>
                </div>
              `).join('');

        return `<div class="product-info-panels rounded-lg border border-slate-200 bg-white px-4 sm:px-5">
          ${renderProductInfoPanel('O que recebe', `${includedItems.length} itens incluídos`, `<ul class="space-y-2.5">${includedMarkup}</ul>`, true)}
          ${renderProductInfoPanel('Como funciona', '3 passos', `<ol class="space-y-2.5">${processMarkup}</ol>`)}
          ${renderProductInfoPanel('Detalhes técnicos', extractProductDimension(product), `<dl class="divide-y divide-slate-100">${technicalMarkup}</dl>`)}
        </div>`;
}

function renderRelatedProductCards(products) {
    return products.map((candidate) => `
            <article class="product-related-card min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <a href="${candidate.canonicalPath}" class="block bg-slate-50">
                <img src="${escapeHtml(candidate.imageUrl)}" alt="${escapeHtml(candidate.nome)}" class="aspect-[4/3] w-full object-contain p-4" loading="lazy" width="720" height="540" decoding="async">
              </a>
              <div class="p-4">
                <p class="text-xs font-medium uppercase text-slate-500">${escapeHtml(candidate.categoryLabel)}</p>
                <h3 data-fit-card-title class="mt-1.5 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-900"><a href="${candidate.canonicalPath}" class="hover:text-slate-700">${escapeHtml(candidate.nome)}</a></h3>
                <div class="mt-4 flex items-center justify-between gap-3">
                  <span class="text-sm font-semibold text-slate-900">${escapeHtml(formatCurrency(candidate.preco))}</span>
                  <a href="${candidate.canonicalPath}" data-product-id="${escapeHtml(candidate.id)}" data-product-name="${escapeHtml(candidate.nome)}" data-product-category="${escapeHtml(candidate.categorySlug)}" class="inline-flex min-h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800">
                    Ver
                  </a>
                </div>
              </div>
            </article>
          `).join('');
}

function renderProductPage(product, categoryEntries, productEntries) {
    const related = productEntries
        .filter((candidate) => candidate.slug !== product.slug && candidate.categorySlug === product.categorySlug)
        .slice(0, 4);
    const fallbackProducts = related.length > 0 ? related : productEntries.filter((candidate) => candidate.slug !== product.slug).slice(0, 4);
    const shuffledSuggestions = productEntries
        .filter((candidate) => candidate.slug !== product.slug && !fallbackProducts.some((item) => item.slug === candidate.slug))
        .sort((left, right) => String(left.slug || '').localeCompare(String(right.slug || ''), 'pt-PT'))
        .slice(0, 4);
    const decisionContent = getProductDecisionContent(product);
    const relatedHeading = related.length > 0 ? 'Outros tamanhos deste formato' : 'Produtos relacionados';
    const relatedSummary = related.length > 0
        ? `Compare alternativas da categoria ${product.categoryLabel} para escolher o tamanho e formato certo.`
        : `Veja mais modelos da categoria ${product.categoryLabel} e compare formatos, tamanhos e preços.`;
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
<body class="bg-white text-slate-900" data-analytics-event="view_product" data-analytics-product-id="${escapeHtml(product.id)}" data-analytics-category-slug="${escapeHtml(product.categorySlug)}" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.nome)}" data-product-category-slug="${escapeHtml(product.categorySlug)}">
  ${renderHeader(product.canonicalPath)}
  <main>
    <div class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-3 text-sm text-slate-500 sm:px-6 lg:px-8">
        <a href="${SiteRoutes.buildCategoryPath(product.categorySlug)}" class="product-mobile-back inline-flex min-h-8 items-center gap-2 text-sm font-medium text-slate-600 md:hidden">
          <span aria-hidden="true">&larr;</span>
          <span>${escapeHtml(product.categoryLabel)}</span>
        </a>
        <nav class="breadcrumb product-breadcrumb hidden md:flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
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
      <div class="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <div class="product-detail-hero grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(400px,480px)] lg:items-start lg:gap-10">
          <div class="product-hero-media min-w-0">
            <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-5">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="product-main-image mx-auto aspect-[4/3] w-full rounded-md bg-white object-contain p-4 sm:p-8" width="1200" height="900" loading="eager" fetchpriority="high" decoding="async">
            </div>
          </div>
          <div class="product-hero-copy min-w-0">
            <div class="product-summary-intro-block border-b border-slate-200 pb-5">
              <p class="text-xs font-semibold uppercase text-blue-600">${escapeHtml(product.categoryLabel)}</p>
              <h1 class="product-page-title mt-2 text-[2rem] font-semibold leading-tight text-slate-950 sm:text-4xl lg:text-[2.6rem]">${escapeHtml(product.nome)}</h1>
              <p class="product-summary-intro mt-3 text-base leading-7 text-slate-600">${escapeHtml(decisionContent.lead || product.display_description || product.seo_description)}</p>
            </div>
            <div class="product-summary-card mt-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div class="product-purchase-summary grid gap-4">
                <div class="flex items-end justify-between gap-4">
                  <div>
                    <div class="text-xs font-semibold uppercase text-slate-500">Preço base</div>
                    <div class="mt-1 text-4xl font-semibold leading-none text-slate-950 sm:text-5xl">${escapeHtml(formatCurrency(product.preco))}</div>
                  </div>
                  <div class="hidden text-right text-xs leading-5 text-slate-500 sm:block">
                    IVA calculado no checkout<br>
                    Personalização incluída
                  </div>
                </div>
                <div>
                  <label for="product-quantity-${escapeHtml(product.id)}" class="mb-2 block text-xs font-semibold uppercase text-slate-500">Quantidade</label>
                  <div class="product-quantity-row grid grid-cols-[5.25rem,minmax(0,1fr)] items-stretch gap-2">
                    <input id="product-quantity-${escapeHtml(product.id)}" type="number" min="1" max="999" step="1" value="1" inputmode="numeric" data-product-quantity-input="${escapeHtml(product.id)}" class="product-quantity-input h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-center text-base font-semibold text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200" aria-label="Quantidade">
                    <a href="${product.personalizePath}" data-personalize-link="true" data-product-quantity-link="${escapeHtml(product.id)}" ${product.categorySlug === 'fly-banner' ? 'data-flybanner-personalize-trigger="true"' : ''} data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.nome)}" data-product-category="${escapeHtml(product.categorySlug)}" data-analytics-event="start_personalization" data-analytics-product-id="${escapeHtml(product.id)}" data-analytics-category-slug="${escapeHtml(product.categorySlug)}" class="product-personalize-button inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                      <span class="min-w-0 truncate">Personalizar produto</span>
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                </div>
              </div>
              <div class="mt-4 border-t border-slate-100 pt-4">
                ${renderProductBuyingNotes(product)}
              </div>
            </div>
            </div>
            <div class="mt-5">
              ${renderProductDecisionBlocks(product)}
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="product-related-section border-t border-slate-200 bg-slate-50">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div class="product-related-intro flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase text-slate-500">Compare antes de decidir</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(relatedHeading)}</h2>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">${escapeHtml(relatedSummary)}</p>
          </div>
          <a href="${SiteRoutes.buildCategoryPath(product.categorySlug)}" class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
            <span>Ver categoria completa</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <div class="product-related-track mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
          ${renderRelatedProductCards(fallbackProducts)}
        </div>
        <div class="mt-10 border-t border-slate-200 pt-8">
          <div class="product-related-intro flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase text-slate-500">Ver mais</p>
              <h2 class="mt-2 text-2xl font-semibold text-slate-900">Outras opções que podem interessar</h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Uma seleção rápida de produtos para explorar formatos diferentes sem voltar ao catálogo inteiro.</p>
            </div>
            <a href="${SiteRoutes.STATIC_PATHS.products}" class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
              <span>Ver tudo</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
          <div class="product-related-track mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
            ${renderRelatedProductCards(shuffledSuggestions)}
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
    const productCountLabel = Number(productCount) === 1 ? 'produto' : 'produtos';
    const categoryOptions = [
        `<option value="all"${safeSelectedCategory === 'all' ? ' selected' : ''}>Todas as categorias</option>`,
        ...categoryEntries.map((category) => `<option value="${escapeHtml(category.slug)}"${safeSelectedCategory === category.slug ? ' selected' : ''}>${escapeHtml(category.label)}</option>`)
    ].join('');

    return `
      <div class="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:items-end sm:justify-between">
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">${escapeHtml(productCount)} ${productCountLabel}</p>
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
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full bg-white object-contain p-3 sm:p-5" loading="${index < 6 ? 'eager' : 'lazy'}" fetchpriority="${index < 4 ? 'high' : 'auto'}" width="720" height="540" decoding="async">
            </a>
            <div class="flex flex-1 flex-col p-3 sm:p-5">
              <div class="flex flex-1 flex-col">
                <p class="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-slate-500 sm:text-xs">${escapeHtml(product.categoryLabel)}</p>
                <h2 data-fit-card-title class="mt-1.5 text-[0.68rem] font-semibold leading-[1.02] text-slate-900 sm:mt-2 sm:text-lg sm:leading-5"><a href="${product.canonicalPath}" class="hover:text-slate-700">${escapeHtml(product.nome)}</a></h2>
                <p class="mt-3 hidden text-sm leading-6 text-slate-600 sm:block">${escapeHtml(summarize(product.display_description || product.seo_description, 160))}</p>
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
    const catalogProducts = productEntries
        .slice()
        .sort((left, right) => {
            const featuredDelta = Number(Boolean(right.destaque)) - Number(Boolean(left.destaque));
            if (featuredDelta !== 0) return featuredDelta;
            return String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-PT');
        });
    const primaryImage = catalogProducts[0]?.imageUrl || `${CANONICAL_ORIGIN}/assets/logos/logo-completo.svg`;
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
            itemListElement: catalogProducts.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: product.nome,
                url: SiteRoutes.buildPublicUrl(product.canonicalPath)
            }))
        }
    ];

    return `${renderHead({
        title: 'Catálogo de Produtos Publicitários | IberFlag',
        description: 'Explore o catálogo IberFlag com fly banners, roll ups, bandeiras, photocalls, tendas e suportes promocionais personalizados.',
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
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">Escolha a categoria certa, compare os modelos e avance para a personalização quando já souber o formato ideal.</p>
        </div>
        ${renderCatalogToolbar(categoryEntries, { selectedCategory: 'all', productCount: catalogProducts.length })}
      </div>
    </section>
    <section class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <div data-catalog-grid class="catalog-grid-two grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
        ${catalogProducts.map((product, index) => `
          <article class="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white" data-catalog-item data-order-index="${index}" data-price="${Number(product.preco || 0)}" data-name="${escapeHtml(String(product.nome || '').toLowerCase())}">
            <a href="${product.canonicalPath}" class="block">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.nome)}" class="aspect-[4/3] h-full w-full bg-white object-contain p-3 sm:p-5" loading="${index < 8 ? 'eager' : 'lazy'}" fetchpriority="${index < 4 ? 'high' : 'auto'}" width="720" height="540" decoding="async">
            </a>
            <div class="flex flex-1 flex-col p-3 sm:p-5">
              <div class="flex flex-1 flex-col">
                <p class="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-slate-500 sm:text-xs">${escapeHtml(product.categoryLabel)}</p>
                <h2 data-fit-card-title class="mt-1.5 text-[0.68rem] font-semibold leading-[1.02] text-slate-900 sm:mt-2 sm:text-base sm:leading-5"><a href="${product.canonicalPath}" class="hover:text-slate-700">${escapeHtml(product.nome)}</a></h2>
                <p class="mt-3 hidden text-sm leading-6 text-slate-600 sm:block">${escapeHtml(summarize(product.display_description || product.seo_description, 145))}</p>
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
        title: 'Mapa do Site IberFlag | Categorias e Produtos',
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
            nomeEs: product.nome_es || null,
            descricaoEs: product.descricao_es || null,
            seoTitle: product.seo_title,
            seoDescription: product.seo_description,
            displayDescription: product.display_description
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
