const fs = require('fs/promises');
const path = require('path');
const cheerio = require('cheerio');

const SiteRoutes = require('../assets/js/core/site-routes.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_PAGES_DIR = path.join(ROOT_DIR, 'pages');
const SOURCE_PRODUCTS_DIR = path.join(ROOT_DIR, 'produto');
const SOURCE_CATEGORIES_DIR = path.join(ROOT_DIR, 'produtos');
const SOURCE_SITEMAP_DIR = path.join(ROOT_DIR, 'sitemaps');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'es');
const OUTPUT_SITEMAPS_DIR = path.join(ROOT_DIR, 'sitemaps');
const CANONICAL_ORIGIN = SiteRoutes.getCanonicalOrigin();

const STATIC_PAGE_ROUTES = {
    'index.html': '',
    'produtos.html': 'produtos',
    'sobre.html': 'sobre',
    'contacto.html': 'contacto',
    'faq.html': 'faq',
    'envios.html': 'envios',
    'devolucoes.html': 'devolucoes',
    'privacidade.html': 'privacidade',
    'termos.html': 'termos',
    'checkout.html': 'checkout',
    'checkout-sucesso.html': 'checkout/sucesso',
    'encomendas.html': 'encomendas',
    'encomenda.html': 'encomenda',
    'personalizar.html': 'personalizar',
    'templates-gallery.html': 'modelos',
    'admin.html': 'admin',
    'admin-template-editor.html': 'admin-template-editor'
};

