-- Ajuste único para o usuário Marcelo Bauer: exercícios registrados só com carga zero
-- (ex.: Escorpião e Superman com 0 / 0 / 0 kg) passam a ser "Sem peso", e esses zeros
-- viram o registro de "feito" do dia ([{"feito": true}]), como acontece hoje ao concluir
-- um exercício sem peso. Exercícios com algum peso maior que zero não mudam.
-- Rode tudo de uma vez no SQL Editor. Para outro usuário, troque o nome em "alvo".

create or replace function pg_temp.tem_carga(a jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(a) = 'array' and exists (
    select 1 from jsonb_array_elements(a) s
    where jsonb_typeof(s) = 'object' and jsonb_typeof(s -> 'carga') in ('number', 'string'));
$$;
-- Todas as cargas preenchidas são zero (número ou texto "0", "0,0").
create or replace function pg_temp.so_zero(a jsonb) returns boolean language sql immutable as $$
  select pg_temp.tem_carga(a) and not exists (
    select 1 from jsonb_array_elements(a) s
    where jsonb_typeof(s) = 'object' and jsonb_typeof(s -> 'carga') in ('number', 'string')
      and replace(s ->> 'carga', ',', '.') !~ '^\s*0+(\.0+)?\s*$');
$$;

create temp table alvo as
  select id from public.perfis where nome = 'Marcelo Bauer';

-- Exercícios do usuário em que todo registro com carga é só zero.
create temp table ex_zero as
  select usuario_id, exercicio
  from (
    select c.usuario_id, e.key as exercicio, e.value as v
    from public.cargas c join alvo on alvo.id = c.usuario_id, jsonb_each(c.series) e
    union all
    select k.usuario_id, e.key, e.value
    from public.checkins k join alvo on alvo.id = k.usuario_id, jsonb_each(k.series) e
  ) x
  where pg_temp.tem_carga(v)
  group by usuario_id, exercicio
  having bool_and(pg_temp.so_zero(v));

-- Prévia: o que vai mudar.
select p.nome, p.email, z.exercicio
from ex_zero z join public.perfis p on p.id = z.usuario_id
order by z.exercicio;

-- 1) Marca como Sem peso.
update public.perfis p
set sem_peso = array(select distinct x from unnest(p.sem_peso || z.lista) as x order by x)
from (select usuario_id, array_agg(exercicio) as lista from ex_zero group by usuario_id) z
where p.id = z.usuario_id;

-- 2) Troca os zeros pelo registro de "feito" (tabela cargas e cargas antigas nos check-ins).
update public.cargas c
set series = (
  select jsonb_object_agg(e.key, case
    when pg_temp.so_zero(e.value) and exists (select 1 from ex_zero z where z.usuario_id = c.usuario_id and z.exercicio = e.key)
      then '[{"feito": true}]'::jsonb
    else e.value end)
  from jsonb_each(c.series) e)
where c.usuario_id in (select usuario_id from ex_zero) and c.series <> '{}'::jsonb;

update public.checkins k
set series = (
  select jsonb_object_agg(e.key, case
    when pg_temp.so_zero(e.value) and exists (select 1 from ex_zero z where z.usuario_id = k.usuario_id and z.exercicio = e.key)
      then '[{"feito": true}]'::jsonb
    else e.value end)
  from jsonb_each(k.series) e)
where k.usuario_id in (select usuario_id from ex_zero) and k.series <> '{}'::jsonb;

-- Resultado.
select nome, email, sem_peso from public.perfis where id in (select id from alvo);
