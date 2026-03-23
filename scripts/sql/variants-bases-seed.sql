-- Seed de bases de fixacao e associacao de exemplo a produtos
-- Requer: variants-bases-schema.sql ja executado

insert into public.bases_fixacao (nome, slug, descricao, imagem, preco_extra, ativo, ordem)
values
    ('Base Cruzeta', 'base-cruzeta', 'Base em cruz para uso interior e exterior em superficies planas.', 'https://images.unsplash.com/photo-1582719478185-2f8fbe8c4f9f?auto=format&fit=crop&w=900&q=80', 14.90, true, 1),
    ('Base Espeto', 'base-espeto', 'Fixacao para relva, terra e areia compacta.', 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=900&q=80', 9.90, true, 2),
    ('Base Placa 8kg', 'base-placa-8kg', 'Base metalica de 8kg para alta estabilidade.', 'https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=900&q=80', 24.90, true, 3),
    ('Base Rodas', 'base-rodas', 'Base com rodas para deslocacao rapida em eventos.', 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=900&q=80', 29.90, true, 4),
    ('Base Enchivel Agua', 'base-enchivel-agua', 'Base enchivel para maior peso e estabilidade no exterior.', 'https://images.unsplash.com/photo-1518457909831-5f6487e7f0db?auto=format&fit=crop&w=900&q=80', 19.90, true, 5)
on conflict (slug) do update set
    nome = excluded.nome,
    descricao = excluded.descricao,
    imagem = excluded.imagem,
    preco_extra = excluded.preco_extra,
    ativo = excluded.ativo,
    ordem = excluded.ordem;

with bases as (
    select id, slug from public.bases_fixacao where ativo = true
),
produtos_alvo as (
    select id, categoria from public.produtos where categoria in ('flybanners', 'rollups', 'lonas', 'banners')
),
mapa as (
    select
        p.id as produto_id,
        b.id as base_id,
        case b.slug
            when 'base-espeto' then 1
            when 'base-cruzeta' then 2
            when 'base-placa-8kg' then 3
            when 'base-enchivel-agua' then 4
            when 'base-rodas' then 5
            else 99
        end as ordem,
        case
            when p.categoria = 'flybanners' and b.slug = 'base-espeto' then true
            when p.categoria = 'rollups' and b.slug = 'base-placa-8kg' then true
            when p.categoria in ('lonas', 'banners') and b.slug = 'base-cruzeta' then true
            else false
        end as is_default
    from produtos_alvo p
    join bases b on (
        (p.categoria = 'flybanners' and b.slug in ('base-espeto', 'base-cruzeta', 'base-placa-8kg', 'base-enchivel-agua'))
        or
        (p.categoria = 'rollups' and b.slug in ('base-placa-8kg', 'base-rodas', 'base-cruzeta'))
        or
        (p.categoria in ('lonas', 'banners') and b.slug in ('base-cruzeta', 'base-placa-8kg', 'base-rodas'))
    )
)
insert into public.produto_bases_fixacao (produto_id, base_id, ativo, ordem, is_default)
select produto_id, base_id, true, ordem, is_default
from mapa
on conflict (produto_id, base_id) do update set
    ativo = excluded.ativo,
    ordem = excluded.ordem,
    is_default = excluded.is_default;
