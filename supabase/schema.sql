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
  tipo text not null check (tipo in ('t1', 't2', 't3', 't4', 't5', 'jiu', 'muay', 'bike')),
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
  treino text not null check (treino in ('t1', 't2', 't3', 't4', 't5')),
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

-- Resumo semanal por e-mail (função "resumo-semanal"): a pessoa pode desligar em Você ou pelo link do e-mail.
alter table public.perfis add column if not exists emails_resumo boolean not null default true;

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
-- ---------- Treinos personalizados ----------
-- Cada pessoa pode montar até 5 treinos de musculação (t1 a t5). Bancos criados com só t1 a t3 recebem os novos.
-- 'muay' = Muay Thai.
alter table public.checkins drop constraint if exists checkins_tipo_check;
alter table public.checkins add constraint checkins_tipo_check check (tipo in ('t1', 't2', 't3', 't4', 't5', 'jiu', 'muay', 'bike'));
alter table public.cargas drop constraint if exists cargas_treino_check;
alter table public.cargas add constraint cargas_treino_check check (treino in ('t1', 't2', 't3', 't4', 't5'));

-- Treinos montados em "Meus treinos". Vazio (null) = o plano pronto que vem no app.
-- ex.: { "1": { "nome": "Treino A", "subtitulo": "Peito", "exercicios": [{ "nome": "Agachamento", "dose": "3×10", "pse": 8 }] } }
-- Os níveis e a explicação de cada exercício vêm da biblioteca do app, pelo nome.
create or replace function public.treinos_validos(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select j is null or (
    jsonb_typeof(j) = 'object'
    and pg_column_size(j) <= 30000
    and not exists (
      select 1 from jsonb_each(j) t
      where t.key !~ '^[1-5]$'
        or jsonb_typeof(t.value) <> 'object'
        or jsonb_typeof(t.value -> 'exercicios') is distinct from 'array'
        or jsonb_array_length(t.value -> 'exercicios') not between 1 and 15
    )
  );
$$;
alter table public.perfis add column if not exists treinos jsonb;
alter table public.perfis drop constraint if exists perfis_treinos_check;
alter table public.perfis add constraint perfis_treinos_check check (public.treinos_validos(treinos));
-- Última resposta ao aviso "Baita atualização" (personalizar ou manter o treino).
alter table public.perfis add column if not exists novidade_treinos timestamptz;
-- Quando a pessoa marcou "Não mostrar esta mensagem de novo". Vazio = o aviso aparece a cada abertura do app.
alter table public.perfis add column if not exists novidade_oculta timestamptz;

grant update (id, nome, email, foto, tema, dias_jiu, semana, sem_peso, emails_resumo, treinos, novidade_treinos, novidade_oculta) on public.perfis to authenticated;

-- Para ver os acessos (SQL Editor):
-- select nome, email, acessos,
--        to_char(ultimo_acesso at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as ultimo_acesso
-- from public.perfis order by ultimo_acesso desc nulls last;

-- ---------- Monitoramento (dashboard /admin) ----------
-- Administradores: só quem está aqui lê os dados de todos pelo dashboard (funções "admin_*").
-- Para se tornar administrador, rode uma vez (trocando o e-mail):
--   insert into public.admins (usuario_id) select id from auth.users where email = 'seu-email@gmail.com' on conflict do nothing;
create table if not exists public.admins (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Sem políticas: ninguém lê nem altera a lista pela API; só a função abaixo a consulta.

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where usuario_id = (select auth.uid()));
$$;
revoke execute on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

-- Eventos de uso do app (telas, recursos, erros), para entender o uso e evoluir o app.
-- Cada usuário só grava os próprios eventos e não consegue lê-los; o dashboard lê pelas funções admin_*.
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo ~ '^[a-z_]{2,40}$'),
  dados jsonb not null default '{}' check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 2000),
  criado_em timestamptz not null default now()
);
create index if not exists eventos_criado_em on public.eventos (criado_em);
create index if not exists eventos_usuario on public.eventos (usuario_id, criado_em);
alter table public.eventos enable row level security;
drop policy if exists "grava os próprios eventos" on public.eventos;
create policy "grava os próprios eventos" on public.eventos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Leitura para o dashboard de monitoramento: só respondem para administradores.
-- Não devolvem observações dos check-ins nem pesos.
-- O retorno mudou (emails_resumo): uma função com outro retorno precisa ser apagada antes de recriada.
drop function if exists public.admin_usuarios();
create function public.admin_usuarios()
returns table (
  id uuid, nome text, email text, cadastro timestamptz, ultimo_acesso timestamptz, acessos integer,
  semana jsonb, dias_jiu smallint[], sem_peso text[], emails_resumo boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select p.id, p.nome, p.email, u.created_at, p.ultimo_acesso, p.acessos, p.semana, p.dias_jiu, p.sem_peso, p.emails_resumo
    from public.perfis p join auth.users u on u.id = p.id
    order by p.nome;
end;
$$;

create or replace function public.admin_checkins(desde timestamp default null)
returns table (
  id uuid, usuario_id uuid, tipo text, inicio timestamp, fim timestamp,
  sem_horario boolean, recuperacao smallint, retroativo boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select c.id, c.usuario_id, c.tipo, c.inicio, c.fim, c.sem_horario, c.recuperacao, c.retroativo
    from public.checkins c
    where desde is null or c.inicio >= desde
    order by c.inicio;
end;
$$;

create or replace function public.admin_eventos(desde timestamptz default null)
returns table (usuario_id uuid, tipo text, dados jsonb, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select e.usuario_id, e.tipo, e.dados, e.criado_em
    from public.eventos e
    where desde is null or e.criado_em >= desde
    order by e.criado_em;
end;
$$;

revoke execute on function public.admin_usuarios() from public, anon;
revoke execute on function public.admin_checkins(timestamp) from public, anon;
revoke execute on function public.admin_eventos(timestamptz) from public, anon;
grant execute on function public.admin_usuarios() to authenticated;
grant execute on function public.admin_checkins(timestamp) to authenticated;
grant execute on function public.admin_eventos(timestamptz) to authenticated;

-- ---------- On-line agora (Supabase Realtime Presence) ----------
-- Cada pessoa publica a própria presença no canal privado "online:<id>" enquanto o app está aberto.
-- Ela lê e publica só no próprio canal; administradores leem o canal de todos (dashboard /admin).
-- Em Realtime → Settings, desligue "Allow public access" para que só canais privados funcionem.
drop policy if exists "presenca: le o proprio canal ou admin" on realtime.messages;
create policy "presenca: le o proprio canal ou admin" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and (
      (select realtime.topic()) = 'online:' || (select auth.uid())::text
      or ((select realtime.topic()) like 'online:%' and (select public.eh_admin()))
    )
  );
drop policy if exists "presenca: publica no proprio canal" on realtime.messages;
create policy "presenca: publica no proprio canal" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) = 'online:' || (select auth.uid())::text
  );

