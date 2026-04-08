begin;

-- Checkout now runs through the server-side API with the service role key.
-- Keep direct public writes closed so browser payloads cannot create/corrupt orders.
alter table if exists public.encomendas enable row level security;
alter table if exists public.itens_encomenda enable row level security;

drop policy if exists encomendas_public_insert on public.encomendas;
drop policy if exists itens_encomenda_public_insert on public.itens_encomenda;

-- Persist selected product bases for order fulfilment and later integrations.
alter table if exists public.itens_encomenda
    add column if not exists base_id bigint,
    add column if not exists base_nome text,
    add column if not exists base_preco_extra numeric(12,2) not null default 0;

-- Remove temporary anon template write policies defensively.
drop policy if exists "Anon pode inserir templates" on public.templates;
drop policy if exists "Anon pode atualizar templates" on public.templates;
drop policy if exists "Anon pode apagar templates" on public.templates;
drop policy if exists "Anon pode inserir links produto_templates" on public.produto_templates;
drop policy if exists "Anon pode atualizar links produto_templates" on public.produto_templates;
drop policy if exists "Anon pode apagar links produto_templates" on public.produto_templates;

-- The checkout API writes customers directly with service role; this RPC must not
-- be callable by anon/authenticated users because it upserts by email.
revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from public;
revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) to service_role;

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
        'facturalusa_status', to_jsonb(e)->>'facturalusa_status',
        'facturalusa_document_number', to_jsonb(e)->>'facturalusa_document_number',
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
                    'nome_produto', coalesce(to_jsonb(ie)->>'nome_produto', p.nome),
                    'imagem_produto', coalesce(to_jsonb(ie)->>'imagem_produto', p.imagem),
                    'base_id', to_jsonb(ie)->'base_id',
                    'base_nome', to_jsonb(ie)->>'base_nome',
                    'base_preco_extra', coalesce(to_jsonb(ie)->'base_preco_extra', '0'::jsonb),
                    'produtos', jsonb_build_object(
                        'id', p.id,
                        'nome', p.nome,
                        'imagem', p.imagem,
                        'preco', p.preco
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
