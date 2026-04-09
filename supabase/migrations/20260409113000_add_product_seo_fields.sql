create extension if not exists unaccent with schema extensions;

alter table public.produtos
    add column if not exists slug text,
    add column if not exists seo_title text,
    add column if not exists seo_description text;

with prepared as (
    select
        id,
        coalesce(
            nullif(trim(slug), ''),
            nullif(
                regexp_replace(
                    lower(extensions.unaccent(coalesce(nome, ''))),
                    '[^a-z0-9]+',
                    '-',
                    'g'
                ),
                ''
            ),
            'produto-' || id::text
        ) as base_slug
    from public.produtos
),
normalized as (
    select
        id,
        coalesce(nullif(regexp_replace(base_slug, '(^-+|-+$)', '', 'g'), ''), 'produto-' || id::text) as normalized_slug
    from prepared
),
ranked as (
    select
        id,
        case
            when count(*) over (partition by normalized_slug) = 1 then normalized_slug
            else normalized_slug || '-' || id::text
        end as final_slug
    from normalized
)
update public.produtos as produtos
set slug = ranked.final_slug
from ranked
where produtos.id = ranked.id
  and coalesce(produtos.slug, '') is distinct from ranked.final_slug;

update public.produtos
set seo_title = coalesce(
    nullif(trim(seo_title), ''),
    trim(coalesce(nome, 'Produto')) || ' | IberFlag'
)
where coalesce(trim(nome), '') <> '';

update public.produtos
set seo_description = coalesce(
    nullif(trim(seo_description), ''),
    left(
        regexp_replace(
            coalesce(nullif(trim(descricao), ''), trim(coalesce(nome, 'Produto')) || ' personalizado da IberFlag.'),
            '\s+',
            ' ',
            'g'
        ),
        155
    )
)
where coalesce(trim(nome), '') <> '';

create unique index if not exists produtos_slug_unique_idx
    on public.produtos (lower(slug))
    where slug is not null;
