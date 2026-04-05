#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const sharp = require('sharp');

const SUPPLIER_BASE_URL = 'https://www.beachflagscatalog.com';
const SUPPLIER_WP_PAGES_URL = `${SUPPLIER_BASE_URL}/wp-json/wp/v2/pages`;
const DEFAULT_BUCKET = 'catalog-products';
const DEFAULT_REPORT_DIR = path.join(process.cwd(), 'reports', 'imports');
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-PT,pt;q=0.9,es-ES;q=0.8,es;q=0.7,en;q=0.6',
    'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const part = String(argv[i] || '');
        if (!part.startsWith('--')) continue;

        const key = part.slice(2);
        const next = argv[i + 1];
        if (next && !String(next).startsWith('--')) {
            args[key] = String(next);
            i += 1;
        } else {
            args[key] = 'true';
        }
    }
    return args;
}

function projectRefFromSupabaseUrl(url) {
    try {
        const hostname = new URL(url).hostname;
        return hostname.split('.')[0] || '';
    } catch {
        return '';
    }
}

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeSpaces(value) {
    return String(value || '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeLongText(value) {
    return normalizeSpaces(
        String(value || '')
            .replace(/\s*([:;,.!?])\s*/g, '$1 ')
            .replace(/\s+/g, ' ')
    );
}

function formatDimensionNumber(raw) {
    const parsed = Number(String(raw || '').replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    if (Math.abs(parsed - Math.round(parsed)) < 0.001) return String(Math.round(parsed));
    return String(parsed.toFixed(2)).replace(/\.?0+$/, '');
}

function buildDimensionLabel(widthRaw, heightRaw, unitRaw) {
    const width = formatDimensionNumber(widthRaw);
    const height = formatDimensionNumber(heightRaw);
    const unit = String(unitRaw || 'cm').toLowerCase();
    if (!width || !height) return null;
    return `${width} x ${height} ${unit}`;
}

function unique(items) {
    const output = [];
    const seen = new Set();
    for (const item of items) {
        const value = String(item || '').trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        output.push(value);
    }
    return output;
}

function parseDimensionsFromText(text) {
    const dimensions = [];
    const regex = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*(cm|mm|m))?/gi;
    let match = regex.exec(text);
    while (match) {
        const label = buildDimensionLabel(match[1], match[2], match[3] || 'cm');
        if (label) dimensions.push(label);
        match = regex.exec(text);
    }
    return unique(dimensions);
}

function parseDimensionsFromTable($) {
    const dimensions = [];
    $('table tr').each((_, tr) => {
        const cells = $(tr).find('th,td');
        if (!cells || cells.length === 0) return;

        const rowText = normalizeSpaces($(tr).text()).replace(/×/g, 'x');
        const combined = parseDimensionsFromText(rowText);
        if (combined.length > 0) {
            dimensions.push(...combined);
            return;
        }

        const parsedValues = [];
        cells.each((__, cell) => {
            const cellText = normalizeSpaces($(cell).text()).replace(/×/g, 'x');
            const parsed = cellText.match(/(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?/i);
            if (!parsed) return;
            parsedValues.push({
                value: parsed[1],
                unit: parsed[2] || null
            });
        });

        if (parsedValues.length >= 2) {
            const first = parsedValues[0];
            const second = parsedValues[1];
            const label = buildDimensionLabel(first.value, second.value, first.unit || second.unit || 'cm');
            if (label) dimensions.push(label);
        }
    });

    return unique(dimensions);
}

function extractPrimaryDescription($) {
    const paragraphs = [];
    $('p').each((_, p) => {
        const text = sanitizeLongText($(p).text());
        if (text.length < 40) return;
        if (/^(buscar|menu|cookies)/i.test(text)) return;
        paragraphs.push(text);
    });

    if (!paragraphs.length) {
        const fallback = sanitizeLongText($('body').text());
        return fallback.slice(0, 600);
    }

    const description = paragraphs.slice(0, 2).join(' ');
    return description.slice(0, 900);
}

function resolveUrl(url) {
    if (!url) return '';
    try {
        return new URL(url, SUPPLIER_BASE_URL).href;
    } catch {
        return '';
    }
}

function pickLargestSrcFromSrcset(srcset) {
    if (!srcset) return '';
    const candidates = srcset
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [urlPart, widthPart] = entry.split(/\s+/);
            const width = Number(String(widthPart || '').replace('w', ''));
            return {
                url: resolveUrl(urlPart),
                width: Number.isFinite(width) ? width : 0
            };
        })
        .filter((entry) => entry.url);

    if (!candidates.length) return '';
    candidates.sort((a, b) => b.width - a.width);
    return candidates[0].url;
}

