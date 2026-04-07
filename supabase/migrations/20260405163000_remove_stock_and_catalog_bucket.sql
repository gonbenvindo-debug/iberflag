begin;

drop view if exists public.estatisticas_produtos;

alter table if exists public.produtos
    drop column if exists stock;

alter table if exists public.encomendas
    add column if not exists payment_provider text,
    add column if not exists payment_status text,
    add column if not exists stripe_session_id text,
    add column if not exists stripe_checkout_url text,
    add column if not exists stripe_payment_intent text,
    add column if not exists stripe_payment_method_type text,
    add column if not exists payment_confirmed_at timestamptz,
    add column if not exists facturalusa_status text,
    add column if not exists facturalusa_last_error text,
    add column if not exists facturalusa_customer_code text,
    add column if not exists facturalusa_document_number text,
    add column if not exists facturalusa_document_url text,
    add column if not exists checkout_payload jsonb default '{}'::jsonb,
    add column if not exists stripe_metadata jsonb default '{}'::jsonb,
    add column if not exists facturalusa_payload jsonb default '{}'::jsonb;

update public.encomendas
   set payment_provider = coalesce(payment_provider, 'stripe'),
       payment_status = coalesce(payment_status, 'pending'),
       facturalusa_status = coalesce(facturalusa_status, 'pending'),
       checkout_payload = coalesce(checkout_payload, '{}'::jsonb),
       stripe_metadata = coalesce(stripe_metadata, '{}'::jsonb),
       facturalusa_payload = coalesce(facturalusa_payload, '{}'::jsonb)
 where payment_provider is null
    or payment_status is null
    or facturalusa_status is null
    or checkout_payload is null
    or stripe_metadata is null
    or facturalusa_payload is null;

create table if not exists public.stripe_webhook_events (
    event_id text primary key,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'processing',
    attempts integer not null default 1,
    last_error text,
    processed_at timestamptz not null default now()
);

create view public.estatisticas_produtos as
select
    count(*) as total_produtos,
    count(case when ativo = true then 1 end) as produtos_ativos,
    count(case when destaque = true then 1 end) as produtos_destaque
from public.produtos;

insert into storage.buckets (id, name, public)
values ('catalog-products', 'catalog-products', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

drop policy if exists catalog_products_public_read on storage.objects;
create policy catalog_products_public_read
on storage.objects
for select
to public
using (bucket_id = 'catalog-products');

drop policy if exists catalog_products_authenticated_write on storage.objects;
create policy catalog_products_authenticated_write
on storage.objects
for all
to authenticated
using (bucket_id = 'catalog-products')
with check (bucket_id = 'catalog-products');

commit;
