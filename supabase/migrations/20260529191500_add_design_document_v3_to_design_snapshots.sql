alter table public.design_snapshots
    add column if not exists design_document_v3 jsonb;

comment on column public.design_snapshots.design_document_v3
    is 'Documento canonico do design em coordenadas relativas (design-document-v3).';