function imagePenalty(url, altText) {
    const ref = `${url} ${altText}`.toLowerCase();
    const negativeTokens = [
        'base_',
        'base-',
        'flotador',
        'pared',
        'tornillo',
        'pica',
        'hercules',
        'rellenable',
        'deluxe',
        'water-base',
        'logo',
        'cropped',
        'assembly',
        'instrucciones',
        'ficha-tecnica'
    ];

    let penalty = 0;
    for (const token of negativeTokens) {
        if (ref.includes(token)) penalty += 30;
    }
    return penalty;
}

function pickMainImage($) {
    const candidates = [];
    $('img').each((index, element) => {
        const src = resolveUrl($(element).attr('src') || '');
        const srcset = $(element).attr('srcset') || '';
        const bestSrcset = pickLargestSrcFromSrcset(srcset);
        const finalUrl = bestSrcset || src;
        if (!finalUrl || finalUrl.startsWith('data:')) return;
        const altText = normalizeSpaces($(element).attr('alt') || '');
        const score = 200 - (index * 3) - imagePenalty(finalUrl, altText);
        candidates.push({ url: finalUrl, score });
    });

    if (!candidates.length) return '';

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
}

function getPtInternalLinks($, currentLink) {
    const links = [];
    $('a[href]').each((_, anchor) => {
        const href = resolveUrl($(anchor).attr('href') || '');
        if (!href.includes('/language/pt/')) return;
        if (href.startsWith(`${SUPPLIER_BASE_URL}/language/pt/#`)) return;
        const normalized = href.endsWith('/') ? href : `${href}/`;
        if (normalized === (currentLink.endsWith('/') ? currentLink : `${currentLink}/`)) return;
        links.push(normalized);
    });
    return unique(links);
}

function isLikelyListingPage(page, parsed) {
    const slug = String(page.slug || '').toLowerCase();
    if (slug === 'inicio-portugues' || slug.startsWith('elementor-')) return true;
    const staticHubs = new Set(['fly-banner-2', 'displays-2', 'banners', 'mastros']);
    if (staticHubs.has(slug)) return true;
    if (parsed.dimensions.length === 0 && parsed.ptInternalLinks.length >= 3) return true;
    return false;
}

function normalizeCategoryFromPage(page) {
    const link = String(page.link || '').toLowerCase();
    const slug = String(page.slug || '').toLowerCase();
    const ref = `${link} ${slug}`;

    const map = [
        { test: /fly-banner/, value: 'fly-banner' },
        { test: /mini-fly-banner/, value: 'mini-fly-banner' },
        { test: /roll-up/, value: 'roll-up' },
        { test: /x-banner/, value: 'x-banner' },
        { test: /wall[_-]?banner/, value: 'wall-banner' },
        { test: /tenda|carpa/, value: 'tenda-publicitaria' },
        { test: /photocall/, value: 'photocall' },
        { test: /mastro/, value: 'mastros' },
        { test: /cubo/, value: 'cubo-publicitario' },
        { test: /balcao|mostrador/, value: 'balcao-promocional' },
        { test: /bandeira/, value: 'bandeiras' }
    ];

    for (const rule of map) {
        if (rule.test.test(ref)) return rule.value;
    }

    return slugify(slug || page.title?.rendered || 'catalogo');
}

