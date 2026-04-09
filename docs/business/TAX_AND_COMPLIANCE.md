# Faturacao, Fiscalidade e Compliance

## 1. Objetivo

Passar para live sem risco fiscal evitavel.

Isto exige mais do que emitir documentos. Exige:

- decidir corretamente o regime de IVA;
- validar dados do cliente;
- guardar evidencia;
- tratar excecoes sem improviso;
- manter trilho auditavel.

## 2. Principio base

Quando houver duvida fiscal, o sistema deve parar para validacao ou encaminhar para decisao humana. Nao deve adivinhar.

## 3. Regras minimas a fechar antes de live

### Identificacao do cliente

- particular vs empresa
- pais
- NIF / VAT
- nome fiscal
- morada de faturacao

### Regra de IVA

Para cada compra, tens de conseguir responder:

- o cliente esta em Portugal, UE ou fora da UE?
- e particular ou empresa?
- tem VAT valido quando aplicavel?
- o produto / servico segue que regra de IVA?
- existe isencao ou reverse charge?

### Evidencia

Guardar:

- NIF / VAT submetido
- resultado de validacao
- timestamp
- pais
- decisao fiscal aplicada
- referencia do documento emitido

## 4. VIES

Para B2B intracomunitario:

- validar VAT no VIES quando aplicavel;
- guardar o resultado;
- definir o que fazer se o VIES estiver indisponivel;
- nunca assumir automaticamente que um numero parecido com VAT esta valido.

Fluxo recomendado:

1. cliente introduz VAT
2. sistema valida formato
3. sistema tenta validar VIES
4. resultado fica guardado
5. so depois se decide o tratamento fiscal final

## 5. Facturalusa

O Facturalusa e meio de emissao, nao motor legal de decisao por si so.

Antes de emitir, a IberFlag precisa de saber:

- que `vat_type` usar;
- que taxa usar;
- se existe isencao;
- se o cliente deve ou nao existir como entidade empresarial;
- se a serie certa esta selecionada.

## 6. Estados recomendados de faturacao

- pending
- ready_to_emit
- issued
- blocked
- failed
- needs_review

O cliente nao precisa de ver todos estes estados. O admin sim.

## 7. Casos de risco elevado

- empresa da UE sem VAT validado
- cliente com dados fiscais contraditorios
- pagamento confirmado e emissao falhada
- reemissao apos correcao de NIF
- nota de credito ou anulacao
- compra transfronteirica mal classificada

Cada um destes casos precisa de processo escrito.

## 8. Politica de erro

Se a emissao falhar:

- a encomenda nao deve desaparecer;
- o pagamento nao deve ser perdido;
- o erro deve ser legivel;
- deve existir caminho de reprocessamento;
- deve existir registo do que foi tentado.

## 9. Checklist de live fiscal

1. Arvore de decisao de IVA validada com contabilista.
2. Regra PT / UE / extra-UE fechada.
3. VIES integrado e com fallback documentado.
4. Campos obrigatorios fechados por tipo de cliente.
5. Facturalusa test validado em cenarios reais.
6. Reemissao e correcao testadas.
7. Evidencia fiscal persistida por encomenda.
8. Logs suficientes para auditoria.

## 10. Donos da decisao

### Sistema

- validacoes basicas
- recolha de dados
- tentativa de VIES
- preparacao de payload
- registo de evidencia

### Operacao / humano

- excecoes
- reclassificacoes
- casos com dados contraditorios
- anulacoes / credito
- confirmacao final de regras cinzentas

## 11. Backlog imediato

1. Criar arvore de decisao fiscal formal.
2. Mapear cenarios para `vat_type`, taxa e isencao.
3. Guardar evidencia de validacao VIES por encomenda.
4. Documentar politica de erro e reemissao.
5. Rever todos os templates email e estados para garantir coerencia fiscal.

## 12. Regra final

O objetivo nao e emitir mais depressa a qualquer custo. E emitir corretamente, com prova, e sem criar passivo fiscal escondido.
