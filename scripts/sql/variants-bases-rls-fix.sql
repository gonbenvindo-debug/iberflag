-- Fix de RLS para permitir escrita via painel admin autenticado
-- Executar no projeto Supabase linked

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'bases_fixacao' and policyname = 'bases_fixacao_admin_authenticated_write'
    ) then
        create policy bases_fixacao_admin_authenticated_write on public.bases_fixacao
            for all
            using (auth.role() = 'authenticated')
            with check (auth.role() = 'authenticated');
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'produto_bases_fixacao' and policyname = 'produto_bases_fixacao_admin_authenticated_write'
    ) then
        create policy produto_bases_fixacao_admin_authenticated_write on public.produto_bases_fixacao
            for all
            using (auth.role() = 'authenticated')
            with check (auth.role() = 'authenticated');
    end if;
end $$;
