begin;

create or replace function public.checkout_upsert_customer(
    p_nome text,
    p_email text,
    p_telefone text default null,
    p_empresa text default null,
    p_nif text default null,
    p_morada text default null,
    p_codigo_postal text default null,
    p_cidade text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_customer_id bigint;
    v_email text := lower(trim(coalesce(p_email, '')));
begin
    if v_email = '' then
        raise exception 'EMAIL_REQUIRED'
            using errcode = 'P0001',
                  hint = 'checkout_upsert_customer requires a valid email.';
    end if;

    select id
      into v_customer_id
      from public.clientes
     where lower(trim(coalesce(email, ''))) = v_email
     order by id desc
     limit 1;

    if v_customer_id is null then
        insert into public.clientes (
            nome,
            email,
            telefone,
            empresa,
            nif,
            morada,
            codigo_postal,
            cidade
        )
        values (
            nullif(trim(coalesce(p_nome, '')), ''),
            v_email,
            nullif(trim(coalesce(p_telefone, '')), ''),
            nullif(trim(coalesce(p_empresa, '')), ''),
            nullif(trim(coalesce(p_nif, '')), ''),
            nullif(trim(coalesce(p_morada, '')), ''),
            nullif(trim(coalesce(p_codigo_postal, '')), ''),
            nullif(trim(coalesce(p_cidade, '')), '')
        )
        returning id into v_customer_id;
    else
        update public.clientes
           set nome = coalesce(nullif(trim(coalesce(p_nome, '')), ''), nome),
               telefone = coalesce(nullif(trim(coalesce(p_telefone, '')), ''), telefone),
               empresa = coalesce(nullif(trim(coalesce(p_empresa, '')), ''), empresa),
               nif = coalesce(nullif(trim(coalesce(p_nif, '')), ''), nif),
               morada = coalesce(nullif(trim(coalesce(p_morada, '')), ''), morada),
               codigo_postal = coalesce(nullif(trim(coalesce(p_codigo_postal, '')), ''), codigo_postal),
               cidade = coalesce(nullif(trim(coalesce(p_cidade, '')), ''), cidade)
         where id = v_customer_id;
    end if;

    return v_customer_id;
end;
$$;

grant execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) to anon, authenticated;

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
        'notas', e.notas,
        'morada_envio', e.morada_envio,
        'metodo_pagamento', e.metodo_pagamento,
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
        'clientes', jsonb_build_object(
            'id', c.id,
            'nome', c.nome,
            'email', c.email,
            'telefone', c.telefone,
            'empresa', c.empresa,
            'nif', c.nif,
            'morada', c.morada,
            'codigo_postal', c.codigo_postal,
            'cidade', c.cidade
        ),
        'items', coalesce((
            select jsonb_agg(
                (
                    to_jsonb(ie) || jsonb_build_object(
                    'nome_produto', coalesce(to_jsonb(ie)->>'nome_produto', p.nome),
                    'imagem_produto', coalesce(to_jsonb(ie)->>'imagem_produto', p.imagem),
                    'produtos', jsonb_build_object(
                        'id', p.id,
                        'nome', p.nome,
                        'imagem', p.imagem,
                        'preco', p.preco
                    )
                ))
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
    left join public.clientes c
      on c.id = e.cliente_id
    where upper(trim(coalesce(e.numero_encomenda, ''))) = v_code
    order by e.id desc
    limit 1;

    return v_payload;
end;
$$;

grant execute on function public.get_order_tracking(text) to anon, authenticated;

commit;
