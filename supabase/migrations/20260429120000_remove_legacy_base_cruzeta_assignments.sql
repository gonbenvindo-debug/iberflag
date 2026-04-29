-- Remove legacy sample "Base Cruzeta" assignments from products that should not
-- expose a base selector. Fly-banner assignments use the supplier-specific bases.

delete from public.produto_bases_fixacao pb
using public.bases_fixacao b, public.produtos p
where pb.base_id = b.id
  and pb.produto_id = p.id
  and b.slug = 'base-cruzeta'
  and lower(coalesce(p.categoria, '')) not in ('fly-banner', 'flybanners');
