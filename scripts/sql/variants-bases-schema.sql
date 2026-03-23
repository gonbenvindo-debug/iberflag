-- Variantes complementares: bases de fixacao para bandeiras
-- Executar no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.bases_fixacao (
    id bigserial primary key,
    nome text not null,
    slug text not null unique,
    descricao text,
    imagem text not null,
    preco_extra numeric(10,2) not null default 0,
    ativo boolean not null default true,
    ordem integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.produto_bases_fixacao (
    id bigserial primary key,
    produto_id bigint not null references public.produtos(id) on delete cascade,
    base_id bigint not null references public.bases_fixacao(id) on delete cascade,
    ativo boolean not null default true,
    ordem integer not null default 0,
    is_default boolean not null default false,
    preco_extra_override numeric(10,2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (produto_id, base_id)
);

create index if not exists idx_bases_fixacao_ativo_ordem
    on public.bases_fixacao (ativo, ordem, nome);

create index if not exists idx_produto_bases_fixacao_produto
    on public.produto_bases_fixacao (produto_id, ativo, ordem);

create index if not exists idx_produto_bases_fixacao_base
    on public.produto_bases_fixacao (base_id);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_bases_fixacao_updated_at on public.bases_fixacao;
create trigger trg_bases_fixacao_updated_at
before update on public.bases_fixacao
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists trg_produto_bases_fixacao_updated_at on public.produto_bases_fixacao;
create trigger trg_produto_bases_fixacao_updated_at
before update on public.produto_bases_fixacao
for each row
execute function public.set_updated_at_timestamp();

alter table public.bases_fixacao enable row level security;
alter table public.produto_bases_fixacao enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'bases_fixacao' and policyname = 'bases_fixacao_public_select'
    ) then
        create policy bases_fixacao_public_select on public.bases_fixacao
            for select
            using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'bases_fixacao' and policyname = 'bases_fixacao_service_all'
    ) then
        create policy bases_fixacao_service_all on public.bases_fixacao
            for all
            using (auth.role() = 'service_role')
            with check (auth.role() = 'service_role');
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'produto_bases_fixacao' and policyname = 'produto_bases_fixacao_public_select'
    ) then
        create policy produto_bases_fixacao_public_select on public.produto_bases_fixacao
            for select
            using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'produto_bases_fixacao' and policyname = 'produto_bases_fixacao_service_all'
    ) then
        create policy produto_bases_fixacao_service_all on public.produto_bases_fixacao
            for all
            using (auth.role() = 'service_role')
            with check (auth.role() = 'service_role');
    end if;
end $$;

create or replace view public.vw_produto_bases as
select
    pb.id,
    pb.produto_id,
    pb.base_id,
    pb.ativo,
    pb.ordem,
    pb.is_default,
    coalesce(pb.preco_extra_override, b.preco_extra) as preco_extra_aplicado,
    b.nome as base_nome,
    b.slug as base_slug,
    b.descricao as base_descricao,
    b.imagem as base_imagem,
    b.preco_extra as base_preco_extra,
    b.ativo as base_ativa
from public.produto_bases_fixacao pb
join public.bases_fixacao b on b.id = pb.base_id;
