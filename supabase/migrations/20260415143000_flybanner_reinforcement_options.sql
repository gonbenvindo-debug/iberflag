alter table if exists public.bases_fixacao
    add column if not exists disponivel boolean not null default true,
    add column if not exists nota_indisponibilidade text;

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
    b.ativo as base_ativa,
    b.disponivel as base_disponivel,
    b.nota_indisponibilidade as base_nota_indisponibilidade
from public.produto_bases_fixacao pb
join public.bases_fixacao b on b.id = pb.base_id;

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
        'Com reforco',
        'flybanner-com-reforco',
        'Opcao de flybanner com reforco aplicado para maior resistencia.',
        '/assets/images/flybanner-variants/com-reforco.svg',
        0,
        true,
        true,
        null,
        10
    ),
    (
        'Sem reforco',
        'flybanner-sem-reforco',
        'Opcao de flybanner sem reforco.',
        '/assets/images/flybanner-variants/sem-reforco.svg',
        0,
        true,
        false,
        'Indisponivel de momento',
        11
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
    where lower(coalesce(categoria, '')) = 'flybanners'
),
target_bases as (
    select id, slug
    from public.bases_fixacao
    where slug in ('flybanner-com-reforco', 'flybanner-sem-reforco')
)
delete from public.produto_bases_fixacao pb
using flybanner_products fp
where pb.produto_id = fp.id
  and pb.base_id not in (select id from target_bases);

with flybanner_products as (
    select id
    from public.produtos
    where lower(coalesce(categoria, '')) = 'flybanners'
),
target_bases as (
    select id, slug
    from public.bases_fixacao
    where slug in ('flybanner-com-reforco', 'flybanner-sem-reforco')
),
assignments as (
    select
        fp.id as produto_id,
        tb.id as base_id,
        true as ativo,
        case when tb.slug = 'flybanner-com-reforco' then 1 else 2 end as ordem,
        tb.slug = 'flybanner-com-reforco' as is_default
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
