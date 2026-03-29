-- Criar tabela de templates
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('promocoes', 'eventos', 'corporativo', 'festas', 'varejo')),
    descricao TEXT,
    tags TEXT[],
    elementos JSONB NOT NULL DEFAULT '[]',
    largura INTEGER DEFAULT 800,
    altura INTEGER DEFAULT 600,
    thumbnail_url TEXT,
    preview_url TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Politica para leitura publica (todos podem ver templates ativos)
CREATE POLICY "Templates visiveis para todos" ON templates
    FOR SELECT USING (ativo = true);

-- Politica para usuarios autenticados gerenciarem templates
CREATE POLICY "Usuarios autenticados podem gerenciar templates" ON templates
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Criar trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_templates_updated_at 
    BEFORE UPDATE ON templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Criar indice para busca por categoria
CREATE INDEX idx_templates_categoria ON templates(categoria);
CREATE INDEX idx_templates_ativo ON templates(ativo);
CREATE INDEX idx_templates_created_at ON templates(created_at DESC);

COMMENT ON TABLE templates IS 'Tabela de templates de design para o personalizador';
COMMENT ON COLUMN templates.elementos IS 'Payload JSON do design. Pode conter SVG inline canónico e metadados/elementos legados.';
