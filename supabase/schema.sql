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
  tipo text not null check (tipo in ('t1', 't2', 't3', 't4', 't5', 't6', 'jiu', 'muay', 'surf', 'bike')),
  inicio timestamp not null,
  fim timestamp check (fim is null or fim >= inicio),
  sem_horario boolean not null default false,
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
  treino text not null check (treino in ('t1', 't2', 't3', 't4', 't5', 't6')),
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
-- Função de gatilho: não é para ser chamada pela API (Security Advisor). O gatilho continua disparando.
revoke execute on function public.criar_perfil() from public, anon, authenticated;

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
-- Segurança do convite: sem isto, uma conta não liberada poderia apagar o próprio perfil e recriá-lo
-- com liberado = true. O perfil nasce pelo gatilho criar_perfil; o app só cria (colunas abaixo) se faltar.
-- A exclusão de conta usa as funções excluir_conta() e admin_excluir_usuario(), não o DELETE direto.
revoke insert, delete on public.perfis from authenticated, anon;
grant insert (id, nome, email, foto, tema, dias_jiu) on public.perfis to authenticated;
-- ---------- Treinos personalizados ----------
-- Cada pessoa pode montar até 6 treinos de musculação (t1 a t6). Bancos criados com menos recebem os novos.
-- 'muay' = Muay Thai; 'surf' = Surf.
alter table public.checkins drop constraint if exists checkins_tipo_check;
alter table public.checkins add constraint checkins_tipo_check check (tipo in ('t1', 't2', 't3', 't4', 't5', 't6', 'jiu', 'muay', 'surf', 'bike'));
alter table public.cargas drop constraint if exists cargas_treino_check;
alter table public.cargas add constraint cargas_treino_check check (treino in ('t1', 't2', 't3', 't4', 't5', 't6'));

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
      where t.key !~ '^[1-6]$'
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
-- Versão anterior dos treinos, gravada a cada vez que a pessoa salva em Meus treinos: { treinos, semana, em }.
-- Serve para o "Desfazer" e para "Restaurar versão anterior".
alter table public.perfis add column if not exists treinos_anterior jsonb
  check (treinos_anterior is null or (jsonb_typeof(treinos_anterior) = 'object' and pg_column_size(treinos_anterior) <= 40000));

-- ---------- Privacidade (LGPD) ----------
-- Versão da Política de Privacidade que a pessoa viu e aceitou (aviso no app quando muda).
alter table public.perfis add column if not exists politica_versao text check (politica_versao is null or char_length(politica_versao) <= 20);
-- Consentimento para guardar observações nos check-ins (podem revelar dados de saúde).
-- Só 'sim' liga o campo no app; vazio ou 'nao' = desligado (padrão).
alter table public.perfis add column if not exists consentimento_saude text check (consentimento_saude is null or consentimento_saude in ('sim', 'nao'));
alter table public.perfis add column if not exists consentimento_saude_em timestamptz;

grant update (id, nome, email, foto, tema, dias_jiu, semana, sem_peso, emails_resumo, treinos, novidade_treinos, novidade_oculta, treinos_anterior, politica_versao, consentimento_saude, consentimento_saude_em) on public.perfis to authenticated;

