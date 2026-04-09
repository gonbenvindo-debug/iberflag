# IberFlag VAT Matrix: Portugal, EU, and Extra-EU

Last revised on `2026-04-09`.

## 1. Purpose

This dossier translates official PT and EU VAT rules into an implementation-oriented decision matrix for IberFlag.

It is designed to answer:

- when Portuguese VAT should be charged;
- when an intra-EU invoice may go out without VAT;
- when destination-country VAT may be due for EU consumers;
- when no EU VAT may be charged on export;
- which cases should be blocked for manual review instead of auto-emitted.

This is implementation guidance, not legal advice. Before live automation, the final matrix must be approved by your accountant.

## 2. Scope and assumptions

This matrix assumes all of the following are true:

- IberFlag is established in mainland Portugal.
- The primary supply is a physical printed good shipped from Portugal.
- Personalisation / design support is ancillary to the goods sale, not a separately invoiced standalone consulting or design service.
- Facturalusa remains the fiscal document issuer.
- Stripe remains the payment layer.
- IberFlag wants a conservative automation policy, not aggressive auto-emission.

## 3. Out of scope unless separately approved

Do not auto-apply this matrix to:

- standalone design services billed without goods;
- installation or on-site services in another country;
- goods dispatched from stock held outside Portugal;
- triangulation chains;
- drop-shipping where IberFlag does not control dispatch evidence;
- special territories with separate VAT/customs treatment;
- UK / Northern Ireland edge cases;
- Azores / Madeira until you confirm the region-specific rate logic and destination handling with your accountant.

These should go to `manual_fiscal_review`.

## 4. Official rule baseline used

### EU cross-border goods

Your Europe states that if you sell goods to a VAT-registered business in another EU country and the goods are sent to that other EU country, you do not charge VAT if the customer has a valid EU VAT number.

It also states that if the customer does not have a valid EU VAT number, you should usually charge VAT at the rate applicable in your country.

### EU B2C distance sales

Official EU sources state that an annual threshold of `EUR 10 000` applies to intra-EU distance sales of goods and certain digital services. Below that threshold, the supplies may remain taxable in the Member State of establishment, subject to the conditions and unless you opt into OSS. Above the threshold, VAT is due in the Member State where transport ends.

### Exports outside the EU

Official EU sources state that exports of goods outside the EU are not charged EU VAT, provided the seller holds proof that the goods were transported outside the EU.

### Portugal

Official EU and Portuguese references show the mainland standard VAT rate in Portugal is `23%`. Madeira and the Azores have different regional rates. This dossier treats those regional paths as separate approval paths until you formalise them.

## 5. Internal decision fields IberFlag should store

For every order:

- supplier establishment country
- dispatch origin country
- dispatch destination country
- customer type: `individual` or `business`
- claimed VAT number / tax ID
- normalized VAT number
- VAT validation source
- VAT validation result
- whether OSS is active
- whether EU B2C distance-sales threshold is exceeded
- export proof status
- chosen fiscal scenario
- chosen Facturalusa `vat_type`
- chosen VAT rate
- chosen `vat_exemption`
- reason for decision
- automation mode: `auto_emit`, `manual_review`, `block`

## 6. Safe decision tree

1. Confirm the order is a goods shipment, not a standalone service.
2. Confirm origin of dispatch.
3. Identify destination country.
4. Identify customer type.
5. If business in EU, validate VAT through VIES or equivalent approved evidence path.
6. If B2C in EU, determine whether the `EUR 10 000` threshold is exceeded or OSS has been chosen.
7. If extra-EU, verify export proof path.
8. Only then resolve Facturalusa fields and emit.

## 7. Implementation matrix

## Scenario A: Portugal mainland -> Portugal mainland, B2C

Commercial meaning:

- domestic consumer sale of goods

VAT treatment:

- charge Portuguese mainland VAT
- for standard-rated goods, current baseline is `23%`

Evidence needed:

- billing and delivery in Portugal mainland
- no contrary special-rate rule for the specific SKU

Automation:

- `auto_emit` allowed

Facturalusa implementation baseline:

- `vat_type`: `Debitar IVA` or `IVA incluido`, depending on your public pricing model
- line VAT: PT standard rate id / `23`
- `vat_exemption`: `M18`

Internal state:

- `ready_to_emit`