function extractDimensions($, rawText) {
    const text = rawText.replace(/×/g, 'x');

    const singularAvailable = /dispon[ií]vel\s+no\s+tamanho/i.test(text);
    const availableMatch = text.match(/dispon[ií]vel[^.]{0,260}/i);
    if (availableMatch) {
        const fromAvailable = parseDimensionsFromText(availableMatch[0]);
        if (fromAvailable.length > 0) {
            return singularAvailable ? [fromAvailable[0]] : fromAvailable;
        }
    }

    const byTable = parseDimensionsFromTable($);
    if (byTable.length > 0) {
        return byTable;
    }

    const byText = parseDimensionsFromText(text);
    return byText;
}

function extractPageData(page) {
    const html = page?.content?.rendered || '';
    const $ = cheerio.load(html);
    const fullText = sanitizeLongText($('body').text());
    const dimensions = extractDimensions($, fullText);
    const mainImageUrl = pickMainImage($);
    const baseDescription = extractPrimaryDescription($);
    const ptInternalLinks = getPtInternalLinks($, page.link || '');

    return {
        dimensions,
        mainImageUrl,
        baseDescription,
        ptInternalLinks
    };
}

async function fetchJson(url) {
    const response = await fetch(url, { headers: REQUEST_HEADERS });
    if (!response.ok) {
        throw new Error(`Falha ao pedir ${url}: HTTP ${response.status}`);
    }
    return response.json();
}

async function fetchBuffer(url, retries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(url, { headers: REQUEST_HEADERS });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            if (!buffer.length) throw new Error('Imagem vazia.');
            return buffer;
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
            }
        }
    }
    throw lastError || new Error(`Falha ao descarregar imagem: ${url}`);
}

async function fetchAllPortuguesePages() {
    const firstResponse = await fetch(`${SUPPLIER_WP_PAGES_URL}?per_page=100&page=1`, { headers: REQUEST_HEADERS });
    if (!firstResponse.ok) {
        throw new Error(`Falha ao carregar o catálogo do fornecedor: HTTP ${firstResponse.status}`);
    }

    const totalPages = Number(firstResponse.headers.get('x-wp-totalpages') || '1');
    const all = await firstResponse.json();

    for (let page = 2; page <= totalPages; page += 1) {
        const chunk = await fetchJson(`${SUPPLIER_WP_PAGES_URL}?per_page=100&page=${page}`);
        all.push(...chunk);
    }

    return all
        .filter((entry) => String(entry?.link || '').includes('/language/pt/'))
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
}

