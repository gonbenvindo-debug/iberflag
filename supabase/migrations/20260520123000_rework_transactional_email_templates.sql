begin;

update public.email_templates
set active = false,
    updated_at = now()
where template_key in ('order_confirmation', 'order_status_update', 'invoice_document_ready');

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
    'order_confirmation_preparacao',
    'Confirmacao de encomenda (Em preparacao)',
    'Email enviado apos pagamento confirmado. Estado inicial: Em preparacao.',
    'order_confirmation_preparacao',
    'Encomenda {{order.code}} confirmada',
    'Recebemos a sua encomenda e ja esta em preparacao.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmacao de encomenda</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 24px 16px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#6b7280;">IberFlag</p>
              <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;">Encomenda confirmada</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;">Ola {{customer.name}}, recebemos a sua encomenda.</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Numero:</strong> {{order.code}}</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Total:</strong> {{order.total}}</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Estado:</strong> Em preparacao</p>
              <p style="margin:16px 0 0 0;font-size:14px;line-height:22px;">Pode acompanhar aqui: <a href="{{order.tracking_url}}" style="color:#1d4ed8;text-decoration:underline;">{{order.tracking_url}}</a></p>
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

Recebemos a sua encomenda {{order.code}}.
Total: {{order.total}}
Estado: Em preparacao

Acompanhe aqui: {{order.tracking_url}}
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.total","label":"Total formatado","group":"Encomenda"},
        {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"}
    ]'::jsonb,
    true
),
(
    'invoice_issued_with_attachment',
    'Fatura emitida com anexo',
    'Email fiscal enviado apenas quando o PDF da fatura esta anexado.',
    'invoice_issued_with_attachment',
    'Fatura da encomenda {{order.code}}',
    'A sua fatura foi emitida e segue em anexo.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fatura emitida</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 24px 16px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#6b7280;">IberFlag</p>
              <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;">Fatura emitida</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;">Ola {{customer.name}}, a fatura da sua encomenda foi emitida.</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Numero da encomenda:</strong> {{order.code}}</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Total:</strong> {{order.total}}</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Estado fiscal:</strong> {{invoice.status_label}}</p>
              <p style="margin:16px 0 0 0;font-size:14px;line-height:22px;">A fatura segue em anexo neste email.</p>
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

A fatura da encomenda {{order.code}} foi emitida.
Total: {{order.total}}
Estado fiscal: {{invoice.status_label}}

A fatura segue em anexo neste email.
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.total","label":"Total formatado","group":"Encomenda"},
        {"key":"invoice.status_label","label":"Estado fiscal visivel","group":"Faturacao"}
    ]'::jsonb,
    true
),
(
    'order_status_expedido',
    'Estado da encomenda: Expedida',
    'Email enviado quando a encomenda muda para Expedida.',
    'order_status_expedido',
    'Encomenda {{order.code}} expedida',
    'A sua encomenda foi expedida.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Encomenda expedida</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 24px 16px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#6b7280;">IberFlag</p>
              <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;">Encomenda expedida</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;">Ola {{customer.name}}, a encomenda {{order.code}} foi expedida.</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;"><strong>Codigo de tracking:</strong> {{order.tracking_code}}</p>
              <p style="margin:16px 0 0 0;font-size:14px;line-height:22px;">Acompanhe aqui: <a href="{{order.tracking_url}}" style="color:#1d4ed8;text-decoration:underline;">{{order.tracking_url}}</a></p>
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

A encomenda {{order.code}} foi expedida.
Codigo de tracking: {{order.tracking_code}}

Acompanhe aqui: {{order.tracking_url}}
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.tracking_code","label":"Codigo de tracking","group":"Tracking"},
        {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"}
    ]'::jsonb,
    true
),
(
    'order_status_entregue',
    'Estado da encomenda: Entregue',
    'Email enviado quando a encomenda muda para Entregue.',
    'order_status_entregue',
    'Encomenda {{order.code}} entregue',
    'A sua encomenda foi entregue.',
    $html$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Encomenda entregue</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 24px 16px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#6b7280;">IberFlag</p>
              <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;">Encomenda entregue</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;">Ola {{customer.name}}, a encomenda {{order.code}} foi entregue.</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;">Obrigado pela sua compra.</p>
              <p style="margin:16px 0 0 0;font-size:14px;line-height:22px;">Historico e detalhes: <a href="{{order.tracking_url}}" style="color:#1d4ed8;text-decoration:underline;">{{order.tracking_url}}</a></p>
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

A encomenda {{order.code}} foi entregue.
Obrigado pela sua compra.

Historico e detalhes: {{order.tracking_url}}
$text$,
    '[
        {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
        {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
        {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"}
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
