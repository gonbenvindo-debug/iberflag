alter table public.encomendas
    add column if not exists tax_profile text,
    add column if not exists customer_fiscal_name text,
    add column if not exists customer_fiscal_country text,
    add column if not exists customer_type text,
    add column if not exists vat_validation_status text,
    add column if not exists vat_validation_number text,
    add column if not exists vat_validation_source text,
    add column if not exists vat_validation_checked_at timestamptz,
    add column if not exists vat_validation_payload jsonb default '{}'::jsonb,
    add column if not exists document_type_resolved text,
    add column if not exists vat_rate_applied numeric(10,2),
    add column if not exists vat_regime_code text,
    add column if not exists vat_exemption_applied text,
    add column if not exists fiscal_snapshot jsonb default '{}'::jsonb;

create index if not exists encomendas_invoice_state_idx on public.encomendas (invoice_state);
create index if not exists encomendas_fiscal_scenario_idx on public.encomendas (fiscal_scenario);
create index if not exists encomendas_customer_fiscal_country_idx on public.encomendas (customer_fiscal_country);
create index if not exists encomendas_vat_validation_status_idx on public.encomendas (vat_validation_status);

update public.encomendas
set
    tax_profile = coalesce(nullif(tax_profile, ''), 'sole_trader_art53'),
    document_type_resolved = coalesce(nullif(document_type_resolved, ''), 'Factura Recibo')
where coalesce(tax_profile, '') = ''
   or coalesce(document_type_resolved, '') = '';
