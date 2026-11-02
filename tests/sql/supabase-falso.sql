-- O mínimo do Supabase para o schema.sql rodar num Postgres comum (testes automáticos).
-- Papéis, login (auth.uid), usuários, armazenamento das fotos, presença ao vivo, pg_net e Vault.
-- Não é o Supabase de verdade: só o suficiente para conferir o schema.sql e as regras de acesso.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Como no Supabase: a API (anon/authenticated) usa o schema public, e as tabelas e funções novas
-- já nascem com permissão para ela; quem protege os dados são as regras de acesso (RLS) e os revokes do schema.sql.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;
create schema if not exists net;
create schema if not exists vault;
create schema if not exists extensions;
grant usage on schema auth, storage, realtime to anon, authenticated, service_role;

-- Quem está logado: o teste define request.jwt.claim.sub (como o PostgREST).
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

create table if not exists realtime.messages (topic text, extension text);
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql as $$ select ''::text $$;

create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 1000) returns bigint language sql as $$ select 0::bigint $$;
create table if not exists vault.decrypted_secrets (name text, decrypted_secret text);
