-- 010 (17/11/2026): objetivos que não são de luta deixam de citar o jiu, e sai o jiu que ficou na semana de quem
-- escolheu Hipertrofia, Força ou Mobilidade só porque a conta antiga começava com jiu na terça e na quinta.
-- Pode rodar de novo sem estrago.

update public.jornadas
set dados = replace(replace(dados::text,
  'Pode ser feito depois do jiu, no lugar de um dia livre.', 'Pode ser feito depois de outro esporte, no lugar de um dia livre.'),
  'Reforçar os pontos que mais sofrem no jiu:', 'Reforçar os pontos que mais sofrem no esporte:')::jsonb
where id in ('forca', 'mobilidade')
  and (dados::text like '%depois do jiu, no lugar%' or dados::text like '%mais sofrem no jiu:%');

-- Só quem tem o jiu exatamente na terça e na quinta (o padrão antigo) e nunca fez check-in de jiu.
update public.perfis p set
  semana = (select jsonb_agg(coalesce((select jsonb_agg(x) from jsonb_array_elements(d) x where x <> '"jiu"'::jsonb), '[]'::jsonb) order by i)
            from jsonb_array_elements(p.semana) with ordinality as t(d, i)),
  dias_jiu = '{}'
where p.jornada in ('hipertrofia', 'forca', 'mobilidade')
  and p.dias_jiu = '{2,4}'::smallint[]
  and p.semana is not null
  and (select array_agg(i - 1 order by i) from jsonb_array_elements(p.semana) with ordinality as t(d, i) where d @> '["jiu"]'::jsonb) = array[2, 4]::bigint[]
  and not exists (select 1 from public.checkins c where c.usuario_id = p.id and c.tipo = 'jiu');
