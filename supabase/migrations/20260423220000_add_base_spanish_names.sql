alter table if exists public.bases_fixacao
    add column if not exists nome_es text;

update public.bases_fixacao
set nome_es = case slug
    when 'base-cruzeta' then 'Base de cruz'
    when 'flybanner-cruzeta-com-flutuador' then 'Base cruzada con flotador'
    when 'flybanner-base-parede' then 'Base de pared'
    when 'flybanner-base-parafuso-roscado' then 'Base de tornillo roscado'
    when 'flybanner-base-pica' then 'Base pincho'
    when 'flybanner-base-hercules-12kg' then 'Base Hércules 12 kg'
    when 'flybanner-base-agua' then 'Base de agua'
    when 'flybanner-base-deluxe-4kg' then 'Base deluxe 4 kg'
    when 'flybanner-base-universal-com-abracadeiras' then 'Base universal con bridas'
    when 'flybanner-base-distancia-entre-eixos-do-carro' then 'Base para coche'
    when 'flybanner-base-para-tenda' then 'Base para carpa'
    else nome_es
end
where slug in (
    'base-cruzeta',
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
);

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
    b.nota_indisponibilidade as base_nota_indisponibilidade,
    b.nome_es as base_nome_es
from public.produto_bases_fixacao pb
join public.bases_fixacao b on b.id = pb.base_id;

notify pgrst, 'reload schema';
