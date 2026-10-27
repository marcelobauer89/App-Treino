-- Importa no ambiente de dev a cópia anonimizada feita pelo exportar.sql (README → "Copiar a produção para o dev").
-- Quem roda é o workflow "Copiar produção para dev", NUNCA na produção. Tudo numa transação: se algo falhar, nada muda.
-- Variável (psql -v): dono = id da sua conta no dev. Entrada: os arquivos .tsv do exportar.sql, na pasta atual.
-- Substitui a cópia anterior: apaga os usuários de mentira (@exemplo.invalid), os seus dados no dev e os convites.
-- Contas reais que entraram no dev continuam lá.
\set ON_ERROR_STOP on
\set QUIET on
begin;
select set_config('copia.dono', :'dono', true) \g /dev/null

create temp table c_perfis (j jsonb) on commit drop;
create temp table c_checkins (j jsonb) on commit drop;
create temp table c_cargas (j jsonb) on commit drop;
create temp table c_eventos (j jsonb) on commit drop;
create temp table c_convites (j jsonb) on commit drop;
create temp table c_admins (j jsonb) on commit drop;
\copy c_perfis (j) from 'perfis.tsv'
\copy c_checkins (j) from 'checkins.tsv'
\copy c_cargas (j) from 'cargas.tsv'
\copy c_eventos (j) from 'eventos.tsv'
\copy c_convites (j) from 'convites.tsv'
\copy c_admins (j) from 'admins.tsv'

do $$
declare dono uuid := current_setting('copia.dono')::uuid;
begin
  if not exists (select 1 from auth.users where id = dono) then
    raise exception 'A conta % não existe neste banco. Entre uma vez no app de dev antes de copiar.', dono;
  end if;
  if not exists (select 1 from c_perfis where (j ->> 'id')::uuid = dono) then
    raise exception 'A exportação não trouxe a sua conta.';
  end if;
end $$;

-- Limpa a cópia anterior (em cascata: perfis, check-ins, cargas, eventos e e-mails dos usuários de mentira).
delete from auth.users where email like '%@exemplo.invalid';
delete from public.checkins where usuario_id = current_setting('copia.dono')::uuid;
delete from public.cargas where usuario_id = current_setting('copia.dono')::uuid;
delete from public.eventos where usuario_id = current_setting('copia.dono')::uuid;
delete from public.convites;

-- Usuários de mentira: só o mínimo para as chaves estrangeiras. Sem identidade do Google, ninguém entra com eles.
-- Os campos de token vazios (e não nulos) evitam erro na lista de usuários do painel do Supabase.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', (j ->> 'id')::uuid, 'authenticated', 'authenticated', j ->> 'email',
       '{"provider": "copia", "providers": []}', jsonb_build_object('full_name', j ->> 'nome'), now(), now(), '', '', '', ''
from c_perfis where (j ->> 'id')::uuid <> current_setting('copia.dono')::uuid;

-- Perfis: o gatilho criar_perfil já criou um perfil vazio; troca pelo copiado (o seu também).
delete from public.perfis where id in (select (j ->> 'id')::uuid from c_perfis);
insert into public.perfis select (jsonb_populate_record(null::public.perfis, j)).* from c_perfis;

-- Check-ins ganham ids novos (as fotos não vêm, então nada depende do id antigo).
insert into public.checkins
select (jsonb_populate_record(null::public.checkins, j || jsonb_build_object('id', gen_random_uuid()))).* from c_checkins;
insert into public.cargas select (jsonb_populate_record(null::public.cargas, j)).* from c_cargas;
insert into public.eventos (usuario_id, tipo, dados, criado_em)
select r.usuario_id, r.tipo, r.dados, r.criado_em from c_eventos, jsonb_populate_record(null::public.eventos, j) r;
insert into public.convites select (jsonb_populate_record(null::public.convites, j)).* from c_convites;
insert into public.admins select (jsonb_populate_record(null::public.admins, j)).* from c_admins on conflict do nothing;

-- Você continua admin e liberado no dev.
insert into public.admins (usuario_id) values (current_setting('copia.dono')::uuid) on conflict do nothing;
update public.perfis set liberado = true where id = current_setting('copia.dono')::uuid;

commit;

\echo 'Cópia concluída:'
\pset footer off
select (select count(*) from public.perfis where email like '%@exemplo.invalid') as usuarios_anonimos,
       (select count(*) from public.checkins) as checkins,
       (select count(*) from public.cargas) as cargas,
       (select count(*) from public.eventos) as eventos,
       (select count(*) from public.convites) as convites;
