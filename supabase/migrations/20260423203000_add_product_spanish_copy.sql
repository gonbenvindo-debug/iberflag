alter table if exists public.produtos
    add column if not exists nome_es text,
    add column if not exists descricao_es text;

comment on column public.produtos.nome_es is 'Nome do produto em espanhol para a experiencia /es.';
comment on column public.produtos.descricao_es is 'Descricao do produto em espanhol para a experiencia /es.';
