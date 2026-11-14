-- 004 (14/11/2026): no projeto de TESTES, o personal pode aceitar o próprio convite e ver o app como aluno.
-- Cria a tabela ajustes_banco e muda ver_convite_personal para ignorar o bloqueio 'proprio' quando o ajuste
-- 'convite_proprio' está ligado. Rodar nos dois projetos (testes e produção); pode rodar de novo sem estrago.

-- Ajustes de cada projeto do Supabase (chave → valor). Sem acesso pela API: só as funções leem.
-- 'convite_proprio' = 'sim' deixa o personal aceitar o próprio convite e virar aluno de si mesmo, para testar o
-- app do aluno com uma conta só. Ligar só no projeto de TESTES (ver a migração 004); em produção fica sem a linha.
create table if not exists public.ajustes_banco (
  chave text primary key,
  valor text not null default ''
);
alter table public.ajustes_banco enable row level security;

create or replace function public.ver_convite_personal(p_codigo text)
returns table (situacao text, nome text, cref text, uf text, atual text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
  p public.profissionais;
  eu uuid := (select auth.uid());
  s text := 'ok';
begin
  select * into v from public.vinculos where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if found then select * into p from public.profissionais where usuario_id = v.personal_id; end if;
  if not found or p.liberado_em is null or p.bloqueado_em is not null then
    return query select 'invalido'::text, ''::text, ''::text, ''::text, ''::text; return;
  end if;
  if v.cancelado_em is not null then s := 'cancelado';
  elsif v.aceito_em is not null then s := case when v.aluno_id = eu and v.encerrado_em is null then 'ok' else 'usado' end;
  elsif v.expira_em < now() then s := 'expirado';
  elsif v.personal_id = eu and not exists (select 1 from public.ajustes_banco a where a.chave = 'convite_proprio' and a.valor = 'sim')
    then s := 'proprio';
  elsif (select count(*) from public.vinculos x where x.personal_id = v.personal_id and x.aceito_em is not null and x.encerrado_em is null) >= p.limite_alunos then s := 'lotado';
  end if;
  return query select s, p.nome, p.cref, p.uf,
    coalesce((select pr.nome from public.vinculos x join public.profissionais pr on pr.usuario_id = x.personal_id
      where x.aluno_id = eu and x.aceito_em is not null and x.encerrado_em is null and x.personal_id <> v.personal_id limit 1), '')::text;
end;
$$;

-- SÓ NO PROJETO DE TESTES (não rode em produção): liga o ajuste.
-- insert into public.ajustes_banco (chave, valor) values ('convite_proprio', 'sim')
--   on conflict (chave) do update set valor = excluded.valor;
