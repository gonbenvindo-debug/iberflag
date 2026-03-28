// Script de diagnóstico para verificar estado da base de dados Supabase
const SUPABASE_URL = 'https://nzwfquivulxkmxrwqalz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56d2ZxdWl2dWx4a214cndxYWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzMzODQsImV4cCI6MjA4OTM0OTM4NH0.pelN5argByWYMij-wE1GRhQ-L8bEFGMDMJliOZrBBXU';

async function checkDatabase() {
    console.log('=== DIAGNOSTICO SUPABASE ===\n');

    // Verificar tabela produtos
    console.log('1. Verificando tabela produtos...');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*&limit=5`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            console.error(`   ERRO HTTP: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error(`   Detalhes: ${errorText}`);
        } else {
            const data = await response.json();
            console.log(`   OK - Encontrados ${data.length} produtos`);
            if (data.length > 0) {
                console.log('   Primeiro produto:', JSON.stringify(data[0], null, 2));
            }
        }
    } catch (error) {
        console.error(`   ERRO: ${error.message}`);
    }

    // Verificar tabela templates
    console.log('\n2. Verificando tabela templates...');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/templates?select=*&limit=3`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            console.error(`   ERRO HTTP: ${response.status} ${response.statusText}`);
        } else {
            const data = await response.json();
            console.log(`   OK - Encontrados ${data.length} templates`);
        }
    } catch (error) {
        console.error(`   ERRO: ${error.message}`);
    }

    // Verificar tabela produto_templates
    console.log('\n3. Verificando tabela produto_templates...');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/produto_templates?select=*&limit=3`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            console.error(`   ERRO HTTP: ${response.status} ${response.statusText}`);
        } else {
            const data = await response.json();
            console.log(`   OK - Encontradas ${data.length} associacoes`);
        }
    } catch (error) {
        console.error(`   ERRO: ${error.message}`);
    }

    // Verificar se existe coluna created_at na tabela produtos
    console.log('\n4. Verificando schema da tabela produtos...');
    try {
        // Tentar ordenar por created_at - vai falhar se a coluna nao existir
        const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*&order=created_at.desc&limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            console.error(`   ERRO: Coluna created_at pode nao existir (${response.status})`);
        } else {
            console.log('   OK - Coluna created_at existe');
        }
    } catch (error) {
        console.error(`   ERRO: ${error.message}`);
    }

    console.log('\n=== FIM DO DIAGNOSTICO ===');
}

checkDatabase();
