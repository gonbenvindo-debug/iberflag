begin;

-- Defensive hardening only: no data changes.
create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.is_admin_user()
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

revoke all on function app_private.is_admin_user() from public;
revoke all on function app_private.is_admin_user() from anon;
grant execute on function app_private.is_admin_user() to authenticated, service_role;

-- Remove legacy permissive policies and rebuild the public/admin contract.
do $$
declare
    r record;
begin
    for r in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
              'produtos',
              'bases_fixacao',
              'produto_bases_fixacao',
              'templates',
              'produto_templates',
              'contactos',
              'clientes',
              'encomendas',
              'itens_encomenda',
              'utilizadores',
              'email_templates',
              'email_delivery_logs',
              'stripe_webhook_events',
              'analytics_events',
              'product_costs',
              'product_pricing_rules',
              'review_queue',
              'shipping_zones',
              'sla_profiles',
              'fiscal_decisions',
              'operational_logs'
          )
    loop
        execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    end loop;
end;
$$;

alter table if exists public.produtos enable row level security;
alter table if exists public.bases_fixacao enable row level security;
alter table if exists public.produto_bases_fixacao enable row level security;
alter table if exists public.templates enable row level security;
alter table if exists public.produto_templates enable row level security;
alter table if exists public.contactos enable row level security;
alter table if exists public.clientes enable row level security;
alter table if exists public.encomendas enable row level security;
alter table if exists public.itens_encomenda enable row level security;
alter table if exists public.utilizadores enable row level security;
alter table if exists public.email_templates enable row level security;
alter table if exists public.email_delivery_logs enable row level security;
alter table if exists public.stripe_webhook_events enable row level security;
alter table if exists public.analytics_events enable row level security;
alter table if exists public.product_costs enable row level security;
alter table if exists public.product_pricing_rules enable row level security;
alter table if exists public.review_queue enable row level security;
alter table if exists public.shipping_zones enable row level security;
alter table if exists public.sla_profiles enable row level security;
alter table if exists public.fiscal_decisions enable row level security;
alter table if exists public.operational_logs enable row level security;

revoke all on table public.produtos from anon, authenticated;
revoke all on table public.bases_fixacao from anon, authenticated;
revoke all on table public.produto_bases_fixacao from anon, authenticated;
revoke all on table public.templates from anon, authenticated;
revoke all on table public.produto_templates from anon, authenticated;
revoke all on table public.contactos from anon, authenticated;
revoke all on table public.clientes from anon, authenticated;
revoke all on table public.encomendas from anon, authenticated;
revoke all on table public.itens_encomenda from anon, authenticated;
revoke all on table public.utilizadores from anon, authenticated;
revoke all on table public.email_templates from anon, authenticated;
revoke all on table public.email_delivery_logs from anon, authenticated;
revoke all on table public.stripe_webhook_events from anon, authenticated;
revoke all on table public.analytics_events from anon, authenticated;
revoke all on table public.product_costs from anon, authenticated;
revoke all on table public.product_pricing_rules from anon, authenticated;
revoke all on table public.review_queue from anon, authenticated;
revoke all on table public.shipping_zones from anon, authenticated;
revoke all on table public.sla_profiles from anon, authenticated;
revoke all on table public.fiscal_decisions from anon, authenticated;
revoke all on table public.operational_logs from anon, authenticated;

grant select on table public.produtos to anon, authenticated;
grant select on table public.bases_fixacao to anon, authenticated;
grant select on table public.produto_bases_fixacao to anon, authenticated;
grant select on table public.templates to anon, authenticated;
grant select on table public.produto_templates to anon, authenticated;

grant select, insert, update, delete on table public.produtos to authenticated;
grant select, insert, update, delete on table public.bases_fixacao to authenticated;
grant select, insert, update, delete on table public.produto_bases_fixacao to authenticated;
grant select, insert, update, delete on table public.templates to authenticated;
grant select, insert, update, delete on table public.produto_templates to authenticated;
grant select, insert, update, delete on table public.contactos to authenticated;
grant select, insert, update, delete on table public.clientes to authenticated;
grant select, insert, update, delete on table public.encomendas to authenticated;
grant select, insert, update, delete on table public.itens_encomenda to authenticated;
grant select, insert, update, delete on table public.utilizadores to authenticated;
grant select, insert, update, delete on table public.email_templates to authenticated;
grant select, insert, update, delete on table public.email_delivery_logs to authenticated;
grant select, insert, update, delete on table public.stripe_webhook_events to authenticated;
grant select, insert, update, delete on table public.analytics_events to authenticated;
grant select, insert, update, delete on table public.product_costs to authenticated;
grant select, insert, update, delete on table public.product_pricing_rules to authenticated;
grant select, insert, update, delete on table public.review_queue to authenticated;
grant select, insert, update, delete on table public.shipping_zones to authenticated;
grant select, insert, update, delete on table public.sla_profiles to authenticated;
grant select, insert, update, delete on table public.fiscal_decisions to authenticated;
grant select, insert, update, delete on table public.operational_logs to authenticated;