-- A nota de recuperação (1 a 5) saiu do app: a coluna e as notas já salvas são apagadas (LGPD: não guardar dado sem uso).
-- Rode depois de publicar a versão do app sem a recuperação; a anterior ainda envia esse campo.
alter table public.checkins drop column if exists recuperacao;

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
  semana jsonb, dias_jiu smallint[], sem_peso text[], emails_resumo boolean,
  liberado boolean, acesso_pedido_em timestamptz, liberado_como text, liberado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    -- Perfil sem nome: usa o nome que veio do Google no login.
    select p.id,
      coalesce(nullif(trim(p.nome), ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')::text,
      p.email, u.created_at, p.ultimo_acesso, p.acessos, p.semana, p.dias_jiu, p.sem_peso, p.emails_resumo,
      p.liberado, p.acesso_pedido_em, p.liberado_como, p.liberado_em
    from public.perfis p join auth.users u on u.id = p.id
    order by 2;
end;
$$;

-- Sem observações nem pesos: o painel recebe só tipo e horário dos check-ins (LGPD).
drop function if exists public.admin_checkins(timestamp);
create function public.admin_checkins(desde timestamp default null)
returns table (
  id uuid, usuario_id uuid, tipo text, inicio timestamp, fim timestamp,
  sem_horario boolean, retroativo boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select c.id, c.usuario_id, c.tipo, c.inicio, c.fim, c.sem_horario, c.retroativo
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

-- ---------- Exclusão de conta ----------
-- Apagar o usuário em auth.users leva junto, em cascata, perfil, check-ins, cargas, eventos e e-mails enviados.
-- Pelo app: a própria pessoa (Você → Excluir conta).
create or replace function public.excluir_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na conta para excluí-la.';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke execute on function public.excluir_conta() from public, anon;
grant execute on function public.excluir_conta() to authenticated;

-- Pelo monitoramento: um administrador exclui a conta de outro usuário (não a própria nem a de outro administrador).
create or replace function public.admin_excluir_usuario(alvo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito a administradores.';
  end if;
  if alvo = (select auth.uid()) then
    raise exception 'Para excluir a sua própria conta, use o app (Você → Excluir conta).';
  end if;
  if exists (select 1 from public.admins where usuario_id = alvo) then
    raise exception 'Não é possível excluir a conta de outro administrador.';
  end if;
  delete from auth.users where id = alvo;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;
revoke execute on function public.admin_excluir_usuario(uuid) from public, anon;
grant execute on function public.admin_excluir_usuario(uuid) to authenticated;

-- ---------- Convites (acesso só para convidados) ----------
-- Quem já tinha conta continua liberado; contas novas entram bloqueadas até usar um convite
-- (link ?convite=CODIGO, válido por 7 dias e para uma pessoa) ou até um administrador liberar o pedido de acesso.
alter table public.perfis add column if not exists liberado boolean;
update public.perfis set liberado = true where liberado is null;
alter table public.perfis alter column liberado set default false;
alter table public.perfis alter column liberado set not null;
alter table public.perfis add column if not exists acesso_pedido_em timestamptz;
-- Como e quando a conta foi liberada (aparece em "Convites utilizados" no monitoramento). Só as funções gravam.
alter table public.perfis add column if not exists liberado_como text check (liberado_como is null or liberado_como in ('convite', 'pedido', 'admin'));
alter table public.perfis add column if not exists liberado_em timestamptz;

create table if not exists public.convites (
  codigo text primary key check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  nome text not null default '' check (char_length(nome) <= 80),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references auth.users (id) on delete set null,
  usado_em timestamptz,
  cancelado_em timestamptz
);
-- Sem políticas: ninguém lê nem grava direto pela API; só pelas funções abaixo.
alter table public.convites enable row level security;

-- A pessoa logada pode usar o app (liberada ou administradora)?
create or replace function public.liberado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select liberado from public.perfis where id = (select auth.uid())), false) or public.eh_admin();
$$;
revoke execute on function public.liberado() from public, anon;
grant execute on function public.liberado() to authenticated;

-- Quem não foi liberado não grava check-ins nem pesos (a trava vale também fora do app).
drop policy if exists "check-ins próprios" on public.checkins;
create policy "check-ins próprios" on public.checkins
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and public.liberado());

drop policy if exists "cargas próprias" on public.cargas;
create policy "cargas próprias" on public.cargas
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and public.liberado());

