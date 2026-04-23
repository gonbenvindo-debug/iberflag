const fs = require('fs/promises');
const path = require('path');
const cheerio = require('cheerio');

const ROOT_DIR = path.resolve(__dirname, '..');
const ES_DIR = path.join(ROOT_DIR, 'es');
const ASCII_URL_PATTERN = /^[\x20-\x7E]+$/;
const BLOCKED_PATTERNS = [
    /\bCarrinho\b/i,
    /\bEncomenda(s)?\b/i,
    /\bDevolu[cç][oõ]es\b/i,
    /\bPol[ií]tica de Privacidade\b/i,
    /\bTermos e Condi[cç][oõ]es\b/i,
    /\bSobre N[oó]s\b/i,
    /\bPre[cç]o base\b/i,
    /\bPedir apoio\b/i,
    /\bProduto(s)? personalizado(s)?\b/i,
    /\bPublicidade f[ií]sica\b/i,
    /\bFale com\b/i,
    /\bEscolha\b/i,
    /\bSelecione\b/i,
    /\bEnvios e Entregas\b/i
];
const ALLOWLIST_PATTERNS = [
    /IberFlag/i,
    /geral@iberflag\.com/i,
    /\/assets\//i,
    /\/produto\//i,
    /\/produtos\//i,
    /https?:\/\//i,
    /\bFAQ\b/i,
    /\bRoll Up(s)?\b/i,
    /\bX-Banner(s)?\b/i,
    /\bWall Banner(s)?\b/i,
    /\bPhotocall(s)?\b/i,
    /\bFly Banner(s)?\b/i
];

async function collectHtmlFiles(dir) {
    const entries = await fs.readdir(dir);
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            files.push(...await collectHtmlFiles(fullPath));
        } else if (stat.isFile() && entry.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

function isAllowed(value) {
    return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(value));
}

function compact(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function checkPortugueseText(filePath, $, issues) {
    $('script, style, noscript').remove();
    const samples = [
        compact($('body').text()),
        ...$('title, meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"], [alt], [title], [placeholder], [aria-label]')
            .toArray()
            .map((element) => {
                const node = $(element);
                return compact(node.text() || node.attr('content') || node.attr('alt') || node.attr('title') || node.attr('placeholder') || node.attr('aria-label') || '');
            })
    ].filter(Boolean);

    for (const sample of samples) {
        if (isAllowed(sample)) continue;
        const blocked = BLOCKED_PATTERNS.find((pattern) => pattern.test(sample));
        if (blocked) {
            issues.push(`${filePath}: texto portugues encontrado (${blocked}): "${sample.slice(0, 180)}"`);
            return;
        }
    }
}

function checkUrls(filePath, $, issues) {
    const attributes = ['href', 'src', 'action', 'content'];
    attributes.forEach((attribute) => {
        `[${attribute}]`;
        $(`[${attribute}]`).each((_, element) => {
            const value = String($(element).attr(attribute) || '').trim();
            if (!value || /^(mailto:|tel:|javascript:|#)/i.test(value)) return;
            const isUrlLike = value.startsWith('/') || value.startsWith('https://iberflag.com');
            if (!isUrlLike) return;
            if (!ASCII_URL_PATTERN.test(value)) {
                issues.push(`${filePath}: URL nao ASCII em ${attribute}: ${value}`);
            }
            if (/\/es\/admin(?:\/|$)/i.test(value)) {
                issues.push(`${filePath}: link para admin espanhol: ${value}`);
            }
        });
    });
}

async function main() {
    const files = await collectHtmlFiles(ES_DIR);
    const issues = [];

    for (const file of files) {
        const relative = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
        if (/^es\/admin(?:\/|$)/i.test(relative) || /^es\/admin-template-editor(?:\/|$)/i.test(relative)) {
            issues.push(`${relative}: pagina admin gerada em espanhol`);
            continue;
        }

        const html = await fs.readFile(file, 'utf8');
        const $ = cheerio.load(html, { decodeEntities: false });
        checkUrls(relative, $, issues);
        checkPortugueseText(relative, $, issues);
    }

    if (issues.length > 0) {
        console.error(`Spanish translation audit failed with ${issues.length} issue(s):`);
        issues.slice(0, 80).forEach((issue) => console.error(`- ${issue}`));
        process.exitCode = 1;
        return;
    }

    console.log(`Spanish translation audit passed for ${files.length} HTML files.`);
}

main().catch((error) => {
    console.error('Spanish translation audit failed:', error);
    process.exitCode = 1;
});
