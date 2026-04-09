# Technical SEO Playbook

## 1. Dominio e canonico
- Um host canonico: `https://iberflag.com`
- Redirect 308 unico para:
  - `www.iberflag.com`
  - `*.vercel.app`
  - rotas publicas antigas `.html`
- Nunca deixar cadeias do tipo:
  - `vercel.app -> .html -> clean URL`

## 2. Politica de indexacao

### Indexar
- `/`
- `/produtos`
- `/produtos/:categoriaSlug`
- `/produto/:produtoSlug`
- `/sobre`
- `/contacto`
- `/faq`
- `/envios`
- `/devolucoes`
- `/privacidade`
- `/termos`
- `/mapa-do-site`

### Nao indexar
- `/produto/:produtoSlug/personalizar`
- `/checkout`
- `/checkout/sucesso`
- `/encomenda/:codigo`
- `/encomendas`
- `/modelos`
- `/admin`
- `/api/*`

## 3. URL design
- Nao usar `.html` como URL publica.
- Evitar query strings como URL primaria de navegacao.
- Uma pagina indexavel deve ter uma URL humana, curta e previsivel.
- Produtos:
  - `/produto/:slug`
- Categorias:
  - `/produtos/:categoria`

## 4. Sitemap policy
- Um sitemap index na raiz.
- Sitemaps separados por tipo:
  - paginas
  - categorias
  - produtos
- So incluir:
  - 200 OK
  - canonicas
  - indexaveis
  - sem parametros

## 5. Structured data minima
- Home:
  - `Organization`
  - `WebSite`
- Categoria:
  - `CollectionPage`
  - `BreadcrumbList`
- Produto:
  - `Product`
  - `BreadcrumbList`
- FAQ:
  - `FAQPage`
- Contacto:
  - `ContactPage`
- Sobre:
  - `AboutPage`

## 6. Conteudo minimo por pagina de produto
- `title` unico
- `meta description` unica
- `h1`
- descricao curta e legivel
- imagem principal
- preco ou indicacao clara se for sob consulta
- CTA para personalizacao
- breadcrumbs
- links para categoria, envio, FAQ e contacto

## 7. Linking interno
- Home liga para categorias prioritarias.
- Categoria liga para produtos indexaveis.
- Produto liga para:
  - categoria pai
  - produtos relacionados
  - FAQ
  - envios
  - contacto
- Footer liga para sitemap e paginas institucionais.

## 8. Auditoria recorrente
- Validar sitemaps a cada deploy relevante.
- Garantir que nao ha novos hardcodes de `vercel.app`.
- Confirmar que novos produtos entram com slug consistente.
- Rever Search Console:
  - cobertura
  - canonical escolhida
  - paginas descobertas e nao indexadas
  - Core Web Vitals

## 9. Erros a evitar
- canonical para URL diferente da navegacao interna;
- sitemap com `noindex`;
- paginas indexaveis com conteudo principal vazio sem JS;
- links de produto feitos com `button` em vez de `<a href>`;
- orphan pages;
- multiplas versoes do mesmo produto por query string.
