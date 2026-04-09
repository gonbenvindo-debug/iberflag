# Internal Linking And Information Architecture

## Objetivo
Fazer com que a Google descubra rapido, compreenda melhor o contexto de cada pagina e encontre uma rota logica entre home, categorias, produtos e paginas de apoio.

## Arquitetura recomendada para a IberFlag

```text
Home
 -> Categorias principais
 -> Produtos destacados
 -> FAQ / Envios / Contacto

Categoria
 -> Produtos dessa categoria
 -> Categorias relacionadas
 -> FAQ / Envios / Contacto

Produto
 -> Categoria pai
 -> Produtos relacionados
 -> Personalizador
 -> FAQ / Envios / Contacto
```

## Principios
- Cada pagina indexavel tem de receber pelo menos um link interno crawlable.
- Produtos nao podem depender so da pesquisa interna ou de modais.
- Breadcrumbs ajudam a semantica e a descoberta.
- Anchor text deve refletir o tipo de produto/categoria, nao apenas "ver mais".

## Regras operacionais

### Home
- Destacar categorias com valor comercial e volume.
- Ligar diretamente para alguns produtos com procura recorrente.

### Categorias
- Servem de hub semantico.
- Devem ter texto introdutorio, links para produtos e algum contexto.

### Produtos
- Devem ligar de volta para a categoria.
- Devem ter secao de relacionados do mesmo universo.
- Devem ligar para paginas de confianca:
  - FAQ
  - envios
  - contacto

### Footer
- Nao encher com ruido.
- Ligar sempre para:
  - categorias/paginas nucleares
  - sitemap HTML
  - termos legais

## Sinais de arquitetura fraca
- URLs que so aparecem em sitemap;
- produto acessivel apenas por modal ou JS state;
- categorias sem copy nem contexto;
- links repetidos com o mesmo anchor generico;
- paginas com canonical certo, mas sem links internos para la.

## Aplicacao especifica na IberFlag
- Home deve empurrar `fly-banner`, `roll-up` e `wall-banner`.
- Categoria deve ser a ponte entre procura genérica e produto especifico.
- O personalizador nao deve ser tratado como destino SEO; o destino SEO e o detalhe do produto.

## Referencias curadas
- LearningSEO:
  [learningseo.io](https://learningseo.io/)
- Internal linking on LearningSEO:
  [learningseo.io/seo_roadmap/deepen-knowledge/advanced-technical/internal-linking](https://learningseo.io/seo_roadmap/deepen-knowledge/advanced-technical/internal-linking/)
- Caso de estudo de internal linking da Orainti:
  [orainti.com/seo-case-study/internal-linking-optimization-to-improve-organic-traffic-pages-per-session](https://www.orainti.com/seo-case-study/internal-linking-optimization-to-improve-organic-traffic-pages-per-session/)
