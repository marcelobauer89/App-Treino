-- App Treino: tabelas, regras de acesso e criação automática do perfil.
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar de novo sem duplicar nada).

-- Perfil e configurações de cada usuário (1 linha por conta).
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 120),
  email text not null default '',
  -- URL da foto do Google ou imagem enviada pelo app (JPEG 320x320 em data URL, ~30 KB).
  foto text not null default '' check (char_length(foto) <= 400000),
  tema text not null default 'auto' check (tema in ('auto', 'claro', 'escuro')),
  -- Dias de jiu-jitsu no padrão Date.getDay() do JavaScript (1 = segunda ... 6 = sábado).
  dias_jiu smallint[] not null default '{2,4}' check (dias_jiu <@ '{1,2,3,4,5,6}'::smallint[])
);

-- Semana montada em "Você": 7 listas (0 = domingo ... 6 = sábado) com até 2 atividades cada,
-- ex.: [[], ["t2"], ["jiu"], ["t1"], ["jiu"], ["t3"], ["bike"]]. Vazia (null) = semana montada a partir de dias_jiu.
-- Bancos criados antes desta coluna a recebem ao rodar o arquivo de novo.
alter table public.perfis add column if not exists semana jsonb
  check (semana is null or (jsonb_typeof(semana) = 'array' and jsonb_array_length(semana) = 7));

-- Check-ins de treino. Horários em hora local do aparelho, sem fuso.
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 'bike' aparece no app como Cardio.
  tipo text not null check (tipo in ('t1', 't2', 't3', 'jiu', 'bike')),
  inicio timestamp not null,
  fim timestamp check (fim is null or fim >= inicio),
  sem_horario boolean not null default false,
  recuperacao smallint check (recuperacao between 1 and 5),
  obs text not null default '' check (char_length(obs) <= 2000),
  retroativo boolean not null default false,
  ultima_serie timestamp,
  -- Cargas por exercício: { "Remada inversa": [{"carga": 20}, null, {"carga": 22.5}] }
  series jsonb not null default '{}' check (jsonb_typeof(series) = 'object'),
  criado_em timestamptz not null default now()
);

create index if not exists checkins_usuario_inicio on public.checkins (usuario_id, inicio);
-- Regra 13 do PRD: só um check-in aberto por vez para cada usuário.
create unique index if not exists checkins_um_aberto on public.checkins (usuario_id) where fim is null;

-- Pesos registrados na ficha, por dia e treino, sem depender de check-in.
-- series: { "Remada inversa": [{"carga": 20}, null, {"carga": 22.5}] }
create table if not exists public.cargas (
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  treino text not null check (treino in ('t1', 't2', 't3')),
  series jsonb not null default '{}' check (jsonb_typeof(series) = 'object'),
  primary key (usuario_id, data, treino)
);

-- Cada usuário só lê e altera os próprios dados.
alter table public.perfis enable row level security;
alter table public.checkins enable row level security;
alter table public.cargas enable row level security;

drop policy if exists "perfil próprio" on public.perfis;
create policy "perfil próprio" on public.perfis
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "check-ins próprios" on public.checkins;
create policy "check-ins próprios" on public.checkins
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "cargas próprias" on public.cargas;
create policy "cargas próprias" on public.cargas
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Ao criar a conta pelo Google, já cria o perfil com nome, e-mail e foto da conta.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, foto)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Exercícios que o usuário faz sem peso (o painel "Registrar pesos" não pede carga).
alter table public.perfis add column if not exists sem_peso text[] not null default '{}';

-- Acessos: último acesso e quantidade de acessos de cada usuário (vistos só no Supabase).
alter table public.perfis add column if not exists ultimo_acesso timestamptz;
alter table public.perfis add column if not exists acessos integer not null default 0;

-- O app chama ao abrir. Usa a hora do servidor e só soma 1 se o acesso anterior foi há mais de
-- 30 min, para recarregar a página não inflar o número.
create or replace function public.registrar_acesso()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfis set
    acessos = acessos + case when ultimo_acesso is null or ultimo_acesso < now() - interval '30 minutes' then 1 else 0 end,
    ultimo_acesso = now()
  where id = (select auth.uid());
$$;
revoke execute on function public.registrar_acesso() from public, anon;
grant execute on function public.registrar_acesso() to authenticated;

-- O usuário edita só as colunas que o app usa; acessos e ultimo_acesso mudam só pela função acima.
revoke update on public.perfis from authenticated;
grant update (id, nome, email, foto, tema, dias_jiu, semana, sem_peso) on public.perfis to authenticated;

-- Para ver os acessos (SQL Editor):
-- select nome, email, acessos,
--        to_char(ultimo_acesso at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as ultimo_acesso
-- from public.perfis order by ultimo_acesso desc nulls last;
