# LatinFlag - WebApp de Publicidade Outdoor

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
