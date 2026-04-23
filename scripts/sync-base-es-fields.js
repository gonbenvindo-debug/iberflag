const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({
    path: [
        path.join(ROOT_DIR, '.env.local'),
        path.join(ROOT_DIR, '.env.vercel.local'),
        path.join(ROOT_DIR, '.env')
    ],
    override: false
});

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ACCESS_TOKEN = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = (SUPABASE_URL.match(/^https:\/\/([^.]+)\.supabase\.co$/i) || [])[1] || '';

if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL e obrigatorio.');
}

if (!SUPABASE_ACCESS_TOKEN || !PROJECT_REF) {
    throw new Error('SUPABASE_ACCESS_TOKEN e project ref sao obrigatorios para aplicar os nomes ES das bases.');
}

const BASE_TRANSLATIONS = {
    'base-cruzeta': 'Base de cruz',
    'flybanner-cruzeta-com-flutuador': 'Base cruzada con flotador',
    'flybanner-base-parede': 'Base de pared',
    'flybanner-base-parafuso-roscado': 'Base de tornillo roscado',
    'flybanner-base-pica': 'Base pincho',
    'flybanner-base-hercules-12kg': 'Base Hércules 12 kg',
    'flybanner-base-agua': 'Base de agua',
    'flybanner-base-deluxe-4kg': 'Base deluxe 4 kg',
    'flybanner-base-universal-com-abracadeiras': 'Base universal con bridas',
    'flybanner-base-distancia-entre-eixos-do-carro': 'Base para coche',
    'flybanner-base-para-tenda': 'Base para carpa'
};

function quoteLiteral(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

async function runManagementQuery(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Management API query failed (${response.status}): ${text}`);
    }

    return text;
}

async function runReadOnlyQuery(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query/read-only`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Management API read-only query failed (${response.status}): ${text}`);
    }

    return text ? JSON.parse(text) : [];
}

function buildValuesClause() {
    return Object.entries(BASE_TRANSLATIONS)
        .map(([slug, nomeEs]) => `(${quoteLiteral(slug)}, ${quoteLiteral(nomeEs)})`)
        .join(',\n                ');
}

async function ensureSchemaAndView() {
    await runManagementQuery(`
        alter table if exists public.bases_fixacao
            add column if not exists nome_es text;

        update public.bases_fixacao as bases
        set nome_es = payload.nome_es
        from (
            values
                ${buildValuesClause()}
        ) as payload(slug, nome_es)
        where bases.slug = payload.slug;

        create or replace view public.vw_produto_bases as
        select
            pb.id,
            pb.produto_id,
            pb.base_id,
            pb.ativo,
            pb.ordem,
            pb.is_default,
            coalesce(pb.preco_extra_override, b.preco_extra) as preco_extra_aplicado,
            b.nome as base_nome,
            b.slug as base_slug,
            b.descricao as base_descricao,
            b.imagem as base_imagem,
            b.preco_extra as base_preco_extra,
            b.ativo as base_ativa,
            b.disponivel as base_disponivel,
            b.nota_indisponibilidade as base_nota_indisponibilidade,
            b.nome_es as base_nome_es
        from public.produto_bases_fixacao pb
        join public.bases_fixacao b on b.id = pb.base_id;

        notify pgrst, 'reload schema';
    `);
}

async function verify() {
    const rows = await runReadOnlyQuery(`
        select slug, nome, nome_es
        from public.bases_fixacao
        where slug in (${Object.keys(BASE_TRANSLATIONS).map(quoteLiteral).join(', ')})
        order by ordem asc, id asc;
    `);

    const viewColumn = await runReadOnlyQuery(`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'vw_produto_bases'
          and column_name = 'base_nome_es';
    `);

    return {
        bases: Array.isArray(rows) ? rows.length : 0,
        hasViewColumn: Array.isArray(viewColumn) && viewColumn.length === 1,
        rows
    };
}

async function main() {
    await ensureSchemaAndView();
    console.log(JSON.stringify(await verify(), null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
