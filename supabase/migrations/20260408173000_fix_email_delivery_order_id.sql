begin;

alter table if exists public.email_delivery_logs
    alter column order_id type text
    using order_id::text;

commit;
