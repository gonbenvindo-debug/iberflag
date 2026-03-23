# IberFlag - E-commerce Iberico de Publicidade Visual

Plataforma completa de e-commerce especializada em flybanners e produtos publicitarios para o mercado de Portugal e Espanha, com **personalizador estilo Canva**.

## 🚀 Características

### Frontend
- **Design Moderno**: Interface clean e apelativa com animações CSS inovadoras
- **Totalmente Responsivo**: Otimizado para desktop, tablet e mobile com menu hamburger
- **Personalizador Avançado**: Editor SVG estilo Canva com resize handles, drag & drop, e camadas
- **Carrinho de Compras**: Sistema completo com localStorage e edição de designs
- **Filtros Avançados**: Pesquisa e filtragem por categoria e preço
- **Animações Premium**: Transições suaves, hover effects, e loading states
- **SEO Otimizado**: Meta tags e estrutura semântica
- **Mobile Menu**: Menu hamburger funcional em todas as páginas

### Backend (Supabase)
- **Base de Dados PostgreSQL**: Schema completo para produtos, encomendas, clientes
- **Autenticação**: Sistema de utilizadores para admin
- **Row Level Security**: Políticas de segurança implementadas
- **Real-time**: Atualizações em tempo real

### Painel Admin
- **Dashboard Completo**: Estatísticas e métricas em tempo real
- **Gestão de Produtos**: CRUD completo com upload de imagens e SVG templates
- **Upload de SVG**: Sistema de upload direto de ficheiros SVG para templates
- **Gestão de Encomendas**: Acompanhamento de pedidos com designs personalizados
- **Gestão de Clientes**: Base de dados de clientes
- **Gestão de Contactos**: Mensagens recebidas via formulário

### Personalizador (Novo!)
- **Interface Estilo Canva**: Layout moderno com 3 painéis (Ferramentas | Canvas | Camadas)
- **Resize Handles**: 8 handles de redimensionamento (cantos + lados)
- **Drag & Drop**: Arrastar elementos com cursores personalizados
- **Camadas**: Sistema de camadas com reordenação (move up/down)
- **Propriedades Dinâmicas**: Painel de propriedades contextual por tipo de elemento
- **Auto-save**: Salvamento automático a cada 5 segundos
- **Edição Persistente**: Continuar a editar designs do carrinho
- **Templates SVG**: Carregamento de templates personalizados por produto
- **Undo/Redo**: Sistema de histórico completo
- **Zoom**: Controlo de zoom (50% - 200%)
- **Grid Background**: Fundo em grelha estilo design profissional

## 📁 Estrutura do Projeto

```
iberflag/
├── pages/
│   ├── index.html              # Homepage
│   ├── produtos.html           # Catálogo de produtos
│   ├── contacto.html           # Formulário de contacto
│   ├── faq.html                # Perguntas frequentes
│   ├── envios.html             # Informações de envio
│   ├── admin.html              # Painel de administração
│   └── personalizar.html       # Personalizador de produtos (Canva-style)
├── assets/
│   ├── css/
│   │   ├── style.css       # Estilos globais com animações
│   │   ├── tailwind.css    # Fonte do Tailwind
│   │   └── tailwind.output.css # CSS compilado
│   └── js/
│       ├── core/
│       │   ├── logic.js    # Lógica partilhada e carrinho
│       │   └── order-workflow.js # Workflow de encomendas
│       └── pages/
│           ├── admin.js
│           ├── checkout.js
│           ├── contacto.js
│           ├── encomenda.js
│           ├── encomendas.js
│           ├── faq.js
│           ├── personalizar.js
│           └── produtos.js
├── scripts/
│   ├── populate-products.js   # Script para popular DB com produtos teste
│   ├── setup-security.js
│   ├── audit.js
│   └── audit2.js
├── package.json           # Dependências Node.js
├── .env                   # Variáveis de ambiente (Supabase)
├── supabase-schema.sql    # Schema da base de dados
└── vercel.json            # Configuração Vercel
```

## 🛠️ Setup e Instalação

### 1. Configurar Supabase

