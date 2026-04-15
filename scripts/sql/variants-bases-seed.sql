-- Seed de bases de fixacao e associacao de exemplo a produtos
-- Requer: variants-bases-schema.sql ja executado

insert into public.bases_fixacao (nome, slug, descricao, imagem, preco_extra, ativo, disponivel, nota_indisponibilidade, ordem)
values
    ('Base Cruzeta', 'base-cruzeta', 'Base em cruz para uso interior e exterior em superficies planas.', 'https://picsum.photos/seed/base-cruzeta/900/560', 14.90, true, true, null, 1),
    ('Base Espeto', 'base-espeto', 'Fixacao para relva, terra e areia compacta.', 'https://picsum.photos/seed/base-espeto/900/560', 9.90, true, true, null, 2),
    ('Base Placa 8kg', 'base-placa-8kg', 'Base metalica de 8kg para alta estabilidade.', 'https://picsum.photos/seed/base-placa8/900/560', 24.90, true, true, null, 3),
    ('Base Rodas', 'base-rodas', 'Base com rodas para deslocacao rapida em eventos.', 'https://picsum.photos/seed/base-rodas/900/560', 29.90, true, true, null, 4),
    ('Base Enchivel Agua', 'base-enchivel-agua', 'Base enchivel para maior peso e estabilidade no exterior.', 'https://picsum.photos/seed/base-agua/900/560', 19.90, true, true, null, 5),
    ('Base Slim Indoor', 'base-slim-indoor', 'Base leve para uso interior em superficies lisas.', 'https://picsum.photos/seed/base-slim/900/560', 11.50, true, true, null, 6),
    ('Base Tripe Reforcado', 'base-tripe-reforcado', 'Tripe de aluminio reforcado para maior estabilidade.', 'https://picsum.photos/seed/base-tripe/900/560', 17.40, true, true, null, 7),
    ('Base Cimento 12kg', 'base-cimento-12kg', 'Base de cimento compacta com 12kg para vento moderado.', 'https://picsum.photos/seed/base-cimento/900/560', 32.00, true, true, null, 8),
    ('Base Premium 360', 'base-premium-360', 'Base premium com sistema de rotacao suave 360 graus.', 'https://picsum.photos/seed/base-premium360/900/560', 39.90, true, true, null, 9),
    ('Com reforco', 'flybanner-com-reforco', 'Opcao de flybanner com reforco aplicado para maior resistencia.', '/assets/images/flybanner-variants/com-reforco.svg', 0, true, true, null, 10),
    ('Sem reforco', 'flybanner-sem-reforco', 'Opcao de flybanner sem reforco.', '/assets/images/flybanner-variants/sem-reforco.svg', 0, true, false, 'Indisponivel de momento', 11)
on conflict (slug) do update set
    nome = excluded.nome,
    descricao = excluded.descricao,
    imagem = excluded.imagem,
    preco_extra = excluded.preco_extra,
    ativo = excluded.ativo,
    disponivel = excluded.disponivel,
    nota_indisponibilidade = excluded.nota_indisponibilidade,
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
        case
            when p.categoria = 'flybanners' and b.slug = 'flybanner-com-reforco' then 1
            when p.categoria = 'flybanners' and b.slug = 'flybanner-sem-reforco' then 2
            when b.slug = 'base-espeto' then 1
            when b.slug = 'base-cruzeta' then 2
            when b.slug = 'base-placa-8kg' then 3
            when b.slug = 'base-enchivel-agua' then 4
            when b.slug = 'base-rodas' then 5
            when b.slug = 'base-slim-indoor' then 6
            when b.slug = 'base-tripe-reforcado' then 7
            when b.slug = 'base-cimento-12kg' then 8
            when b.slug = 'base-premium-360' then 9
            else 99
        end as ordem,
        case
            when p.categoria = 'flybanners' and b.slug = 'flybanner-com-reforco' then true
            when p.categoria = 'rollups' and b.slug = 'base-placa-8kg' then true
            when p.categoria in ('lonas', 'banners') and b.slug = 'base-cruzeta' then true
            else false
        end as is_default
    from produtos_alvo p
    join bases b on (
        (p.categoria = 'flybanners' and b.slug in ('flybanner-com-reforco', 'flybanner-sem-reforco'))
        or
        (p.categoria = 'rollups' and b.slug in ('base-placa-8kg', 'base-rodas', 'base-cruzeta'))
        or
        (p.categoria in ('lonas', 'banners') and b.slug in ('base-espeto', 'base-cruzeta', 'base-placa-8kg', 'base-enchivel-agua', 'base-rodas', 'base-slim-indoor', 'base-tripe-reforcado', 'base-cimento-12kg', 'base-premium-360'))
    )
)
insert into public.produto_bases_fixacao (produto_id, base_id, ativo, ordem, is_default)
select produto_id, base_id, true, ordem, is_default
from mapa
on conflict (produto_id, base_id) do update set
    ativo = excluded.ativo,
    ordem = excluded.ordem,
    is_default = excluded.is_default;
