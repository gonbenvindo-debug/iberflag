# Facturalusa API Offline Summary

Last reviewed from official Facturalusa docs on 2026-04-09.

This summary is aimed at the IberFlag production invoicing path.

## 1. Scope and vendor model

Official source:

- [https://facturalusa.pt/documentacao/api/introducao](https://facturalusa.pt/documentacao/api/introducao)

What the vendor states publicly:

- The API is REST.
- Responses are JSON.
- The API can be used in real or test mode.
- Test mode requires a subscribed plan plus a registered testing subscription in the account.
- Base URL is `https://facturalusa.pt/api/v2`.

Implication for IberFlag:

- Your code should treat Facturalusa test and live as distinct business environments.
- Never assume test readiness implies live readiness for:
  - series communication
  - VAT mapping
  - legal wording
  - customer data quality

## 2. Authentication and request limits

Official source:

- [https://facturalusa.pt/documentacao/api/autenticacao](https://facturalusa.pt/documentacao/api/autenticacao)

What matters:

- Authentication is Bearer Token only.
- Public docs mention daily API request limits by plan:
  - Basic: 1000
  - Medium: 2000
  - Large: 3000
  - Custom: negotiated
- If the plan is expired, the API cannot be used.

Practical IberFlag implication:

- Do not design emission flows that repeatedly probe Facturalusa on every page load.
- Cache lookups such as series and VAT rates.
- Persist the Facturalusa customer code and document id so you do not re-search unnecessarily.

## 3. Response model and HTTP errors

Official source:

- [https://facturalusa.pt/documentacao/api/resposta-e-erros](https://facturalusa.pt/documentacao/api/resposta-e-erros)

HTTP statuses explicitly documented:

- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `429` Too Many Requests
- `500`, `502`, `503`, `504` Server Errors

Operational rule:

- Always branch first on HTTP status, then parse the JSON body.
- Never treat a body-only success marker as sufficient.

## 4. High-level endpoint families

Official source:

- [https://facturalusa.pt/documentacao/api](https://facturalusa.pt/documentacao/api)

Relevant groups for IberFlag:

- Sales
  - create
  - update
  - cancel
  - duplicate
  - receipt
  - credit note
  - debit note
  - download
  - send email
  - send sms
  - generate MB reference
  - generate MBWay
  - sign
  - summary
  - find
- Customers
  - create
  - update
  - delete
  - find
- Administration
  - series
  - VAT rates
  - countries
  - VAT exemptions

For IberFlag today, the minimum safe subset is:

- `customers/find`
- `customers/create`
- `sales/create`
- `sales/download`
- `sales/send_email` if you ever delegate emailing to Facturalusa
- `administration/series/find`
- `administration/vatrates/find`

## 5. Customers: create and find

Official sources:

- [https://facturalusa.pt/documentacao/api/clientes/criar](https://facturalusa.pt/documentacao/api/clientes/criar)
- [https://facturalusa.pt/documentacao/api/clientes/procurar](https://facturalusa.pt/documentacao/api/clientes/procurar)

### Create customer

Endpoint:

- `POST /customers`

Documented fields that matter most:

- `code`
- `name` required
- `vat_number`
- `country`
- `address`
- `city`
- `postal_code`
- `email`
- `telephone`
- `mobile`
- `type`
- `vat_exemption_id`
- `vat_type`
- `irs_retention_tax`
- `receive_sms`
- `receive_emails`
- `language`
- `addresses`

Important public notes:

- Customer is created active by default.
- Mobile should avoid spaces and `+351`.
- `language` accepts `Auto`, `PT`, `EN`.

### Find customer

Endpoint:

- `POST /customers/find`

Documented search keys:

- `ID`
- `Code`
- `Name`
- `Email`
- `Vat Number`
- `Mobile`

Recommended IberFlag strategy:

- Prefer exact search by `Vat Number` first for business customers.
- Fall back to `Email` only when that aligns with your own anti-corruption rules.
- Never overwrite an existing internal customer record from Facturalusa data without a deterministic merge policy.

## 6. Sales create: this is the core invoicing endpoint

Official source:

- [https://facturalusa.pt/documentacao/api/vendas/criar](https://facturalusa.pt/documentacao/api/vendas/criar)

Endpoint:

- `POST /sales`

Publicly documented document families supported through this endpoint include:

- Factura
- Factura Recibo
- Factura Simplificada
- Nota de Credito
- Nota de Debito
- Factura Pro-forma
- Orcamento
- Encomenda
- Guia de Transporte
- Guia de Remessa
- Guia de Consignacao
- Guia de Devolucao

The docs state that the endpoint already returns a document download URL, making an immediate follow-up download call unnecessary in many cases.

### Core request fields

Documented fields most relevant to IberFlag:

- `issue_date` required
- `due_date`
- `document_type` required
- `serie`
- `customer` required
- `vat_number`
- `address` required
- `city` required
- `postal_code` required
- `country`
- `currency`
- `currency_exchange`
- `vat_type` required
- `observations`
- `status` required
- `language`
- `format`
- `paid_callback_url`
- `items` required

### Item fields

Documented item fields:

- `id` required
- `details`
- `price` required
- `quantity` required
- `discount`
- `vat` required
- `vat_exemption`

### Status

The docs state that `status` must be one of:

- `Rascunho`
- `Terminado`

Recommended IberFlag rule:

- Use `Rascunho` only if you have a deliberate manual review flow.
- For automated live emission, do not send `Terminado` unless all fiscal checks have already passed.

## 7. VAT fields in Facturalusa

Official sources:

- [https://facturalusa.pt/documentacao/api/vendas/criar](https://facturalusa.pt/documentacao/api/vendas/criar)
- [https://facturalusa.pt/documentacao/api/vendas/sumario](https://facturalusa.pt/documentacao/api/vendas/sumario)
- [https://facturalusa.pt/documentacao/api/isencoes-iva](https://facturalusa.pt/documentacao/api/isencoes-iva)
- [https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar](https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar)

### `vat_type`

Documented accepted values:

- `Debitar IVA`
- `IVA incluido`
- `Nao fazer nada`

Interpretation for implementation:

- `Debitar IVA` means VAT is added on top according to the applied VAT rate.
- `IVA incluido` means gross pricing includes VAT.
- `Nao fazer nada` is a special path and needs care.

Publicly documented constraint:

- In update docs, Facturalusa explicitly says that with `Nao fazer nada`, all document lines must have VAT `0%` and the corresponding VAT exemption reason applied.

### `vat`

The line-level VAT field can be:

- id
- description
- percentage or tax number such as `23`

### `vat_exemption`

The docs say the exemption can be sent by:

- internal id
- code such as `M08`

If omitted, the default is:

- `M18 - Sem isencao`

Important published examples from the exemption table:

- `M16` - Isento Artigo 14 do RITI or similar
- `M18` - Sem isencao
- `M19` - IVA regime forfetario
- `M21` - IVA nao confere direito a deducao
- `M30`, `M31`, `M32`, `M34`, `M40` - various autoliquidacao or reverse-charge style codes

Critical IberFlag implication:

- Facturalusa does not choose the correct exemption code for you.
- Your app must map the fiscal scenario to the exact `vat_type`, `vat`, and `vat_exemption`.

## 8. Facturalusa summary endpoint is useful before emission

Official source:

- [https://facturalusa.pt/documentacao/api/vendas/sumario](https://facturalusa.pt/documentacao/api/vendas/sumario)

Why this matters:

- It can calculate totals in real time before final emission.
- It uses the same fiscal parameters:
  - document type
  - VAT type
  - VAT rates
  - exemptions
  - items

Recommended use:

- Before live `sales/create` with `Terminado`, call `sales/summary` with the exact payload class you intend to emit.
- Persist the computed totals and compare them to your internal order total.
- If totals differ, stop and surface a fiscal mismatch state.

## 9. Document delivery and callbacks

Official sources:

- [https://facturalusa.pt/documentacao/api/vendas/criar](https://facturalusa.pt/documentacao/api/vendas/criar)
- [https://facturalusa.pt/documentacao/api/vendas/enviar-email](https://facturalusa.pt/documentacao/api/vendas/enviar-email)

Published details:

- `paid_callback_url` exists on sales creation and is described as the URL Facturalusa should notify when an invoice, pro-forma, quote, or order is paid.
- There is also a `sales/:id/send_email` endpoint for sending a document by email.

What is not obvious from the public docs:

- no public signature verification model was found for the callback
- no public reliability or retry contract was found
- no public event schema comparable to Stripe webhooks was found

Conservative recommendation:

- Do not rely on Facturalusa callbacks as the only source of truth.
- Treat them as optional notifications, not canonical payment confirmation.
- Keep Stripe as the source of payment truth, and use Facturalusa for fiscal document state.

## 10. Series and VAT rate discovery

Official sources:

- [https://facturalusa.pt/documentacao/api/administracao-series/procurar](https://facturalusa.pt/documentacao/api/administracao-series/procurar)
- [https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar](https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar)

### Series find

Endpoint:

- `POST /administration/series/find`

Response shape in public docs:

- `id`
- `description`

### VAT rates find

Endpoint:

- `PUT /administration/vatrates/find`

Response shape in public docs:

- `id`
- `description`
- `type`
- `tax`
- `saft_region`

Recommended IberFlag rule:

- Resolve and cache the exact series and VAT-rate IDs you intend to use in live mode.
- Do not hardcode only free-text names if the fiscal setup may vary per account.

## 11. Countries and address handling

Official source:

- [https://facturalusa.pt/documentacao/api/paises](https://facturalusa.pt/documentacao/api/paises)

Published behavior:

- `country` can be the English country name or the ISO code.

Recommended IberFlag rule:

- Normalize countries to ISO 2 codes internally and only transform if Facturalusa account behavior requires something else.
- Keep original customer-entered country, normalized country, and emitted country in the audit trail.

## 12. Published constraints and known error cases

Official sources:

- [https://facturalusa.pt/documentacao/api/vendas/criar](https://facturalusa.pt/documentacao/api/vendas/criar)
- [https://facturalusa.pt/documentacao/api/vendas/actualizar](https://facturalusa.pt/documentacao/api/vendas/actualizar)

Documented errors that matter most:

- must include at least one item
- max 100 items per document
- customer VAT number may already be blocked or recorded and not changeable
- selected series may not be communicated to AT for the selected document type
- line unit price cannot be negative
- when VAT exemption exists, VAT rate must be zero
- with `Nao fazer nada`, all lines must be `0%` VAT and the proper exemption reason must be applied
- transport guides require transport start date
- total cannot be negative or zero
- plan invoice volume limits can block emission
- some invoices require customer identification and domicile when total is at least `1000.00`

Why this matters:

- You cannot safely "just send the payload and see what happens" in live mode.
- Fiscal validation must happen before the final emission call.

## 13. Missing pieces in public docs

What I did not find publicly documented on 2026-04-09:

- a published VIES validation feature in Facturalusa API
- a published endpoint specifically for VAT-number validation against VIES
- a published webhook signing or verification model
- a public compliance matrix that maps fiscal scenario to `vat_type` and `vat_exemption`

This means:

- VIES validation must be treated as an IberFlag responsibility unless Facturalusa support confirms otherwise in writing.
- The fiscal regime mapping must be designed by you and approved by your accountant.

## 14. Recommended Facturalusa adapter behavior for IberFlag

Before live emission:

1. Resolve fiscal scenario from your own rules engine.
2. Resolve series and VAT-rate IDs from Facturalusa.
3. Resolve exemption code if applicable.
4. Optionally pre-create or reconcile the customer.
5. Call `sales/summary`.
6. Compare totals.
7. Only then call `sales/create`.

After emission:

1. Store Facturalusa document id.
2. Store document number.
3. Store download URL if returned.
4. Store emitted VAT type, VAT rate, exemption code, country, and customer VAT number.
5. Store any vendor response body and traceable error payload.

## 15. Facturalusa-specific go-live rules

Non-negotiable:

1. No live invoice emission without an accountant-approved mapping of VAT scenarios to `vat_type` and `vat_exemption`.
2. No live invoice emission if the selected series is not confirmed and communicated to AT.
3. No zero-VAT or reverse-charge automation without an explicit evidence policy.
4. No silent fallback from an invalid fiscal scenario to `M18`.
5. No mutation of already-emitted invoices unless the document state and vendor rules explicitly allow it.

Strongly recommended:

1. Add a manual review queue for uncertain VAT scenarios.
2. Save the exact payload sent to Facturalusa for every emitted document.
3. Save the exact response returned by Facturalusa.
4. Keep a printable audit trail per order.

## 16. Source list

- [https://facturalusa.pt/documentacao/api/introducao](https://facturalusa.pt/documentacao/api/introducao)
- [https://facturalusa.pt/documentacao/api/autenticacao](https://facturalusa.pt/documentacao/api/autenticacao)
- [https://facturalusa.pt/documentacao/api/resposta-e-erros](https://facturalusa.pt/documentacao/api/resposta-e-erros)
- [https://facturalusa.pt/documentacao/api/vendas/criar](https://facturalusa.pt/documentacao/api/vendas/criar)
- [https://facturalusa.pt/documentacao/api/vendas/sumario](https://facturalusa.pt/documentacao/api/vendas/sumario)
- [https://facturalusa.pt/documentacao/api/vendas/actualizar](https://facturalusa.pt/documentacao/api/vendas/actualizar)
- [https://facturalusa.pt/documentacao/api/vendas/enviar-email](https://facturalusa.pt/documentacao/api/vendas/enviar-email)
- [https://facturalusa.pt/documentacao/api/clientes/criar](https://facturalusa.pt/documentacao/api/clientes/criar)
- [https://facturalusa.pt/documentacao/api/clientes/procurar](https://facturalusa.pt/documentacao/api/clientes/procurar)
- [https://facturalusa.pt/documentacao/api/paises](https://facturalusa.pt/documentacao/api/paises)
- [https://facturalusa.pt/documentacao/api/isencoes-iva](https://facturalusa.pt/documentacao/api/isencoes-iva)
- [https://facturalusa.pt/documentacao/api/administracao-series/procurar](https://facturalusa.pt/documentacao/api/administracao-series/procurar)
- [https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar](https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar)