## Scenario B: Portugal mainland -> Portugal mainland, B2B

Commercial meaning:

- domestic Portuguese business customer

VAT treatment:

- charge Portuguese mainland VAT
- standard baseline `23%` unless the specific product has an approved different rate

Evidence needed:

- domestic billing scenario
- valid invoice data

Automation:

- `auto_emit` allowed

Facturalusa baseline:

- `vat_type`: `Debitar IVA` or `IVA incluido`
- line VAT: PT standard rate id / `23`
- `vat_exemption`: `M18`

Internal state:

- `ready_to_emit`

## Scenario C: Portugal mainland -> another EU country, B2B, VAT valid

Commercial meaning:

- intra-EU supply of goods to a taxable business in another EU Member State

VAT treatment baseline:

- do not charge Portuguese VAT on the invoice, provided the customer has a valid EU VAT number and the goods are sent to another EU country

Critical evidence:

- valid EU VAT number
- VIES validation or accountant-approved equivalent evidence
- proof that goods were dispatched to another EU Member State
- customer details consistent enough for your accountant-approved policy

Automation:

- `auto_emit` only if all evidence is present
- otherwise `block`

Facturalusa baseline:

- `vat_type`: `Nao fazer nada`
- line VAT: `0%`
- `vat_exemption`: accountant-approved intra-EU code

Important note:

- your current pack suggests `M16` may correspond to Article 14 RITI-style intra-EU exemption, but this must be confirmed in writing with accountant and/or Facturalusa support before full automation

Internal states:

- success path: `ready_to_emit`
- missing evidence: `blocked_requires_vies` or `blocked_requires_transport_proof`

## Scenario D: Portugal mainland -> another EU country, B2B, VAT invalid or unverified

Commercial meaning:

- customer claims business status but cannot support it with valid VAT evidence

VAT treatment baseline:

- official EU guidance says you should usually charge VAT at the rate applicable in your country if the customer does not have a valid EU VAT number

Conservative IberFlag policy:

- do not auto-zero-rate
- either:
  - treat as taxable sale with Portuguese VAT if your accountant approves this path for your goods flow; or
  - hold for manual review

Automation:

- recommended default: `manual_review`

Safer interim implementation:

- `block`

Facturalusa:

- do not auto-fallback to `Nao fazer nada`
- if accountant approves taxable fallback:
  - `vat_type`: `Debitar IVA` or `IVA incluido`
  - line VAT: PT standard rate id / `23`
  - `vat_exemption`: `M18`

Internal state:

- `blocked_requires_valid_vat`

## Scenario E: Portugal mainland -> another EU country, B2C, total cross-border B2C sales at or below EUR 10 000 threshold, no OSS election

Commercial meaning:

- distance sale of goods to EU consumer while still below the EU-wide threshold and not opted into OSS

VAT treatment baseline:

- official EU guidance allows these sales to remain taxed in the Member State where the supplier is established, subject to the threshold conditions

Automation:

- `auto_emit` allowed only if:
  - threshold tracker is reliable
  - OSS is not active
  - accountant approves this path

Facturalusa baseline:

- `vat_type`: `Debitar IVA` or `IVA incluido`
- line VAT: PT standard rate id / `23`
- `vat_exemption`: `M18`

Internal state:

- `ready_to_emit`

Critical warning:

- once the threshold is exceeded, or if you voluntarily opt into OSS, this path no longer applies

## Scenario F: Portugal mainland -> another EU country, B2C, threshold exceeded or OSS active

Commercial meaning:

- intra-EU distance sale of goods to consumer where destination-country VAT is due

VAT treatment baseline:

- charge VAT of the destination Member State

Evidence needed:

- destination country
- threshold / OSS status
- correct destination-country VAT rate for the goods

Automation:

- recommended current status: `manual_review` until you build:
  - destination-country rate table
  - OSS accounting process
  - accountant-approved invoice treatment path

Facturalusa implications:

- do not assume Portuguese VAT here
- do not emit automatically until you know how your accountant wants these sales reported and how Facturalusa should represent them

Internal state:

- `blocked_requires_oss_matrix`

## Scenario G: Portugal mainland -> non-EU destination, B2B or B2C, direct export with proof

Commercial meaning:

- export of goods outside the EU

VAT treatment baseline:

- no EU VAT charged, provided you retain proof of export

