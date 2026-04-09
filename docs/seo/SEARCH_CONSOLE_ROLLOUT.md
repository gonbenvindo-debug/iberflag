# Search Console Rollout

## 1. Verificacao inicial
- Criar ou confirmar `Domain property` para `iberflag.com`.
- Preferir verificacao DNS ao inves de propriedades por prefixo de URL.
- Confirmar que `www` e variantes ficam cobertas pela mesma propriedade.

Fonte:
- [Verify your site ownership](https://support.google.com/webmasters/answer/9008080)

## 2. Sitemaps
- Submeter apenas:
  - `https://iberflag.com/sitemap.xml`
- Depois confirmar se o sitemap index expande para:
  - `pages.xml`
  - `categories.xml`
  - `products.xml`

Fonte:
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

## 3. Pedido de indexacao
- Pedir inspecao/indexacao manual para:
  - home
  - 3 categorias principais
  - 5 a 10 produtos prioritarios
- Nao gastar tempo a pedir indexacao de checkout, tracking ou personalizador.

## 4. Monitores principais
- Coverage / Pages
- Canonical escolhida pela Google
- Crawled but not indexed
- Discovered but not indexed
- Redirected pages inesperadas
- Core Web Vitals

## 5. Testes apos deploy
- Verificar `Live URL` da home, de uma categoria e de um produto.
- Confirmar:
  - 200 final
  - canonical correta
  - robots correto
  - HTML com conteudo principal visivel

## 6. Indicadores de problema
- sitemap aceite mas muitas URLs "excluded";
- canonical da Google diferente da tua;
- produtos descobertos mas nao indexados;
- grande percentagem de soft duplicates;
- perda de descoberta depois de troca de URL structure.

## 7. Rotina semanal inicial
- Semana 1:
  - verificar propriedade e sitemap
  - inspecionar URLs chave
- Semana 2:
  - rever cobertura e canonicals
- Semana 3:
  - rever desempenho organico inicial
- Semana 4:
  - rever logs, Core Web Vitals e novas paginas publicadas

## Fontes oficiais
- Search Console start:
  [developers.google.com/search/docs/monitor-debug/search-console-start](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- Verify ownership:
  [support.google.com/webmasters/answer/9008080](https://support.google.com/webmasters/answer/9008080)
