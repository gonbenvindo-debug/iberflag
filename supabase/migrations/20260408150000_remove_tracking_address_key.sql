begin;

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
