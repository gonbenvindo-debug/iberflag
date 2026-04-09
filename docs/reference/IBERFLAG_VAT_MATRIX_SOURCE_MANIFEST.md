# IberFlag VAT Matrix Source Manifest

Curated on `2026-04-09`.

## Primary official sources used

1. Your Europe
   - Cross-border VAT overview: [https://europa.eu/youreurope/business/taxation/vat/cross-border-vat/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/cross-border-vat/index_en.htm)
   - Why it matters:
     - confirms intra-EU B2B goods with valid VAT can be invoiced without charging VAT
     - confirms invalid VAT usually pushes you back to charging VAT
     - confirms the `EUR 10 000` threshold for intra-EU B2C distance sales

2. Your Europe
   - Charging and deducting VAT / invoicing rules: [https://europa.eu/youreurope/business/taxation/vat/charging-deducting-vat/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/charging-deducting-vat/index_en.htm)
   - Why it matters:
     - confirms invoice treatment baseline under EU rules
     - confirms exports to non-EU countries normally do not show VAT on the invoice

3. Your Europe
   - VAT rules and rates: [https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm)
   - Why it matters:
     - confirms exports outside the EU are not charged VAT if proof of export is kept
     - gives EU-wide rate context and country links

4. European Commission OSS portal
   - One Stop Shop threshold explanation: [https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en)
   - Why it matters:
     - explains how the `EUR 10 000` threshold applies
     - explains when destination-country VAT becomes relevant

5. European Commission / VAT for businesses
   - VAT for businesses overview: [https://taxation-customs.ec.europa.eu/value-added-tax-vat/vat-businesses_en](https://taxation-customs.ec.europa.eu/value-added-tax-vat/vat-businesses_en)
   - Why it matters:
     - confirms the role of OSS in cross-border B2C e-commerce

6. Access2Markets
   - Export guide: [https://webgate.acceptance.ec.europa.eu/portal9/en/content/guide-export-goods](https://webgate.acceptance.ec.europa.eu/portal9/en/content/guide-export-goods)
   - Why it matters:
     - confirms exports outside the EU require proof of export to sustain non-VAT treatment

7. European Commission / Portugal VAT rules
   - Portugal VAT rules under OSS reference: [https://vat-one-stop-shop.ec.europa.eu/national-vat-rules/portugal-vat-rules_en](https://vat-one-stop-shop.ec.europa.eu/national-vat-rules/portugal-vat-rules_en)
   - Why it matters:
     - gives Portugal-specific invoice and VAT rule references

8. European Commission / Portugal standard rate reference
   - Portugal rate excerpt referenced in EU material: [https://taxation-customs.ec.europa.eu/system/files/2018-02/moss_2018_pt_en.pdf](https://taxation-customs.ec.europa.eu/system/files/2018-02/moss_2018_pt_en.pdf)
   - Why it matters:
     - confirms mainland Portugal standard VAT rate `23%`
     - notes different rates in Madeira and the Azores in the referenced material

9. Portal das Financas
   - Portuguese tax rates leaflet: [https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/Documents/SFP_taxas_2022.pdf](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/Documents/SFP_taxas_2022.pdf)
   - Why it matters:
     - confirms mainland / Madeira / Azores rate split

10. EU VIES overview
    - Official page: [https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm](https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm)
    - Why it matters:
      - confirms VIES role and limitations

## Internal reference pack this dossier depends on

- [STRIPE_API_OFFLINE_SUMMARY.md](C:/Users/Suporte/Desktop/iberflag/iberflag-main/docs/reference/STRIPE_API_OFFLINE_SUMMARY.md)
- [FACTURALUSA_API_OFFLINE_SUMMARY.md](C:/Users/Suporte/Desktop/iberflag/iberflag-main/docs/reference/FACTURALUSA_API_OFFLINE_SUMMARY.md)
- [INVOICING_LIVE_READINESS.md](C:/Users/Suporte/Desktop/iberflag/iberflag-main/docs/reference/INVOICING_LIVE_READINESS.md)

## Scope note

This source manifest supports a conservative goods-focused matrix for IberFlag. It does not attempt to settle:

- special VAT regimes for every product category;
- all regional-territory nuances;
- standalone services place-of-supply rules;
- accountant sign-off on the exact Facturalusa exemption code per scenario.
