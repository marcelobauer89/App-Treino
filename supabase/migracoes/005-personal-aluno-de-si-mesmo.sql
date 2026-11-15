-- 005 (14/11/2026): o personal que é aluno de si mesmo (banco de testes, ajuste 'convite_proprio') consegue aplicar
-- ficha e ajustar os próprios treinos. Antes, a regra "o aluno não muda os treinos que o personal monta" barrava
-- também o personal. Rodar nos dois projetos (testes e produção); pode rodar de novo sem estrago.

-- Enquanto houver personal, os treinos do aluno são os que o personal monta: o próprio aluno não os muda.
-- Exceção: o personal que é aluno de si mesmo (só no banco de testes, com o ajuste 'convite_proprio') monta os seus.
create or replace function public.treinos_do_personal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.acompanhado_por is not null and new.acompanhado_por <> new.id and (select auth.uid()) = new.id
    and new.treinos is distinct from old.treinos then
    raise exception 'Seus treinos são montados pelo seu personal.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.treinos_do_personal() from public, anon, authenticated;
drop trigger if exists perfis_treinos_do_personal on public.perfis;
create trigger perfis_treinos_do_personal before update of treinos on public.perfis
  for each row execute function public.treinos_do_personal();
