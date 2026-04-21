// ============================================================
// TEMPLATE SYSTEM - IberFlag Design Templates
// ============================================================

const DesignTemplates = {
    categories: [
        { id: 'promocoes', name: 'Promoções', icon: 'percent' },
        { id: 'eventos', name: 'Eventos', icon: 'calendar' },
        { id: 'corporativo', name: 'Corporativo', icon: 'building-2' },
        { id: 'festas', name: 'Festas', icon: 'party-popper' },
        { id: 'varejo', name: 'Varejo', icon: 'shopping-bag' }
    ],

    templates: [
        // ========== PROMOÇÕES ==========
        {
            id: 'promo-summer-sale',
            name: 'Promoção Verão',
            category: 'promocoes',
            thumbnail: '/assets/templates/promo-summer-thumb.jpg',
            description: 'Banner vibrante para promoções de verão com destaque no desconto',
            tags: ['desconto', 'verão', 'sale'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#fef3c7',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 400,
                    width: 700,
                    height: 150,
                    fill: '#f59e0b',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'PROMOÇÃO',
                    x: 400,
                    y: 180,
                    font: 'Impact',
                    size: 72,
                    color: '#dc2626',
                    bold: true,
                    italic: false,
                    rotation: -5,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'VERÃO',
                    x: 400,
                    y: 260,
                    font: 'Impact',
                    size: 96,
                    color: '#2563eb',
                    bold: true,
                    italic: false,
                    rotation: -5,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'ATÉ 50% OFF',
                    x: 400,
                    y: 480,
                    font: 'Arial Black',
                    size: 56,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 650,
                    y: 150,
                    width: 120,
                    height: 120,
                    fill: '#dc2626',
                    stroke: '#ffffff',
                    strokeWidth: 4,
                    rotation: 15
                },
                {
                    type: 'text',
                    content: '50%',
                    x: 650,
                    y: 165,
                    font: 'Impact',
                    size: 42,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 15,
                    textAnchor: 'middle'
                }
            ]
        },
        {
            id: 'promo-black-friday',
            name: 'Black Friday',
            category: 'promocoes',
            thumbnail: '/assets/templates/promo-blackfriday-thumb.jpg',
            description: 'Design impactante para Black Friday',
            tags: ['black friday', 'desconto', 'black'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#111827',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 8,
                    fill: '#fbbf24',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 542,
                    width: 700,
                    height: 8,
                    fill: '#fbbf24',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'BLACK',
                    x: 400,
                    y: 220,
                    font: 'Impact',
                    size: 100,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'FRIDAY',
                    x: 400,
                    y: 330,
                    font: 'Impact',
                    size: 100,
                    color: '#fbbf24',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'DESCONTOS DE ATÉ 70%',
                    x: 400,
                    y: 420,
                    font: 'Arial',
                    size: 28,
                    color: '#ffffff',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                }
            ]
        },

        // ========== EVENTOS ==========
        {
            id: 'event-conference',
            name: 'Conferência Business',
            category: 'eventos',
            thumbnail: '/assets/templates/event-conference-thumb.jpg',
            description: 'Design profissional para conferências corporativas',
            tags: ['conferência', 'business', 'corporativo'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#ffffff',
                    stroke: '#e5e7eb',
                    strokeWidth: 2,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 250,
                    height: 500,
                    fill: '#1e40af',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: '2025',
                    x: 175,
                    y: 480,
                    font: 'Arial Black',
                    size: 64,
                    color: '#60a5fa',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'CONFERÊNCIA',
                    x: 475,
                    y: 200,
                    font: 'Arial',
                    size: 48,
                    color: '#1e3a8a',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'ANUAL',
                    x: 475,
                    y: 270,
                    font: 'Arial',
                    size: 36,
                    color: '#6b7280',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: '15 de Junho | Lisboa',
                    x: 475,
                    y: 380,
                    font: 'Arial',
                    size: 22,
                    color: '#4b5563',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 400,
                    y: 420,
                    width: 150,
                    height: 4,
                    fill: '#f59e0b',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                }
            ]
        },
        {
            id: 'event-festival',
            name: 'Festival de Música',
            category: 'eventos',
            thumbnail: '/assets/templates/event-festival-thumb.jpg',
            description: 'Design vibrante para festivais e eventos musicais',
            tags: ['festival', 'música', 'evento'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#4c1d95',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 150,
                    y: 150,
                    width: 80,
                    height: 80,
                    fill: '#ec4899',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 650,
                    y: 450,
                    width: 120,
                    height: 120,
                    fill: '#8b5cf6',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 600,
                    y: 120,
                    width: 60,
                    height: 60,
                    fill: '#fbbf24',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'SUMMER',
                    x: 400,
                    y: 250,
                    font: 'Impact',
                    size: 80,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: -3,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'FEST',
                    x: 400,
                    y: 350,
                    font: 'Impact',
                    size: 110,
                    color: '#fbbf24',
                    bold: true,
                    italic: false,
                    rotation: 3,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: '20-22 Agosto 2025',
                    x: 400,
                    y: 450,
                    font: 'Arial',
                    size: 24,
                    color: '#c4b5fd',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                }
            ]
        },

        // ========== CORPORATIVO ==========
        {
            id: 'corp-welcome',
            name: 'Bem-vindo',
            category: 'corporativo',
            thumbnail: '/assets/templates/corp-welcome-thumb.jpg',
            description: 'Banner de boas-vindas para recepção',
            tags: ['welcome', 'recepção', 'corporativo'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#f8fafc',
                    stroke: '#e2e8f0',
                    strokeWidth: 1,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 200,
                    y: 50,
                    width: 400,
                    height: 8,
                    fill: '#3b82f6',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'BEM-VINDO',
                    x: 400,
                    y: 280,
                    font: 'Georgia',
                    size: 72,
                    color: '#1e293b',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'À nossa empresa',
                    x: 400,
                    y: 350,
                    font: 'Arial',
                    size: 28,
                    color: '#64748b',
                    bold: false,
                    italic: true,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 400,
                    y: 150,
                    width: 100,
                    height: 100,
                    fill: '#dbeafe',
                    stroke: '#3b82f6',
                    strokeWidth: 3,
                    rotation: 0
                }
            ]
        },
        {
            id: 'corp-opening',
            name: 'Inauguração',
            category: 'corporativo',
            thumbnail: '/assets/templates/corp-opening-thumb.jpg',
            description: 'Banner para inauguração de novas instalações',
            tags: ['inauguração', 'novo', 'abertura'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#ffffff',
                    stroke: '#10b981',
                    strokeWidth: 4,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 450,
                    width: 700,
                    height: 100,
                    fill: '#10b981',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'INAUGURAÇÃO',
                    x: 400,
                    y: 240,
                    font: 'Arial Black',
                    size: 64,
                    color: '#065f46',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'GRANDE ABERTURA',
                    x: 400,
                    y: 320,
                    font: 'Arial',
                    size: 32,
                    color: '#059669',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'Dia 15 de Março',
                    x: 400,
                    y: 505,
                    font: 'Arial',
                    size: 26,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 650,
                    y: 120,
                    width: 60,
                    height: 60,
                    fill: '#fbbf24',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 100,
                    y: 400,
                    width: 40,
                    height: 40,
                    fill: '#34d399',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                }
            ]
        },

        // ========== FESTAS ==========
        {
            id: 'party-birthday',
            name: 'Aniversário',
            category: 'festas',
            thumbnail: '/assets/templates/party-birthday-thumb.jpg',
            description: 'Banner colorido para festas de aniversário',
            tags: ['aniversário', 'festa', 'celebração'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#fce7f3',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 120,
                    y: 100,
                    width: 50,
                    height: 50,
                    fill: '#f472b6',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 680,
                    y: 150,
                    width: 70,
                    height: 70,
                    fill: '#a78bfa',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 150,
                    y: 480,
                    width: 60,
                    height: 60,
                    fill: '#34d399',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 650,
                    y: 450,
                    width: 45,
                    height: 45,
                    fill: '#fbbf24',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'FELIZ',
                    x: 400,
                    y: 250,
                    font: 'Comic Sans MS',
                    size: 72,
                    color: '#db2777',
                    bold: true,
                    italic: false,
                    rotation: -5,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'ANIVERSÁRIO!',
                    x: 400,
                    y: 340,
                    font: 'Comic Sans MS',
                    size: 64,
                    color: '#7c3aed',
                    bold: true,
                    italic: false,
                    rotation: 5,
                    textAnchor: 'middle'
                }
            ]
        },
        {
            id: 'party-new-year',
            name: 'Ano Novo',
            category: 'festas',
            thumbnail: '/assets/templates/party-newyear-thumb.jpg',
            description: 'Design elegante para celebração de ano novo',
            tags: ['ano novo', '2025', 'festa'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#0f172a',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: '2025',
                    x: 400,
                    y: 320,
                    font: 'Arial Black',
                    size: 140,
                    color: '#fbbf24',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'FELIZ ANO NOVO',
                    x: 400,
                    y: 180,
                    font: 'Arial',
                    size: 42,
                    color: '#ffffff',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 150,
                    y: 420,
                    width: 30,
                    height: 30,
                    fill: '#ef4444',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 650,
                    y: 420,
                    width: 30,
                    height: 30,
                    fill: '#3b82f6',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 250,
                    y: 480,
                    width: 20,
                    height: 20,
                    fill: '#10b981',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'circle',
                    x: 550,
                    y: 480,
                    width: 20,
                    height: 20,
                    fill: '#f59e0b',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                }
            ]
        },

        // ========== VAREJO ==========
        {
            id: 'retalho-grand-opening',
            name: 'Grande Abertura',
            category: 'varejo',
            thumbnail: '/assets/templates/retalho-opening-thumb.jpg',
            description: 'Banner para inauguração de loja',
            tags: ['loja', 'abertura', 'varejo'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#fefce8',
                    stroke: '#eab308',
                    strokeWidth: 3,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 120,
                    fill: '#eab308',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'GRANDE',
                    x: 400,
                    y: 115,
                    font: 'Impact',
                    size: 64,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'ABERTURA',
                    x: 400,
                    y: 280,
                    font: 'Arial Black',
                    size: 72,
                    color: '#854d0e',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'Descontos especiais de inauguração',
                    x: 400,
                    y: 360,
                    font: 'Arial',
                    size: 24,
                    color: '#a16207',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'Rua Principal, 123',
                    x: 400,
                    y: 480,
                    font: 'Arial',
                    size: 20,
                    color: '#854d0e',
                    bold: false,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                }
            ]
        },
        {
            id: 'retalho-clearance',
            name: 'Liquidação Total',
            category: 'varejo',
            thumbnail: '/assets/templates/retalho-clearance-thumb.jpg',
            description: 'Design impactante para liquidação de estoque',
            tags: ['liquidação', 'total', 'estoque'],
            elements: [
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: '#dc2626',
                    stroke: 'none',
                    strokeWidth: 0,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 50,
                    y: 50,
                    width: 700,
                    height: 500,
                    fill: 'none',
                    stroke: '#ffffff',
                    strokeWidth: 8,
                    rotation: 0
                },
                {
                    type: 'shape',
                    shapeType: 'rectangle',
                    x: 70,
                    y: 70,
                    width: 660,
                    height: 460,
                    fill: 'none',
                    stroke: '#ffffff',
                    strokeWidth: 4,
                    rotation: 0
                },
                {
                    type: 'text',
                    content: 'LIQUIDAÇÃO',
                    x: 400,
                    y: 230,
                    font: 'Impact',
                    size: 80,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'TOTAL',
                    x: 400,
                    y: 340,
                    font: 'Impact',
                    size: 100,
                    color: '#fef08a',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                },
                {
                    type: 'text',
                    content: 'ATÉ 70% DE DESCONTO',
                    x: 400,
                    y: 460,
                    font: 'Arial Black',
                    size: 28,
                    color: '#ffffff',
                    bold: true,
                    italic: false,
                    rotation: 0,
                    textAnchor: 'middle'
                }
            ]
        }
    ],

    // Métodos utilitários
    getById(id) {
        return this.templates.find(t => t.id === id);
    },

    getByCategory(categoryId) {
        return this.templates.filter(t => t.category === categoryId);
    },

    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.templates.filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }
};

// Exportar para us? global
window.DesignTemplates = DesignTemplates;
