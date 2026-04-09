# Offline API Reference

Last curated from official online sources on 2026-04-09.

Purpose:

- keep a local, searchable reference pack for the invoicing and payment stack
- reduce the need to browse during implementation work
- document the limits of what Stripe and Facturalusa do, and what IberFlag must still decide in code

Files in this folder:

- [STRIPE_API_OFFLINE_SUMMARY.md](C:/Users/Suporte/Desktop/iberflag/iberflag-main/docs/reference/STRIPE_API_OFFLINE_SUMMARY.md)
- [FACTURALUSA_API_OFFLINE_SUMMARY.md](C:/Users/Suporte/Desktop/iberflag/iberflag-main/docs/reference/FACTURALUSA_API_OFFLINE_SUMMARY.md)
- [INVOICING_LIVE_READINESS.md](C:/Users/Suporte/Desktop/iberflag/iberflag-main/docs/reference/INVOICING_LIVE_READINESS.md)

How to use this pack:

1. Read `INVOICING_LIVE_READINESS.md` first for the go-live rules and unresolved decisions.
2. Use `STRIPE_API_OFFLINE_SUMMARY.md` for Checkout, tax ID collection, tax validation status, webhooks, idempotency, and testing.
3. Use `FACTURALUSA_API_OFFLINE_SUMMARY.md` for document emission, customer records, VAT rate and exemption mapping, and operational constraints.

Important limits:

- This is a curated summary, not a byte-for-byte mirror of the vendor docs.
- Stripe docs are account-sensitive and version-sensitive. Your Dashboard can show parameters or behavior that differ from the generic public docs.
- Facturalusa docs list endpoints and fields, but some compliance behavior is not fully specified publicly. Where the docs are silent, this pack marks the gap explicitly.
- This pack is implementation guidance, not legal or accounting advice. Before live invoicing, validate the final VAT decision tree with your accountant or fiscal advisor.

Official source index used for this pack:

Stripe:

- API overview: [https://docs.stripe.com/api](https://docs.stripe.com/api)
- Checkout Sessions API: [https://docs.stripe.com/api/checkout/sessions/create](https://docs.stripe.com/api/checkout/sessions/create)
- Checkout Sessions object: [https://docs.stripe.com/api/checkout/sessions/object](https://docs.stripe.com/api/checkout/sessions/object)
- Tax IDs in Checkout: [https://docs.stripe.com/tax/checkout/tax-ids](https://docs.stripe.com/tax/checkout/tax-ids)
- Stripe Tax for Checkout: [https://docs.stripe.com/tax/checkout](https://docs.stripe.com/tax/checkout)
- Tax IDs with invoicing: [https://docs.stripe.com/tax/invoicing/tax-ids](https://docs.stripe.com/tax/invoicing/tax-ids)
- Zero tax / reverse charge: [https://docs.stripe.com/tax/zero-tax](https://docs.stripe.com/tax/zero-tax)
- Webhooks: [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)
- Idempotency: [https://docs.stripe.com/api/idempotent_requests](https://docs.stripe.com/api/idempotent_requests)
- Request IDs: [https://docs.stripe.com/api/request_ids](https://docs.stripe.com/api/request_ids)
- Testing: [https://docs.stripe.com/testing](https://docs.stripe.com/testing)
- EU VAT background from Stripe: [https://docs.stripe.com/tax/supported-countries/european-union](https://docs.stripe.com/tax/supported-countries/european-union)

Facturalusa:

- API intro: [https://facturalusa.pt/documentacao/api/introducao](https://facturalusa.pt/documentacao/api/introducao)
- Authentication: [https://facturalusa.pt/documentacao/api/autenticacao](https://facturalusa.pt/documentacao/api/autenticacao)
- Responses and errors: [https://facturalusa.pt/documentacao/api/resposta-e-erros](https://facturalusa.pt/documentacao/api/resposta-e-erros)
- Sales create: [https://facturalusa.pt/documentacao/api/vendas/criar](https://facturalusa.pt/documentacao/api/vendas/criar)
- Sales summary: [https://facturalusa.pt/documentacao/api/vendas/sumario](https://facturalusa.pt/documentacao/api/vendas/sumario)
- Sales update: [https://facturalusa.pt/documentacao/api/vendas/actualizar](https://facturalusa.pt/documentacao/api/vendas/actualizar)
- Sales send email: [https://facturalusa.pt/documentacao/api/vendas/enviar-email](https://facturalusa.pt/documentacao/api/vendas/enviar-email)
- Customers create: [https://facturalusa.pt/documentacao/api/clientes/criar](https://facturalusa.pt/documentacao/api/clientes/criar)
- Customers find: [https://facturalusa.pt/documentacao/api/clientes/procurar](https://facturalusa.pt/documentacao/api/clientes/procurar)
- Countries: [https://facturalusa.pt/documentacao/api/paises](https://facturalusa.pt/documentacao/api/paises)
- VAT exemptions: [https://facturalusa.pt/documentacao/api/isencoes-iva](https://facturalusa.pt/documentacao/api/isencoes-iva)
- Series find: [https://facturalusa.pt/documentacao/api/administracao-series/procurar](https://facturalusa.pt/documentacao/api/administracao-series/procurar)
- VAT rates find: [https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar](https://facturalusa.pt/documentacao/api/administracao-taxas-iva/procurar)

VIES / EU VAT validation:

- Official EU VIES overview: [https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm)
