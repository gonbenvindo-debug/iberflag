-- Rename fly banner products to supplier height format requested by business.
-- Format: Fly Banner <Modelo> <ALTURA>CM

with rename_map as (
    select *
    from (values
        ('fly-banner-surf-55-x-226-cm', 'Fly Banner Surf 290CM', 'Fly Banner Surf 290CM'),
        ('fly-banner-surf-65-x-272-cm', 'Fly Banner Surf 340CM', 'Fly Banner Surf 340CM'),
        ('fly-banner-surf-75-5-x-351-cm', 'Fly Banner Surf 400CM', 'Fly Banner Surf 400CM'),
        ('fly-banner-surf-75-5-x-417-cm', 'Fly Banner Surf 500CM', 'Fly Banner Surf 500CM'),
        ('fly-banner-surf-90-x-516-cm', 'Fly Banner Surf 600CM', 'Fly Banner Surf 600CM'),
        ('fly-banner-drop-75-x-194-cm', 'Fly Banner Drop 245CM', 'Fly Banner Drop 245CM'),
        ('fly-banner-drop-92-x-228-cm', 'Fly Banner Drop 300CM', 'Fly Banner Drop 300CM'),
        ('fly-banner-drop-103-x-298-cm', 'Fly Banner Drop 350CM', 'Fly Banner Drop 350CM'),
        ('fly-banner-drop-132-x-352-cm', 'Fly Banner Drop 440CM', 'Fly Banner Drop 440CM'),
        ('fly-banner-drop-145-x-446-cm', 'Fly Banner Drop 540CM', 'Fly Banner Drop 540CM')
    ) as t(slug, nome, nome_es)
)
update public.produtos as p
set
    nome = rm.nome,
    nome_es = rm.nome_es
from rename_map rm
where p.slug = rm.slug
  and lower(coalesce(p.categoria, '')) in ('fly-banner', 'flybanners');