async function resolveServiceRoleKey({ supabaseUrl, accessToken }) {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRole) {
        return serviceRole;
    }

    if (!accessToken) {
        return '';
    }

    const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
    if (!projectRef) {
        throw new Error('Nao foi possivel inferir o project-ref a partir de SUPABASE_URL.');
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Falha ao obter API keys via token CLI (HTTP ${response.status}).`);
    }

    const keys = await response.json();
    const serviceRoleKey = Array.isArray(keys)
        ? keys.find((entry) => String(entry?.name || '').toLowerCase() === 'service_role')?.api_key
        : '';

    return String(serviceRoleKey || '');
}

async function ensureBucket(supabase, bucketName) {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = Array.isArray(buckets) && buckets.some((bucket) => bucket.id === bucketName);
    if (exists) return;

    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
    if (createError) throw createError;
}

function hashForPath(value) {
    return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10);
}

async function uploadImageToStorage({ supabase, bucketName, sourceImageUrl, category, baseName }) {
    const originalBuffer = await fetchBuffer(sourceImageUrl, 3);
    const webpBuffer = await sharp(originalBuffer)
        .rotate()
        .webp({ quality: 86 })
        .toBuffer();

    const safeCategory = slugify(category || 'catalogo');
    const safeBaseName = slugify(baseName || 'produto');
    const imageHash = hashForPath(`${sourceImageUrl}-${webpBuffer.length}`);
    const objectPath = `supplier-pt/${safeCategory}/${safeBaseName}-${imageHash}.webp`;

    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(objectPath, webpBuffer, {
            upsert: true,
            contentType: 'image/webp',
            cacheControl: '31536000'
        });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(objectPath);

    const publicUrl = publicUrlData?.publicUrl || '';
    if (!publicUrl) {
        throw new Error(`Falha ao obter URL publica para ${objectPath}`);
    }
    return publicUrl;
}

function buildDescription(baseDescription, sizeLabel, sourceLink) {
    const description = sanitizeLongText(baseDescription || 'Produto importado do catálogo do fornecedor.');
    const sizeText = sizeLabel === 'Tamanho único' ? 'Tamanho único' : `Tamanho: ${sizeLabel}`;
    const merged = `${description}\n\n${sizeText}\nFonte: ${sourceLink}`;
    return merged.slice(0, 1900);
}

function buildProductsFromPage(page, parsedPage) {
    const baseName = sanitizeLongText(page?.title?.rendered || page?.slug || 'Produto');
    const category = normalizeCategoryFromPage(page);
    const sizes = parsedPage.dimensions.length > 0 ? parsedPage.dimensions : ['Tamanho único'];

    return sizes.map((sizeLabel) => {
        const finalName = sizeLabel === 'Tamanho único'
            ? `${baseName} (Tamanho único)`
            : `${baseName} (${sizeLabel})`;

        return {
            nome: finalName,
            descricao: buildDescription(parsedPage.baseDescription, sizeLabel, page.link),
            preco: 0,
            categoria: category,
            destaque: false,
            ativo: true,
            svg_template: null,
            __sizeLabel: sizeLabel,
            __pageId: page.id,
            __sourcePageLink: page.link,
            __baseName: baseName,
            __sourceImageUrl: parsedPage.mainImageUrl
        };
    });
}

function stripPrivateFields(record) {
    const clone = { ...record };
    Object.keys(clone).forEach((key) => {
        if (key.startsWith('__')) delete clone[key];
    });
    return clone;
}

async function insertInChunks(supabase, records, chunkSize = 40) {
    for (let offset = 0; offset < records.length; offset += chunkSize) {
        const chunk = records.slice(offset, offset + chunkSize);
        const { error } = await supabase
            .from('produtos')
            .insert(chunk.map(stripPrivateFields));
        if (error) {
            throw new Error(`Erro no insert de produtos [${offset}-${offset + chunk.length - 1}]: ${error.message}`);
        }
    }
}

function writeReport(reportDir, report) {
    fs.mkdirSync(reportDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(reportDir, `import-catalog-pt-${stamp}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return filePath;
}

