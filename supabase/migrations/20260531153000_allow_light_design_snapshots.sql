alter table public.design_snapshots
    alter column design_svg drop not null;

comment on column public.design_snapshots.design_svg
    is 'Fallback legado. Novos designs confirmados usam masked_svg_path em Storage como fonte visual oficial.';