-- Usar um convite: 'ok', 'ja_liberado', 'invalido', 'usado', 'expirado' ou 'cancelado'.
create or replace function public.usar_convite(p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  c public.convites;
begin
  if eu is null then raise exception 'Entre com o Google para usar o convite.'; end if;
  if (select liberado from public.perfis where id = eu) then return 'ja_liberado'; end if;
  select * into c from public.convites where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')) for update;
  if not found then return 'invalido'; end if;
  if c.cancelado_em is not null then return 'cancelado'; end if;
  if c.usado_em is not null then return 'usado'; end if;
  if c.expira_em < now() then return 'expirado'; end if;
  update public.convites set usado_por = eu, usado_em = now() where codigo = c.codigo;
  update public.perfis set liberado = true, acesso_pedido_em = null, liberado_como = 'convite', liberado_em = now() where id = eu;
  return 'ok';
end;
$$;

-- Pedir acesso sem convite: aparece no monitoramento para um administrador liberar.
create or replace function public.pedir_acesso()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfis set acesso_pedido_em = now() where id = (select auth.uid()) and not liberado;
$$;

create or replace function public.admin_criar_convite(p_nome text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  novo text;
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  loop
    novo := '';
    for i in 1..6 loop
      novo := novo || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    exit when not exists (select 1 from public.convites where codigo = novo);
  end loop;
  insert into public.convites (codigo, nome, criado_por) values (novo, left(trim(coalesce(p_nome, '')), 80), (select auth.uid()));
  return novo;
end;
$$;

create or replace function public.admin_convites()
returns table (
  codigo text, nome text, criado_em timestamptz, expira_em timestamptz, usado_em timestamptz, cancelado_em timestamptz,
  usado_por uuid, usado_por_nome text, usado_por_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select c.codigo, c.nome, c.criado_em, c.expira_em, c.usado_em, c.cancelado_em, c.usado_por, p.nome, p.email
    from public.convites c left join public.perfis p on p.id = c.usado_por
    order by c.criado_em desc;
end;
$$;

create or replace function public.admin_cancelar_convite(p_codigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  update public.convites set cancelado_em = now() where codigo = p_codigo and usado_em is null and cancelado_em is null;
  if not found then raise exception 'Convite não encontrado ou já usado.'; end if;
end;
$$;

create or replace function public.admin_liberar_usuario(alvo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  update public.perfis set
      liberado_como = case when liberado then liberado_como when acesso_pedido_em is not null then 'pedido' else 'admin' end,
      liberado_em = case when liberado then liberado_em else now() end,
      liberado = true, acesso_pedido_em = null
    where id = alvo;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end;
$$;

create or replace function public.admin_bloquear_usuario(alvo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  if alvo = (select auth.uid()) then raise exception 'Você não pode bloquear a sua própria conta.'; end if;
  if exists (select 1 from public.admins where usuario_id = alvo) then raise exception 'Não é possível bloquear outro administrador.'; end if;
  update public.perfis set liberado = false where id = alvo;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end;
$$;

create or replace function public.admin_recusar_pedido(alvo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  update public.perfis set acesso_pedido_em = null where id = alvo;
end;
$$;

-- Excluir o registro de um convite (usado ou não). Quem já entrou com ele continua liberado.
create or replace function public.admin_excluir_convite(p_codigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  delete from public.convites where codigo = p_codigo;
  if not found then raise exception 'Convite não encontrado.'; end if;
end;
$$;

-- Histórico de quem já entrou antes de existir liberado_como (roda só onde está vazio).
update public.perfis p set liberado_como = 'convite', liberado_em = c.usado_em
  from public.convites c
  where c.usado_por = p.id and p.liberado and p.liberado_como is null;
-- Liberados depois de pedir acesso: a data é a primeira tela aberta depois do último pedido.
update public.perfis p set liberado_como = 'pedido',
    liberado_em = (select min(t.criado_em) from public.eventos t where t.usuario_id = p.id and t.tipo = 'tela' and t.criado_em > ped.ultimo)
  from (select usuario_id, max(criado_em) as ultimo from public.eventos where tipo = 'acesso_pedido' group by usuario_id) ped
  where ped.usuario_id = p.id and p.liberado and p.liberado_como is null;

revoke execute on function public.usar_convite(text), public.pedir_acesso(), public.admin_criar_convite(text), public.admin_convites(),
  public.admin_cancelar_convite(text), public.admin_excluir_convite(text), public.admin_liberar_usuario(uuid), public.admin_bloquear_usuario(uuid), public.admin_recusar_pedido(uuid)
  from public, anon;
grant execute on function public.usar_convite(text), public.pedir_acesso(), public.admin_criar_convite(text), public.admin_convites(),
  public.admin_cancelar_convite(text), public.admin_excluir_convite(text), public.admin_liberar_usuario(uuid), public.admin_bloquear_usuario(uuid), public.admin_recusar_pedido(uuid)
  to authenticated;

-- ---------- Baixar meus dados (LGPD, direito de acesso) ----------
-- O registro de uso e os e-mails enviados não são lidos pela API; esta função devolve só os da própria pessoa.
create or replace function public.meus_dados_extras()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'dados', e.dados, 'criado_em', e.criado_em) order by e.criado_em)
      from public.eventos e where e.usuario_id = (select auth.uid())), '[]'::jsonb),
    'emails_enviados', coalesce((select jsonb_agg(to_jsonb(m) - 'usuario_id' order by m.enviado_em)
      from public.emails_enviados m where m.usuario_id = (select auth.uid())), '[]'::jsonb)
  );
$$;
revoke execute on function public.meus_dados_extras() from public, anon;
grant execute on function public.meus_dados_extras() to authenticated;

-- ---------- Foto do check-in (opcional) ----------
-- O check-in guarda só o caminho do arquivo; a foto fica no Storage, no bucket privado "fotos-checkin",
-- em "<usuário>/<check-in>.jpg". Só quem postou vê a foto no app; o painel do administrador nunca a mostra.
alter table public.checkins add column if not exists foto text not null default '' check (char_length(foto) <= 200);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-checkin', 'fotos-checkin', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Cada pessoa mexe só na própria pasta; enviar exige conta liberada. Administradores precisam de leitura
-- para conseguir apagar (no Postgres, apagar exige ver a linha): é usada só na exclusão de conta pelo painel,
-- que nunca mostra nem baixa as fotos.
drop policy if exists "fotos-checkin: le a propria" on storage.objects;
drop policy if exists "fotos-checkin: le a propria ou admin" on storage.objects;
create policy "fotos-checkin: le a propria ou admin" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-checkin' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.eh_admin()));
drop policy if exists "fotos-checkin: envia na propria" on storage.objects;
create policy "fotos-checkin: envia na propria" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-checkin' and (storage.foldername(name))[1] = (select auth.uid())::text and public.liberado());
drop policy if exists "fotos-checkin: troca a propria" on storage.objects;
create policy "fotos-checkin: troca a propria" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-checkin' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fotos-checkin' and (storage.foldername(name))[1] = (select auth.uid())::text and public.liberado());
drop policy if exists "fotos-checkin: apaga a propria ou admin" on storage.objects;
create policy "fotos-checkin: apaga a propria ou admin" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-checkin' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.eh_admin()));

-- ---------- Visitantes sem login ----------
-- As regras de acesso (RLS) já bloqueiam tudo para quem não entrou; isto tira também as permissões
-- padrão do Supabase nas tabelas, como reforço.
revoke all on public.perfis, public.checkins, public.cargas, public.eventos, public.admins, public.convites, public.emails_enviados from anon;
