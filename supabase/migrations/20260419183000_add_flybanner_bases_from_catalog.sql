insert into public.bases_fixacao (
    nome,
    slug,
    descricao,
    imagem,
    preco_extra,
    ativo,
    disponivel,
    nota_indisponibilidade,
    ordem
)
values
    (
        'Base cruzada com flutuador',
        'flybanner-cruzeta-com-flutuador',
        'Base cruzada com flutuador para maior estabilidade.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_flotador_FB.jpg',
        0,
        true,
        true,
        null,
        1
    ),
    (
        'Base da parede',
        'flybanner-base-parede',
        'Base para fixacao em parede.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_pared_FB.jpg',
        0,
        true,
        true,
        null,
        2
    ),
    (
        'Base de parafuso roscado',
        'flybanner-base-parafuso-roscado',
        'Base de parafuso roscado para superficies adequadas.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_tornillo_FB.jpg',
        0,
        true,
        true,
        null,
        3
    ),
    (
        'Base pica',
        'flybanner-base-pica',
        'Base pica para terreno ou relvado.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_pica_FB.jpg',
        0,
        true,
        true,
        null,
        4
    ),
    (
        'Base Hércules 12kg',
        'flybanner-base-hercules-12kg',
        'Base Hércules de 12kg para maior estabilidade.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2022/07/Base-Hercules.jpg',
        0,
        true,
        true,
        null,
        5
    ),
    (
        'Base de água',
        'flybanner-base-agua',
        'Base de água enchível para uso versatil.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_rellenable_FB.jpg',
        0,
        true,
        true,
        null,
        6
    ),
    (
        'Base deluxe 4 kg',
        'flybanner-base-deluxe-4kg',
        'Base deluxe de 4 kg para transporte facil.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_deluxe_FB.jpg',
        0,
        true,
        true,
        null,
        7
    ),
    (
        'Base universal com abraçadeiras',
        'flybanner-base-universal-com-abracadeiras',
        'Base universal com abraçadeiras.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2026/03/Base-universal-con-bridas-1.jpg',
        0,
        true,
        true,
        null,
        8
    ),
    (
        'Distância entre eixos do carro',
        'flybanner-base-distancia-entre-eixos-do-carro',
        'Base para fixacao entre eixos do carro.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_coche_FB.jpg',
        0,
        true,
        true,
        null,
        9
    ),
    (
        'Banner fly base para tenda',
        'flybanner-base-para-tenda',
        'Base para tenda e estruturas similares.',
        'https://www.beachflagscatalog.com/wp-content/uploads/2021/06/Base_carpa_FB.jpg',
        0,
        true,
        true,
        null,
        10
    )
on conflict (slug) do update set
    nome = excluded.nome,
    descricao = excluded.descricao,
    imagem = excluded.imagem,
    preco_extra = excluded.preco_extra,
    ativo = excluded.ativo,
    disponivel = excluded.disponivel,
    nota_indisponibilidade = excluded.nota_indisponibilidade,
    ordem = excluded.ordem;

with flybanner_products as (
    select id
    from public.produtos
    where lower(coalesce(categoria, '')) in ('fly-banner', 'flybanners')
),
target_bases as (
    select id, slug
    from public.bases_fixacao
    where slug in (
        'flybanner-cruzeta-com-flutuador',
        'flybanner-base-parede',
        'flybanner-base-parafuso-roscado',
        'flybanner-base-pica',
        'flybanner-base-hercules-12kg',
        'flybanner-base-agua',
        'flybanner-base-deluxe-4kg',
        'flybanner-base-universal-com-abracadeiras',
        'flybanner-base-distancia-entre-eixos-do-carro',
        'flybanner-base-para-tenda'
    )
)
delete from public.produto_bases_fixacao pb
using flybanner_products fp
where pb.produto_id = fp.id;

with flybanner_products as (
    select id
    from public.produtos
    where lower(coalesce(categoria, '')) in ('fly-banner', 'flybanners')
),
target_bases as (
    select id, slug
    from public.bases_fixacao
    where slug in (
        'flybanner-cruzeta-com-flutuador',
        'flybanner-base-parede',
        'flybanner-base-parafuso-roscado',
        'flybanner-base-pica',
        'flybanner-base-hercules-12kg',
        'flybanner-base-agua',
        'flybanner-base-deluxe-4kg',
        'flybanner-base-universal-com-abracadeiras',
        'flybanner-base-distancia-entre-eixos-do-carro',
        'flybanner-base-para-tenda'
),
assignments as (
    select
        fp.id as produto_id,
        tb.id as base_id,
        true as ativo,
        case when tb.slug = 'flybanner-cruzeta-com-flutuador' then 1 else tb.ordem end as ordem,
        tb.slug = 'flybanner-cruzeta-com-flutuador' as is_default
    from flybanner_products fp
    cross join target_bases tb
)
insert into public.produto_bases_fixacao (
    produto_id,
    base_id,
    ativo,
    ordem,
    is_default
)
select
    produto_id,
    base_id,
    ativo,
    ordem,
    is_default
from assignments
on conflict (produto_id, base_id) do update set
    ativo = excluded.ativo,
    ordem = excluded.ordem,
    is_default = excluded.is_default;

delete from public.bases_fixacao
where slug in ('flybanner-com-reforco', 'flybanner-sem-reforco');