const TEXT_REPLACEMENTS = [
    ['IberFlag - Flybanners e Publicidade Física Personalizada', 'IberFlag - Fly banners y publicidad física personalizada'],
    ['Especialistas em flybanners, roll-ups e produtos publicitários com operação principal em Portugal, produção rápida e apoio dedicado.', 'Especialistas en fly banners, roll ups y productos publicitarios con operación principal en Portugal, producción rápida y apoyo dedicado.'],
    ['Especialistas em flybanners, roll-ups e produtos publicitários com operação principal em Portugal.', 'Especialistas en fly banners, roll ups y productos publicitarios con operación principal en Portugal.'],
    ['Fale com a equipa IberFlag para apoio comercial e técnico.', 'Hable con el equipo IberFlag para apoyo comercial y técnico.'],
    ['Informação de prazos, tracking e cobertura de entregas confirmada no checkout.', 'Información de plazos, tracking y cobertura de entregas confirmada en el checkout.'],
    ['Respostas a perguntas frequentes sobre prazos, personalização, pagamento, envio e funcionamento das encomendas na IberFlag.', 'Respuestas a preguntas frecuentes sobre plazos, personalización, pago, envío y funcionamiento de los pedidos en IberFlag.'],
    ['Flybanners', 'Fly banners'],
    ['Flybanner', 'Fly banner'],
    ['Roll Up', 'Roll Up'],
    ['Publicidade física', 'Publicidad física'],
    ['tratada como marca.', 'tratada como marca.'],
    ['Publicidade Fisica', 'Publicidad física'],
    ['tratada como marca.', 'tratada como marca.'],
    ['Início', 'Inicio'],
    ['Sobre Nós', 'Sobre nosotros'],
    ['Produtos', 'Productos'],
    ['Contacto', 'Contacto'],
    ['Carrinho de Compras', 'Carrito de compra'],
    ['Carrinho', 'Carrito'],
    ['Abrir carrinho', 'Abrir carrito'],
    ['Abrir menu', 'Abrir menú'],
    ['Ver Catálogo', 'Ver catálogo'],
    ['Ver Catalogo', 'Ver catálogo'],
    ['Ver Todos os Produtos', 'Ver todos los productos'],
    ['Ver Todos os Produtos', 'Ver todos los productos'],
    ['Falar com Consultor', 'Hablar con un asesor'],
    ['Falar com a equipa', 'Hablar con el equipo'],
    ['Falar com Consultor', 'Hablar con un asesor'],
    ['Os formatos mais pedidos.', 'Los formatos más solicitados.'],
    ['Peças escolhidas por marcas que precisam de rapidez sem abdicar da apresentação.', 'Piezas elegidas por marcas que necesitan rapidez sin renunciar a la presentación.'],
    ['Escolha o formato certo para o espaço.', 'Elija el formato adecuado para el espacio.'],
    ['Cada solução foi pensada para criar presença com leitura clara, montagem simples e impacto imediato.', 'Cada solución está pensada para crear presencia con lectura clara, montaje sencillo e impacto inmediato.'],
    ['Entrega Preparada', 'Entrega preparada'],
    ['Qualidade Controlada', 'Calidad controlada'],
    ['Direção Visual', 'Dirección visual'],
    ['Presença Premium', 'Presencia premium'],
    ['produção e envio coordenados', 'producción y envío coordinados'],
    ['acabamento profissional', 'acabado profesional'],
    ['apoio gráfico orientado à marca', 'apoyo gráfico orientado a la marca'],
    ['concebido para impressionar', 'concebido para impresionar'],
    ['Entre em Contacto', 'Póngase en contacto'],
    ['Entre em contacto', 'Póngase en contacto'],
    ['Estamos aqui para ajudar a preparar, validar e acompanhar a sua encomenda.', 'Estamos aquí para ayudarle a preparar, validar y seguir su pedido.'],
    ['Envie-nos uma Mensagem', 'Envíenos un mensaje'],
    ['Selecione um assunto', 'Seleccione un asunto'],
    ['Pedido de Orçamento', 'Solicitud de presupuesto'],
    ['Informação sobre Produtos', 'Información sobre productos'],
    ['Estado de Encomenda', 'Estado del pedido'],
    ['Reclamação', 'Reclamación'],
    ['Escreva a sua mensagem aqui...', 'Escriba su mensaje aquí...'],
    ['Aceito a', 'Acepto la'],
    ['autorizo o tratamento dos meus dados pessoais', 'autorizo el tratamiento de mis datos personales'],
    ['Perguntas Frequentes', 'Preguntas frecuentes'],
    ['Talvez a sua resposta já esteja aqui', 'Quizás su respuesta ya esté aquí'],
    ['Prazos de Entrega', 'Plazos de entrega'],
    ['Métodos de Pagamento', 'Métodos de pago'],
    ['Design Gráfico', 'Diseño gráfico'],
    ['Envios e Entregas', 'Envíos y entregas'],
    ['Devoluções', 'Devoluciones'],
    ['Política de Privacidade', 'Política de privacidad'],
    ['Termos e Condições', 'Términos y condiciones'],
    ['Minhas Encomendas', 'Mis pedidos'],
    ['Detalhe da Encomenda', 'Detalle del pedido'],
    ['Personalizar Produto', 'Personalizar producto'],
    ['Escolher Template', 'Elegir plantilla'],
    ['Mapa do Site', 'Mapa del sitio'],
    ['Produtos personalizados', 'Productos personalizados'],
    ['Produtos publicitários', 'Productos publicitarios'],
    ['Ver produto', 'Ver producto'],
    ['Ver tudo', 'Ver todo'],
    ['Continue a explorar', 'Siga explorando'],
    ['Produtos relacionados', 'Productos relacionados'],
    ['Ver categoria completa', 'Ver categoría completa'],
    ['Outras opções que podem interessar', 'Otras opciones que pueden interesarle'],
    ['Uma seleção rápida de produtos para explorar formatos diferentes sem voltar ao catálogo inteiro.', 'Una selección rápida de productos para explorar formatos diferentes sin volver al catálogo completo.'],
    ['Preço base', 'Precio base'],
    ['Personalizar produto', 'Personalizar producto'],
    ['Escolha as opções, envie o design e finalize a encomenda no passo seguinte.', 'Elija las opciones, envíe el diseño y finalice el pedido en el siguiente paso.'],
    ['Pedir apoio', 'Solicitar ayuda'],
    ['Escolher outro produto', 'Elegir otro producto'],
    ['Escolha o reforço', 'Elija el refuerzo'],
    ['Selecione a opção pretendida antes de continuar.', 'Seleccione la opción deseada antes de continuar.'],
    ['Mapa do site', 'Mapa del sitio'],
    ['Páginas principais', 'Páginas principales'],
    ['Categorias', 'Categorías'],
    ['Paginas principais', 'Páginas principales'],
    ['Página', 'Página'],
    ['Página de contacto', 'Página de contacto'],
    ['Loja 100% online', 'Tienda 100% online'],
    ['Atendimento 24h', 'Atención 24 h'],
    ['Atendimento online 24h', 'Atención online 24 h'],
    ['Envie-nos', 'Envíenos'],
    ['Escreva', 'Escriba'],
    ['Selecione', 'Seleccione'],
    ['Escolha', 'Elija'],
    ['Os seus', 'Sus'],
    ['sua', 'su'],
    ['seu', 'su'],
    ['já esteja aqui', 'ya esté aquí'],
    ['para ajudar', 'para ayudar'],
    ['perguntas frequentes', 'preguntas frecuentes']
];

