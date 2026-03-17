// Configuração Supabase
const SUPABASE_URL = 'https://nzwfquivulxkmxrwqalz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56d2ZxdWl2dWx4a214cndxYWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzMzODQsImV4cCI6MjA4OTM0OTM4NH0.pelN5argByWYMij-wE1GRhQ-L8bEFGMDMJliOZrBBXU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos do DOM
const productsContainer = document.getElementById('products-container');

// Dados iniciais (fallback caso o Supabase não esteja configurado)
const initialProducts = [
    {
        id: 1,
        nome: "Bandeira Drop",
        descricao: "Bandeira publicitária em formato gota, ideal para eventos outdoor.",
        preco: 45.00,
        imagem: "https://images.unsplash.com/photo-1596435707700-6264292b919d?auto=format&fit=crop&q=80"
    },
    {
        id: 2,
        nome: "Roll-up Premium",
        descricao: "Expositor vertical auto-enrolável com impressão de alta qualidade.",
        preco: 65.00,
        imagem: "https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80"
    },
    {
        id: 3,
        nome: "Lona Publicitária",
        descricao: "Lona PVC de alta resistência com ilhós para fixação.",
        preco: 25.00,
        imagem: "https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?auto=format&fit=crop&q=80"
    }
];

// Função para renderizar produtos
function renderProducts(products) {
    if (!products || products.length === 0) {
        productsContainer.innerHTML = '<p class="text-center col-span-full py-10">Nenhum produto encontrado.</p>';
        return;
    }

    productsContainer.innerHTML = products.map(product => `
        <div class="product-card bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 flex flex-col">
            <div class="relative h-64 overflow-hidden">
                <img src="${product.imagem}" alt="${product.nome}" class="w-full h-full object-cover transition transform hover:scale-105 duration-500">
                <div class="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold text-blue-600 shadow-sm">
                    A partir de ${product.preco.toFixed(2)}€
                </div>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="text-xl font-bold mb-2 text-gray-900">${product.nome}</h3>
                <p class="text-gray-600 text-sm mb-6 flex-grow">${product.descricao}</p>
                <button onclick="solicitarOrcamento('${product.nome}')" class="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                    Solicitar Orçamento
                </button>
            </div>
        </div>
    `).join('');
}

// Função para buscar produtos do Supabase
async function fetchProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
            renderProducts(data);
        } else {
            // Se não houver dados, usa os iniciais para demonstração
            renderProducts(initialProducts);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error.message);
        renderProducts(initialProducts); // Fallback
    }
}

// Função para lidar com orçamentos
function solicitarOrcamento(produto) {
    const mensagem = `Olá! Gostaria de solicitar um orçamento para o produto: ${produto}`;
    const whatsappUrl = `https://wa.me/351900000000?text=${encodeURIComponent(mensagem)}`;
    window.open(whatsappUrl, '_blank');
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
});
