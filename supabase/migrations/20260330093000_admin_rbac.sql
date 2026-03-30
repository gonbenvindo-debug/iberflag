begin;

-- Admin allowlist used by RLS helpers.
create table if not exists public.admin_users (
    email text primary key,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.admin_users (email, active)
values ('admin123@iberflag.pt', true)
on conflict (email) do update
set active = excluded.active,
    updated_at = now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
before update on public.admin_users
for each row
execute function public.touch_updated_at();

revoke all on table public.admin_users from anon, authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select exists (
        select 1
        from public.admin_users au
        where au.active = true
          and lower(au.email) = lower(auth.email())
    );
$$;

-- Products
alter table public.produtos enable row level security;
drop policy if exists produtos_public_select on public.produtos;
drop policy if exists produtos_admin_manage on public.produtos;
create policy produtos_public_select on public.produtos
    for select
    using (true);

create policy produtos_admin_manage on public.produtos
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

-- Templates
alter table public.templates enable row level security;
drop policy if exists "Templates visiveis para todos" on public.templates;
drop policy if exists "Usuarios autenticados podem gerenciar templates" on public.templates;
drop policy if exists "Anon pode inserir templates" on public.templates;
drop policy if exists "Anon pode atualizar templates" on public.templates;
drop policy if exists "Anon pode apagar templates" on public.templates;
drop policy if exists templates_public_select on public.templates;
drop policy if exists templates_admin_manage on public.templates;
create policy templates_public_select on public.templates
    for select
    using (ativo = true);

create policy templates_admin_manage on public.templates
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

-- Product-template links
alter table public.produto_templates enable row level security;
drop policy if exists "Associacoes visiveis para todos" on public.produto_templates;
drop policy if exists "Usuarios autenticados podem gerenciar" on public.produto_templates;
drop policy if exists "Anon pode inserir links produto_templates" on public.produto_templates;
drop policy if exists "Anon pode atualizar links produto_templates" on public.produto_templates;
drop policy if exists "Anon pode apagar links produto_templates" on public.produto_templates;
drop policy if exists produto_templates_public_select on public.produto_templates;
drop policy if exists produto_templates_admin_manage on public.produto_templates;
create policy produto_templates_public_select on public.produto_templates
    for select
    using (true);

create policy produto_templates_admin_manage on public.produto_templates
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

-- Bases de fixacao
alter table public.bases_fixacao enable row level security;
drop policy if exists bases_fixacao_public_select on public.bases_fixacao;
drop policy if exists bases_fixacao_service_all on public.bases_fixacao;
drop policy if exists bases_fixacao_admin_authenticated_write on public.bases_fixacao;
drop policy if exists bases_fixacao_admin_manage on public.bases_fixacao;
create policy bases_fixacao_public_select on public.bases_fixacao
    for select
    using (ativo = true);

create policy bases_fixacao_admin_manage on public.bases_fixacao
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

alter table public.produto_bases_fixacao enable row level security;
drop policy if exists produto_bases_fixacao_public_select on public.produto_bases_fixacao;
drop policy if exists produto_bases_fixacao_service_all on public.produto_bases_fixacao;
drop policy if exists produto_bases_fixacao_admin_authenticated_write on public.produto_bases_fixacao;
drop policy if exists produto_bases_fixacao_admin_manage on public.produto_bases_fixacao;
create policy produto_bases_fixacao_public_select on public.produto_bases_fixacao
    for select
    using (true);

create policy produto_bases_fixacao_admin_manage on public.produto_bases_fixacao
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

-- Contact form
alter table public.contactos enable row level security;
drop policy if exists contactos_public_insert on public.contactos;
drop policy if exists contactos_admin_manage on public.contactos;
create policy contactos_public_insert on public.contactos
    for insert
    to anon, authenticated
    with check (true);

create policy contactos_admin_manage on public.contactos
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

-- Orders and items
alter table public.encomendas enable row level security;
drop policy if exists encomendas_public_insert on public.encomendas;
drop policy if exists encomendas_admin_manage on public.encomendas;
create policy encomendas_public_insert on public.encomendas
    for insert
    to anon, authenticated
    with check (true);

create policy encomendas_admin_manage on public.encomendas
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

alter table public.itens_encomenda enable row level security;
drop policy if exists itens_encomenda_public_insert on public.itens_encomenda;
drop policy if exists itens_encomenda_admin_manage on public.itens_encomenda;
create policy itens_encomenda_public_insert on public.itens_encomenda
    for insert
    to anon, authenticated
    with check (true);

create policy itens_encomenda_admin_manage on public.itens_encomenda
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

-- Customers
alter table public.clientes enable row level security;
drop policy if exists clientes_admin_manage on public.clientes;
create policy clientes_admin_manage on public.clientes
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());

commit;
