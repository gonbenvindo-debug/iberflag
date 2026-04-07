# Teste de pagamentos

Para testar o checkout sem tocar na produção:

1. Define `PAYMENT_ENVIRONMENT=test`.
2. Preenche:
   - `STRIPE_SECRET_KEY_TEST`
   - `STRIPE_WEBHOOK_SECRET_TEST`
   - `STRIPE_PUBLISHABLE_KEY_TEST` ou `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`
   - `FACTURALUSA_API_TOKEN_TEST`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Mantem:
   - `FACTURALUSA_FORCE_SEND_EMAIL=false`
4. Valida a configuracao com:

```bash
npm run payments:check
```

O ficheiro [.env.test.example](/C:/Users/Benvindo/OneDrive/iberflag/.env.test.example) serve como checklist rapido.

Notas:

- O codigo nao faz fallback automatico para chaves live quando o modo esta em `test`.
- O Facturalusa usa a mesma API base por defeito; se tiveres um endpoint de teste dedicado, define `FACTURALUSA_BASE_URL_TEST`.
- O checkout continua a usar `Checkout Session` do Stripe e o webhook confirma a encomenda antes de emitir o documento fiscal.