const ATTRIBUTE_TRANSLATIONS = {
    alt: true,
    title: true,
    placeholder: true,
    'aria-label': true,
    'aria-labelledby': true,
    content: true,
    item: true
};

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateText(value) {
    const raw = String(value || '');
    if (!raw.trim()) {
        return raw;
    }

    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    let output = raw.trim().replace(/\s+/g, ' ');
    for (const [source, target] of TEXT_REPLACEMENTS) {
        output = output.replace(new RegExp(escapeRegExp(source), 'g'), target);
    }
    return `${leading}${output}${trailing}`;
}

function splitUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return { path: '', suffix: '', isAbsolute: false };

    const absoluteMatch = raw.match(new RegExp(`^${escapeRegExp(CANONICAL_ORIGIN)}(?<path>\\/[^?#]*)(?<suffix>[?#].*)?$`));
    if (absoluteMatch?.groups) {
        return {
            path: absoluteMatch.groups.path || '/',
            suffix: absoluteMatch.groups.suffix || '',
            isAbsolute: true
        };
    }

    const relativeMatch = raw.match(/^(?<path>\/[^?#]*)(?<suffix>[?#].*)?$/);
    if (relativeMatch?.groups) {
        return {
            path: relativeMatch.groups.path || '/',
            suffix: relativeMatch.groups.suffix || '',
            isAbsolute: false
        };
    }

    return { path: '', suffix: '', isAbsolute: false };
}

function localizeUrlValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw) && !raw.startsWith(CANONICAL_ORIGIN)) return raw;
    const { path: pathname, suffix, isAbsolute } = splitUrl(raw);
    if (!pathname) return raw;
    if (/^\/assets\//i.test(pathname) || /^\/favicon/i.test(pathname) || /^\/api\//i.test(pathname) || /^\/sitemaps\//i.test(pathname) || /^\/robots\.txt$/i.test(pathname) || /^\/sitemap\.xml$/i.test(pathname)) {
        return raw;
    }
    const localizedPath = SiteRoutes.getLocalizedPath(pathname, 'es');
    if (isAbsolute) {
        return `${CANONICAL_ORIGIN}${localizedPath}${suffix}`;
    }

    return `${localizedPath}${suffix}`;
}

function localizeTextContent(value) {
    const localizedUrl = localizeUrlValue(value);
    if (localizedUrl !== value) {
        return localizedUrl;
    }

    return translateText(value);
}

function localizeJsonLd(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;

    try {
        const parsed = JSON.parse(raw);
        const visit = (value) => {
            if (Array.isArray(value)) {
                return value.map(visit);
            }

            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value).map(([key, nextValue]) => [key, visit(nextValue)]));
            }

            if (typeof value === 'string') {
                return localizeTextContent(value);
            }

            return value;
        };

        return JSON.stringify(visit(parsed), null, 2);
    } catch {
        return translateText(raw);
    }
}

function localizeAttributeValue(name, value) {
    if (!ATTRIBUTE_TRANSLATIONS[name]) {
        return value;
    }

    return localizeTextContent(value);
}

function addAlternateLinks($, canonicalPath) {
    const canonical = SiteRoutes.buildPublicUrl(canonicalPath);
    const localized = SiteRoutes.buildPublicUrl(SiteRoutes.getLocalizedPath(canonicalPath, 'es'));
    $('link[rel="alternate"]').remove();
    const alternatePt = `<link rel="alternate" hreflang="pt-PT" href="${canonical}">`;
    const alternateEs = `<link rel="alternate" hreflang="es-ES" href="${localized}">`;

    const canonicalLink = $('link[rel="canonical"]').first();
    if (canonicalLink.length > 0) {
        canonicalLink.after(`\n  ${alternatePt}\n  ${alternateEs}`);
        return;
    }

    $('head').append(`\n  ${alternatePt}\n  ${alternateEs}`);
}

