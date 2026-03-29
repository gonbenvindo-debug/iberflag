-- Temporary/admin compatibility policy:
-- allow anon clients (admin panel in test mode) to manage templates
-- and product-template links without requiring auth.uid().

-- templates
DROP POLICY IF EXISTS "Anon pode inserir templates" ON templates;
DROP POLICY IF EXISTS "Anon pode atualizar templates" ON templates;
DROP POLICY IF EXISTS "Anon pode apagar templates" ON templates;

CREATE POLICY "Anon pode inserir templates" ON templates
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Anon pode atualizar templates" ON templates
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon pode apagar templates" ON templates
    FOR DELETE TO anon
    USING (true);

-- produto_templates
DROP POLICY IF EXISTS "Anon pode inserir links produto_templates" ON produto_templates;
DROP POLICY IF EXISTS "Anon pode atualizar links produto_templates" ON produto_templates;
DROP POLICY IF EXISTS "Anon pode apagar links produto_templates" ON produto_templates;

CREATE POLICY "Anon pode inserir links produto_templates" ON produto_templates
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Anon pode atualizar links produto_templates" ON produto_templates
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon pode apagar links produto_templates" ON produto_templates
    FOR DELETE TO anon
    USING (true);
