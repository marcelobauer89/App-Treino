-- Aviso por e-mail aos administradores a cada novo pedido de acesso ("Pedir acesso" na tela de convidados).
-- Rode no SQL Editor do Supabase DEPOIS de:
--   1. rodar o supabase/schema.sql;
--   2. publicar a versão atual da Edge Function "resumo-semanal" (ela faz o envio, pelo mesmo Gmail do resumo);
--   3. rodar o supabase/agendamentos/resumo-semanal.sql (ele guarda o RESUMO_TOKEN no Vault como "resumo_token").
-- Pode rodar de novo quando quiser: substitui a função e o gatilho sem duplicar nada.
-- Quem recebe: os e-mails das contas que estão na tabela admins.

create extension if not exists pg_net with schema extensions;

-- Ao gravar um pedido (perfis.acesso_pedido_em), chama a função com {"pedido": "<id>"}.
-- Pedidos repetidos da mesma pessoa em menos de 1 hora não geram outro e-mail; a função também não
-- avisa duas vezes o mesmo pedido. Se a chamada falhar, o pedido fica salvo do mesmo jeito.
create or replace function public.avisar_pedido_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.acesso_pedido_em is not null and not new.liberado
     and (old.acesso_pedido_em is null or new.acesso_pedido_em > old.acesso_pedido_em + interval '1 hour') then
    begin
      -- O endereço é o mesmo do agendamento do resumo (página da função no painel → Edge Functions).
      perform net.http_post(
        url := 'https://mlovfgbndtpeczgnvivi.supabase.co/functions/v1/rapid-worker',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-resumo-token', (select decrypted_secret from vault.decrypted_secrets where name = 'resumo_token')
        ),
        body := jsonb_build_object('pedido', new.id),
        params := jsonb_build_object('pedido', new.id::text),
        timeout_milliseconds := 30000
      );
    exception when others then
      raise warning 'aviso de pedido de acesso não enviado: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
-- Só o gatilho usa esta função; ninguém a chama pela API.
revoke execute on function public.avisar_pedido_acesso() from public, anon, authenticated;

drop trigger if exists aviso_pedido_acesso on public.perfis;
create trigger aviso_pedido_acesso
  after update of acesso_pedido_em on public.perfis
  for each row execute function public.avisar_pedido_acesso();

-- ---------- Úteis ----------
-- Ver as últimas chamadas da função (status 200 = aviso processado):
-- select id, status_code, content::text, created from net._http_response order by created desc limit 10;
-- Desligar o aviso:
-- drop trigger if exists aviso_pedido_acesso on public.perfis;
