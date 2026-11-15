-- 008 (15/11/2026): ao encerrar o acompanhamento (pelo aluno, pelo personal ou na troca de personal), os treinos que o
-- personal montou saem do app do aluno; voltam os que ele tinha antes do primeiro personal (ou o plano pronto do app).
-- Rodar nos dois projetos (testes e produção), depois da 007; pode rodar de novo sem estrago.

-- Os treinos que o aluno tinha antes do primeiro personal ({ treinos, jornada, em }): voltam quando o acompanhamento acaba.
alter table public.perfis add column if not exists treinos_antes_personal jsonb
  check (treinos_antes_personal is null or (jsonb_typeof(treinos_antes_personal) = 'object' and pg_column_size(treinos_antes_personal) <= 40000));

-- Fim do acompanhamento (aluno encerrou, personal encerrou ou o aluno trocou de personal): os treinos que aquele
-- personal montou saem do app do aluno. Voltam os que o aluno tinha antes do primeiro personal (ou o plano pronto do app),
-- e a versão anterior guardada é apagada, para "Restaurar versão anterior" não trazer a ficha de volta.
create or replace function public.tirar_treinos_do_personal(p_aluno uuid, p_personal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfis p set
    treinos = nullif(p.treinos_antes_personal -> 'treinos', 'null'::jsonb),
    jornada = p.treinos_antes_personal ->> 'jornada',
    treinos_anterior = null, ficha_id = null, treinos_por = null, treinos_em = null,
    acompanhado_por = null -- na mesma linha: o gatilho treinos_do_personal só barra a troca com personal ativo
  where p.id = p_aluno and p.treinos_por = p_personal;
  update public.perfis set acompanhado_por = null, treinos_antes_personal = null where id = p_aluno;
end;
$$;
revoke execute on function public.tirar_treinos_do_personal(uuid, uuid) from public, anon, authenticated;

-- Aceitar: guarda os treinos de antes do primeiro personal e, na troca, tira os do personal anterior.
create or replace function public.aceitar_vinculo(p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  v public.vinculos;
  s text;
  antigo uuid;
  antes jsonb;
begin
  if eu is null then raise exception 'Entre com o Google para aceitar o convite.'; end if;
  select c.situacao into s from public.ver_convite_personal(p_codigo) c;
  if s <> 'ok' then return s; end if;
  select * into v from public.vinculos where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')) for update;
  if v.aluno_id = eu and v.aceito_em is not null then return 'ok'; end if;
  -- Troca de personal: os treinos do anterior saem (voltam os de antes do primeiro personal).
  select x.personal_id into antigo from public.vinculos x where x.aluno_id = eu and x.aceito_em is not null and x.encerrado_em is null;
  update public.vinculos set encerrado_em = now(), encerrado_por = 'troca'
    where aluno_id = eu and aceito_em is not null and encerrado_em is null;
  if antigo is not null then
    antes := (select p.treinos_antes_personal from public.perfis p where p.id = eu);
    perform public.tirar_treinos_do_personal(eu, antigo);
    update public.perfis set treinos_antes_personal = antes where id = eu;
  end if;
  update public.vinculos set aluno_id = eu, aceito_em = now() where id = v.id;
  update public.perfis set acompanhado_por = v.personal_id, liberado = true, acesso_pedido_em = null,
    treinos_antes_personal = coalesce(treinos_antes_personal, jsonb_build_object('treinos', treinos, 'jornada', jornada, 'em', now())),
    liberado_como = case when liberado then liberado_como else 'personal' end,
    liberado_em = case when liberado then liberado_em else now() end
    where id = eu;
  return 'ok';
end;
$$;

-- Encerrar pelo aluno ou pelo personal: os treinos do personal saem.
create or replace function public.encerrar_vinculo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  quem uuid;
begin
  select personal_id into quem from public.vinculos where aluno_id = eu and aceito_em is not null and encerrado_em is null;
  update public.vinculos set encerrado_em = now(), encerrado_por = 'aluno'
    where aluno_id = eu and aceito_em is not null and encerrado_em is null;
  if quem is not null then perform public.tirar_treinos_do_personal(eu, quem);
  else update public.perfis set acompanhado_por = null where id = eu; end if;
end;
$$;
create or replace function public.personal_encerrar_vinculo(p_aluno uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_meu_aluno(p_aluno) then raise exception 'Este aluno não está com você.'; end if;
  update public.vinculos set encerrado_em = now(), encerrado_por = 'personal'
    where aluno_id = p_aluno and personal_id = (select auth.uid()) and aceito_em is not null and encerrado_em is null;
  perform public.tirar_treinos_do_personal(p_aluno, (select auth.uid()));
end;
$$;