function translateDom($) {
    const sourceCanonical = currentCanonicalPath($);
    $('html').attr('lang', 'es-ES');
    $('meta[property="og:locale"]').attr('content', 'es_ES');
    $('link[rel="alternate"]').remove();

    $('script[type="application/ld+json"]').each((_, element) => {
        const node = $(element);
        node.text(localizeJsonLd(node.text()));
    });

    $('[href], [src], [action]').each((_, element) => {
        const node = $(element);
        for (const attribute of ['href', 'src', 'action']) {
            const currentValue = node.attr(attribute);
            if (currentValue) {
                node.attr(attribute, localizeUrlValue(currentValue));
            }
        }
    });

    $('[content], [item]').each((_, element) => {
        const node = $(element);
        for (const attribute of ['content', 'item']) {
            const currentValue = node.attr(attribute);
            if (!currentValue) continue;

            const localizedValue = localizeUrlValue(currentValue);
            node.attr(attribute, localizedValue !== currentValue ? localizedValue : translateText(currentValue));
        }
    });

    for (const attribute of Object.keys(ATTRIBUTE_TRANSLATIONS)) {
        if (attribute === 'content' || attribute === 'item') continue;
        const selector = `[${attribute}]`;
        $(selector).each((_, element) => {
            const node = $(element);
            const currentValue = node.attr(attribute);
            if (currentValue) {
                node.attr(attribute, localizeAttributeValue(attribute, currentValue));
            }
        });
    }

    const walk = (element) => {
        if (!element || !element.children) return;

        element.children.forEach((child) => {
            if (child.type === 'text') {
                const nextValue = localizeTextContent(child.data);
                if (nextValue !== child.data) {
                    child.data = nextValue;
                }
                return;
            }

            if (child.type === 'tag' && !['script', 'style', 'noscript'].includes(String(child.name || '').toLowerCase())) {
                walk(child);
            }
        });
    };

    walk($.root()[0]);
    addAlternateLinks($, sourceCanonical);
    return $;
}

function currentCanonicalPath($) {
    const canonicalHref = $('link[rel="canonical"]').attr('href') || `${CANONICAL_ORIGIN}/`;
    const normalized = canonicalHref.startsWith(CANONICAL_ORIGIN)
        ? canonicalHref.slice(CANONICAL_ORIGIN.length)
        : canonicalHref;
    return normalized || '/';
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeFile(targetPath, content) {
    await ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, String(content || '').replace(/[ \t]+$/gm, ''), 'utf8');
}

async function removeGeneratedPath(targetPath) {
    await fs.rm(targetPath, { recursive: true, force: true });
}

function staticTargetPath(sourceFileName) {
    const route = STATIC_PAGE_ROUTES[sourceFileName];
    if (route === undefined) {
        return null;
    }

    return route ? path.join(OUTPUT_ROOT, route, 'index.html') : path.join(OUTPUT_ROOT, 'index.html');
}

function sourceCanonicalPath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/');
    if (normalized.startsWith('pages/')) {
        const fileName = path.basename(normalized);
        const route = STATIC_PAGE_ROUTES[fileName];
        if (route === undefined) {
            return null;
        }
        return route ? `/${route}` : '/';
    }

    if (normalized.startsWith('produto/')) {
        const slug = normalized.split('/')[1];
        return `/produto/${slug}`;
    }

    if (normalized.startsWith('produtos/')) {
        const slug = normalized.split('/')[1];
        return `/produtos/${slug}`;
    }

    if (normalized.startsWith('mapa-do-site/')) {
        return '/mapa-do-site';
    }

    return null;
}

function translateHtmlFile(html, sourceFileName) {
    const $ = cheerio.load(html, { decodeEntities: false });
    translateDom($);

    if (sourceFileName === 'index.html') {
        $('title').text('IberFlag - Fly banners y publicidad física personalizada');
    }

    return $.html();
}

