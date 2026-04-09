# Invoicing Live Readiness

Last revised on 2026-04-09.

This document is not vendor documentation. It is the operational translation of the Stripe, Facturalusa, and VIES docs into a safe go-live checklist for IberFlag.

## 1. Objective

Go live without accidental fiscal mistakes.

That means:

- no wrong VAT treatment due to missing validation
- no accidental reverse-charge emission
- no silent fallback to the wrong exemption code
- no invoice emission without enough evidence
- no payment-success path that can leave finance blind

## 2. What the official sources support

Stripe:

- can collect tax IDs at checkout
- can format-check tax IDs at checkout
- can asynchronously validate EU VAT numbers via VIES
- can expose tax IDs and verification status through Stripe objects and webhooks

Facturalusa:

- can create customers
- can create fiscal documents
- requires you to send VAT type, VAT rate, and VAT exemption correctly
- exposes sales summary and reference endpoints

EU VIES:

- confirms whether an EU VAT number is valid for intra-EU trade
- does not guarantee full legal identity matching in every case
- can be unavailable or lag behind national systems

## 3. What the official sources do not solve for you

They do not decide:

- whether a specific IberFlag order should be billed with Portuguese VAT
- whether a specific B2B order qualifies for reverse charge under your exact business model
- which exact Facturalusa `vat_exemption` code must be applied for each scenario
- whether a VIES-valid number is sufficient evidence for your accountant

That is your fiscal decision engine. The code can help. The accountant signs off the rulebook.

## 4. Minimum data needed before issuing a live invoice

For every order that might be invoiced live, keep:

- internal order id
- order code
- payment mode and provider
- payment confirmation source
- issue date
- billing country
- shipping country if relevant
- customer type
- legal name or company name
- VAT or tax ID as entered
- normalized VAT or tax ID
- Stripe tax ID object id if Stripe collected it
- Stripe tax ID verification status if available
- VIES result if you run your own check
- chosen VAT type
- chosen VAT rate
- chosen VAT exemption code
- exact reason for that VAT decision
- Facturalusa customer id or code
- Facturalusa document id and number

If you cannot produce that audit trail later, the go-live is not safe enough.

## 5. Recommended fiscal decision flow

This is a system design recommendation, not tax advice.

### State 1: payment captured

- Stripe confirms payment
- order becomes `paid`
- invoice state becomes `pending_fiscal_review`

Do not automatically emit live invoice yet if the VAT path is not deterministic.

### State 2: normalize fiscal inputs

Normalize:

- country
- VAT number / tax ID
- customer type
- company name
- address

Reject obvious bad input early:

- invalid VAT format for the claimed country
- missing required company name for business invoicing
- missing address when document rules require it

### State 3: gather tax evidence

Possible evidence sources:

- Stripe Checkout tax ID
- Stripe customer tax ID verification result
- your own VIES validation record
- billing country
- shipping country
- accountant-approved matrix

If evidence is incomplete:

- hold the invoice for manual review
- do not silently downgrade to a consumer invoice

### State 4: choose fiscal scenario

Examples of fiscal scenarios that your own rules engine must represent:

- PT individual, domestic
- PT business, domestic
- EU business, intra-EU, VAT-valid
- EU business, intra-EU, VAT-unverified
- EU customer with invalid or inactive VAT
- non-EU customer

For each scenario you need an approved mapping to:

- Facturalusa `vat_type`
- line VAT rate
- `vat_exemption`
- invoice wording if required

### State 5: preflight against Facturalusa

Before final creation:

1. resolve series
2. resolve VAT rate id if needed
3. build exact sales payload
4. call `sales/summary`
5. compare totals

If the summary differs from your internal order total:

- stop
- mark invoice as `blocked`
- surface the mismatch to admin

### State 6: emit

Only emit if all are true:

- payment is confirmed
- fiscal scenario is resolved
- VAT evidence is acceptable
- Facturalusa preflight totals match
- no duplicate document already exists

### State 7: persist immutable evidence

After emission persist:

- request payload
- response payload
- vendor ids
- chosen tax rule
- evidence used
- timestamp

## 6. Safe handling of VIES

Official source:

- [https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm)

What the EU page makes clear:

- VIES is a search engine, not a primary database
- invalid can mean:
  - nonexistent
  - not activated for intra-EU trade
  - registration not finalized
- name and address association may require national authority confirmation
- VIES can be unavailable
- it is recommended to keep track of your validation

Practical IberFlag policy:

- If VIES is unavailable, do not automatically approve a zero-VAT or reverse-charge invoice unless your accountant explicitly approves that fallback.
- Save proof of validation attempt:
  - timestamp
  - VAT number checked
  - result
  - source
- If the result is negative or unavailable, send the order to manual review or charge according to the approved fallback rule.

## 7. How to use Stripe safely in the fiscal path

Good use:

- collect tax ID in Checkout
- use `customer.tax_id.updated` to learn verification outcomes
- store `verification.status`, `verified_name`, `verified_address` when available

Bad use:

- issuing zero-VAT invoices only because the checkout form accepted the VAT number
- assuming name and address are legally matched just because Stripe saved the tax ID

## 8. How to use Facturalusa safely in the fiscal path

Good use:

- use `customers/find` and `customers/create` deliberately
- use `sales/summary` before live emission
- use `sales/create` only after rule resolution

Bad use:

- sending `vat_exemption=M18` as a catch-all fallback
- emitting `Terminado` and only then deciding whether the tax treatment made sense
- relying on vendor-side defaults for legally sensitive VAT paths

## 9. Recommended states for IberFlag

Suggested invoice status model:

- `pending_payment`
- `paid_pending_fiscal_validation`
- `paid_pending_vies`
- `paid_pending_manual_review`
- `ready_to_emit`
- `emitted`
- `blocked_fiscal`
- `emission_failed`

This keeps payment truth separate from invoice truth.

## 10. Non-negotiable go-live checklist

Before switching Stripe and Facturalusa to live:

1. Written VAT scenario matrix approved by accountant.
2. Exact mapping from scenario to Facturalusa `vat_type`, VAT rate, and `vat_exemption`.
3. Confirmed live series in Facturalusa and AT communication status.
4. Manual admin override path for blocked invoices.
5. Audit log for:
   - payment event
   - fiscal inputs
   - VIES / Stripe tax validation evidence
   - Facturalusa request/response
6. Idempotent Stripe and webhook handling already proven in test.
7. Test-mode dry runs for:
   - domestic PT individual
   - domestic PT business
   - EU business with valid VAT
   - EU business with invalid VAT
   - VIES unavailable path
   - Facturalusa emission error path

## 11. Open questions to resolve before live

These are the questions that still need explicit answers from accountant and/or Facturalusa support:

1. Which exact Facturalusa exemption code applies to your intended intra-EU B2B cases?
2. When VIES is unavailable, what is the fallback?
3. Do you require name/address matching evidence beyond VAT validity?
4. Are any of your products/services subject to special domestic VAT treatment?
5. Do you want fully automatic emission, or automatic only for low-risk scenarios and manual review for the rest?

## 12. Recommended next implementation steps

1. Add a formal fiscal decision object per order.
2. Add storage for Stripe tax ID verification status and details.
3. Add a VIES validation adapter or queue, if you decide Stripe evidence is not sufficient alone.
4. Add a Facturalusa preflight using `sales/summary`.
5. Add a blocked-invoice admin workflow with explicit reasons.
