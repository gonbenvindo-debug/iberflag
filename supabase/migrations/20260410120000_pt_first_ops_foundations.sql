alter table if exists public.encomendas
    add column if not exists fiscal_scenario text,
    add column if not exists fiscal_decision_mode text,
    add column if not exists fiscal_evidence_status text,
    add column if not exists invoice_state text,
    add column if not exists vat_rate_applied numeric(6,2),
    add column if not exists vat_exemption_applied text,
    add column if not exists fiscal_decision_reason text,
    add column if not exists shipping_zone_code text,
    add column if not exists sla_target_at timestamptz,
    add column if not exists sla_breached_at timestamptz,
    add column if not exists margin_estimate numeric(12,2);

alter table if exists public.produtos
    add column if not exists core_offer boolean default false,
    add column if not exists price_floor numeric(12,2),
    add column if not exists price_recommended numeric(12,2),
    add column if not exists sla_profile_id uuid;

create table if not exists public.sla_profiles (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    label text not null,
    target_hours integer not null default 48,
    active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shipping_zones (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    label text not null,
    country_code text,
    active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_costs (
    id uuid primary key default gen_random_uuid(),
    product_id bigint not null references public.produtos(id) on delete cascade,
    estimated_unit_cost numeric(12,2) not null default 0,
    currency text not null default 'EUR',
    notes text,
    active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (product_id)
);

create table if not exists public.product_pricing_rules (
    id uuid primary key default gen_random_uuid(),
    product_id bigint not null references public.produtos(id) on delete cascade,
    margin_min_percent numeric(6,2) not null default 35,
    discount_max_percent numeric(6,2) not null default 10,
    price_floor numeric(12,2),
    price_recommended numeric(12,2),
    active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (product_id)
);

create table if not exists public.fiscal_decisions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.encomendas(id) on delete cascade,
    scenario text not null,
    decision_mode text not null,
    evidence_status text not null,
    vat_rate numeric(6,2),
    vat_exemption text,
    reason text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.review_queue (
    id uuid primary key default gen_random_uuid(),
    queue_key text unique not null,
    order_id uuid references public.encomendas(id) on delete cascade,
    type text not null,
    status text not null default 'open',
    priority text not null default 'normal',
    title text not null,
    details text,
    payload jsonb not null default '{}'::jsonb,
    opened_at timestamptz not null default timezone('utc', now()),
    resolved_at timestamptz
);

create table if not exists public.analytics_events (
    id uuid primary key default gen_random_uuid(),
    event_name text not null,
    path text,
    session_id text,
    order_id uuid references public.encomendas(id) on delete set null,
    product_id bigint references public.produtos(id) on delete set null,
    country_code text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.operational_logs (
    id uuid primary key default gen_random_uuid(),
    event_name text not null,
    level text not null default 'info',
    order_id uuid references public.encomendas(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

insert into public.sla_profiles (code, label, target_hours, active)
values
    ('pt_standard_48h', 'Portugal continental · 48h', 48, true),
    ('es_compatible_72h', 'Espanha compatível · 72h', 72, true)
on conflict (code) do update
set label = excluded.label,
    target_hours = excluded.target_hours,
    active = excluded.active,
    updated_at = timezone('utc', now());

insert into public.shipping_zones (code, label, country_code, active)
values
    ('pt_continental', 'Portugal continental', 'PT', true),
    ('es_peninsular', 'Espanha peninsular', 'ES', true)
on conflict (code) do update
set label = excluded.label,
    country_code = excluded.country_code,
    active = excluded.active,
    updated_at = timezone('utc', now());

update public.produtos
set
    core_offer = coalesce(core_offer, false) or coalesce(destaque, false),
    price_floor = coalesce(price_floor, nullif(preco, 0)),
    price_recommended = coalesce(price_recommended, nullif(preco, 0)),
    sla_profile_id = coalesce(
        sla_profile_id,
        (select id from public.sla_profiles where code = 'pt_standard_48h' limit 1)
    );

insert into public.product_costs (product_id, estimated_unit_cost, currency, notes, active)
select
    p.id,
    round(greatest(coalesce(p.preco, 0) * 0.42, 1)::numeric, 2),
    'EUR',
    'Valor simulado base para controlo operacional.',
    true
from public.produtos p
left join public.product_costs pc on pc.product_id = p.id
where pc.id is null;

insert into public.product_pricing_rules (product_id, margin_min_percent, discount_max_percent, price_floor, price_recommended, active)
select
    p.id,
    35,
    10,
    round(greatest(coalesce(p.preco, 0) * 0.90, 1)::numeric, 2),
    round(greatest(coalesce(p.preco, 0), 1)::numeric, 2),
    true
from public.produtos p
left join public.product_pricing_rules pr on pr.product_id = p.id
where pr.id is null;

update public.encomendas
set
    fiscal_scenario = coalesce(fiscal_scenario, 'pt_domestic'),
    fiscal_decision_mode = coalesce(fiscal_decision_mode, 'auto_emit'),
    fiscal_evidence_status = coalesce(fiscal_evidence_status, 'domestic_checkout_data'),
    invoice_state = coalesce(
        invoice_state,
        case
            when payment_status = 'paid' and facturalusa_status = 'emitted' then 'emitted'
            when payment_status = 'paid' then 'ready_to_emit'
            else 'pending_payment'
        end
    ),
    vat_rate_applied = coalesce(vat_rate_applied, 23),
    shipping_zone_code = coalesce(shipping_zone_code, 'pt_continental'),
    sla_target_at = coalesce(sla_target_at, timezone('utc', now()) + interval '48 hours'),
    margin_estimate = coalesce(margin_estimate, 0);

alter table if exists public.review_queue enable row level security;
alter table if exists public.analytics_events enable row level security;
alter table if exists public.operational_logs enable row level security;
alter table if exists public.product_costs enable row level security;
alter table if exists public.product_pricing_rules enable row level security;
alter table if exists public.fiscal_decisions enable row level security;
alter table if exists public.shipping_zones enable row level security;
alter table if exists public.sla_profiles enable row level security;