async function run() {
    const args = parseArgs(process.argv.slice(2));
    const accessToken = String(args['access-token'] || process.env.SUPABASE_ACCESS_TOKEN || '');
    const bucketName = String(args.bucket || DEFAULT_BUCKET);
    const reportDir = String(args['report-dir'] || DEFAULT_REPORT_DIR);
    const shouldReset = String(args.reset || 'true').toLowerCase() !== 'false';

    const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
    if (!supabaseUrl) {
        throw new Error('SUPABASE_URL nao definido no ambiente.');
    }

    const serviceRoleKey = await resolveServiceRoleKey({ supabaseUrl, accessToken });
    const authKey = serviceRoleKey || String(process.env.SUPABASE_ANON_KEY || '').trim();
    if (!authKey) {
        throw new Error('Nao foi encontrada chave de acesso Supabase (service role ou anon).');
    }

    const supabase = createClient(supabaseUrl, authKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const report = {
        startedAt: new Date().toISOString(),
        source: SUPPLIER_BASE_URL,
        language: 'pt',
        bucket: bucketName,
        resetApplied: shouldReset,
        pagesTotalPt: 0,
        pagesImported: 0,
        pagesSkipped: [],
        productsGenerated: 0,
        productsInserted: 0,
        imageUploads: 0,
        failures: []
    };

    console.log('1/6 A preparar bucket de imagens...');
    await ensureBucket(supabase, bucketName);

    console.log('2/6 A ler páginas PT do catálogo do fornecedor...');
    const pages = await fetchAllPortuguesePages();
    report.pagesTotalPt = pages.length;

    const imageCache = new Map();
    const generatedProducts = [];

    console.log(`3/6 A processar ${pages.length} páginas PT...`);
    for (const page of pages) {
        try {
            const parsedPage = extractPageData(page);
            if (isLikelyListingPage(page, parsedPage)) {
                report.pagesSkipped.push({
                    pageId: page.id,
                    slug: page.slug,
                    reason: 'listing-or-placeholder'
                });
                continue;
            }

            if (!parsedPage.mainImageUrl) {
                report.pagesSkipped.push({
                    pageId: page.id,
                    slug: page.slug,
                    reason: 'missing-main-image'
                });
                continue;
            }

            const pageProducts = buildProductsFromPage(page, parsedPage);
            if (!pageProducts.length) {
                report.pagesSkipped.push({
                    pageId: page.id,
                    slug: page.slug,
                    reason: 'no-products-generated'
                });
                continue;
            }

            for (const product of pageProducts) {
                const cacheKey = `${product.__sourceImageUrl}`;
                let publicImageUrl = imageCache.get(cacheKey);
                if (!publicImageUrl) {
                    publicImageUrl = await uploadImageToStorage({
                        supabase,
                        bucketName,
                        sourceImageUrl: product.__sourceImageUrl,
                        category: product.categoria,
                        baseName: product.__baseName
                    });
                    imageCache.set(cacheKey, publicImageUrl);
                    report.imageUploads += 1;
                }
                product.imagem = publicImageUrl;
            }

            generatedProducts.push(...pageProducts);
            report.pagesImported += 1;
        } catch (error) {
            report.failures.push({
                pageId: page?.id || null,
                slug: page?.slug || '',
                stage: 'process-page',
                error: error?.message || String(error)
            });
        }
    }

    report.productsGenerated = generatedProducts.length;

    if (report.failures.length > 0) {
        const reportPath = writeReport(reportDir, {
            ...report,
            finishedAt: new Date().toISOString(),
            success: false
        });
        throw new Error(`Falhas durante o parsing/import inicial. Ver relatório: ${reportPath}`);
    }

    if (!generatedProducts.length) {
        const reportPath = writeReport(reportDir, {
            ...report,
            finishedAt: new Date().toISOString(),
            success: false
        });
        throw new Error(`Nenhum produto foi gerado. Ver relatório: ${reportPath}`);
    }

    console.log(`4/6 ${generatedProducts.length} produtos gerados. A preparar escrita no Supabase...`);
    if (shouldReset) {
        const { error: detachItemsError } = await supabase
            .from('itens_encomenda')
            .update({ produto_id: null })
            .not('produto_id', 'is', null);

        if (detachItemsError) {
            throw new Error(`Falha ao desvincular itens_encomenda antes do reset: ${detachItemsError.message}`);
        }

        const { error: resetError } = await supabase.from('produtos').delete().neq('id', 0);
        if (resetError) {
            throw new Error(`Falha ao limpar produtos antes do import: ${resetError.message}`);
        }
    }

    console.log('5/6 A inserir produtos em lotes...');
    await insertInChunks(supabase, generatedProducts, 40);
    report.productsInserted = generatedProducts.length;

    const finalReport = {
        ...report,
        finishedAt: new Date().toISOString(),
        success: true
    };
    const reportPath = writeReport(reportDir, finalReport);

    console.log('6/6 Importação concluída com sucesso.');
    console.log(`Produtos inseridos: ${finalReport.productsInserted}`);
    console.log(`Páginas importadas: ${finalReport.pagesImported}`);
    console.log(`Páginas ignoradas: ${finalReport.pagesSkipped.length}`);
    console.log(`Uploads de imagem: ${finalReport.imageUploads}`);
    console.log(`Relatório: ${reportPath}`);
}

run().catch((error) => {
    console.error('\nImportação falhou:');
    console.error(error?.message || error);
    process.exit(1);
});
