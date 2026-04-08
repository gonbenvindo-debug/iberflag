begin;

create table if not exists public.email_templates (
    id uuid primary key default gen_random_uuid(),
    template_key text not null unique,
    name text not null,
    description text,
    event_type text not null,
    subject text not null,
    preheader text,
    html_body text not null,
    text_body text,
    variables jsonb not null default '[]'::jsonb,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.email_delivery_logs (
    id bigserial primary key,
    template_key text not null,
    order_id bigint,
    recipient text not null,
    subject text not null,
    dedupe_key text,
    status text not null default 'queued',
    provider_message_id text,
    error_message text,
    payload jsonb not null default '{}'::jsonb,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_email_templates_event_type
    on public.email_templates (event_type);

create index if not exists idx_email_delivery_logs_template_key
    on public.email_delivery_logs (template_key);

create index if not exists idx_email_delivery_logs_order_id
    on public.email_delivery_logs (order_id);

create unique index if not exists idx_email_delivery_logs_sent_dedupe_key
    on public.email_delivery_logs (dedupe_key)
    where dedupe_key is not null and status = 'sent';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
before update on public.email_templates
for each row
execute function public.touch_updated_at();

alter table public.email_templates enable row level security;
alter table public.email_delivery_logs enable row level security;

revoke all on table public.email_templates from anon;
revoke all on table public.email_delivery_logs from anon;
revoke all on table public.email_templates from authenticated;
revoke all on table public.email_delivery_logs from authenticated;

grant select, insert, update, delete on table public.email_templates to authenticated;
grant select, insert, update, delete on table public.email_delivery_logs to authenticated;
grant usage, select on sequence public.email_delivery_logs_id_seq to authenticated;

drop policy if exists email_templates_admin_manage on public.email_templates;
create policy email_templates_admin_manage on public.email_templates
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

drop policy if exists email_delivery_logs_admin_manage on public.email_delivery_logs;
create policy email_delivery_logs_admin_manage on public.email_delivery_logs
    for all
    to authenticated
    using (public.is_admin_user())
    with check (public.is_admin_user());

insert into public.email_templates (
    template_key,
    name,
    description,
    event_type,
    subject,
    preheader,
    html_body,
    text_body,
    variables,
    active
)
values
(
    'order_confirmation',
    'Confirmacao de encomenda',
    'Enviado depois da encomenda ficar registada/paga. Inclui codigo e link de acompanhamento.',
    'order_confirmation',
    'Confirmacao da encomenda {{order.code}}',
    'Recebemos a sua encomenda. Pode acompanhar o estado na area de tracking.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmacao da encomenda</title>
</head>
<body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Recebemos a sua encomenda. Pode acompanhar o estado na area de tracking.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">IberFlag</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">Encomenda confirmada</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Ola {{customer.name}},</p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;">Recebemos a sua encomenda <strong>{{order.code}}</strong> no valor de <strong>{{order.total}}</strong>.</p>
              <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:20px 0;background:#fafafa;">
                <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:700;">Codigo de tracking</p>
                <p style="margin:0;font-size:20px;line-height:1.4;font-weight:700;letter-spacing:.02em;color:#111827;">{{order.tracking_code}}</p>
              </div>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#4b5563;">Por seguranca, os detalhes completos da encomenda so estao disponiveis na app de acompanhamento.</p>
              <p style="margin:0 0 24px 0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:8px;">Acompanhar encomenda</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Se o botao nao funcionar, abra este link: <a href="{{order.tracking_url}}" style="color:#2563eb;text-decoration:underline;">{{order.tracking_url}}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html$,
    $text$
Ola {{customer.name}},

Recebemos a sua encomenda {{order.code}} no valor de {{order.total}}.

Codigo de tracking: {{order.tracking_code}}
Acompanhar encomenda: {{order.tracking_url}}

Por seguranca, os detalhes completos da encomenda so estao disponiveis na app de acompanhamento.
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.total","label":"Total formatado","group":"Encomenda"},
        {"key":"order.tracking_code","label":"Codigo de tracking","group":"Tracking"},
        {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
        {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
        {"key":"support.email","label":"Email de suporte","group":"Empresa"}
    ]'::jsonb,
    true
),
(
    'order_status_update',
    'Atualizacao de estado',
    'Enviado quando o estado operacional da encomenda muda. O cliente consulta detalhes so pelo tracking.',
    'order_status_update',
    'Atualizacao da encomenda {{order.code}}: {{order.status_label}}',
    'A sua encomenda mudou de estado. Consulte o tracking para ver os detalhes.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Atualizacao de estado</title>
</head>
<body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">Atualizacao de encomenda</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">{{order.status_label}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Ola {{customer.name}},</p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;">A encomenda <strong>{{order.code}}</strong> passou para o estado <strong>{{order.status_label}}</strong>.</p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#4b5563;">Por privacidade, os detalhes completos, historico e tracking so devem ser consultados na app de acompanhamento.</p>
              <p style="margin:0 0 24px 0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:8px;">Ver estado na app</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Codigo de tracking: <strong>{{order.tracking_code}}</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html$,
    $text$
Ola {{customer.name}},

A encomenda {{order.code}} passou para o estado {{order.status_label}}.

Consulte os detalhes na app: {{order.tracking_url}}
Codigo de tracking: {{order.tracking_code}}
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.status","label":"Estado tecnico","group":"Encomenda"},
        {"key":"order.status_label","label":"Estado visivel","group":"Encomenda"},
        {"key":"order.tracking_code","label":"Codigo de tracking","group":"Tracking"},
        {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
        {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
        {"key":"support.email","label":"Email de suporte","group":"Empresa"}
    ]'::jsonb,
    true
),
(
    'invoice_document_ready',
    'Documento fiscal',
    'Enviado quando o documento fiscal fica disponivel ou quando existe uma nota fiscal a consultar.',
    'invoice_document_ready',
    'Documento da encomenda {{order.code}}',
    'Atualizacao sobre o documento fiscal da sua encomenda.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documento fiscal</title>
</head>
<body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">Faturacao</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">Documento da encomenda {{order.code}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Ola {{customer.name}},</p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;">Temos uma atualizacao sobre o documento fiscal da encomenda <strong>{{order.code}}</strong>.</p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#4b5563;">Estado fiscal: <strong>{{invoice.status_label}}</strong></p>
              <p style="margin:0 0 24px 0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:8px;">Consultar na app</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Por seguranca, nao enviamos dados fiscais sensiveis neste email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html$,
    $text$
Ola {{customer.name}},

Temos uma atualizacao sobre o documento fiscal da encomenda {{order.code}}.
Estado fiscal: {{invoice.status_label}}

Consulte na app: {{order.tracking_url}}
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
        {"key":"invoice.status","label":"Estado fiscal tecnico","group":"Faturacao"},
        {"key":"invoice.status_label","label":"Estado fiscal visivel","group":"Faturacao"},
        {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
        {"key":"support.email","label":"Email de suporte","group":"Empresa"}
    ]'::jsonb,
    true
)
on conflict (template_key) do update
set name = excluded.name,
    description = excluded.description,
    event_type = excluded.event_type,
    subject = excluded.subject,
    preheader = excluded.preheader,
    html_body = excluded.html_body,
    text_body = excluded.text_body,
    variables = excluded.variables,
    active = excluded.active,
    updated_at = now();

commit;
