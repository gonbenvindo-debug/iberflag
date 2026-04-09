# Google Search Central

## O que interessa mesmo

### 1. Search Essentials
- A Google separa SEO em tres blocos: requisitos tecnicos, politicas de spam e conteudo util para pessoas.
- Requisito minimo tecnico:
  - URL tem de devolver HTTP valido;
  - Googlebot nao pode estar bloqueado;
  - pagina tem de ser indexavel;
  - conteudo principal tem de conseguir ser renderizado.
- `robots.txt` nao substitui `noindex`.
- Structured data nao compensa problemas de crawling, canonical ou thin content.

### 2. SEO Starter Guide
- Titles, descriptions, headings, links internos, imagens, navegacao e dados estruturados continuam a ser o baseline.
- A arquitetura deve ser simples, previsivel e consistente.
- Evitar criar multiplas URLs para o mesmo conteudo sem sinal canonico claro.
- A Google trata sitemap como pista, nao garantia de indexacao.

### 3. Canonicalizacao
- Canonical e um sinal, nao um comando absoluto.
- Os sinais mais fortes devem apontar todos na mesma direcao:
  - redirect permanente;
  - `rel="canonical"`;
  - sitemap;
  - links internos;
  - ausencia de versoes concorrentes com parametros ou `.html`.
- Se a mesma pagina existir em varias URLs, a Google pode ignorar o canonical se os outros sinais forem contraditorios.

### 4. Sitemaps
- Sitemap deve listar apenas URLs canonicas e indexaveis.
- Nao meter URLs com redirect, `noindex`, erro, parametros ou duplicadas.
- Em sites maiores, separar por grupos ajuda manutencao e debugging.
- Sitemap index e abordagem correta quando ha paginas, categorias e produtos em ficheiros distintos.

### 5. Robots meta e X-Robots-Tag
- Para paginas utilitarias, usar `noindex,follow`.
- Para API, admin e endpoints tecnicos, usar `noindex,nofollow`.
- Se quiseres excluir do indice mas manter descoberta de links, usa `noindex,follow`.
- Se bloqueares via `robots.txt`, a Google pode nao ver o `noindex` da pagina.

### 6. JavaScript SEO
- A Google recomenda que links navegacionais relevantes sejam links reais (`<a href>`), nao apenas handlers JS.
- Conteudo importante para indexacao nao deve depender exclusivamente de interacoes do cliente.
- Render client-side puro aumenta risco de descoberta lenta, conteudo parcial e problemas de render budget.
- Lazy loading deve ser implementado de forma crawlable.

### 7. Structured data
- Structured data serve para clarificar o tipo de conteudo e elegibilidade para resultados enriquecidos.
- Nao inventar dados nem marcar conteudo que o utilizador nao ve.
- Para a IberFlag, os tipos relevantes sao:
  - `Organization`
  - `WebSite`
  - `BreadcrumbList`
  - `CollectionPage`
  - `Product`
  - `FAQPage`
  - `AboutPage`
  - `ContactPage`

### 8. Ecommerce
- A Google tem guias especificos para ecommerce sobre URL structure, site structure, product data e launch de sites novos.
- Para a IberFlag isso implica:
  - uma URL canonica por produto;
  - uma categoria consistente;
  - dados de produto visiveis no HTML;
  - structured data coerente;
  - navegacao clara entre categoria e produto.

## Implicacoes praticas para a IberFlag
- `iberflag.com` deve ser o unico host canonico.
- `vercel.app`, `www`, `.html` e query URLs antigas devem fazer redirect 308 direto.
- O personalizador nao deve ser pagina SEO; a pagina SEO e o detalhe do produto.
- Home e categorias devem empurrar crawl para produtos.
- Footer, breadcrumbs e produtos relacionados devem reforcar descoberta.

## Fontes oficiais
- Google Search Essentials:
  [developers.google.com/search/docs/essentials](https://developers.google.com/search/docs/essentials)
- SEO Starter Guide:
  [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- Canonicalizacao:
  [developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- Sitemaps:
  [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- Robots meta:
  [developers.google.com/search/docs/crawling-indexing/robots-meta-tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- JavaScript SEO basics:
  [developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- Search Console start:
  [developers.google.com/search/docs/monitor-debug/search-console-start](https://developers.google.com/search/docs/monitor-debug/search-console-start)
