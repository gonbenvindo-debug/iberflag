create table if not exists public.design_snapshots (
    design_id text primary key,
    design_svg text not null,
    design_preview text,
    design_document_v2 jsonb,
    product_id bigint,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_design_snapshots_updated_at
    on public.design_snapshots (updated_at desc);

alter table public.design_snapshots enable row level security;

comment on table public.design_snapshots is 'Snapshots canonicos de design por design_id para reutilizacao de previews e re-edicao.';

