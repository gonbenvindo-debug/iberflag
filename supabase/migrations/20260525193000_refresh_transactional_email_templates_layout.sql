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
    'order_confirmation',
    'Confirmacao de encomenda',
    'Layout visual de confirmacao de encomenda com detalhe de linhas e totais.',
    'order_confirmation',
    'Confirmacao da encomenda {{order.code}}',
    'Recebemos a sua encomenda e ja estamos a preparar tudo.',
    $html_order$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmacao da encomenda</title>
</head>
<body style="margin:0;padding:0;background:#f4f8fb;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Recebemos a sua encomenda e ja estamos a preparar tudo.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fb;">
    <tr>
      <td align="center" style="padding:22px 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border:1px solid #dbe7ee;">
          <tr>
            <td align="center" style="padding:22px 28px 14px;font-family:Arial,Helvetica,sans-serif;color:#15313b;border-bottom:1px solid #eef4f7;">
              <p style="margin:0;font-size:26px;line-height:30px;font-weight:700;letter-spacing:.01em;">{{company.name}}</p>
              <p style="margin:8px 0 0;font-size:18px;line-height:24px;font-weight:700;text-transform:uppercase;">Confirmacao da encomenda</p>
              <p style="margin:8px 0 0;font-size:11px;line-height:18px;color:#7c8b93;">Nao responda a este email. Data: {{order.date_short}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#35bfd6;color:#ffffff;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:18px;font-weight:700;">Referencia da encomenda: {{order.code}}</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:18px;">Tracking: {{order.tracking_code}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#15313b;">
              <p style="margin:0;font-size:14px;line-height:22px;">Ola {{customer.name}}, recebemos a sua encomenda e o pagamento foi confirmado.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding:0 18px 0 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:18px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Cliente</p>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#15313b;font-weight:700;">{{customer.name}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.email}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.phone}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.tax_id}}</p>
                    <p style="margin:10px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.address_line_1}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.address_line_2}}</p>
                  </td>
                  <td valign="top" width="50%" style="padding:0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:18px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Envio</p>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#15313b;font-weight:700;">Entrega da encomenda</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.shipping_address_line_1}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.shipping_address_line_2}}</p>
                    <p style="margin:10px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Estado: {{order.status_label}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Total: {{order.total}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:14px;line-height:20px;font-weight:700;color:#35bfd6;text-align:center;text-transform:uppercase;">Detalhes da sua encomenda</p>
              {{{order.items_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              {{{order.summary_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 18px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 14px;font-size:12px;line-height:19px;color:#5a6d77;">Pode acompanhar o estado e o historico da encomenda no link abaixo.</p>
              <p style="margin:0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;padding:12px 18px;background:#15313b;color:#ffffff;text-decoration:none;font-size:13px;line-height:16px;font-weight:700;">Acompanhar encomenda</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:18px;color:#7c8b93;">Se o botao nao funcionar, abra este link: <a href="{{order.tracking_url}}" style="color:#2277b8;text-decoration:underline;">{{order.tracking_url}}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f7fbfc;border-top:1px solid #e7f0f4;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding:0 14px 0 0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Precisa de ajuda?</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{support.email}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">{{support.phone}}</p>
                  </td>
                  <td valign="top" width="50%" style="padding:0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">{{company.name}}</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{company.website}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">Email automatico transacional</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html_order$,
    $text_order$
Ola {{customer.name}},

Recebemos a sua encomenda {{order.code}} e o pagamento foi confirmado.
Data: {{order.date_short}}
Estado: {{order.status_label}}
Tracking: {{order.tracking_code}}

Cliente:
{{customer.name}}
{{customer.email}}
{{customer.phone}}
{{customer.tax_id}}
{{customer.address_line_1}}
{{customer.address_line_2}}

Linhas da encomenda:
{{order.items_text}}

{{order.summary_text}}

Acompanhar encomenda:
{{order.tracking_url}}

Suporte: {{support.email}}
$text_order$,
    '[
      {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
      {"key":"customer.email","label":"Email do cliente","group":"Cliente"},
      {"key":"customer.phone","label":"Telefone","group":"Cliente"},
      {"key":"customer.tax_id","label":"NIF","group":"Cliente"},
      {"key":"customer.address_line_1","label":"Morada","group":"Cliente"},
      {"key":"customer.address_line_2","label":"Codigo postal e cidade","group":"Cliente"},
      {"key":"customer.shipping_address_line_1","label":"Morada de envio","group":"Cliente"},
      {"key":"customer.shipping_address_line_2","label":"Codigo postal e cidade envio","group":"Cliente"},
      {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
      {"key":"order.date_short","label":"Data curta","group":"Encomenda"},
      {"key":"order.status_label","label":"Estado visivel","group":"Encomenda"},
      {"key":"order.total","label":"Total formatado","group":"Encomenda"},
      {"key":"order.tracking_code","label":"Codigo de tracking","group":"Tracking"},
      {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
      {"key":"order.items_text","label":"Linhas em texto","group":"Encomenda"},
      {"key":"order.items_table_html","label":"Tabela HTML de itens","group":"Encomenda"},
      {"key":"order.summary_table_html","label":"Tabela HTML de totais","group":"Encomenda"},
      {"key":"order.summary_text","label":"Totais em texto","group":"Encomenda"},
      {"key":"support.email","label":"Email de suporte","group":"Empresa"},
      {"key":"support.phone","label":"Telefone de suporte","group":"Empresa"},
      {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
      {"key":"company.website","label":"Site","group":"Empresa"}
    ]'::jsonb,
    true
),
(
    'order_confirmation_preparacao',
    'Confirmacao de encomenda (Em preparacao)',
    'Layout visual de confirmacao de encomenda com detalhe de linhas e totais.',
    'order_confirmation_preparacao',
    'Confirmacao da encomenda {{order.code}}',
    'Recebemos a sua encomenda e ja estamos a preparar tudo.',
    $html_order$
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmacao da encomenda</title>
</head>
<body style="margin:0;padding:0;background:#f4f8fb;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Recebemos a sua encomenda e ja estamos a preparar tudo.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fb;">
    <tr>
      <td align="center" style="padding:22px 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border:1px solid #dbe7ee;">
          <tr>
            <td align="center" style="padding:22px 28px 14px;font-family:Arial,Helvetica,sans-serif;color:#15313b;border-bottom:1px solid #eef4f7;">
              <p style="margin:0;font-size:26px;line-height:30px;font-weight:700;letter-spacing:.01em;">{{company.name}}</p>
              <p style="margin:8px 0 0;font-size:18px;line-height:24px;font-weight:700;text-transform:uppercase;">Confirmacao da encomenda</p>
              <p style="margin:8px 0 0;font-size:11px;line-height:18px;color:#7c8b93;">Nao responda a este email. Data: {{order.date_short}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#35bfd6;color:#ffffff;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:18px;font-weight:700;">Referencia da encomenda: {{order.code}}</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:18px;">Tracking: {{order.tracking_code}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#15313b;">
              <p style="margin:0;font-size:14px;line-height:22px;">Ola {{customer.name}}, recebemos a sua encomenda e o pagamento foi confirmado.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding:0 18px 0 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:18px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Cliente</p>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#15313b;font-weight:700;">{{customer.name}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.email}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.phone}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.tax_id}}</p>
                    <p style="margin:10px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.address_line_1}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.address_line_2}}</p>
                  </td>
                  <td valign="top" width="50%" style="padding:0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:18px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Envio</p>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#15313b;font-weight:700;">Entrega da encomenda</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.shipping_address_line_1}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:19px;color:#4d626d;">{{customer.shipping_address_line_2}}</p>
                    <p style="margin:10px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Estado: {{order.status_label}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Total: {{order.total}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:14px;line-height:20px;font-weight:700;color:#35bfd6;text-align:center;text-transform:uppercase;">Detalhes da sua encomenda</p>
              {{{order.items_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              {{{order.summary_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 18px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 14px;font-size:12px;line-height:19px;color:#5a6d77;">Pode acompanhar o estado e o historico da encomenda no link abaixo.</p>
              <p style="margin:0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;padding:12px 18px;background:#15313b;color:#ffffff;text-decoration:none;font-size:13px;line-height:16px;font-weight:700;">Acompanhar encomenda</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:18px;color:#7c8b93;">Se o botao nao funcionar, abra este link: <a href="{{order.tracking_url}}" style="color:#2277b8;text-decoration:underline;">{{order.tracking_url}}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f7fbfc;border-top:1px solid #e7f0f4;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding:0 14px 0 0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Precisa de ajuda?</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{support.email}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">{{support.phone}}</p>
                  </td>
                  <td valign="top" width="50%" style="padding:0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">{{company.name}}</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{company.website}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">Email automatico transacional</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
$html_order$,
    $text_order$
Ola {{customer.name}},

Recebemos a sua encomenda {{order.code}} e o pagamento foi confirmado.
Data: {{order.date_short}}
Estado: {{order.status_label}}
Tracking: {{order.tracking_code}}

Cliente:
{{customer.name}}
{{customer.email}}
{{customer.phone}}
{{customer.tax_id}}
{{customer.address_line_1}}
{{customer.address_line_2}}

Linhas da encomenda:
{{order.items_text}}

{{order.summary_text}}

Acompanhar encomenda:
{{order.tracking_url}}

Suporte: {{support.email}}
$text_order$,
    '[
      {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
      {"key":"customer.email","label":"Email do cliente","group":"Cliente"},
      {"key":"customer.phone","label":"Telefone","group":"Cliente"},
      {"key":"customer.tax_id","label":"NIF","group":"Cliente"},
      {"key":"customer.address_line_1","label":"Morada","group":"Cliente"},
      {"key":"customer.address_line_2","label":"Codigo postal e cidade","group":"Cliente"},
      {"key":"customer.shipping_address_line_1","label":"Morada de envio","group":"Cliente"},
      {"key":"customer.shipping_address_line_2","label":"Codigo postal e cidade envio","group":"Cliente"},
      {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
      {"key":"order.date_short","label":"Data curta","group":"Encomenda"},
      {"key":"order.status_label","label":"Estado visivel","group":"Encomenda"},
      {"key":"order.total","label":"Total formatado","group":"Encomenda"},
      {"key":"order.tracking_code","label":"Codigo de tracking","group":"Tracking"},
      {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
      {"key":"order.items_text","label":"Linhas em texto","group":"Encomenda"},
      {"key":"order.items_table_html","label":"Tabela HTML de itens","group":"Encomenda"},
      {"key":"order.summary_table_html","label":"Tabela HTML de totais","group":"Encomenda"},
      {"key":"order.summary_text","label":"Totais em texto","group":"Encomenda"},
      {"key":"support.email","label":"Email de suporte","group":"Empresa"},
      {"key":"support.phone","label":"Telefone de suporte","group":"Empresa"},
      {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
      {"key":"company.website","label":"Site","group":"Empresa"}
    ]'::jsonb,
    true
),
(
    'invoice_document_ready',
    'Documento fiscal',
    'Layout visual para atualizacao sobre o documento fiscal da encomenda.',
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
      <td align="center" style="padding:22px 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border:1px solid #dbe7ee;">
          <tr>
            <td align="center" style="padding:22px 28px 14px;font-family:Arial,Helvetica,sans-serif;color:#15313b;border-bottom:1px solid #eef4f7;">
              <p style="margin:0;font-size:26px;line-height:30px;font-weight:700;letter-spacing:.01em;">{{company.name}}</p>
              <p style="margin:8px 0 0;font-size:18px;line-height:24px;font-weight:700;text-transform:uppercase;">Documento fiscal da encomenda</p>
              <p style="margin:8px 0 0;font-size:11px;line-height:18px;color:#7c8b93;">Nao responda a este email. Data: {{order.date_short}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#35bfd6;color:#ffffff;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:18px;font-weight:700;">Encomenda: {{order.code}}</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:18px;">Estado fiscal: {{invoice.status_label}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#15313b;">
              <p style="margin:0;font-size:14px;line-height:22px;">Ola {{customer.name}}, temos uma atualizacao sobre o documento fiscal da sua encomenda.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:14px 16px;border:1px solid #dfeaf0;background:#f7fbfc;">
                    <p style="margin:0;font-size:12px;line-height:19px;color:#15313b;font-weight:700;">Documento fiscal</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Numero: {{invoice.document_number}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Estado: {{invoice.status_label}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:14px;line-height:20px;font-weight:700;color:#35bfd6;text-align:center;text-transform:uppercase;">Resumo da encomenda</p>
              {{{order.items_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              {{{order.summary_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 18px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 14px;font-size:12px;line-height:19px;color:#5a6d77;">Pode acompanhar a encomenda e futuras atualizacoes no link abaixo.</p>
              <p style="margin:0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;padding:12px 18px;background:#15313b;color:#ffffff;text-decoration:none;font-size:13px;line-height:16px;font-weight:700;">Abrir area da encomenda</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f7fbfc;border-top:1px solid #e7f0f4;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding:0 14px 0 0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Precisa de ajuda?</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{support.email}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">{{support.phone}}</p>
                  </td>
                  <td valign="top" width="50%" style="padding:0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">{{company.name}}</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{company.website}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">Email automatico transacional</p>
                  </td>
                </tr>
              </table>
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

Temos uma atualizacao sobre o documento fiscal da sua encomenda {{order.code}}.
Estado fiscal: {{invoice.status_label}}
Numero do documento: {{invoice.document_number}}

Resumo da encomenda:
{{order.items_text}}

{{order.summary_text}}

Area da encomenda:
{{order.tracking_url}}

Suporte: {{support.email}}
$text_invoice_ready$,
    '[
      {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
      {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
      {"key":"order.date_short","label":"Data curta","group":"Encomenda"},
      {"key":"order.items_text","label":"Linhas em texto","group":"Encomenda"},
      {"key":"order.items_table_html","label":"Tabela HTML de itens","group":"Encomenda"},
      {"key":"order.summary_table_html","label":"Tabela HTML de totais","group":"Encomenda"},
      {"key":"order.summary_text","label":"Totais em texto","group":"Encomenda"},
      {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
      {"key":"invoice.status_label","label":"Estado fiscal visivel","group":"Faturacao"},
      {"key":"invoice.document_number","label":"Numero do documento","group":"Faturacao"},
      {"key":"support.email","label":"Email de suporte","group":"Empresa"},
      {"key":"support.phone","label":"Telefone de suporte","group":"Empresa"},
      {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
      {"key":"company.website","label":"Site","group":"Empresa"}
    ]'::jsonb,
    true
),
(
    'invoice_issued_with_attachment',
    'Fatura emitida com anexo',
    'Layout visual para email da fatura com anexo.',
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
      <td align="center" style="padding:22px 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border:1px solid #dbe7ee;">
          <tr>
            <td align="center" style="padding:22px 28px 14px;font-family:Arial,Helvetica,sans-serif;color:#15313b;border-bottom:1px solid #eef4f7;">
              <p style="margin:0;font-size:26px;line-height:30px;font-weight:700;letter-spacing:.01em;">{{company.name}}</p>
              <p style="margin:8px 0 0;font-size:18px;line-height:24px;font-weight:700;text-transform:uppercase;">Fatura da encomenda</p>
              <p style="margin:8px 0 0;font-size:11px;line-height:18px;color:#7c8b93;">Nao responda a este email. Data: {{order.date_short}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#35bfd6;color:#ffffff;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:18px;font-weight:700;">Encomenda: {{order.code}}</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:18px;">Documento fiscal: {{invoice.document_number}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#15313b;">
              <p style="margin:0;font-size:14px;line-height:22px;">Ola {{customer.name}}, a sua fatura foi emitida e segue em anexo neste email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:14px 16px;border:1px solid #dfeaf0;background:#f7fbfc;">
                    <p style="margin:0;font-size:12px;line-height:19px;color:#15313b;font-weight:700;">Documento fiscal anexado</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Numero: {{invoice.document_number}}</p>
                    <p style="margin:3px 0 0;font-size:12px;line-height:19px;color:#4d626d;">Estado: {{invoice.status_label}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:14px;line-height:20px;font-weight:700;color:#35bfd6;text-align:center;text-transform:uppercase;">Resumo da encomenda</p>
              {{{order.items_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
              {{{order.summary_table_html}}}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 18px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 14px;font-size:12px;line-height:19px;color:#5a6d77;">Guardamos tambem o estado e o historico da encomenda na sua area de acompanhamento.</p>
              <p style="margin:0;">
                <a href="{{order.tracking_url}}" style="display:inline-block;padding:12px 18px;background:#15313b;color:#ffffff;text-decoration:none;font-size:13px;line-height:16px;font-weight:700;">Abrir area da encomenda</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f7fbfc;border-top:1px solid #e7f0f4;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top" width="50%" style="padding:0 14px 0 0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">Precisa de ajuda?</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{support.email}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">{{support.phone}}</p>
                  </td>
                  <td valign="top" width="50%" style="padding:0;">
                    <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;color:#35bfd6;text-transform:uppercase;">{{company.name}}</p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#4d626d;">{{company.website}}</p>
                    <p style="margin:2px 0 0;font-size:12px;line-height:18px;color:#4d626d;">Email automatico transacional</p>
                  </td>
                </tr>
              </table>
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

A sua fatura da encomenda {{order.code}} foi emitida e segue em anexo.
Numero do documento: {{invoice.document_number}}
Estado fiscal: {{invoice.status_label}}

Resumo da encomenda:
{{order.items_text}}

{{order.summary_text}}

Area da encomenda:
{{order.tracking_url}}

Suporte: {{support.email}}
$text_invoice_attachment$,
    '[
      {"key":"customer.name","label":"Nome do cliente","group":"Cliente"},
      {"key":"order.code","label":"Numero da encomenda","group":"Encomenda"},
      {"key":"order.date_short","label":"Data curta","group":"Encomenda"},
      {"key":"order.items_text","label":"Linhas em texto","group":"Encomenda"},
      {"key":"order.items_table_html","label":"Tabela HTML de itens","group":"Encomenda"},
      {"key":"order.summary_table_html","label":"Tabela HTML de totais","group":"Encomenda"},
      {"key":"order.summary_text","label":"Totais em texto","group":"Encomenda"},
      {"key":"order.tracking_url","label":"Link de acompanhamento","group":"Tracking"},
      {"key":"invoice.status_label","label":"Estado fiscal visivel","group":"Faturacao"},
      {"key":"invoice.document_number","label":"Numero do documento","group":"Faturacao"},
      {"key":"support.email","label":"Email de suporte","group":"Empresa"},
      {"key":"support.phone","label":"Telefone de suporte","group":"Empresa"},
      {"key":"company.name","label":"Nome da empresa","group":"Empresa"},
      {"key":"company.website","label":"Site","group":"Empresa"}
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
