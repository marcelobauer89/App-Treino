-- Usuário SÓ LEITURA para a cópia da produção para o dev (README → "Copiar a produção para o dev").
-- Rode uma vez no SQL Editor da PRODUÇÃO, trocando TROQUE-POR-UMA-SENHA-FORTE por uma senha longa
-- (só no SQL Editor, nunca no arquivo do repositório). Essa senha vai no segredo PROD_DB_URL do GitHub.
-- Ele só lê as tabelas que a cópia usa e não consegue gravar nada. Pode rodar de novo para trocar a senha.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'leitor_copia') then
    create role leitor_copia with login bypassrls password 'TROQUE-POR-UMA-SENHA-FORTE';
  else
    alter role leitor_copia with login bypassrls password 'TROQUE-POR-UMA-SENHA-FORTE';
  end if;
end $$;
-- Toda sessão dele já começa em modo só leitura.
alter role leitor_copia set default_transaction_read_only = on;

grant usage on schema public to leitor_copia;
grant select on public.perfis, public.checkins, public.cargas, public.eventos, public.convites, public.admins to leitor_copia;

-- Para desligar a cópia: drop role leitor_copia;
-- Se o Supabase recusar o "bypassrls", use no PROD_DB_URL o usuário postgres (o workflow abre a sessão em modo só leitura).
