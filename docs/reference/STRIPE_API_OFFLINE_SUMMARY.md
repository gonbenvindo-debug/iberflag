# Stripe API Offline Summary

Last reviewed from official Stripe docs on 2026-04-09.

This summary is focused on the IberFlag use case:

- Stripe-hosted Checkout for one-off orders
- collecting customer tax IDs during payment
- post-payment webhooks
- auditability, retries, and go-live safety
- interaction points with external invoicing software

## 1. Core API model

Official source:

- [https://docs.stripe.com/api](https://docs.stripe.com/api)

What matters:

- Base URL is `https://api.stripe.com`.
- Requests are HTTPS only.
- API v1 is still the primary path for Checkout, Customers, Tax IDs, Payment Intents, Events, Invoices.
- Stripe docs are account- and version-sensitive. A public doc page can differ slightly from what your account shows in Dashboard or SDK behavior.
- Test mode and live mode are separated by the API key used in the request.

Immediate implication for IberFlag:

- Never infer environment from domain or branch.
- Always choose behavior from explicit environment variables and the key prefix:
  - `sk_test_...`
  - `sk_live_...`

## 2. Authentication and key handling

Official source:

- [https://docs.stripe.com/api](https://docs.stripe.com/api)

What matters:

- Secret keys authenticate server-side requests.
- Test secret keys start with `sk_test_`.
- Live secret keys start with `sk_live_`.
- Secret keys must never be committed or exposed client-side.

Recommended IberFlag rule:

- Keep publishable and secret keys split by environment.
- Never mix test checkout creation with live webhook secrets.
- Log which mode was used for each session and webhook event.

## 3. Request IDs and vendor support traceability

Official source:

- [https://docs.stripe.com/api/request_ids](https://docs.stripe.com/api/request_ids)

What matters:

- Every API request returns a `Request-Id` response header.
- Stripe support expects that request ID when diagnosing issues.

Recommended IberFlag rule:

- Persist the Stripe request ID for:
  - checkout session creation
  - tax ID retrieval
  - invoice-related calls if ever used
  - refunds if added later
- Include the request ID in internal error logs and admin diagnostics.

## 4. Idempotency

Official source:

- [https://docs.stripe.com/api/idempotent_requests](https://docs.stripe.com/api/idempotent_requests)

What matters:

- All `POST` requests in API v1 accept idempotency keys.
- Repeating the same `POST` with the same idempotency key returns the stored result of the first call.
- Stripe stores the first status code and body, even if that first result was a `500`.
- Keys can be pruned after at least 24 hours.
- Stripe compares parameters on replay and errors if they differ.
- Validation failures before execution starts are not saved as the idempotent result, so those can be retried.

Recommended IberFlag rule:

- Every server-side create action to Stripe should have a generated UUID idempotency key.
- Store the idempotency key alongside the local order.
- Do not derive the idempotency key from personal data.
- Reuse the same key only for an intentional retry of the exact same operation.

## 5. Checkout Sessions: what IberFlag actually needs

Official sources:

- [https://docs.stripe.com/api/checkout/sessions/create](https://docs.stripe.com/api/checkout/sessions/create)
- [https://docs.stripe.com/payments/checkout-sessions](https://docs.stripe.com/payments/checkout-sessions)
- [https://docs.stripe.com/api/checkout/sessions/object](https://docs.stripe.com/api/checkout/sessions/object)

Parameters most relevant to this project:

- `mode=payment`
- `line_items`
- `success_url`
- `cancel_url`
- `client_reference_id`
- `customer` or `customer_creation`
- `customer_email`
- `customer_update`
- `automatic_tax`
- `tax_id_collection`
- `billing_address_collection`
- `shipping_address_collection`
- `metadata`

High-value notes:

- `client_reference_id` is useful for reconciling the Stripe session with your internal order code.
- `customer_creation=always` makes it easier to retain billing data and tax IDs collected in Checkout.
- If you provide an existing `customer`, Checkout can update selected customer fields if `customer_update[...]` is configured.
- The Session object contains `customer_details`, including tax IDs collected at checkout.

Recommended IberFlag pattern:

- Continue creating Checkout Sessions server-side only.
- Use `client_reference_id` for the internal order code.
- Keep a compact `metadata` payload with order code, internal order UUID, payment environment, and cart fingerprint.
- Prefer creating a Stripe customer only when the retention and audit story is clear.

## 6. Tax ID collection in Checkout

Official sources:

- [https://docs.stripe.com/tax/checkout/tax-ids](https://docs.stripe.com/tax/checkout/tax-ids)
- [https://docs.stripe.com/payments/advanced/tax](https://docs.stripe.com/payments/advanced/tax)
- [https://docs.stripe.com/tax/invoicing/tax-ids](https://docs.stripe.com/tax/invoicing/tax-ids)

What Stripe can do:

- Show a business tax ID form inside Checkout.
- Save collected tax IDs and business name to the resulting Customer when the session is associated with a Customer.
- Expose collected tax IDs inside `checkout.session.completed`.
- Validate the format synchronously.
- Perform asynchronous validation for:
  - EU VAT
  - GB VAT
  - AU ABN

What Stripe does not guarantee:

- It does not make the tax ID legally correct just because the format is accepted.
- It does not guarantee name and address match the tax registration.
- For invoices, Stripe can display a customer tax ID even if it is invalid.

Critical source details:

- Stripe says Checkout verifies that tax IDs are formatted correctly during checkout, but not necessarily valid at that moment.
- Stripe automatically validates EU VAT numbers against VIES asynchronously.
- Stripe can return `verification.status` on customer tax IDs.

Implication for IberFlag:

- Stripe tax ID collection is useful evidence and a good UX improvement.
- It must not be your only control before fiscal emission in live mode.

## 7. EU VAT / VIES behavior in Stripe

Official sources:

- [https://docs.stripe.com/tax/invoicing/tax-ids](https://docs.stripe.com/tax/invoicing/tax-ids)
- [https://docs.stripe.com/tax/checkout/tax-ids](https://docs.stripe.com/tax/checkout/tax-ids)
- [https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm)

What is explicit in the docs:

- Stripe validates EU VAT numbers against VIES.
- The EU states that VIES is a search engine, not a database, and results come from national databases.
- A VAT number can be invalid in VIES because:
  - it does not exist
  - it is not activated for intra-EU transactions
  - registration is not yet finalized
- The EU also says name and address association may require checking at national level, and can be limited by data protection.

Operational meaning:

- VIES validity alone is helpful but not complete.
- For high-risk B2B zero-VAT decisions, you should store:
  - raw VAT number
  - country inferred from VAT number
  - Stripe tax ID object id
  - Stripe tax ID verification status
  - timestamp of decision
  - billing country
  - shipping country if relevant
  - internal rule that chose VAT treatment

## 8. Automatic tax in Checkout

Official source:

- [https://docs.stripe.com/tax/checkout](https://docs.stripe.com/tax/checkout)

What matters:

- `automatic_tax[enabled]=true` allows Stripe Tax to calculate taxes automatically in Checkout.
- Tax calculation depends on customer location.
- For new customers, Stripe can use the billing or shipping address collected during Checkout.
- For existing customers, Stripe prioritizes shipping address if available, otherwise billing address depending on configuration.

Important limitation for IberFlag:

- Even when Stripe Tax helps calculate tax, it does not replace your fiscal emission logic in Facturalusa.
- If Stripe and Facturalusa diverge on VAT treatment, the fiscal document is the bigger risk.

Pragmatic decision:

- If you move to live with Facturalusa as the source of the final fiscal document, do not let Stripe Tax silently become the fiscal truth without a deliberate mapping strategy.

## 9. Reverse charge / zero tax behavior

Official source:

- [https://docs.stripe.com/tax/zero-tax](https://docs.stripe.com/tax/zero-tax)

What matters:

- Stripe documents reverse charge handling for eligible transactions.
- Stripe Tax can automatically apply reverse charge based on jurisdiction data and tax ID presence.

Critical caution:

- This is useful for payment-side totals, but your legal invoice still needs the correct local wording, tax amount, and exemption code in the fiscal system.
- If Facturalusa needs a specific VAT exemption code such as `M16` or another reverse-charge code, Stripe does not choose that for you.

## 10. Customer tax ID object and verification status

Official sources:

- [https://docs.stripe.com/api/customer_tax_ids/retrieve](https://docs.stripe.com/api/customer_tax_ids/retrieve)
- [https://docs.stripe.com/billing/taxes/tax-ids](https://docs.stripe.com/billing/taxes/tax-ids)

What matters:

- A customer tax ID object includes:
  - type
  - value
  - country
  - verification status
  - verified name
  - verified address
- Verification status can be `pending`, and later resolve.
- Stripe emits `customer.tax_id.updated` for asynchronous validation updates.

This is one of the most important Stripe facts for your invoicing go-live:

- if you want to rely on Stripe-collected VAT for live B2B decisions, you should consume tax ID verification updates and not stop at `checkout.session.completed`.

## 11. Webhooks

Official source:

- [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)

What matters:

- Registered webhook endpoints must be public HTTPS URLs.
- Stripe recommends verifying signatures with the raw request body and the endpoint secret.
- Test and live webhook secrets are different even if the endpoint URL is the same.
- Stripe recommends returning a `2xx` quickly before running heavy business logic.
- Stripe signs each delivery attempt separately. Retries produce fresh signatures and timestamps.
- Default replay protection tolerance in Stripe libraries is 5 minutes.

Recommended IberFlag rule:

- Verify signature before any business logic.
- Store processed event IDs in a dedicated idempotency table.
- Return `200` only after the event is safely persisted or after the workflow is safely delegated.
- Keep webhook logic minimal:
  - store event
  - mark payment status
  - queue or trigger post-payment invoice workflow

## 12. Testing

Official source:

- [https://docs.stripe.com/testing](https://docs.stripe.com/testing)

What matters:

- Use test keys only in test mode.
- Do not use real card details in live mode for testing.
- Use Stripe test cards or Stripe test PaymentMethods.

Tax ID testing:

- Stripe documents test values for tax ID verification flows.
- The docs explicitly mention magic testing values for some tax ID types and asynchronous verification states.

Recommended IberFlag test matrix:

- successful card payment
- failed card payment
- duplicate webhook delivery
- delayed webhook
- tax ID present and pending verification
- tax ID valid
- tax ID invalid
- payment succeeded but invoice emission blocked

## 13. What Stripe is good for in IberFlag

Use Stripe for:

- secure payment collection
- hosted Checkout UX
- collecting business tax IDs at payment time
- asynchronous VAT format and VIES-backed validation support
- durable eventing through webhooks
- payment dispute, refund, and reconciliation history

Do not let Stripe alone decide:

- Portuguese fiscal exemption codes in Facturalusa
- final invoice wording and local compliance mapping
- whether a VIES-valid number is sufficient evidence for your accountant

## 14. Stripe-specific go-live rules for IberFlag

Non-negotiable:

1. Store Stripe request IDs for every mutating API call.
2. Use idempotency keys for every `POST` that creates or mutates Stripe state.
3. Verify raw-body webhook signatures.
4. Persist Stripe event IDs and dedupe them.
5. Enable tax ID collection only if the downstream invoicing path can consume it safely.
6. If you rely on VAT validation, consume `customer.tax_id.updated` and not only `checkout.session.completed`.
7. Keep test and live API keys, webhook secrets, and endpoint URLs explicitly separated.

Recommended if going live with fiscal risk close to zero:

1. Build a `payment succeeded, invoice pending validation` intermediate state.
2. Block zero-VAT or reverse-charge invoice emission until VAT validation evidence is sufficient under your accountant-approved rules.
3. Save a fiscal decision record per order.

## 15. Known gaps this summary does not solve

- Stripe does not replace Portuguese accounting advice.
- Stripe does not select the correct Facturalusa `vat_exemption` code for you.
- Stripe validation is helpful, but not the same thing as a complete legal audit trail for every jurisdiction.

## 16. Source list

- [https://docs.stripe.com/api](https://docs.stripe.com/api)
- [https://docs.stripe.com/api/checkout/sessions/create](https://docs.stripe.com/api/checkout/sessions/create)
- [https://docs.stripe.com/api/checkout/sessions/object](https://docs.stripe.com/api/checkout/sessions/object)
- [https://docs.stripe.com/tax/checkout/tax-ids](https://docs.stripe.com/tax/checkout/tax-ids)
- [https://docs.stripe.com/tax/checkout](https://docs.stripe.com/tax/checkout)
- [https://docs.stripe.com/tax/invoicing/tax-ids](https://docs.stripe.com/tax/invoicing/tax-ids)
- [https://docs.stripe.com/billing/taxes/tax-ids](https://docs.stripe.com/billing/taxes/tax-ids)
- [https://docs.stripe.com/tax/zero-tax](https://docs.stripe.com/tax/zero-tax)
- [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)
- [https://docs.stripe.com/api/idempotent_requests](https://docs.stripe.com/api/idempotent_requests)
- [https://docs.stripe.com/api/request_ids](https://docs.stripe.com/api/request_ids)
- [https://docs.stripe.com/testing](https://docs.stripe.com/testing)
- [https://docs.stripe.com/tax/supported-countries/european-union](https://docs.stripe.com/tax/supported-countries/european-union)
- [https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm)
