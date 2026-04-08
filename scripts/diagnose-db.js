const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({
    path: [
        path.join(rootDir, '.env.local'),
        path.join(rootDir, '.env.vercel.local'),
        path.join(rootDir, '.env.test.local'),
        path.join(rootDir, '.env')
    ],
    override: false
});

function firstEnv(keys) {
    return String(keys.map((key) => process.env[key]).find((value) => String(value || '').trim()) || '').trim();
}

const SUPABASE_URL = firstEnv(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']).replace(/\/+$/, '');
const SUPABASE_ANON_KEY = firstEnv(['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function fetchAnon(pathname) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json'
        }
    });

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    return { response, payload, text };
}

async function checkTable(label, pathname) {
    const { response, payload, text } = await fetchAnon(pathname);
    if (!response.ok) {
        console.error(`   ERRO HTTP: ${response.status} ${response.statusText}`);
        if (text) {
            console.error(`   Detalhes: ${text.slice(0, 300)}`);
        }
        return;
    }

    const count = Array.isArray(payload) ? payload.length : 0;
    console.log(`   OK - ${label}: ${count} registos visiveis por anon`);
}

async function checkDatabase() {
    console.log('=== DIAGNOSTICO SUPABASE ===\n');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('SUPABASE_URL/SUPABASE_ANON_KEY em falta. Use .env.local ou .env.vercel.local.');
        process.exitCode = 1;
        return;
    }

    console.log('1. Verificando produtos publicos...');
    await checkTable('produtos', 'produtos?select=id,nome,preco,ativo&limit=5');

    console.log('\n2. Verificando templates publicos...');
    await checkTable('templates', 'templates?select=id,nome,ativo&limit=3');

    console.log('\n3. Verificando associacoes produto_templates...');
    await checkTable('produto_templates', 'produto_templates?select=produto_id,template_id&limit=3');

    console.log('\n4. Verificando se produtos tem created_at...');
    const { response } = await fetchAnon('produtos?select=id&order=created_at.desc&limit=1');
    console.log(response.ok ? '   OK - Coluna created_at existe' : `   ERRO - created_at indisponivel (${response.status})`);

    console.log('\n=== FIM DO DIAGNOSTICO ===');
}

checkDatabase().catch((error) => {
    console.error(`ERRO: ${error.message}`);
    process.exitCode = 1;
});
