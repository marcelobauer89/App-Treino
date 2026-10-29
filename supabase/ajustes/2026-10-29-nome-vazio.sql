-- Perfis sem nome: o nome é copiado do Google só quando a conta é criada; se ele não veio (ou foi apagado),
-- o painel mostrava só o e-mail. Rode no SQL Editor (testes e produção). Pode rodar de novo: só mexe em quem está sem nome.

-- 1. Preenche com o nome do Google.
update public.perfis p
   set nome = left(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), 120)
  from auth.users u
 where u.id = p.id
   and trim(coalesce(p.nome, '')) = ''
   and trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')) <> '';

-- 2. Quem continua sem nome (a conta do Google não tem nome): a pessoa digita em Você → Dados,
--    ou rode: update public.perfis set nome = 'Nome da pessoa' where email = 'email@da.pessoa';
select p.email from public.perfis p where trim(coalesce(p.nome, '')) = '';
