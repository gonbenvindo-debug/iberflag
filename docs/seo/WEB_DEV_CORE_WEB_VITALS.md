# Core Web Vitals And Crawlability

## Metricas que interessam
- `LCP`:
  - alvo bom: `<= 2.5s`
- `INP`:
  - alvo bom: `<= 200ms`
- `CLS`:
  - alvo bom: `<= 0.1`

Para laboratorio interno continua a ser util acompanhar tambem:
- `TBT`
- `FCP`
- `Speed Index`

## O que isto significa na pratica
- Core Web Vitals nao sao a mesma coisa que indexacao, mas afetam qualidade tecnica e experiencia real.
- Em ecommerce/catalogo, a combinacao que mais prejudica costuma ser:
  - imagens pesadas;
  - CSS/JS excessivo;
  - fonts e scripts third-party acima da dobra;
  - layout shifts em cards, banners e imagens sem dimensoes fixas.

## Regras operacionais para a IberFlag

### HTML publico
- HTML publico deve usar cache revalidavel, nao `no-store`.
- Conteudo SEO principal tem de sair no HTML inicial.
- Scripts nao criticos devem ser `defer`.

### Imagens
- Sempre definir `width` e `height` ou `aspect-ratio`.
- Usar `loading="lazy"` abaixo da dobra.
- Usar `decoding="async"` quando fizer sentido.
- Evitar heros com imagens gigantes sem compressao.

### CSS e JS
- Carregar apenas o necessario por pagina.
- Evitar dependencia de JS para headings, breadcrumbs, descricao principal e dados de produto.
- Se uma pagina so existe para SEO, o conteudo principal nao deve esperar por Supabase client-side.

### Fonts e terceiros
- Menos terceiros e melhor.
- Password managers e extensoes do browser podem sujar a consola, mas nao devem afetar HTML publico nem crawlability.

## Checklist rapido por template
- Home:
  - hero leve;
  - imagens principais otimizadas;
  - links rapidos para categorias e produtos.
- Categoria:
  - listagem renderizada no HTML;
  - links para produtos reais;
  - copy curta mas unica.
- Produto:
  - H1, descricao, preco, imagem, CTA, breadcrumbs e related products no HTML.

## Fonte oficial
- web.dev Web Vitals:
  [web.dev/articles/vitals](https://web.dev/articles/vitals)
