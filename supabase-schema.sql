-- ===== LATINFLAG DATABASE SCHEMA =====
-- Execute this SQL in your Supabase SQL Editor to create all necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== PRODUTOS TABLE =====
CREATE TABLE IF NOT EXISTS produtos (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    imagem TEXT,
    destaque BOOLEAN DEFAULT false,
    stock INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CLIENTES TABLE =====
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    empresa VARCHAR(255),
    nif VARCHAR(20),
    morada TEXT,
    codigo_postal VARCHAR(10),
    cidade VARCHAR(100),
    pais VARCHAR(100) DEFAULT 'Portugal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ENCOMENDAS TABLE =====
CREATE TABLE IF NOT EXISTS encomendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id),
    numero_encomenda VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    subtotal DECIMAL(10, 2) NOT NULL,
    envio DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    notas TEXT,
    morada_envio TEXT,
    metodo_pagamento VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ITENS_ENCOMENDA TABLE =====
CREATE TABLE IF NOT EXISTS itens_encomenda (
    id BIGSERIAL PRIMARY KEY,
    encomenda_id UUID REFERENCES encomendas(id) ON DELETE CASCADE,
    produto_id BIGINT REFERENCES produtos(id),
    quantidade INTEGER NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== UTILIZADORES (ADMIN) TABLE =====
CREATE TABLE IF NOT EXISTS utilizadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CONTACTOS TABLE =====
CREATE TABLE IF NOT EXISTS contactos (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    assunto VARCHAR(255),
    mensagem TEXT NOT NULL,
    respondido BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_destaque ON produtos(destaque);
CREATE INDEX IF NOT EXISTS idx_encomendas_status ON encomendas(status);
CREATE INDEX IF NOT EXISTS idx_encomendas_cliente ON encomendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_itens_encomenda ON itens_encomenda(encomenda_id);

-- ===== FUNCTIONS =====
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ===== TRIGGERS =====
-- Triggers for updated_at
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_encomendas_updated_at BEFORE UPDATE ON encomendas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_utilizadores_updated_at BEFORE UPDATE ON utilizadores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== INSERT SAMPLE PRODUCTS =====
INSERT INTO produtos (nome, descricao, preco, categoria, imagem, destaque, stock) VALUES
('Flybanner Gota 2.5m', 'Bandeira publicitária em formato gota, ideal para eventos outdoor. Inclui estrutura em fibra de vidro e base com água.', 45.00, 'flybanners', 'https://images.unsplash.com/photo-1596435707700-6264292b919d?auto=format&fit=crop&q=80', true, 50),
('Flybanner Vela 3m', 'Bandeira em formato vela, máxima visibilidade. Estrutura em fibra de vidro resistente ao vento.', 52.00, 'flybanners', 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80', true, 45),
('Flybanner Retangular 2m', 'Bandeira retangular para máxima área de impressão. Base com água ou areia incluída.', 48.00, 'flybanners', 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80', false, 30),
('Flybanner Pena 4m', 'Modelo alto em formato pena, ideal para máxima visibilidade em eventos. Estrutura premium.', 68.00, 'flybanners', 'https://images.unsplash.com/photo-1596435707700-6264292b919d?auto=format&fit=crop&q=80', true, 25),
('Roll-up Premium 85x200cm', 'Expositor vertical auto-enrolável com impressão de alta qualidade. Inclui maleta de transporte.', 65.00, 'rollups', 'https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80', true, 60),
('Roll-up Económico 80x200cm', 'Solução económica para eventos. Estrutura leve e fácil montagem em segundos.', 45.00, 'rollups', 'https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80', false, 80),
('Roll-up Dupla Face 85x200cm', 'Expositor com impressão frente e verso. Máximo aproveitamento do espaço.', 95.00, 'rollups', 'https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80', false, 20),
('Lona PVC 440g/m²', 'Lona PVC de alta resistência com ilhós para fixação. Impressão digital de alta resolução.', 25.00, 'lonas', 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?auto=format&fit=crop&q=80', false, 100),
('Banner Mesh Microperforado', 'Banner mesh ideal para locais com vento. Permite passagem de ar mantendo visibilidade.', 32.00, 'lonas', 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?auto=format&fit=crop&q=80', false, 75),
('Lona Frontlit Premium 510g/m²', 'Lona premium para impressão de alta qualidade. Ideal para fachadas e grandes formatos.', 35.00, 'lonas', 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?auto=format&fit=crop&q=80', true, 90),
('X-Banner 60x160cm', 'Expositor em X portátil e leve. Montagem rápida sem ferramentas.', 28.00, 'rollups', 'https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80', false, 40),
('L-Banner 60x160cm', 'Expositor em L com base sólida. Estabilidade garantida em ambientes indoor.', 32.00, 'rollups', 'https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1?auto=format&fit=crop&q=80', false, 35)
ON CONFLICT DO NOTHING;

-- ===== ROW LEVEL SECURITY (RLS) =====
-- Enable RLS on tables
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE encomendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_encomenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;

-- Public read access to produtos
CREATE POLICY "Public can view active products" ON produtos
    FOR SELECT USING (ativo = true);

-- Admin full access to produtos
CREATE POLICY "Admin full access to products" ON produtos
    FOR ALL USING (auth.role() = 'authenticated');

-- Contactos - anyone can insert
CREATE POLICY "Anyone can submit contact form" ON contactos
    FOR INSERT WITH CHECK (true);

-- Admin can view contactos
CREATE POLICY "Admin can view contacts" ON contactos
    FOR SELECT USING (auth.role() = 'authenticated');

-- ===== VIEWS =====
-- View for order statistics
CREATE OR REPLACE VIEW estatisticas_encomendas AS
SELECT 
    COUNT(*) as total_encomendas,
    SUM(total) as valor_total,
    AVG(total) as valor_medio,
    COUNT(CASE WHEN status = 'pendente' THEN 1 END) as pendentes,
    COUNT(CASE WHEN status = 'processando' THEN 1 END) as processando,
    COUNT(CASE WHEN status = 'concluido' THEN 1 END) as concluidas
FROM encomendas;

-- View for product statistics
CREATE OR REPLACE VIEW estatisticas_produtos AS
SELECT 
    COUNT(*) as total_produtos,
    COUNT(CASE WHEN ativo = true THEN 1 END) as produtos_ativos,
    COUNT(CASE WHEN destaque = true THEN 1 END) as produtos_destaque,
    SUM(stock) as stock_total
FROM produtos;

-- ===== COMMENTS =====
COMMENT ON TABLE produtos IS 'Catálogo de produtos disponíveis para venda';
COMMENT ON TABLE clientes IS 'Informação de clientes registados';
COMMENT ON TABLE encomendas IS 'Encomendas realizadas pelos clientes';
COMMENT ON TABLE itens_encomenda IS 'Itens individuais de cada encomenda';
COMMENT ON TABLE utilizadores IS 'Utilizadores admin do sistema';
COMMENT ON TABLE contactos IS 'Mensagens de contacto recebidas';