grant all on table public.produtos to service_role;
grant all on table public.bases_fixacao to service_role;
grant all on table public.produto_bases_fixacao to service_role;
grant all on table public.templates to service_role;
grant all on table public.produto_templates to service_role;
grant all on table public.contactos to service_role;
grant all on table public.clientes to service_role;
grant all on table public.encomendas to service_role;
grant all on table public.itens_encomenda to service_role;
grant all on table public.utilizadores to service_role;
grant all on table public.email_templates to service_role;
grant all on table public.email_delivery_logs to service_role;
grant all on table public.stripe_webhook_events to service_role;
grant all on table public.analytics_events to service_role;
grant all on table public.product_costs to service_role;
grant all on table public.product_pricing_rules to service_role;
grant all on table public.review_queue to service_role;
grant all on table public.shipping_zones to service_role;
grant all on table public.sla_profiles to service_role;
grant all on table public.fiscal_decisions to service_role;
grant all on table public.operational_logs to service_role;

create policy produtos_public_select on public.produtos
    for select
    to anon, authenticated
    using (ativo = true);

create policy produtos_admin_manage on public.produtos
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy bases_fixacao_public_select on public.bases_fixacao
    for select
    to anon, authenticated
    using (ativo = true);

create policy bases_fixacao_admin_manage on public.bases_fixacao
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy produto_bases_fixacao_public_select on public.produto_bases_fixacao
    for select
    to anon, authenticated
    using (
        ativo = true
        and exists (
            select 1
            from public.produtos p
            where p.id = produto_id
              and p.ativo = true
        )
        and exists (
            select 1
            from public.bases_fixacao b
            where b.id = base_id
              and b.ativo = true
        )
    );

create policy produto_bases_fixacao_admin_manage on public.produto_bases_fixacao
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy templates_public_select on public.templates
    for select
    to anon, authenticated
    using (ativo = true);

create policy templates_admin_manage on public.templates
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy produto_templates_public_select on public.produto_templates
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.produtos p
            where p.id = produto_id
              and p.ativo = true
        )
        and exists (
            select 1
            from public.templates t
            where t.id = template_id
              and t.ativo = true
        )
    );

create policy produto_templates_admin_manage on public.produto_templates
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy contactos_admin_manage on public.contactos
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy clientes_admin_manage on public.clientes
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy encomendas_admin_manage on public.encomendas
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy itens_encomenda_admin_manage on public.itens_encomenda
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy utilizadores_admin_manage on public.utilizadores
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy email_templates_admin_manage on public.email_templates
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy email_delivery_logs_admin_manage on public.email_delivery_logs
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy stripe_webhook_events_admin_manage on public.stripe_webhook_events
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy analytics_events_admin_manage on public.analytics_events
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy product_costs_admin_manage on public.product_costs
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy product_pricing_rules_admin_manage on public.product_pricing_rules
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy review_queue_admin_manage on public.review_queue
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy shipping_zones_admin_manage on public.shipping_zones
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy sla_profiles_admin_manage on public.sla_profiles
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy fiscal_decisions_admin_manage on public.fiscal_decisions
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

create policy operational_logs_admin_manage on public.operational_logs
    for all
    to authenticated
    using (app_private.is_admin_user())
    with check (app_private.is_admin_user());

-- Public order tracking must go through /api/checkout/session-status.
revoke execute on function public.get_order_tracking(text) from public;
revoke execute on function public.get_order_tracking(text) from anon;
revoke execute on function public.get_order_tracking(text) from authenticated;
grant execute on function public.get_order_tracking(text) to service_role;

revoke execute on function public.is_admin_user() from public;
revoke execute on function public.is_admin_user() from anon;
revoke execute on function public.is_admin_user() from authenticated;
grant execute on function public.is_admin_user() to service_role;

alter function public.touch_updated_at() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.update_updated_at_column() from public;
grant execute on function public.touch_updated_at() to service_role;
grant execute on function public.update_updated_at_column() to service_role;

alter view public.vw_produto_bases set (security_invoker = true);
alter view public.estatisticas_produtos set (security_invoker = true);
alter view public.estatisticas_encomendas set (security_invoker = true);

revoke all on table public.estatisticas_produtos from anon, authenticated;
revoke all on table public.estatisticas_encomendas from anon, authenticated;
revoke all on table public.vw_produto_bases from anon, authenticated;
grant select on table public.vw_produto_bases to anon, authenticated;

drop policy if exists catalog_products_public_read on storage.objects;
drop policy if exists catalog_products_authenticated_write on storage.objects;

create policy catalog_products_admin_write
on storage.objects
for all
to authenticated
using (
    bucket_id = 'catalog-products'
    and app_private.is_admin_user()
)
with check (
    bucket_id = 'catalog-products'
    and app_private.is_admin_user()
);

commit;
