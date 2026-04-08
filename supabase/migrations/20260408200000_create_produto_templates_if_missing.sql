create table if not exists public.produto_templates (
    id uuid primary key default gen_random_uuid(),
    produto_id integer not null references public.produtos(id) on delete cascade,
    template_id uuid not null references public.templates(id) on delete cascade,
    ordem integer default 0,
    created_at timestamptz default now(),
    unique (produto_id, template_id)
);

alter table public.produto_templates enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'produto_templates'
          and policyname = 'Associacoes visiveis para todos'
    ) then
        create policy "Associacoes visiveis para todos"
            on public.produto_templates
            for select
            using (true);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'produto_templates'
          and policyname = 'Usuarios autenticados podem gerenciar'
    ) then
        create policy "Usuarios autenticados podem gerenciar"
            on public.produto_templates
            for all
            using (auth.uid() is not null);
    end if;
end $$;

create index if not exists idx_produto_templates_produto
    on public.produto_templates(produto_id);

create index if not exists idx_produto_templates_template
    on public.produto_templates(template_id);

comment on table public.produto_templates is 'Tabela de associacao entre produtos e templates disponiveis';
