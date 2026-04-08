begin;

-- Complete checkout persistence for Stripe test mode and later fulfilment.
alter table if exists public.encomendas
    add column if not exists payment_provider text,
    add column if not exists payment_status text,
    add column if not exists stripe_session_id text,
    add column if not exists stripe_checkout_url text,
    add column if not exists stripe_payment_intent text,
    add column if not exists stripe_payment_method_type text,
    add column if not exists payment_confirmed_at timestamptz,
    add column if not exists facturalusa_status text,
    add column if not exists facturalusa_last_error text,
    add column if not exists facturalusa_customer_code text,
    add column if not exists facturalusa_document_number text,
    add column if not exists facturalusa_document_url text,
    add column if not exists checkout_payload jsonb default '{}'::jsonb,
    add column if not exists stripe_metadata jsonb default '{}'::jsonb,
    add column if not exists facturalusa_payload jsonb default '{}'::jsonb;

alter table if exists public.itens_encomenda
    add column if not exists design_id text,
    add column if not exists design_svg text,
    add column if not exists design_preview text,
    add column if not exists nome_produto text,
    add column if not exists imagem_produto text,
    add column if not exists base_id bigint,
    add column if not exists base_nome text,
    add column if not exists base_preco_extra numeric(12,2) not null default 0;

update public.encomendas
   set payment_provider = coalesce(payment_provider, 'stripe'),
       payment_status = coalesce(payment_status, 'pending'),
       facturalusa_status = coalesce(facturalusa_status, 'pending'),
       checkout_payload = coalesce(checkout_payload, '{}'::jsonb),
       stripe_metadata = coalesce(stripe_metadata, '{}'::jsonb),
       facturalusa_payload = coalesce(facturalusa_payload, '{}'::jsonb)
 where payment_provider is null
    or payment_status is null
    or facturalusa_status is null
    or checkout_payload is null
    or stripe_metadata is null
    or facturalusa_payload is null;

create table if not exists public.stripe_webhook_events (
    event_id text primary key,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'processing',
    attempts integer not null default 1,
    last_error text,
    processed_at timestamptz not null default now()
);

create index if not exists idx_encomendas_numero_encomenda
    on public.encomendas (numero_encomenda);
create index if not exists idx_encomendas_stripe_session_id
    on public.encomendas (stripe_session_id);
create index if not exists idx_itens_encomenda_encomenda_id
    on public.itens_encomenda (encomenda_id);

-- Drop legacy public policies on sensitive tables; re-create only the minimal contracts.
do $$
declare
    r record;
begin
    for r in
        select schemaname, tablename, policyname
          from pg_policies
         where schemaname = 'public'
           and tablename in ('clientes', 'contactos', 'encomendas', 'itens_encomenda', 'utilizadores')
    loop
        execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    end loop;
end;
$$;

alter table if exists public.clientes enable row level security;
alter table if exists public.contactos enable row level security;
alter table if exists public.encomendas enable row level security;
alter table if exists public.itens_encomenda enable row level security;
alter table if exists public.utilizadores enable row level security;

revoke all on table public.clientes from anon;
revoke all on table public.contactos from anon;
revoke all on table public.encomendas from anon;
revoke all on table public.itens_encomenda from anon;
revoke all on table public.utilizadores from anon;

grant select, insert, update, delete on table public.clientes to authenticated;
grant insert on table public.contactos to anon, authenticated;
grant select, update, delete on table public.contactos to authenticated;
grant select, insert, update, delete on table public.encomendas to authenticated;
grant select, insert, update, delete on table public.itens_encomenda to authenticated;
grant select, insert, update, delete on table public.utilizadores to authenticated;

create policy clientes_admin_manage on public.clientes
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

create policy contactos_public_insert on public.contactos
    for insert
    to anon, authenticated
    with check (true);

create policy contactos_admin_manage on public.contactos
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

create policy encomendas_admin_manage on public.encomendas
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

create policy itens_encomenda_admin_manage on public.itens_encomenda
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

create policy utilizadores_admin_manage on public.utilizadores
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

do $$
begin
    if to_regprocedure('public.checkout_upsert_customer(text,text,text,text,text,text,text,text)') is not null then
        revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from public;
        revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from anon;
        revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from authenticated;
        grant execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) to service_role;
    end if;
end;
$$;

create or replace function public.get_order_tracking(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(trim(coalesce(p_code, '')));
    v_payload jsonb;
begin
    if v_code = '' then
        return null;
    end if;

    select jsonb_build_object(
        'id', e.id,
        'numero_encomenda', e.numero_encomenda,
        'status', e.status,
        'subtotal', e.subtotal,
        'envio', e.envio,
        'total', e.total,
        'notas', '',
        'morada_envio', '',
        'metodo_pagamento', e.metodo_pagamento,
        'payment_provider', coalesce(to_jsonb(e)->>'payment_provider', 'stripe'),
        'payment_status', coalesce(to_jsonb(e)->>'payment_status', 'pending'),
        'created_at', e.created_at,
        'updated_at', to_jsonb(e)->>'updated_at',
        'tracking_codigo', coalesce(
            to_jsonb(e)->>'tracking_codigo',
            to_jsonb(e)->>'codigo_tracking',
            to_jsonb(e)->>'tracking_code',
            to_jsonb(e)->>'tracking'
        ),
        'tracking_url', coalesce(
            to_jsonb(e)->>'tracking_url',
            to_jsonb(e)->>'url_tracking',
            to_jsonb(e)->>'tracking_link'
        ),
        'items', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'produto_id', ie.produto_id,
                    'quantidade', ie.quantidade,
                    'preco_unitario', ie.preco_unitario,
                    'subtotal', ie.subtotal,
                    'design_id', to_jsonb(ie)->>'design_id',
                    'design_preview', to_jsonb(ie)->>'design_preview',
                    'nome_produto', coalesce(to_jsonb(ie)->>'nome_produto', p.nome, 'Produto'),
                    'imagem_produto', coalesce(to_jsonb(ie)->>'imagem_produto', p.imagem, ''),
                    'base_id', to_jsonb(ie)->'base_id',
                    'base_nome', to_jsonb(ie)->>'base_nome',
                    'base_preco_extra', coalesce(to_jsonb(ie)->'base_preco_extra', '0'::jsonb),
                    'produtos', jsonb_build_object(
                        'id', p.id,
                        'nome', coalesce(to_jsonb(ie)->>'nome_produto', p.nome, 'Produto'),
                        'imagem', coalesce(to_jsonb(ie)->>'imagem_produto', p.imagem, ''),
                        'preco', coalesce(ie.preco_unitario, p.preco)
                    )
                )
                order by ie.id asc
            )
            from public.itens_encomenda ie
            left join public.produtos p
              on p.id = ie.produto_id
            where ie.encomenda_id = e.id
        ), '[]'::jsonb)
    )
    into v_payload
    from public.encomendas e
    where upper(trim(coalesce(e.numero_encomenda, ''))) = v_code
    order by e.id desc
    limit 1;

    return v_payload;
end;
$$;

revoke execute on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text) to anon, authenticated;

commit;