Evidence needed:

- export / customs proof
- dispatch evidence
- destination country

Automation:

- `auto_emit` only if export proof path is systemically reliable
- otherwise `block`

Facturalusa baseline:

- likely `Nao fazer nada`
- line VAT: `0%`
- `vat_exemption`: accountant-confirmed export code

Important warning:

- do not auto-reuse intra-EU exemption code for extra-EU export

Internal states:

- success path: `ready_to_emit`
- no proof: `blocked_requires_export_proof`

## Scenario H: non-EU customer but no reliable export proof

Commercial meaning:

- customer outside EU is not enough by itself

VAT treatment:

- do not auto-assume export treatment

Automation:

- `block`

Internal state:

- `blocked_requires_export_proof`

## Scenario I: Azores, Madeira, Canary Islands, Ceuta, Melilla, Northern Ireland, or other special territories

Treatment:

- `manual_review`

Reason:

- these paths can have regional-rate, customs-territory, or post-Brexit nuances that are too risky to automate under the current matrix

Internal state:

- `manual_fiscal_review_special_territory`

## Scenario J: standalone design service without physical goods

Treatment:

- `manual_review`

Reason:

- service place-of-supply rules differ from goods rules and should not inherit the goods matrix

## 8. Recommended conservative automation policy

Auto-emit only for:

- PT mainland domestic B2C
- PT mainland domestic B2B
- EU B2C below threshold with no OSS, if accountant approves and your threshold tracker is reliable
- intra-EU B2B valid VAT only after VIES and transport evidence are both present
- extra-EU export only after export proof exists

Block or manual-review for:

- invalid or unverified EU VAT
- destination-country VAT / OSS paths not fully implemented
- special territories
- any scenario with missing evidence

## 9. Suggested Facturalusa implementation table

This is not final legal mapping. It is the safest implementation baseline.

| Scenario | `vat_type` | VAT line | `vat_exemption` | Emit mode |
| --- | --- | --- | --- | --- |
| PT domestic taxable | `Debitar IVA` or `IVA incluido` | PT rate | `M18` | auto |
| EU B2B valid VAT | `Nao fazer nada` | `0%` | accountant-approved intra-EU code | conditional auto |
| EU B2B invalid VAT | do not auto-decide | do not auto-decide | do not auto-decide | manual |
| EU B2C below threshold, no OSS | `Debitar IVA` or `IVA incluido` | PT rate | `M18` | conditional auto |
| EU B2C with OSS / over threshold | do not auto-decide | destination rate | accountant-approved code if relevant | manual |
| Extra-EU export with proof | `Nao fazer nada` | `0%` | accountant-approved export code | conditional auto |
| Extra-EU without proof | do not emit | n/a | n/a | block |

## 10. What must exist before full live automation

1. Accountant-approved written matrix from scenario to:
   - `vat_type`
   - VAT rate
   - `vat_exemption`
2. Threshold tracker for EU B2C distance sales.
3. Explicit decision whether IberFlag uses OSS.
4. VIES validation persistence.
5. Export-proof storage policy.
6. Separate handling for special territories.
7. Explicit rule for standalone services, if ever sold.

## 11. Implementation recommendation for the codebase

Represent this in code as:

- `supply_kind`
- `customer_type`
- `customer_region_group`
- `vat_validation_status`
- `transport_evidence_status`
- `oss_mode`
- `fiscal_scenario`
- `fiscal_decision_mode`

Recommended `fiscal_scenario` values:

- `pt_domestic_b2c`
- `pt_domestic_b2b`
- `eu_b2b_valid_vat`
- `eu_b2b_invalid_vat`
- `eu_b2c_below_threshold`
- `eu_b2c_oss_destination_vat`
- `extra_eu_export_with_proof`
- `extra_eu_export_without_proof`
- `special_territory_manual`
- `standalone_service_manual`

Recommended `fiscal_decision_mode` values:

- `auto_emit`
- `manual_review`
- `block`

## 12. Hard rules

- Never auto-zero-rate because the customer typed a VAT number.
- Never auto-fallback to `M18` on an uncertain non-taxable path.
- Never treat non-EU destination as export if you cannot prove export.
- Never use the goods matrix for standalone services.
- Never automate EU B2C destination-country VAT until OSS and rate logic are truly operational.
