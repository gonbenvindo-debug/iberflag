begin;

drop view if exists public.estatisticas_produtos;

alter table if exists public.produtos
    drop column if exists stock;

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
