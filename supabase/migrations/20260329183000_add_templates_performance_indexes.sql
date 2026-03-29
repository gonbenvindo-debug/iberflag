-- Índices compostos para acelerar a galeria de templates
CREATE INDEX IF NOT EXISTS idx_templates_ativo_created_at
    ON templates (ativo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_produto_templates_produto_ordem
    ON produto_templates (produto_id, ordem);
