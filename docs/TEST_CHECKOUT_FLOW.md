# Fluxo de compra em modo teste

Este projeto está configurado para simular compras com Stripe test e Facturalusa test. O modo live fica bloqueado por defeito: para usar live no futuro é preciso definir `PAYMENT_ENVIRONMENT=live` e `PAYMENT_LIVE_ENABLED=true`.

## 1. Ambiente

Variáveis mínimas:

- `PAYMENT_ENVIRONMENT=test`
- `STRIPE_ENVIRONMENT=test`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_PUBLISHABLE_KEY_TEST`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`
- `FACTURALUSA_API_TOKEN_TEST`
- `FACTURALUSA_BASE_URL_TEST`
- `FACTURALUSA_SERIE_ID_TEST`
- `FACTURALUSA_FORCE_SEND_EMAIL=false`
- `PUBLIC_SITE_URL=https://iberflag.vercel.app`

Para validar localmente:

```powershell
npm run payments:check
npm run test-flow:check
```

## 2. Supabase

Antes de testar compra end-to-end, aplicar as migrations em `supabase/migrations`, incluindo:

- `20260405163000_remove_stock_and_catalog_bucket.sql`
- `20260408120000_harden_order_flow.sql`
- `20260408143000_complete_test_checkout_flow.sql`
- `20260408150000_remove_tracking_address_key.sql`
- `20260408153000_fill_simulated_catalog_values.sql`

Sem acesso SQL remoto (`SUPABASE_ACCESS_TOKEN` para a CLI, ou connection string da base), estas migrations não podem ser aplicadas automaticamente a partir deste workspace.

## 3. Teste end-to-end

1. Abrir um produto com preço válido.
2. Personalizar e adicionar ao carrinho.
3. Finalizar checkout.
4. Pagar no Stripe Checkout com cartão test.
5. Confirmar redirect para sucesso.
6. Confirmar webhook Stripe e estado `paid`.
7. Confirmar emissão ou erro reemitível da Facturalusa test.
8. Confirmar que `/encomenda.html?codigo=...` não mostra PII.
9. Confirmar no admin que a encomenda tem dados completos e reemissão protegida.