-- ---------- Resumo semanal por e-mail ----------
-- Registro dos e-mails enviados pela função "resumo-semanal", para não mandar o mesmo resumo duas vezes.
-- referencia = último dia do período resumido (AAAA-MM-DD). Sem políticas: só a função (service role) lê e grava.
create table if not exists public.emails_enviados (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  referencia text not null,
  enviado_em timestamptz not null default now(),
  primary key (usuario_id, tipo, referencia)
);
alter table public.emails_enviados enable row level security;

-- Abertura e clique de cada e-mail: a função registra quando a imagem invisível do e-mail carrega
-- (abertura aproximada: alguns apps de e-mail carregam sozinhos ou bloqueiam imagens) e quando o
-- botão "Abrir o App Treino" é tocado (clique, exato).
alter table public.emails_enviados add column if not exists aberto_em timestamptz;
alter table public.emails_enviados add column if not exists aberturas integer not null default 0;
alter table public.emails_enviados add column if not exists clicado_em timestamptz;
alter table public.emails_enviados add column if not exists cliques integer not null default 0;

-- Leitura dos envios para o dashboard (só administradores).
create or replace function public.admin_emails()
returns table (
  usuario_id uuid, tipo text, referencia text, enviado_em timestamptz,
  aberto_em timestamptz, aberturas integer, clicado_em timestamptz, cliques integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select e.usuario_id, e.tipo, e.referencia, e.enviado_em, e.aberto_em, e.aberturas, e.clicado_em, e.cliques
    from public.emails_enviados e
    order by e.enviado_em;
end;
$$;
revoke execute on function public.admin_emails() from public, anon;
grant execute on function public.admin_emails() to authenticated;
