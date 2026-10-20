-- Ajuste único: exercícios registrados só com peso zero passam a ser "Sem peso".
-- Rode DEPOIS de criar a coluna perfis.sem_peso (schema.sql / PR "Opção Sem peso").
-- Critério: para cada usuário, o exercício entra em sem_peso se TODAS as cargas registradas
-- dele (tabela cargas e cargas antigas guardadas nos check-ins) forem 0. Exercícios com
-- algum peso maior que zero não mudam. Os registros de peso não são apagados.
-- Pode rodar mais de uma vez: só acrescenta o que ainda não está marcado.

-- 1) Prévia: quais exercícios serão marcados, por usuário.
with series as (
  select c.usuario_id, ex.key as exercicio, s.value as serie
  from public.cargas c, jsonb_each(c.series) ex, jsonb_array_elements(ex.value) s
  where jsonb_typeof(ex.value) = 'array'
  union all
  select k.usuario_id, ex.key, s.value
  from public.checkins k, jsonb_each(k.series) ex, jsonb_array_elements(ex.value) s
  where jsonb_typeof(ex.value) = 'array'
), so_zero as (
  select usuario_id, exercicio
  from series
  where jsonb_typeof(serie) = 'object' and jsonb_typeof(serie -> 'carga') in ('number', 'string')
  group by usuario_id, exercicio
  -- Carga 0 gravada como número ou como texto ("0", "0,0"); qualquer outro valor conta como peso.
  having bool_and(replace(serie ->> 'carga', ',', '.') ~ '^\s*0+(\.0+)?\s*$')
)
select p.nome, p.email, z.exercicio
from so_zero z join public.perfis p on p.id = z.usuario_id
where not (z.exercicio = any (p.sem_peso))
order by p.email, z.exercicio;

-- 2) Ajuste: acrescenta esses exercícios em perfis.sem_peso.
with series as (
  select c.usuario_id, ex.key as exercicio, s.value as serie
  from public.cargas c, jsonb_each(c.series) ex, jsonb_array_elements(ex.value) s
  where jsonb_typeof(ex.value) = 'array'
  union all
  select k.usuario_id, ex.key, s.value
  from public.checkins k, jsonb_each(k.series) ex, jsonb_array_elements(ex.value) s
  where jsonb_typeof(ex.value) = 'array'
), so_zero as (
  select usuario_id, array_agg(exercicio) as exercicios
  from (
    select usuario_id, exercicio
    from series
    where jsonb_typeof(serie) = 'object' and jsonb_typeof(serie -> 'carga') in ('number', 'string')
    group by usuario_id, exercicio
    having bool_and(replace(serie ->> 'carga', ',', '.') ~ '^\s*0+(\.0+)?\s*$')
  ) e
  group by usuario_id
)
update public.perfis p
set sem_peso = array(select distinct x from unnest(p.sem_peso || z.exercicios) as x order by x)
from so_zero z
where p.id = z.usuario_id
  and not (z.exercicios <@ p.sem_peso);