function translateSitemapXml(xml) {
    return xml
        .replace(/<loc>([^<]+)<\/loc>/g, (_, loc) => `<loc>${localizeUrlValue(loc)}</loc>`)
        .replace(/<lastmod>([^<]+)<\/lastmod>/g, (_, lastmod) => `<lastmod>${lastmod}</lastmod>`);
}

async function collectFiles(dir, predicate = () => true) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectFiles(fullPath, predicate));
            continue;
        }

        if (predicate(fullPath)) {
            files.push(fullPath);
        }
    }
    return files;
}

async function buildSpanishStaticPages() {
    const sourceFiles = [
        ...(await collectFiles(SOURCE_PAGES_DIR, (file) => file.endsWith('.html'))),
        ...(await collectFiles(SOURCE_PRODUCTS_DIR, (file) => file.endsWith('index.html'))),
        ...(await collectFiles(SOURCE_CATEGORIES_DIR, (file) => file.endsWith('index.html'))),
        ...(await collectFiles(SOURCE_SITEMAP_DIR, (file) => file.endsWith('index.html')))
    ];

    await removeGeneratedPath(OUTPUT_ROOT);
    await ensureDir(OUTPUT_ROOT);

    for (const sourcePath of sourceFiles) {
        const relative = path.relative(ROOT_DIR, sourcePath).replace(/\\/g, '/');
        const sourceHtml = await fs.readFile(sourcePath, 'utf8');
        const sourceCanonical = sourceCanonicalPath(relative);

        if (sourceCanonical) {
            const sourceDom = cheerio.load(sourceHtml, { decodeEntities: false });
            addAlternateLinks(sourceDom, sourceCanonical);
            const updatedSourceHtml = sourceDom.html();
            if (updatedSourceHtml && updatedSourceHtml !== sourceHtml) {
                await writeFile(sourcePath, updatedSourceHtml);
            }
        }

        const translatedHtml = translateHtmlFile(sourceHtml, path.basename(sourcePath));

        let targetPath = null;

        if (relative.startsWith('pages/')) {
            targetPath = staticTargetPath(path.basename(sourcePath));
        } else if (relative.startsWith('produto/')) {
            const productSlug = relative.split('/')[1];
            targetPath = path.join(OUTPUT_ROOT, 'produto', productSlug, 'index.html');
        } else if (relative.startsWith('produtos/')) {
            const categorySlug = relative.split('/')[1];
            targetPath = path.join(OUTPUT_ROOT, 'produtos', categorySlug, 'index.html');
        } else if (relative.startsWith('mapa-do-site/')) {
            targetPath = path.join(OUTPUT_ROOT, 'mapa-do-site', 'index.html');
        }

        if (!targetPath) continue;

        await writeFile(targetPath, translatedHtml);
    }
}

async function buildSpanishSitemaps() {
    const sitemapFiles = [
        'pages.xml',
        'categories.xml',
        'products.xml'
    ];

    for (const fileName of sitemapFiles) {
        const sourcePath = path.join(SOURCE_SITEMAP_DIR, fileName);
        const targetPath = path.join(SOURCE_SITEMAP_DIR, `es-${fileName}`);
        const sourceXml = await fs.readFile(sourcePath, 'utf8');
        await writeFile(targetPath, translateSitemapXml(sourceXml));
    }

    const rootSitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
    const rootSitemap = await fs.readFile(rootSitemapPath, 'utf8');
    const rootWithoutSpanishEntries = rootSitemap.replace(/\n  <sitemap>\n    <loc>https:\/\/iberflag\.com\/sitemaps\/es-[\s\S]*?<\/sitemap>/g, '');
    const localizedIndexEntries = sitemapFiles.map((fileName) => `
  <sitemap>
    <loc>${CANONICAL_ORIGIN}/sitemaps/es-${fileName}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </sitemap>`).join('');

    const updatedRootSitemap = rootWithoutSpanishEntries.replace('</sitemapindex>', `${localizedIndexEntries}\n</sitemapindex>`);
    await writeFile(rootSitemapPath, updatedRootSitemap);
}

async function main() {
    await buildSpanishStaticPages();
    await buildSpanishSitemaps();
    console.log('Spanish site build complete.');
}

main().catch((error) => {
    console.error('Spanish site build failed:', error);
    process.exitCode = 1;
});
