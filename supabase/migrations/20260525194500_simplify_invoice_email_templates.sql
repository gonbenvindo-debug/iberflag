begin;

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
    'invoice_document_ready',
    'Documento fiscal',
    'Template simples para atualizacao do documento fiscal.',
    'invoice_document_ready',
    'Documento da encomenda {{order.code}}',
    'Atualizacao sobre o documento fiscal da sua encomenda.',
    $html_invoice_ready$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documento fiscal</title>
</head>
<body style="margin:0;padding:0;background:#f4f8fb;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Atualizacao sobre o documento fiscal da sua encomenda.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fb;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe7ee;">
          <tr>
            <td style="padding:28px 28px 18px;font-family:Arial,Helvetica,sans-serif;color:#15313b;border-bottom:1px solid #eef4f7;">
              <p style="margin:0;font-size:22px;line-height:28px;font-weight:700;">{{company.name}}</p>
              <p style="margin:10px 0 0;font-size:18px;line-height:24px;font-weight:700;">Documento fiscal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-family:Arial,Helvetica,sans-serif;color:#15313b;">
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;">Ola {{customer.name}},</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:22px;">Temos uma atualizacao sobre o documento fiscal da encomenda <strong>{{order.code}}</strong>.</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:22px;">Estado fiscal: <strong>{{invoice.status_label}}</strong>.</p>
              <p style="margin:0;font-size:14px;line-height:22px;">Numero do documento: <strong>{{invoice.document_number}}</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:19px;color:#60737d;">Se precisar de ajuda, responda para {{support.email}}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html_invoice_ready$,
    $text_invoice_ready$
Ola {{customer.name}},

Temos uma atualizacao sobre o documento fiscal da encomenda {{order.code}}.
Estado fiscal: {{invoice.status_label}}
Numero do documento: {{invoice.document_number}}

Suporte: {{support.email}}
$text_invoice_ready$,
    '[
      {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
      {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
      {"key":"invoice.status_label","label":"Estado fiscal visivel","group":"Faturacao"},
      {"key":"invoice.document_number","label":"Numero do documento","group":"Faturacao"},
      {"key":"support.email","label":"Email de suporte","group":"Empresa"},
      {"key":"company.name","label":"Nome da empresa","group":"Empresa"}
    ]'::jsonb,
    true
),
(
    'invoice_issued_with_attachment',
    'Fatura emitida com anexo',
    'Template simples para envio da fatura em anexo.',
    'invoice_issued_with_attachment',
    'Fatura da encomenda {{order.code}}',
    'A sua fatura foi emitida e segue em anexo.',
    $html_invoice_attachment$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fatura emitida</title>
</head>
<body style="margin:0;padding:0;background:#f4f8fb;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">A sua fatura foi emitida e segue em anexo.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fb;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe7ee;">
          <tr>
            <td style="padding:28px 28px 18px;font-family:Arial,Helvetica,sans-serif;color:#15313b;border-bottom:1px solid #eef4f7;">
              <p style="margin:0;font-size:22px;line-height:28px;font-weight:700;">{{company.name}}</p>
              <p style="margin:10px 0 0;font-size:18px;line-height:24px;font-weight:700;">Fatura emitida</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-family:Arial,Helvetica,sans-serif;color:#15313b;">
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;">Ola {{customer.name}},</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:22px;">A fatura da encomenda <strong>{{order.code}}</strong> foi emitida.</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:22px;">Numero do documento: <strong>{{invoice.document_number}}</strong>.</p>
              <p style="margin:0;font-size:14px;line-height:22px;">A fatura segue em anexo neste email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:19px;color:#60737d;">Se precisar de ajuda, responda para {{support.email}}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html_invoice_attachment$,
    $text_invoice_attachment$
Ola {{customer.name}},

A fatura da encomenda {{order.code}} foi emitida.
Numero do documento: {{invoice.document_number}}

A fatura segue em anexo neste email.

Suporte: {{support.email}}
$text_invoice_attachment$,
    '[
      {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
      {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
      {"key":"invoice.document_number","label":"Numero do documento","group":"Faturacao"},
      {"key":"support.email","label":"Email de suporte","group":"Empresa"},
      {"key":"company.name","label":"Nome da empresa","group":"Empresa"}
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
