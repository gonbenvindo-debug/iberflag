insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    updated_at
)
values (
    'design-sources',
    'design-sources',
    false,
    10485760,
    array[
        'image/svg+xml',
        'application/json',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif'
    ],
    now()
)
on conflict (id) do update
set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

alter table public.design_snapshots
    add column if not exists storage_bucket text not null default 'design-sources',
    add column if not exists masked_svg_path text,
    add column if not exists document_path text,
    add column if not exists asset_manifest jsonb not null default '{}'::jsonb,
    add column if not exists read_token_hash text;

create index if not exists idx_design_snapshots_storage_bucket
    on public.design_snapshots (storage_bucket);

create index if not exists idx_design_snapshots_masked_svg_path
    on public.design_snapshots (masked_svg_path);

comment on column public.design_snapshots.storage_bucket
    is 'Bucket privado onde vive a fonte oficial do design confirmado.';

comment on column public.design_snapshots.masked_svg_path
    is 'Caminho privado do SVG final mascarado confirmado.';

comment on column public.design_snapshots.document_path
    is 'Caminho privado opcional do documento leve usado para reedicao.';

comment on column public.design_snapshots.asset_manifest
    is 'Manifesto leve de assets persistentes associados ao documento do design.';

comment on column public.design_snapshots.read_token_hash
    is 'Hash SHA-256 do token usado pela API para autorizar leitura privada.';

alter table public.itens_encomenda
    add column if not exists design_storage_bucket text,
    add column if not exists design_storage_path text,
    add column if not exists design_svg_url text;

comment on column public.itens_encomenda.design_storage_bucket
    is 'Bucket privado do SVG final do design associado ao item.';

comment on column public.itens_encomenda.design_storage_path
    is 'Caminho privado do SVG final do design associado ao item.';

comment on column public.itens_encomenda.design_svg_url
    is 'URL interna da API para renderizar/descarregar o SVG final do design.';
