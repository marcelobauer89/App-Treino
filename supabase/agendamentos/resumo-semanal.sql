-- Agendamento do resumo semanal por e-mail: toda sexta-feira às 9h (Brasília).
-- Rode no SQL Editor do Supabase DEPOIS de:
--   1. ligar as extensões (ou rode as duas linhas abaixo);
--   2. publicar a Edge Function "resumo-semanal" e cadastrar os segredos dela (veja o README).
-- Pode rodar de novo quando quiser: atualiza o token e o horário sem duplicar nada.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1) Guarda o token no Vault (cofre do Supabase). Troque o texto abaixo pelo MESMO valor do segredo
--    RESUMO_TOKEN da Edge Function. Nunca salve o token real em arquivo do repositório.
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'resumo_token';
  if v_id is null then
    perform vault.create_secret('COLE_AQUI_O_RESUMO_TOKEN', 'resumo_token');
  else
    perform vault.update_secret(v_id, 'COLE_AQUI_O_RESUMO_TOKEN');
  end if;
end $$;

-- 2) Agenda: sexta, 12h UTC = 9h em Brasília (sem horário de verão).
--    O endereço é o da página da função no painel (Edge Functions). Se criar a função de novo,
--    troque "rapid-worker" aqui e no segredo FUNCAO_URL pelo novo final.
--    Com o mesmo nome, o cron.schedule substitui o agendamento anterior.
select cron.schedule(
  'resumo-semanal',
  '0 12 * * 5',
  $$
  select net.http_post(
    url := 'https://mlovfgbndtpeczgnvivi.supabase.co/functions/v1/rapid-worker',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-resumo-token', (select decrypted_secret from vault.decrypted_secrets where name = 'resumo_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ---------- Úteis (rode só a linha que precisar) ----------

-- Ver quem receberia e o assunto de cada e-mail, sem enviar nada:
-- select net.http_post(
--   url := 'https://mlovfgbndtpeczgnvivi.supabase.co/functions/v1/rapid-worker',
--   headers := jsonb_build_object('content-type', 'application/json',
--     'x-resumo-token', (select decrypted_secret from vault.decrypted_secrets where name = 'resumo_token')),
--   body := '{"simular": true}'::jsonb,
--   timeout_milliseconds := 30000);

-- Enviar uma prévia só para você (com os seus dados; não conta como enviado):
-- select net.http_post(
--   url := 'https://mlovfgbndtpeczgnvivi.supabase.co/functions/v1/rapid-worker',
--   headers := jsonb_build_object('content-type', 'application/json',
--     'x-resumo-token', (select decrypted_secret from vault.decrypted_secrets where name = 'resumo_token')),
--   body := '{"previa": "seu-email@gmail.com"}'::jsonb,
--   timeout_milliseconds := 30000);

-- Ver a resposta das últimas chamadas (uns 10 segundos depois). status_code vazio = sem resposta;
-- veja timed_out e error_msg. O pg_net espera só 5 s se a chamada não disser outro limite.
-- select id, status_code, timed_out, error_msg, content, created from net._http_response order by id desc limit 5;

-- Ver as últimas execuções do agendamento:
-- select start_time, status, return_message from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'resumo-semanal') order by start_time desc limit 5;

-- Quem já recebeu cada resumo:
-- select p.nome, e.referencia, e.enviado_em from public.emails_enviados e join public.perfis p on p.id = e.usuario_id
-- order by e.enviado_em desc;

-- Desligar o envio automático:
-- select cron.unschedule('resumo-semanal');
