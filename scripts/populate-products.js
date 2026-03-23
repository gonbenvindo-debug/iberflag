// ===== POPULATE DATABASE WITH TEST PRODUCTS =====
// Run with: node populate-products.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// SVG Templates for different flag sizes
const svgTemplates = {
    flybanner_small: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
        <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#grid)"/>
        <rect x="100" y="100" width="600" height="400" fill="white" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="400" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Área de Impressão: 600x400mm</text>
    </svg>`,
    
    flybanner_medium: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700">
        <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="900" height="700" fill="url(#grid)"/>
        <rect x="100" y="100" width="700" height="500" fill="white" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="450" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Área de Impressão: 700x500mm</text>
    </svg>`,
    
    flybanner_large: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800">
        <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="1000" height="800" fill="url(#grid)"/>
        <rect x="100" y="100" width="800" height="600" fill="white" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="500" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Área de Impressão: 800x600mm</text>
    </svg>`,
    
    rollup_standard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1100">
        <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="850" height="1100" fill="url(#grid)"/>
        <rect x="75" y="100" width="700" height="900" fill="white" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="425" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Área de Impressão: 700x900mm (Roll-Up)</text>
    </svg>`,
    
    rollup_premium: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1200">
        <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="1000" height="1200" fill="url(#grid)"/>
        <rect x="100" y="100" width="800" height="1000" fill="white" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="500" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Área de Impressão: 800x1000mm (Roll-Up Premium)</text>
    </svg>`,
    
    banner_horizontal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400">
        <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="1200" height="400" fill="url(#grid)"/>
        <rect x="100" y="50" width="1000" height="300" fill="white" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="600" y="30" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">Área de Impressão: 1000x300mm (Banner Horizontal)</text>
    </svg>`
};

// Test products with SVG templates
const testProducts = [
    {
        nome: 'Flybanner Pequeno',
        descricao: 'Flybanner compacto ideal para eventos e promoções. Dimensões: 600x400mm',
        preco: 45.00,
        categoria: 'flybanners',
        imagem: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        svg_template: svgTemplates.flybanner_small,
        stock: 50,
        destaque: true,
        ativo: true
    },
    {
        nome: 'Flybanner Médio',
        descricao: 'Flybanner de tamanho médio para maior visibilidade. Dimensões: 700x500mm',
        preco: 65.00,
        categoria: 'flybanners',
        imagem: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        svg_template: svgTemplates.flybanner_medium,
        stock: 40,
        destaque: true,
        ativo: true
    },
    {
        nome: 'Flybanner Grande',
        descricao: 'Flybanner de grande dimensão para máximo impacto visual. Dimensões: 800x600mm',
        preco: 85.00,
        categoria: 'flybanners',
        imagem: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        svg_template: svgTemplates.flybanner_large,
        stock: 30,
        destaque: true,
        ativo: true
    },
    {
        nome: 'Roll-Up Standard 85x200cm',
        descricao: 'Roll-up clássico com estrutura em alumínio. Área de impressão: 700x900mm',
        preco: 75.00,
        categoria: 'rollups',
        imagem: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800',
        svg_template: svgTemplates.rollup_standard,
        stock: 25,
        destaque: true,
        ativo: true
    },
    {
        nome: 'Roll-Up Premium 100x200cm',
        descricao: 'Roll-up premium com base reforçada e impressão de alta qualidade. Área: 800x1000mm',
        preco: 95.00,
        categoria: 'rollups',
        imagem: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800',
        svg_template: svgTemplates.rollup_premium,
        stock: 20,
        destaque: false,
        ativo: true
    },
    {
        nome: 'Banner Horizontal 3x1m',
        descricao: 'Banner horizontal perfeito para fachadas e eventos. Dimensões: 1000x300mm',
        preco: 55.00,
        categoria: 'banners',
        imagem: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
        svg_template: svgTemplates.banner_horizontal,
        stock: 35,
        destaque: false,
        ativo: true
    }
];

async function populateProducts() {
    console.log('🚀 Iniciando população da base de dados...\n');
    
    try {
        // Delete existing products (optional - comment out if you want to keep existing)
        console.log('🗑️  Limpando produtos existentes...');
        const { error: deleteError } = await supabase
            .from('produtos')
            .delete()
            .neq('id', 0); // Delete all
        
        if (deleteError && deleteError.code !== 'PGRST116') { // PGRST116 = no rows found (ok)
            console.error('Erro ao limpar produtos:', deleteError);
        } else {
            console.log('✅ Produtos existentes removidos\n');
        }
        
        // Insert new products
        console.log('📦 Inserindo novos produtos...\n');
        
        for (const product of testProducts) {
            const { data, error } = await supabase
                .from('produtos')
                .insert([product])
                .select();
            
            if (error) {
                console.error(`❌ Erro ao inserir "${product.nome}":`, error.message);
            } else {
                console.log(`✅ Produto inserido: ${product.nome}`);
                console.log(`   - Categoria: ${product.categoria}`);
                console.log(`   - Preço: ${product.preco.toFixed(2)}€`);
                console.log(`   - Template SVG: ${product.svg_template ? 'Sim' : 'Não'}`);
                console.log('');
            }
        }
        
        console.log('\n🎉 População da base de dados concluída!');
        console.log(`📊 Total de produtos inseridos: ${testProducts.length}`);
        
    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

// Run the script
populateProducts();
