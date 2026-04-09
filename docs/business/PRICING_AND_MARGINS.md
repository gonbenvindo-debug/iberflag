# Pricing e Margens

## 1. Objetivo

Garantir que a IberFlag vende com logica economica, nao por intuicao.

Sem este dossier, e facil:

- vender abaixo do custo real;
- oferecer descontos destrutivos;
- aumentar complexidade sem cobrar por ela;
- confundir volume com lucro.

## 2. Regra principal

Nao definir preco apenas olhando para concorrentes.

Preco correto = custo real + margem desejada + risco operacional + posicionamento comercial.

## 3. Estrutura de custo por encomenda

Cada produto deve ter uma ficha de custo.

### Custos diretos

- materia-prima
- impressao
- estrutura
- embalagem
- consumiveis
- mao de obra direta
- acabamento

### Custos logistico-operacionais

- picking
- embalamento
- transporte
- reenvio potencial
- danos

### Custos comerciais e financeiros

- fees Stripe
- custo de publicidade atribuivel
- comissao comercial, se existir
- custo de suporte pre-venda

### Custos de risco

- erro de ficheiro
- falha de producao
- devolucao ou reimpressao
- urgencia

## 4. Formula base recomendada

### Passo 1

Calcular custo total esperado por SKU / variante.

### Passo 2

Definir margem bruta minima aceitavel.

### Passo 3

Adicionar buffer para erros, urgencias e excecoes.

### Passo 4

Definir preco publico e teto de desconto.

## 5. Margens de referencia

Os valores exatos precisam de tabela real. Como regra estrategica:

- produtos simples e comparaveis: margem mais apertada, mas nunca cega;
- produtos complexos, personalizados ou urgentes: margem significativamente superior;
- servicos de ficheiro, revisao e prioridade devem ter margem alta.

Recomendacao:

- nunca deixar servicos de risco elevado sem monetizacao clara;
- a urgencia deve pagar urgencia.

## 6. Tabela minima por produto

Cada produto deve ter:

- SKU / slug
- familia
- custo de material
- custo de producao
- custo de embalagem
- custo medio de envio
- fee de pagamento estimada
- custo total esperado
- preco minimo
- preco recomendado
- margem bruta estimada
- desconto maximo permitido

## 7. Politica de descontos

Desconto sem regra e perda invisivel.

Definir:

- desconto maximo sem aprovacao
- desconto por quantidade
- desconto para revenda
- desconto para cliente recorrente
- condicoes para bundle

Evitar:

- dar desconto por reflexo;
- oferecer portes gratis sem calculo;
- igualar concorrente sem rever estrutura de custo.

## 8. Portes e entrega

Os portes devem seguir uma logica clara:

- incluidos apenas quando o preco total e margem o suportam;
- visiveis cedo;
- modelados por tipo de produto e zona;
- com regra separada para urgencia.

## 9. Modelos de preco recomendados

### Preco de entrada

Bom para SEO e descoberta, desde que corresponda a uma configuracao real.

### Preco recomendado

Deve ser o preco da configuracao que realmente faz sentido para a maioria.

### Preco custom

Para grandes quantidades, especificacoes especiais ou projetos complexos.

## 10. Riscos de margem mais provaveis

- produto com base ou acessorio mal parametrizado
- preco antigo com custo novo
- envio subestimado
- erro de IVA ou fee
- desconto manual nao controlado
- urgencia dada sem cobrar

## 11. Metrica que importa

Nao basta medir faturacao.

Deves medir:

- margem bruta por produto
- margem por canal
- margem por cliente
- lucro por encomenda
- pedidos com reimpressao ou custo extra

## 12. Decisoes imediatas

1. Criar tabela mestra de custos reais.
2. Definir margem minima por categoria.
3. Definir politica de desconto.
4. Separar claramente o que entra no preco e o que e extra.
5. Rever todos os produtos com preco simulado e substituir por precos economicamente defendiveis.

## 13. Regra final

Se o negocio nao controla margem por SKU, nao controla o negocio. Controla apenas faturacao aparente.
