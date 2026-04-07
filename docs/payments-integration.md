# Stripe + Facturalusa

Fluxo implementado:

1. O frontend do checkout envia os dados do cliente e do carrinho para `/api/checkout/create-session`.
2. O backend cria uma encomenda provisoria no Supabase e abre uma `Checkout Session` no Stripe.
3. O utilizador paga no Stripe.
4. O webhook `/api/stripe/webhook` confirma o evento.
5. O backend marca a encomenda como paga e emite o documento fiscal no Facturalusa.
6. O utilizador e redirecionado para `checkout-sucesso.html` e depois para o tracking.

## Ambiente

O checkout suporta `live` e `test` atraves de:

- `PAYMENT_ENVIRONMENT=test`
- `STRIPE_ENVIRONMENT=test`

Para testes, usa estes segredos:

- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_PUBLISHABLE_KEY_TEST`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`
- `FACTURALUSA_API_TOKEN_TEST`

Em producao:

- `STRIPE_SECRET_KEY_LIVE` ou `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET_LIVE` ou `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY_LIVE` ou `STRIPE_PUBLISHABLE_KEY`
- `FACTURALUSA_API_TOKEN_LIVE` ou `FACTURALUSA_API_TOKEN`

Variaveis comuns:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FACTURALUSA_BASE_URL` ou `FACTURALUSA_BASE_URL_TEST`
- `FACTURALUSA_DOCUMENT_TYPE`
- `FACTURALUSA_VAT_RATE`
- `FACTURALUSA_VAT_TYPE`
- `FACTURALUSA_LANGUAGE`
- `FACTURALUSA_CURRENCY`
- `FACTURALUSA_FORCE_SEND_EMAIL=false` recomendado em teste
- `PUBLIC_SITE_URL`

## Notas

- O webhook Stripe guarda estado em `stripe_webhook_events` para ser resiliente a retries.
- O documento Facturalusa e emitido apenas depois da confirmacao de pagamento.
- Os artigos da Facturalusa sao criados automaticamente por referencia quando ainda nao existirem.
- No modo `test`, o codigo nao faz fallback automatico para chaves live.