1. Aceda a [supabase.com](https://supabase.com) e crie um projeto
2. No SQL Editor, execute o ficheiro `supabase-schema.sql`
3. Isto irá criar:
   - Todas as tabelas necessárias
   - Índices para performance
   - Políticas de segurança (RLS)

### 2. Popular Base de Dados com Produtos de Teste

Execute o script de população para adicionar 6 produtos com templates SVG:

```bash
# Instalar dependências
npm install

# Executar script de população
npm run populate
```

Isto irá adicionar:
- 3 Flybanners (Pequeno, Médio, Grande) com templates SVG
- 2 Roll-ups (Standard, Premium) com templates SVG
- 1 Banner Horizontal com template SVG

Cada produto inclui um template SVG otimizado com área de impressão delimitada.

### 2. Configurar Variáveis de Ambiente

As credenciais do Supabase podem ser definidas via `window.APP_CONFIG` (opcional) e têm fallback para os valores atuais no `logic.js`:
- URL: `https://nzwfquivulxkmxrwqalz.supabase.co`
- ANON KEY: Já configurada em `logic.js`

**IMPORTANTE**: Para produção, mova estas credenciais para variáveis de ambiente.

### 3. Deploy

#### Opção A: Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Opção B: Netlify
```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

#### Opção C: Servidor Local
```bash
# Usar qualquer servidor HTTP
python -m http.server 8000
# ou
npx serve
```

## 📊 Aceder ao Painel Admin

1. Navegue para `/admin` (ou `/admin.html`)
2. Configure o email único de admin no meta `iberflag-admin-email` em `pages/admin.html`
3. O login é feito apenas com password (email não é pedido no formulário)
4. O painel só aceita sessão do utilizador cujo email coincide com `iberflag-admin-email`
5. Funcionalidades disponíveis:
   - Dashboard com estatísticas
   - Adicionar/Editar/Eliminar produtos
   - Ver encomendas e clientes
   - Gerir contactos recebidos

## 🎨 Personalização

### Cores
Edite as variáveis CSS em `style.css`:
```css
:root {
    --primary: #2563eb;
    --primary-dark: #1d4ed8;
    --secondary: #4f46e5;
    --accent: #06b6d4;
}
```

### Conteúdo
- **Contactos**: Atualize email e telefone em todos os ficheiros HTML
- **Morada**: Edite em `pages/contacto.html` e `pages/envios.html`
- **Redes Sociais**: Adicione links reais no footer
- **Imagens**: Substitua URLs do Unsplash por imagens próprias

### Produtos
Adicione produtos através de:
1. Painel Admin (`/admin` ou `/admin.html`)
2. Diretamente no Supabase
3. SQL: `INSERT INTO produtos (...) VALUES (...)`

## 🔧 Funcionalidades Principais

### Carrinho de Compras
- Adicionar/Remover produtos
- Atualizar quantidades
- Persistência com localStorage
- Sidebar animado

### Filtros de Produtos
- Por categoria (Flybanners, Roll-ups, Lonas)
- Por faixa de preço
- Ordenação (preço, nome)
- Pesquisa em tempo real

### Formulário de Contacto
- Validação completa
- Envio para Supabase
- Notificações toast
- Proteção GDPR

### Animações
- Marquee no banner superior
- Floating shapes no hero
- Hover effects nos cards
- Skeleton loading
- Page transitions
- Smooth scrolling

## 📱 Páginas Criadas

- ✅ **Homepage** (`pages/index.html`) - Hero, categorias, produtos em destaque
- ✅ **Produtos** (`pages/produtos.html`) - Catálogo completo com filtros
- ✅ **Contacto** (`pages/contacto.html`) - Formulário funcional
- ✅ **FAQ** (`pages/faq.html`) - Accordion com pesquisa
- ✅ **Envios** (`pages/envios.html`) - Informações de entrega
- ✅ **Admin** (`pages/admin.html`) - Painel de gestão completo

## 🔐 Segurança

- Row Level Security (RLS) ativado
- Políticas de acesso configuradas
- Validação de formulários
- Proteção contra SQL injection (Supabase)
- HTTPS obrigatório em produção

## 📈 Próximos Passos

1. **Hardening Admin**: adicionar rate limit server-side e MFA para admin
2. **Checkout**: Página de finalização de compra
3. **Pagamentos**: Integração com Stripe/PayPal
4. **Email**: Notificações automáticas
5. **Analytics**: Google Analytics ou Plausible
6. **Blog**: Secção de notícias/artigos
7. **Reviews**: Sistema de avaliações

## 🐛 Troubleshooting

### Produtos não aparecem
- Verifique se executou o `supabase-schema.sql`
- Confirme as credenciais do Supabase
- Veja o console do browser (F12)

### Carrinho não funciona
- Limpe o localStorage: `localStorage.clear()`
- Verifique se JavaScript está ativado

### Admin não carrega
- Verifique permissões no Supabase
- Configure RLS policies corretamente

## 📞 Suporte

Para dúvidas ou problemas:
- Email: geral@latinflag.pt
- Telefone: +351 900 000 000

## 📄 Licença

Projeto proprietario - IberFlag © 2024

---

**Desenvolvido para IberFlag** - WebApp de Publicidade Visual para a Peninsula Iberica

Esta é uma aplicação web simples e moderna para venda de produtos de publicidade exterior, preparada para ser alojada na **Vercel** e utilizar o **Supabase** como base de dados.

## 🚀 Como Configurar

### 1. Supabase
Crie um projeto no [Supabase](https://supabase.com/) e execute o seguinte SQL no **SQL Editor** para criar a tabela de produtos:

```sql
create table produtos (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  preco decimal(10,2),
  imagem text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Inserir alguns dados de exemplo
insert into produtos (nome, descricao, preco, imagem)
values 
('Bandeira Drop', 'Bandeira publicitária em formato gota, resistente ao vento.', 45.00, 'https://images.unsplash.com/photo-1596435707700-6264292b919d'),
('Roll-up Premium', 'Expositor vertical auto-enrolável com impressão HQ.', 65.00, 'https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1'),
('Lona PVC', 'Lona de alta resistência com ilhós.', 25.00, 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a');
```

### 2. Ligar a App ao Supabase
No ficheiro `logic.js`, substitua as constantes:
- `SUPABASE_URL`: O URL do seu projeto Supabase.
- `SUPABASE_ANON_KEY`: A sua chave anónima (Anon Key).

### 3. Deploy na Vercel
1. Instale a CLI da Vercel: `npm i -g vercel`
2. Corra `vercel` na pasta raiz do projeto.
3. Ou ligue o seu repositório GitHub diretamente ao painel da Vercel.

## 🛠️ Tecnologias
- **HTML5 / CSS3** (Puro)
- **Tailwind CSS** (Styling via CDN)
- **Lucide Icons** (Ícones modernos)
- **Supabase** (Backend as a Service)
- **Vercel** (Hosting)
