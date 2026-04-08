begin;

-- Simulated catalog defaults for test-mode checkout. These values are not
-- supplier prices; they keep every active product purchasable in the test flow.
update public.produtos p
   set preco = round((
           case lower(trim(coalesce(p.categoria, '')))
               when 'bandeiras' then 19.90
               when 'bandeirolas-esportivas' then 24.90
               when 'mastros' then 39.90
               when 'fly-banner' then 69.90
               when 'photocall' then 149.90
               when 'cubo-publicitario' then 89.90
               when 'tenda-publicitaria' then 249.90
               when 'x-banner' then 44.90
               when 'roll-up' then 54.90
               when 'wall-banner' then 64.90
               when 'balcao-promocional' then 129.90
               else 49.90
           end
           + (mod(p.id, 7) * 2.50)
       )::numeric, 2),
       ativo = coalesce(p.ativo, true),
       destaque = coalesce(p.destaque, false),
       updated_at = now()
 where p.ativo is not false
   and (p.preco is null or p.preco <= 0);

update public.produtos p
   set svg_template = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#ffffff"/><rect x="40" y="40" width="720" height="520" fill="none" stroke="#111827" stroke-width="4" stroke-dasharray="16 10"/><text x="400" y="292" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#111827">Area de impressao</text><text x="400" y="336" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">Template simulado para checkout teste</text></svg>',
       updated_at = now()
 where nullif(trim(coalesce(p.svg_template, '')), '') is null;

-- Attach the active base catalog to all active products with zero override so
-- simulated base selection does not silently change product prices.
with active_bases as (
    select
        b.id,
        row_number() over (order by coalesce(b.ordem, 999999), b.id) as rn
    from public.bases_fixacao b
    where b.ativo is not false
)
insert into public.produto_bases_fixacao (
    produto_id,
    base_id,
    ativo,
    ordem,
    is_default,
    preco_extra_override
)
select
    p.id,
    b.id,
    true,
    b.rn,
    b.rn = 1,
    0
from public.produtos p
cross join active_bases b
where p.ativo is not false
  and not exists (
      select 1
      from public.produto_bases_fixacao pbf
      where pbf.produto_id = p.id
        and pbf.base_id = b.id
  );

-- Attach active templates to all active products so the template chooser has
-- deterministic data in the test flow.
with active_templates as (
    select
        t.id,
        row_number() over (order by t.created_at desc nulls last, t.id) as rn
    from public.templates t
    where t.ativo is not false
)
insert into public.produto_templates (
    produto_id,
    template_id,
    ordem
)
select
    p.id,
    t.id,
    t.rn
from public.produtos p
cross join active_templates t
where p.ativo is not false
  and not exists (
      select 1
      from public.produto_templates pt
      where pt.produto_id = p.id
        and pt.template_id = t.id
  );

-- Backfill snapshots for legacy order items. If the original product was
-- deleted, map to the active product with the closest simulated unit price.
with chosen_products as (
    select
        ie.id as item_id,
        coalesce(
            ie.produto_id,
            (
                select p2.id
                from public.produtos p2
                where p2.ativo is not false
                  and p2.preco > 0
                order by abs(coalesce(p2.preco, 0) - coalesce(ie.preco_unitario, 0)), p2.id
                limit 1
            )
        ) as produto_id
    from public.itens_encomenda ie
),
default_base as (
    select b.id, b.nome
    from public.bases_fixacao b
    where b.ativo is not false
    order by coalesce(b.ordem, 999999), b.id
    limit 1
)
update public.itens_encomenda ie
   set produto_id = coalesce(ie.produto_id, p.id),
       quantidade = greatest(1, coalesce(ie.quantidade, 1)),
       preco_unitario = case
           when ie.preco_unitario is null or ie.preco_unitario <= 0 then coalesce(p.preco, 1)
           else ie.preco_unitario
       end,
       subtotal = case
           when ie.subtotal is null or ie.subtotal <= 0 then
               greatest(1, coalesce(ie.quantidade, 1)) * (
                   case
                       when ie.preco_unitario is null or ie.preco_unitario <= 0 then coalesce(p.preco, 1)
                       else ie.preco_unitario
                   end
               )
           else ie.subtotal
       end,
       design_id = coalesce(nullif(trim(ie.design_id), ''), 'sim-legacy-' || ie.id::text),
       design_svg = coalesce(nullif(trim(ie.design_svg), ''), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#ffffff"/><rect x="48" y="48" width="704" height="504" fill="none" stroke="#111827" stroke-width="4"/><text x="400" y="312" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#111827">Design simulado</text></svg>'),
       design_preview = coalesce(nullif(trim(ie.design_preview), ''), nullif(trim(coalesce(ie.imagem_produto, p.imagem)), ''), '/assets/images/template-placeholder.svg'),
       nome_produto = coalesce(nullif(trim(ie.nome_produto), ''), p.nome, 'Produto simulado #' || ie.id::text),
       imagem_produto = coalesce(nullif(trim(ie.imagem_produto), ''), p.imagem, '/assets/images/template-placeholder.svg'),
       base_id = coalesce(ie.base_id, db.id),
       base_nome = coalesce(nullif(trim(ie.base_nome), ''), db.nome, 'Base simulada'),
       base_preco_extra = coalesce(ie.base_preco_extra, 0)
from chosen_products cp
left join public.produtos p
  on p.id = cp.produto_id
left join default_base db
  on true
where ie.id = cp.item_id
  and (
      ie.produto_id is null
      or ie.quantidade is null
      or ie.quantidade <= 0
      or ie.preco_unitario is null
      or ie.preco_unitario <= 0
      or ie.subtotal is null
      or ie.subtotal <= 0
      or nullif(trim(coalesce(ie.design_id, '')), '') is null
      or nullif(trim(coalesce(ie.design_svg, '')), '') is null
      or nullif(trim(coalesce(ie.design_preview, '')), '') is null
      or nullif(trim(coalesce(ie.nome_produto, '')), '') is null
      or nullif(trim(coalesce(ie.imagem_produto, '')), '') is null
      or ie.base_id is null
      or nullif(trim(coalesce(ie.base_nome, '')), '') is null
      or ie.base_preco_extra is null
  );

with order_totals as (
    select
        ie.encomenda_id,
        sum(coalesce(ie.subtotal, 0)) as subtotal
    from public.itens_encomenda ie
    group by ie.encomenda_id
)
update public.encomendas e
   set subtotal = case
           when e.subtotal is null or e.subtotal <= 0 then coalesce(ot.subtotal, 0)
           else e.subtotal
       end,
       envio = coalesce(e.envio, 0),
       total = case
           when e.total is null or e.total <= 0 then coalesce(ot.subtotal, 0) + coalesce(e.envio, 0)
           else e.total
       end,
       payment_provider = coalesce(nullif(trim(e.payment_provider), ''), 'stripe'),
       payment_status = coalesce(nullif(trim(e.payment_status), ''), 'pending'),
       facturalusa_status = coalesce(nullif(trim(e.facturalusa_status), ''), 'pending'),
       checkout_payload = coalesce(e.checkout_payload, '{}'::jsonb),
       stripe_metadata = coalesce(e.stripe_metadata, '{}'::jsonb),
       facturalusa_payload = coalesce(e.facturalusa_payload, '{}'::jsonb)
from order_totals ot
where e.id = ot.encomenda_id;

commit;
