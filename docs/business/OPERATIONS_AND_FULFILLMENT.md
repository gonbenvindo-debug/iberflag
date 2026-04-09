# Operacoes e Fulfillment

## 1. Objetivo

Garantir que a experiencia pos-compra e previsivel, escalavel e auditavel.

Num negocio de personalizacao, a venda nao termina no pagamento. E ai que comeca o risco operacional.

## 2. Fluxo operacional alvo

1. encomenda paga
2. validacao de dados e arte
3. validacao fiscal
4. preparacao de producao
5. producao
6. controlo de qualidade
7. embalamento
8. expedicao
9. tracking
10. entrega
11. pos-venda e arquivo

## 3. Estados recomendados

Os estados do cliente devem ser simples.

- em preparacao
- em producao
- expedido
- entregue

Os estados internos podem ser mais detalhados no admin, mas sem poluir a experiencia publica.

## 4. Pontos de controlo obrigatorios

### Antes de producao

- dados do cliente validos
- morada valida
- pagamento confirmado
- regra fiscal fechada
- arte confirmada ou aceite segundo o fluxo definido

### Antes de expedicao

- produto correto
- quantidade correta
- acabamento correto
- embalagem adequada
- tracking criado

## 5. SLA por familia de produto

Tens de fechar isto por escrito.

Cada familia precisa de:

- prazo standard
- prazo urgente
- cut-off horario
- condicoes que suspendem SLA

Exemplos de suspensao:

- ficheiro invalido
- NIF / VAT pendente
- confirmacao de arte pendente
- stock / material indisponivel

## 6. Excecoes que precisam de processo proprio

- pagamento confirmado mas faturacao falhou
- erro de arte detetado antes de produzir
- cliente quer alterar depois de pagar
- encomenda urgente fora de SLA
- tracking ainda nao disponivel
- expedicao falhada
- documento fiscal precisa de reemissao

Para cada excecao deve existir:

- dono do problema
- prazo maximo de resolucao
- comunicacao ao cliente

## 7. Comunicacao operacional

O cliente nao precisa de ver todos os detalhes internos. Precisa de perceber:

- que a encomenda existe
- que esta a avancar
- quando esta pronta
- quando foi expedida
- o que fazer se algo falhar

Emails e estados devem ser consistentes com a operacao real.

## 8. Dados operacionais minimos por encomenda

- codigo da encomenda
- cliente
- produto e snapshots
- prazo prometido
- payment status
- facturalusa status
- estado operacional
- tracking code
- notas internas
- historico de eventos

## 9. KPIs operacionais

- tempo medio ate producao
- tempo medio ate expedicao
- taxa de encomendas no SLA
- taxa de erro de producao
- taxa de reimpressao
- taxa de contactos pos-compra por duvida evitavel

## 10. Gargalos provaveis

- arte enviada em mau formato
- cliente altera dados apos pagamento
- regras fiscais ainda nao automatizadas por completo
- falta de disciplina na atualizacao do estado
- tracking tardio ou mal integrado

## 11. Backlog imediato

1. Fechar SLA real por categoria.
2. Documentar excecoes e respostas padrão.
3. Garantir que cada encomenda tem historico legivel.
4. Alinhar emails com estados reais.
5. Definir checklists curtas para producao e expedicao.

## 12. Regra final

Operacao boa nao e a que resolve heroicamente no fim. E a que evita o erro antes de ele chegar ao cliente.
