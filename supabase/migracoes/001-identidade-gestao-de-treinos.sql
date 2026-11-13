-- 001 (13/11/2026): identidade "Gestão de Treinos". Conta nova começa sem dias de jiu na semana,
-- o objetivo Jiu Jitsu vai para o fim da lista e o objetivo Mobilidade deixa de citar o tatame.
-- Pode rodar de novo sem estrago. Contas que já existem mantêm os próprios dias de jiu.

alter table public.perfis alter column dias_jiu set default '{}';

update public.jornadas set ordem = case id
  when 'hipertrofia' then 1 when 'forca' then 2 when 'mobilidade' then 3 when 'jiu' then 4 end
where id in ('hipertrofia', 'forca', 'mobilidade', 'jiu');

update public.jornadas
set dados = replace(dados::text, 'se mexer melhor no tatame', 'se mexer melhor no esporte')::jsonb
where id = 'mobilidade' and dados::text like '%se mexer melhor no tatame%';
