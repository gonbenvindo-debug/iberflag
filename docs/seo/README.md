# SEO Reference Pack

Snapshot local preparado em `2026-04-09`.

Objetivo:
- concentrar num sitio so as regras tecnicas que interessam para a IberFlag;
- reduzir dependencia de pesquisa online para decisoes recorrentes;
- separar orientacao oficial da Google de heuristicas operacionais da industria.

Leitura recomendada:
1. [GOOGLE_SEARCH_CENTRAL.md](/Users/Suporte/Desktop/iberflag/iberflag-main/docs/seo/GOOGLE_SEARCH_CENTRAL.md)
2. [TECHNICAL_SEO_PLAYBOOK.md](/Users/Suporte/Desktop/iberflag/iberflag-main/docs/seo/TECHNICAL_SEO_PLAYBOOK.md)
3. [INTERNAL_LINKING_AND_INFORMATION_ARCHITECTURE.md](/Users/Suporte/Desktop/iberflag/iberflag-main/docs/seo/INTERNAL_LINKING_AND_INFORMATION_ARCHITECTURE.md)
4. [WEB_DEV_CORE_WEB_VITALS.md](/Users/Suporte/Desktop/iberflag/iberflag-main/docs/seo/WEB_DEV_CORE_WEB_VITALS.md)
5. [SEARCH_CONSOLE_ROLLOUT.md](/Users/Suporte/Desktop/iberflag/iberflag-main/docs/seo/SEARCH_CONSOLE_ROLLOUT.md)
6. [SOURCE_MANIFEST.md](/Users/Suporte/Desktop/iberflag/iberflag-main/docs/seo/SOURCE_MANIFEST.md)

Regras-base para a IberFlag:
- O dominio canonicamente indexavel e `https://iberflag.com`.
- So entram em sitemap e indice as paginas publicas de conteudo: home, institucionais, categorias e produtos.
- Checkout, tracking, admin, sucesso de checkout, personalizador e galeria de templates ficam `noindex,follow`.
- Produto e categoria devem existir em HTML estatico com conteudo principal visivel sem depender de fetch client-side.
- Canonicals, breadcrumbs, links internos e structured data devem apontar sempre para as URLs limpas.

Limites deste dossier:
- Nao e um mirror completo da documentacao externa.
- E um resumo curado e operacional.
- Quando houver conflito, a prioridade e:
  1. documentacao oficial da Google;
  2. documentacao oficial de performance do web.dev;
  3. referencias externas curadas.
