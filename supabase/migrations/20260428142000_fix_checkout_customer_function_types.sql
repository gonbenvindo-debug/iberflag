begin;

drop function if exists public.checkout_upsert_customer(text, text, text, text, text, text, text, text);

create or replace function public.checkout_upsert_customer(
    p_nome text,
    p_email text,
    p_telefone text default null::text,
    p_empresa text default null::text,
    p_nif text default null::text,
    p_morada text default null::text,
    p_codigo_postal text default null::text,
    p_cidade text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_customer_id uuid;
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
     order by created_at desc nulls last, id desc
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

revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from public;
revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from anon;
revoke execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) from authenticated;
grant execute on function public.checkout_upsert_customer(text, text, text, text, text, text, text, text) to service_role;

commit;
