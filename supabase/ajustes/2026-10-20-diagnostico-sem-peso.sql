-- Diagnóstico: por usuário e exercício, quantas séries têm carga zero, maior que zero ou
-- valor não numérico, a última data com carga e se o exercício já está marcado como Sem peso.
with series as (
  select c.usuario_id, c.data::text as data, ex.key as exercicio, s.value as serie, 'cargas' as origem
  from public.cargas c, jsonb_each(c.series) ex, jsonb_array_elements(ex.value) s
  where jsonb_typeof(ex.value) = 'array'
  union all
  select k.usuario_id, left(k.inicio::text, 10), ex.key, s.value, 'checkins'
  from public.checkins k, jsonb_each(k.series) ex, jsonb_array_elements(ex.value) s
  where jsonb_typeof(ex.value) = 'array'
), cargas as (
  select usuario_id, data, exercicio, origem,
         serie -> 'carga' as bruto,
         case when jsonb_typeof(serie -> 'carga') = 'number' then (serie ->> 'carga')::numeric
              when jsonb_typeof(serie -> 'carga') = 'string' and replace(serie ->> 'carga', ',', '.') ~ '^\s*\d+(\.\d+)?\s*$'
                then replace(serie ->> 'carga', ',', '.')::numeric
         end as kg
  from series
  where jsonb_typeof(serie) = 'object' and serie ? 'carga' and jsonb_typeof(serie -> 'carga') <> 'null'
)
select p.email, c.exercicio,
       count(*) filter (where c.kg = 0) as series_zero,
       count(*) filter (where c.kg > 0) as series_com_peso,
       count(*) filter (where c.kg is null) as valores_estranhos,
       count(*) filter (where jsonb_typeof(c.bruto) = 'string') as gravados_como_texto,
       max(c.data) as ultima_data,
       string_agg(distinct c.origem, ', ') as origem,
       c.exercicio = any (p.sem_peso) as ja_sem_peso
from cargas c join public.perfis p on p.id = c.usuario_id
group by p.email, p.sem_peso, c.exercicio
having count(*) filter (where c.kg = 0) > 0
order by p.email, c.exercicio;
