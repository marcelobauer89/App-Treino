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
  tipo text not null check (tipo in ('t1', 't2', 't3', 't4', 't5', 't6', 'jiu', 'muay', 'surf', 'futebol', 'futvolei', 'bike')),
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

-- Estilo das cores escolhido em Você → Aparência: 'padrao' (o tema claro/escuro de sempre) ou um dos outros estilos (neon, brasa, cyber, ultra, gelo, violeta, miami, lua_de_sangue),
-- sempre escuro. Bancos criados antes desta coluna a recebem ao rodar o arquivo de novo.
alter table public.perfis add column if not exists estilo text not null default 'padrao';
alter table public.perfis drop constraint if exists perfis_estilo_check;
alter table public.perfis add constraint perfis_estilo_check check (estilo in ('padrao', 'neon', 'brasa', 'cyber', 'ultra', 'gelo', 'violeta', 'miami', 'lua_de_sangue'));

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
-- 'muay' = Muay Thai; 'surf' = Surf; 'futebol' = Futebol; 'futvolei' = Futvôlei.
-- A Calistenia ('cali') existiu por poucos dias e foi retirada: os check-ins dela são apagados
-- e ela sai da semana montada de quem tinha colocado (rodar de novo não muda nada).
delete from public.checkins where tipo = 'cali';
update public.perfis p set semana = (
    select jsonb_agg(coalesce((select jsonb_agg(x) from jsonb_array_elements(d) x where x <> '"cali"'::jsonb), '[]'::jsonb) order by i)
    from jsonb_array_elements(p.semana) with ordinality as t(d, i))
  where p.semana::text like '%"cali"%';
alter table public.checkins drop constraint if exists checkins_tipo_check;
alter table public.checkins add constraint checkins_tipo_check check (tipo in ('t1', 't2', 't3', 't4', 't5', 't6', 'jiu', 'muay', 'surf', 'futebol', 'futvolei', 'bike'));
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

-- Jornada pronta escolhida pela pessoa (hipertrofia, forca, mobilidade, jiu). Vazia = nenhuma escolhida.
-- Só identifica a jornada; os treinos continuam em perfis.treinos. Quem já usa o app fica com o que tem.
alter table public.perfis add column if not exists jornada text check (jornada is null or char_length(jornada) <= 30);
-- Vídeos dos exercícios liberados pelo administrador (Monitoramento → Usuários). Só o admin muda (fora do grant update).
alter table public.perfis add column if not exists videos_liberados boolean not null default false;

-- ---------- Privacidade (LGPD) ----------
-- Versão da Política de Privacidade que a pessoa viu e aceitou (aviso no app quando muda).
alter table public.perfis add column if not exists politica_versao text check (politica_versao is null or char_length(politica_versao) <= 20);
-- Consentimento para guardar observações nos check-ins (podem revelar dados de saúde).
-- Só 'sim' liga o campo no app; vazio ou 'nao' = desligado (padrão).
alter table public.perfis add column if not exists consentimento_saude text check (consentimento_saude is null or consentimento_saude in ('sim', 'nao'));
alter table public.perfis add column if not exists consentimento_saude_em timestamptz;

-- Temporizador de descanso (Você → Temporizador): { ativo, segundos, vibrar }. Vazio = desligado.
alter table public.perfis add column if not exists temporizador jsonb
  check (temporizador is null or (jsonb_typeof(temporizador) = 'object' and pg_column_size(temporizador) <= 500));
grant update (id, nome, email, foto, tema, estilo, dias_jiu, semana, sem_peso, emails_resumo, treinos, novidade_treinos, novidade_oculta, treinos_anterior, jornada, temporizador, politica_versao, consentimento_saude, consentimento_saude_em) on public.perfis to authenticated;

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
  liberado boolean, acesso_pedido_em timestamptz, liberado_como text, liberado_em timestamptz,
  videos_liberados boolean
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
      p.liberado, p.acesso_pedido_em, p.liberado_como, p.liberado_em, p.videos_liberados
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
    order by c.inicio, c.id;
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
    -- O id desempata: o painel busca em páginas de 1.000 e a ordem precisa ser a mesma em todas.
    order by e.criado_em, e.id;
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

-- ---------- Vídeos dos exercícios (só para quem o administrador liberar) ----------
-- A lista (exercício → id do vídeo no YouTube) fica só no banco; ninguém lê a tabela pela API.
-- A carga dos vídeos é feita uma vez pelo SQL Editor (não fica no repositório).
create table if not exists public.videos_exercicios (
  exercicio text primary key check (char_length(exercicio) between 1 and 80),
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$')
);
alter table public.videos_exercicios enable row level security;
revoke all on public.videos_exercicios from anon, authenticated;

-- Os vídeos para o app: devolve a lista só se a própria pessoa estiver com os vídeos liberados.
create or replace function public.meus_videos()
returns table (exercicio text, video_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.exercicio, v.video_id from public.videos_exercicios v
  where exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.videos_liberados);
$$;

-- Liberar ou tirar os vídeos de um usuário (só administradores).
create or replace function public.admin_liberar_videos(alvo uuid, liberar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  update public.perfis set videos_liberados = coalesce(liberar, false) where id = alvo;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end;
$$;
revoke execute on function public.meus_videos(), public.admin_liberar_videos(uuid, boolean) from public, anon;
grant execute on function public.meus_videos(), public.admin_liberar_videos(uuid, boolean) to authenticated;

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

-- ---------- Catálogo: exercícios e objetivos ----------
-- A biblioteca de exercícios e os objetivos prontos (jornadas) que o app oferece. Todos que entram leem;
-- só administradores mudam, pelo painel (aba Exercícios), com as funções admin_* abaixo.
-- Os treinos das contas (perfis.treinos) guardam só nome, dose e PSE: mudar o catálogo não mexe neles.
-- Renomear guarda o nome antigo em nomes_antigos (o app continua achando o exercício por ele) e
-- desativar (ativo = false) tira o exercício da lista de escolha, sem sumir dos treinos de quem já o tem.
-- Nome comparado sem diferenciar maiúsculas, acentos e espaços (para não repetir exercício).
create or replace function public.chave_exercicio(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'));
$$;

create table if not exists public.exercicios (
  nome text primary key check (char_length(nome) between 1 and 80 and nome = btrim(nome)),
  grupo text not null check (grupo in ('Mobilidade', 'Core', 'Explosivos', 'Pernas', 'Costas', 'Peito', 'Ombros', 'Braços', 'Pescoço', 'Cardio')),
  dose text not null default '3×10' check (char_length(dose) between 1 and 30),
  pse smallint not null default 8 check (pse between 1 and 10),
  hipertrofia text not null default 'baixa' check (hipertrofia in ('alta', 'media', 'baixa')),
  mobilidade text not null default 'baixa' check (mobilidade in ('alta', 'media', 'baixa')),
  forca text not null default 'baixa' check (forca in ('alta', 'media', 'baixa')),
  explosao text not null default 'baixa' check (explosao in ('alta', 'media', 'baixa')),
  explicacao text not null default '' check (char_length(explicacao) <= 400),
  variacoes text[] not null default '{}' check (cardinality(variacoes) <= 20),
  nomes_antigos text[] not null default '{}' check (cardinality(nomes_antigos) <= 20),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create unique index if not exists exercicios_chave on public.exercicios (public.chave_exercicio(nome));

-- Objetivos prontos: dados = { nome, resumo, nivel, dias, tempo, equipamento, semana, treinos }, no formato do app.
create table if not exists public.jornadas (
  id text primary key check (id ~ '^[a-z0-9_-]{2,30}$'),
  ordem int not null default 0,
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and jsonb_typeof(dados -> 'treinos') = 'object' and pg_column_size(dados) <= 40000),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- Objetivos a que o exercício se aplica (ids de jornadas; opcional): no app, o filtro "Do meu objetivo".
-- Ao criar a coluna (só nessa vez), já vem preenchida com os objetivos em que o exercício aparece.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'exercicios' and column_name = 'objetivos') then
    alter table public.exercicios add column objetivos text[] not null default '{}' check (cardinality(objetivos) <= 20);
    update public.exercicios e set objetivos = coalesce((
      select array_agg(distinct j.id order by j.id) from public.jornadas j, jsonb_each(j.dados -> 'treinos') t, jsonb_array_elements(t.value -> 'exercicios') x
      where x ->> 'nome' = e.nome), '{}');
  end if;
end $$;

alter table public.exercicios enable row level security;
alter table public.jornadas enable row level security;
revoke all on public.exercicios, public.jornadas from anon, authenticated;
grant select on public.exercicios, public.jornadas to authenticated;
drop policy if exists "catálogo: todos leem" on public.exercicios;
create policy "catálogo: todos leem" on public.exercicios for select to authenticated using (true);
drop policy if exists "catálogo: todos leem" on public.jornadas;
create policy "catálogo: todos leem" on public.jornadas for select to authenticated using (true);

-- Para o painel: os exercícios com o vídeo e quantas contas têm cada um nos treinos
-- (quem usa o plano pronto conta nos exercícios do objetivo Jiu Jitsu).
drop function if exists public.admin_exercicios();
create function public.admin_exercicios()
returns table (nome text, grupo text, dose text, pse smallint, hipertrofia text, mobilidade text, forca text, explosao text,
  explicacao text, variacoes text[], nomes_antigos text[], objetivos text[], ativo boolean, atualizado_em timestamptz, video_id text, usos int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
  with usados as (
    select x ->> 'nome' as nome, p.id
      from public.perfis p, jsonb_each(p.treinos) t, jsonb_array_elements(t.value -> 'exercicios') x
      where p.treinos is not null and jsonb_typeof(p.treinos) = 'object'
    union
    select x ->> 'nome', p.id
      from public.perfis p, public.jornadas j, jsonb_each(j.dados -> 'treinos') t, jsonb_array_elements(t.value -> 'exercicios') x
      where p.treinos is null and j.id = 'jiu'
  )
  select e.nome, e.grupo, e.dose, e.pse, e.hipertrofia, e.mobilidade, e.forca, e.explosao, e.explicacao, e.variacoes, e.nomes_antigos,
    e.objetivos, e.ativo, e.atualizado_em, v.video_id,
    (select count(distinct u.id)::int from usados u where u.nome = e.nome or u.nome = any(e.nomes_antigos))
  from public.exercicios e
  left join public.videos_exercicios v on v.exercicio = e.nome
  order by e.nome;
end;
$$;

-- Cria (p_nome_atual vazio) ou altera um exercício. p = { nome, grupo, dose, pse, hipertrofia, mobilidade, forca,
-- explosao, explicacao, variacoes, objetivos, ativo, video_id }. O nome fica sem espaços sobrando e com a primeira letra maiúscula. Ao renomear, o nome antigo vai para nomes_antigos e o vídeo
-- acompanha. video_id vazio tira o vídeo; sem a chave video_id, o vídeo fica como está.
create or replace function public.admin_salvar_exercicio(p_nome_atual text, p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p ->> 'nome', '')), '\s+', ' ', 'g');
  v_obj text[] := coalesce(array(select distinct btrim(x) from jsonb_array_elements_text(coalesce(p -> 'objetivos', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
  v_video text := btrim(coalesce(p ->> 'video_id', ''));
  v_antigos text[] := '{}';
  v_outro text;
  v_var text[] := coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p -> 'variacoes', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  v_nome := upper(left(v_nome, 1)) || substr(v_nome, 2);
  v_var := array(select upper(left(x, 1)) || substr(x, 2) from unnest(v_var) x);
  if char_length(v_nome) not between 1 and 80 then raise exception 'Informe o nome do exercício (até 80 letras).'; end if;
  select e.nome into v_outro from public.exercicios e
    where public.chave_exercicio(e.nome) = public.chave_exercicio(v_nome) and e.nome is distinct from p_nome_atual;
  if found then raise exception 'Já existe um exercício com esse nome: %.', v_outro; end if;
  select e.nome into v_outro from public.exercicios e
    where e.nome is distinct from p_nome_atual and exists (select 1 from unnest(e.nomes_antigos) a where public.chave_exercicio(a) = public.chave_exercicio(v_nome));
  if found then raise exception 'Esse nome já foi do exercício %. Escolha outro.', v_outro; end if;
  if v_video <> '' and v_video !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'Vídeo inválido: use o link ou o código de 11 letras do YouTube.'; end if;

  if p_nome_atual is null or p_nome_atual = '' then
    insert into public.exercicios (nome, grupo, dose, pse, hipertrofia, mobilidade, forca, explosao, explicacao, variacoes, objetivos, ativo)
    values (v_nome, p ->> 'grupo', coalesce(nullif(btrim(p ->> 'dose'), ''), '3×10'), coalesce((p ->> 'pse')::smallint, 8),
      coalesce(p ->> 'hipertrofia', 'baixa'), coalesce(p ->> 'mobilidade', 'baixa'), coalesce(p ->> 'forca', 'baixa'), coalesce(p ->> 'explosao', 'baixa'),
      coalesce(btrim(p ->> 'explicacao'), ''), v_var, v_obj, coalesce((p ->> 'ativo')::boolean, true));
  else
    select e.nomes_antigos into v_antigos from public.exercicios e where e.nome = p_nome_atual for update;
    if not found then raise exception 'Exercício não encontrado.'; end if;
    if v_nome <> p_nome_atual then
      v_antigos := array_remove(v_antigos, v_nome);
      if not p_nome_atual = any(v_antigos) then v_antigos := v_antigos || p_nome_atual; end if;
    end if;
    update public.exercicios set nome = v_nome, grupo = p ->> 'grupo', dose = coalesce(nullif(btrim(p ->> 'dose'), ''), '3×10'),
      pse = coalesce((p ->> 'pse')::smallint, 8), hipertrofia = coalesce(p ->> 'hipertrofia', 'baixa'), mobilidade = coalesce(p ->> 'mobilidade', 'baixa'),
      forca = coalesce(p ->> 'forca', 'baixa'), explosao = coalesce(p ->> 'explosao', 'baixa'), explicacao = coalesce(btrim(p ->> 'explicacao'), ''),
      variacoes = v_var, objetivos = case when p ? 'objetivos' then v_obj else objetivos end, nomes_antigos = v_antigos, ativo = coalesce((p ->> 'ativo')::boolean, true), atualizado_em = now()
      where nome = p_nome_atual;
    if v_nome <> p_nome_atual then
      delete from public.videos_exercicios where exercicio = v_nome;
      update public.videos_exercicios set exercicio = v_nome where exercicio = p_nome_atual;
    end if;
  end if;
  if p ? 'video_id' then
    if v_video = '' then delete from public.videos_exercicios where exercicio = v_nome;
    else insert into public.videos_exercicios (exercicio, video_id) values (v_nome, v_video)
      on conflict (exercicio) do update set video_id = excluded.video_id;
    end if;
  end if;
  return v_nome;
end;
$$;
revoke execute on function public.admin_exercicios(), public.admin_salvar_exercicio(text, jsonb) from public, anon;
grant execute on function public.admin_exercicios(), public.admin_salvar_exercicio(text, jsonb) to authenticated;

-- catalogo:inicio (gerado por supabase/gerar-catalogo.cjs a partir do index.html; não edite à mão)
-- Carga inicial: só entra o que ainda não existe. Exercícios renomeados (nome antigo em nomes_antigos) não voltam,
-- e o que já foi editado pelo painel continua como está.
insert into public.exercicios (nome, grupo, dose, pse, hipertrofia, mobilidade, forca, explosao, explicacao, variacoes, objetivos)
select x.nome, x.grupo, x.dose, x.pse, x.hipertrofia, x.mobilidade, x.forca, x.explosao, x.explicacao,
  array(select jsonb_array_elements_text(x.variacoes)), array(select jsonb_array_elements_text(x.objetivos))
from jsonb_to_recordset($catalogo$[
  {"nome":"Alcance da ponte alternada","grupo":"Mobilidade","dose":"2–3×12 totais","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Abre quadril, ombros e coluna torácica alternando os lados; bom preparo para a ponte e as rotações.","variacoes":["Ponte alta alternada","Alcance da ponte"],"objetivos":[]},
  {"nome":"Alcance no pé semiajoelhado","grupo":"Mobilidade","dose":"3×12 / lado","pse":5,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Com um joelho no chão, leva a mão até o pé da frente; abre quadril e posterior de coxa.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Alongamento de posterior com mobilidade escapular","grupo":"Mobilidade","dose":"1×5 / lado","pse":4,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Alonga a parte de trás das pernas enquanto move as escápulas; prepara costas e quadril juntos.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Alongamento de posteriores","grupo":"Mobilidade","dose":"1×20 s / lado","pse":4,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Alongamento dos posteriores de coxa antes do treino de pernas; mais amplitude para dobrar o quadril.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Armbar com kettlebell","grupo":"Mobilidade","dose":"3×5 / lado","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Deitado, segura o peso com o braço esticado e gira o corpo por baixo dele; ombro estável e protegido.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Cócoras","grupo":"Mobilidade","dose":"3×1 min","pse":5,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Mobilidade de quadril/tornozelo e preparação para posições baixas do grappling.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Escorpião","grupo":"Mobilidade","dose":"3×10","pse":5,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Mobilidade de quadril e coluna; preparação para movimentos de rotação.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Jefferson curl","grupo":"Mobilidade","dose":"2–3×8","pse":8,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Mobilidade da coluna e dos posteriores de coxa com carga, ganhando controle ao dobrar o tronco.","variacoes":["Jeff curl"],"objetivos":["mobilidade"]},
  {"nome":"Mobilidade 90/90 com remada","grupo":"Mobilidade","dose":"3×12 / lado","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Sentado na posição 90/90, puxa o cabo girando o tronco; quadril aberto e rotação com força.","variacoes":[],"objetivos":[]},
  {"nome":"Mobilidade de ombros 180°","grupo":"Mobilidade","dose":"2–3×8","pse":8,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Amplitude e controle do ombro em todo o arco (quanto mais amplo, melhor); prepara para empurrar e puxar acima da cabeça.","variacoes":["Mobilidade de ombros com halter"],"objetivos":["hipertrofia","mobilidade"]},
  {"nome":"Mobilidade de punho","grupo":"Mobilidade","dose":"3×15","pse":4,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Em 4 apoios, leva o peso sobre as mãos em extensão e em flexão; punho preparado para as pegadas.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Mobilidade de quadril","grupo":"Mobilidade","dose":"2–3×10 totais","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Rotação interna e externa do quadril; mais amplitude para a guarda e as transições.","variacoes":["Mobilidade de quadril pára-brisa","Mobilidade de quadril capoeirinha","Mobilidade de quadril 90/90","Mobilidade 90/90"],"objetivos":["hipertrofia"]},
  {"nome":"Mobilidade de quadril na cócoras","grupo":"Mobilidade","dose":"2–3×12 totais","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Mobilidade de quadril e tornozelo a partir da cócoras; mais conforto nas posições baixas do grappling.","variacoes":[],"objetivos":["hipertrofia","mobilidade"]},
  {"nome":"Mobilidade de tronco na parede","grupo":"Mobilidade","dose":"3×6 / lado","pse":5,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Rotação da coluna torácica com apoio na parede; mais giro do tronco sem compensar na lombar.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Quadril alto/baixo","grupo":"Mobilidade","dose":"3×5","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"media","explicacao":"Controle do quadril e transição entre posições; útil para mobilidade no solo.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Rolamento","grupo":"Mobilidade","dose":"3×10","pse":5,"hipertrofia":"baixa","mobilidade":"media","forca":"baixa","explosao":"media","explicacao":"Controle corporal, orientação espacial e transferência para quedas e transições.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Rolamento tocando os pés","grupo":"Mobilidade","dose":"3×6","pse":5,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"media","explicacao":"Rola para trás até tocar os pés atrás da cabeça e volta; coluna solta e controle para inverter a guarda.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Rotação de quadril ajoelhado","grupo":"Mobilidade","dose":"3×10","pse":6,"hipertrofia":"baixa","mobilidade":"alta","forca":"baixa","explosao":"baixa","explicacao":"Ajoelhado, gira o quadril para dentro e para fora; mais rotação para a guarda e menos risco no joelho.","variacoes":["Rotação de quadril ajoelhando"],"objetivos":["mobilidade"]},
  {"nome":"Windmill semiajoelhado","grupo":"Mobilidade","dose":"3×6 / lado","pse":7,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Com o halter ou kettlebell acima da cabeça, desce o tronco de lado até o chão; ombro estável, quadril e oblíquos.","variacoes":[],"objetivos":["forca","mobilidade"]},
  {"nome":"Abdominal bicicleta","grupo":"Core","dose":"3×20 totais","pse":7,"hipertrofia":"media","mobilidade":"baixa","forca":"baixa","explosao":"baixa","explicacao":"Leva o cotovelo ao joelho oposto alternando, como pedalando; abdômen e oblíquos na rotação.","variacoes":[],"objetivos":[]},
  {"nome":"Abdominal infra","grupo":"Core","dose":"3×12–15","pse":7,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Deitado, sobe as pernas e tira o quadril do chão no fim, sem arquear a lombar; parte de baixo do abdômen.","variacoes":["Elevação de pernas deitado"],"objetivos":[]},
  {"nome":"Abdominal na polia","grupo":"Core","dose":"3×12–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Ajoelhado de frente para o cabo, enrola o tronco para baixo segurando a corda; abdômen com carga.","variacoes":["Abdominal ajoelhado no cabo"],"objetivos":[]},
  {"nome":"Abdominal supra","grupo":"Core","dose":"3×15–20","pse":7,"hipertrofia":"media","mobilidade":"baixa","forca":"baixa","explosao":"baixa","explicacao":"Deitado, sobe o tronco tirando as escápulas do chão, sem puxar o pescoço; parte de cima do abdômen.","variacoes":["Abdominal crunch","Abdominal reto"],"objetivos":[]},
  {"nome":"Alcance diagonal","grupo":"Core","dose":"3×10","pse":7,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"media","explicacao":"Coordenação diagonal, estabilidade e controle do tronco.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Carregada farmer","grupo":"Core","dose":"2–3×30 s","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Andar com um halter pesado em cada mão; pegada, trapézio e postura firme.","variacoes":["Carregada unilateral"],"objetivos":["forca","mobilidade"]},
  {"nome":"Carregada na marcha","grupo":"Core","dose":"3×20","pse":5,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Pegada, core, estabilidade e força unilateral; grande transferência para grappling.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Carregada overhead","grupo":"Core","dose":"2–3×15 s / lado","pse":8,"hipertrofia":"baixa","mobilidade":"media","forca":"alta","explosao":"baixa","explicacao":"Andar com o peso acima da cabeça: ombro estável e core que não deixa o tronco inclinar.","variacoes":[],"objetivos":[]},
  {"nome":"Dead bug","grupo":"Core","dose":"3×10 / lado","pse":6,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Deitado de costas, estica braço e perna opostos com a lombar colada no chão; controle do abdômen e da coordenação.","variacoes":["Inseto morto"],"objetivos":["forca","hipertrofia"]},
  {"nome":"Elevação de pernas na barra","grupo":"Core","dose":"3×8–12","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Pendurado na barra, sobe as pernas (ou os joelhos) sem balançar; abdômen, flexores do quadril e pegada.","variacoes":["Elevação de joelhos na barra"],"objetivos":[]},
  {"nome":"Flexão lateral semiajoelhada overhead","grupo":"Core","dose":"2–3×8 / lado","pse":7,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Inclinação lateral com o peso acima da cabeça; mobilidade e força dos oblíquos e do ombro.","variacoes":[],"objetivos":[]},
  {"nome":"Hollow hold","grupo":"Core","dose":"3×20–30 s","pse":7,"hipertrofia":"baixa","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Deitado, tira ombros e pernas do chão em forma de canoa e segura; abdômen firme como um bloco.","variacoes":["Canoa"],"objetivos":[]},
  {"nome":"L-sit","grupo":"Core","dose":"2–3×20 s","pse":7,"hipertrofia":"baixa","mobilidade":"media","forca":"alta","explosao":"baixa","explicacao":"Sustentar as pernas estendidas à frente; abdômen, flexores do quadril e tríceps.","variacoes":[],"objetivos":[]},
  {"nome":"Levantamento turco","grupo":"Core","dose":"2–3×2 / lado","pse":8,"hipertrofia":"baixa","mobilidade":"alta","forca":"alta","explosao":"baixa","explicacao":"TGU completo: estabilidade de ombro, core e quadril enquanto o corpo sai do chão e volta.","variacoes":[],"objetivos":[]},
  {"nome":"Lift diagonal no cabo","grupo":"Core","dose":"2–3×12 / lado","pse":8,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"media","explicacao":"Força em diagonal, de baixo para cima; core que leva a força das pernas até os braços.","variacoes":[],"objetivos":[]},
  {"nome":"Perdigueiro alternado","grupo":"Core","dose":"3×10 / lado","pse":6,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Em 4 apoios, estica braço e perna opostos; estabilidade da lombar e do quadril.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Ponte Copenhagen dinâmica","grupo":"Core","dose":"2–3×8 / lado","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Adutores e oblíquos; protege a virilha e firma as pernas para fechar a guarda.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Ponte lateral dinâmica com apoio","grupo":"Core","dose":"2–3×8 / lado","pse":7,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Oblíquos e glúteo médio subindo e descendo o quadril de lado; estabilidade lateral do tronco.","variacoes":[],"objetivos":[]},
  {"nome":"Prancha","grupo":"Core","dose":"3×30–45 s","pse":7,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Apoiado nos antebraços e nas pontas dos pés, corpo reto sem deixar o quadril cair; abdômen e lombar firmes.","variacoes":["Prancha frontal","Prancha isométrica"],"objetivos":[]},
  {"nome":"Prancha lateral","grupo":"Core","dose":"3×20–30 s / lado","pse":7,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"De lado, apoiado no antebraço, quadril alto; oblíquos e glúteo médio para a base lateral.","variacoes":[],"objetivos":["hipertrofia","mobilidade"]},
  {"nome":"Prancha tocando os ombros","grupo":"Core","dose":"3×10 / lado","pse":7,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Na prancha alta, toca o ombro oposto sem girar o quadril; core firme contra a rotação.","variacoes":[],"objetivos":[]},
  {"nome":"Prancha trocando a base","grupo":"Core","dose":"3×12","pse":8,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"media","explicacao":"Na prancha, troca os apoios de lugar sem deixar o quadril girar; core firme enquanto a base muda. Para facilitar, apoie os pés na parede.","variacoes":[],"objetivos":[]},
  {"nome":"Quadrupedia com flexão","grupo":"Core","dose":"3×10","pse":7,"hipertrofia":"media","mobilidade":"media","forca":"media","explosao":"media","explicacao":"Anda em 4 apoios e faz uma flexão de braços; core, ombros e peito trabalhando juntos, como no chão.","variacoes":["Quadrupedia com pushup"],"objetivos":[]},
  {"nome":"Quadrupedia tocando os ombros","grupo":"Core","dose":"3×20","pse":6,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"media","explicacao":"Estabilidade de core e cintura escapular; prepara para apoio e controle no chão.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Roda abdominal","grupo":"Core","dose":"3×8–12","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Ajoelhado, rola a roda à frente até onde mantiver a lombar firme e volta; abdômen forte contra a extensão.","variacoes":["Ab wheel","Rolinho abdominal"],"objetivos":[]},
  {"nome":"Rotação com velocidade","grupo":"Core","dose":"3×12 / lado","pse":8,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"alta","explicacao":"Rotação rápida do tronco; potência para raspagens e para girar o quadril.","variacoes":[],"objetivos":[]},
  {"nome":"Rotação no cabo","grupo":"Core","dose":"3×10 / lado","pse":8,"hipertrofia":"media","mobilidade":"media","forca":"alta","explosao":"media","explicacao":"Rotação e resistência do tronco, importantes para controlar e transferir força.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Rotação unilateral no landmine","grupo":"Core","dose":"3×8 / lado","pse":8,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"alta","explicacao":"Rotação do tronco com a barra presa no chão; potência de giro e controle do core.","variacoes":[],"objetivos":[]},
  {"nome":"Superman","grupo":"Core","dose":"3×30 s","pse":7,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Resistência da cadeia posterior e controle lombopélvico.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Swing diagonal semiajoelhado","grupo":"Core","dose":"3×12 / lado","pse":8,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"alta","explicacao":"Com um joelho no chão, leva o halter em diagonal de baixo para cima; potência de rotação do tronco.","variacoes":["Swing diagonal"],"objetivos":[]},
  {"nome":"TGU parcial","grupo":"Core","dose":"3×5 / lado","pse":8,"hipertrofia":"baixa","mobilidade":"alta","forca":"alta","explosao":"media","explicacao":"Estabilidade de ombro, core, quadril e controle global do corpo.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Clean","grupo":"Explosivos","dose":"2×4 válidas","pse":9,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"alta","explicacao":"Arremesso do chão até os ombros; potência de corpo inteiro e coordenação.","variacoes":["Clean do chão unilateral"],"objetivos":[]},
  {"nome":"Elevação de quadril unilateral com salto","grupo":"Explosivos","dose":"3×12 / lado","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"alta","explicacao":"Elevação de quadril de uma perna empurrando com explosão; potência para a ponte e as fugas por baixo.","variacoes":["Elevação de quadril unilateral saltando"],"objetivos":[]},
  {"nome":"Hang power clean","grupo":"Explosivos","dose":"3×6","pse":9,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"alta","explicacao":"Extensão explosiva do quadril e puxada rápida; potência para quedas e para levantar o oponente.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Hang power snatch unilateral","grupo":"Explosivos","dose":"3×6","pse":9,"hipertrofia":"baixa","mobilidade":"media","forca":"media","explosao":"alta","explicacao":"Explosão do quadril levada até o braço num movimento só; potência e coordenação de um lado por vez.","variacoes":[],"objetivos":[]},
  {"nome":"Passada alternada com salto","grupo":"Explosivos","dose":"3×12 totais","pse":8,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"alta","explicacao":"Pliometria trocando as pernas no ar; explosão e troca rápida de base.","variacoes":[],"objetivos":[]},
  {"nome":"Push press","grupo":"Explosivos","dose":"2×5 válidas","pse":9,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"alta","explicacao":"Impulso das pernas passado para os braços; força e potência de empurrar acima da cabeça.","variacoes":[],"objetivos":[]},
  {"nome":"Puxada alta","grupo":"Explosivos","dose":"2×5 válidas","pse":9,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"alta","explicacao":"Puxada explosiva da carga até a altura do peito; potência de quadril e trapézio.","variacoes":[],"objetivos":[]},
  {"nome":"Saltitos","grupo":"Explosivos","dose":"3×10","pse":8,"hipertrofia":"baixa","mobilidade":"baixa","forca":"baixa","explosao":"alta","explicacao":"Saltos curtos e rápidos na ponta dos pés; tornozelo reativo e pés leves para mudar de base.","variacoes":[],"objetivos":[]},
  {"nome":"Salto","grupo":"Explosivos","dose":"3×4","pse":8,"hipertrofia":"baixa","mobilidade":"baixa","forca":"media","explosao":"alta","explicacao":"Pliometria: potência das pernas para entradas de queda e mudanças rápidas de posição.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Snatch","grupo":"Explosivos","dose":"2×4 válidas","pse":9,"hipertrofia":"baixa","mobilidade":"media","forca":"alta","explosao":"alta","explicacao":"Arranco do chão até acima da cabeça; o mais explosivo dos levantamentos, com mobilidade de ombro.","variacoes":[],"objetivos":[]},
  {"nome":"Abdução de quadril deitado de lado","grupo":"Pernas","dose":"3×10–15","pse":7,"hipertrofia":"media","mobilidade":"baixa","forca":"baixa","explosao":"baixa","explicacao":"Deitado de lado, sobe a perna de cima (esticada ou flexionada); glúteo médio sem equipamento.","variacoes":["Abdução decúbito lateral"],"objetivos":[]},
  {"nome":"Abdução de quadril no cabo","grupo":"Pernas","dose":"3×15 / lado","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Em pé, afasta a perna para o lado com o cabo passando por trás; glúteo médio e quadril estável.","variacoes":["Abdução de quadril na polia baixa"],"objetivos":["hipertrofia"]},
  {"nome":"Agachamento","grupo":"Pernas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"media","explicacao":"Força de pernas e quadril; base, pressão e capacidade de produzir força.","variacoes":["Agachamento HBL","Agachamento com barra","Agachamento goblet"],"objetivos":["forca","hipertrofia","jiu"]},
  {"nome":"Agachamento búlgaro","grupo":"Pernas","dose":"3×10 / lado","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"baixa","explicacao":"Uma perna à frente e o pé de trás apoiado no banco, com halteres; força unilateral e glúteos.","variacoes":["Búlgaro com halteres"],"objetivos":["hipertrofia"]},
  {"nome":"Agachamento lateral alternado","grupo":"Pernas","dose":"3–4×12 totais","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Agachamento de um lado para o outro, com halter ou no cabo; adutores, glúteos e base lateral.","variacoes":[],"objetivos":[]},
  {"nome":"Agachamento sumô","grupo":"Pernas","dose":"4×10","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Pés bem afastados, com halter (pode ser em cima de steps); adutores e glúteos contraindo na subida.","variacoes":["Agachamento sumô no step"],"objetivos":["hipertrofia"]},
  {"nome":"Agachamento unilateral Zercher","grupo":"Pernas","dose":"3×4 / lado","pse":9,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"media","explicacao":"Uma perna por vez com a carga na dobra dos cotovelos; força unilateral e core firme.","variacoes":[],"objetivos":[]},
  {"nome":"Agachamento Zercher","grupo":"Pernas","dose":"2×4 válidas","pse":9,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"media","explicacao":"Agachamento com a carga na dobra dos cotovelos; pernas, core e costas firmes, como ao levantar alguém agarrado.","variacoes":[],"objetivos":[]},
  {"nome":"Cadeira abdutora","grupo":"Pernas","dose":"2–3×12","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Sentado na máquina, abre as pernas contra o apoio; glúteo médio e quadril estável.","variacoes":[],"objetivos":[]},
  {"nome":"Cadeira adutora","grupo":"Pernas","dose":"3×12","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Adutores fortes para fechar a guarda e proteger a virilha.","variacoes":["Adução de quadril com caneleira"],"objetivos":["hipertrofia"]},
  {"nome":"Cadeira extensora","grupo":"Pernas","dose":"3×8","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Isola o quadríceps; complemento de hipertrofia e proteção do joelho.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Cadeira flexora","grupo":"Pernas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Sentado na máquina, dobra os joelhos levando o apoio para baixo; isola os posteriores de coxa. É diferente da mesa flexora, em que se faz deitado.","variacoes":["Cadeira flexora unilateral"],"objetivos":[]},
  {"nome":"Coice de glúteo na polia","grupo":"Pernas","dose":"3×8–10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Em 4 apoios ou em pé, empurra a perna para trás no cabo e segura 2 s em cima; isola o glúteo.","variacoes":["Glúteos coice na polia","Coice em 4 apoios na polia"],"objetivos":[]},
  {"nome":"Deadlift","grupo":"Pernas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"alta","explicacao":"Cadeia posterior, quadril e força de puxada; essencial para força global.","variacoes":["Deadlift veloz"],"objetivos":["forca","hipertrofia","jiu"]},
  {"nome":"Deadlift split","grupo":"Pernas","dose":"3×4 / lado","pse":9,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Levantamento terra com as pernas afastadas, uma à frente; força unilateral da cadeia posterior.","variacoes":[],"objetivos":[]},
  {"nome":"Deadlift sumô","grupo":"Pernas","dose":"3×8","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Levantamento terra com os pés afastados e a barra entre as pernas; glúteos, adutores e posterior.","variacoes":[],"objetivos":[]},
  {"nome":"Deslocamento lateral com elástico","grupo":"Pernas","dose":"3×15 / lado","pse":7,"hipertrofia":"media","mobilidade":"baixa","forca":"baixa","explosao":"baixa","explicacao":"Passos para o lado com elástico nas pernas; ativa o glúteo médio e protege os joelhos.","variacoes":[],"objetivos":[]},
  {"nome":"Drop lunge","grupo":"Pernas","dose":"3×5 / lado","pse":7,"hipertrofia":"media","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Afundo cruzando a perna para trás, com halter ou kettlebell; glúteo médio e estabilidade do joelho.","variacoes":[],"objetivos":[]},
  {"nome":"Elevação de quadril","grupo":"Pernas","dose":"4×8","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Glúteos fortes na extensão do quadril; ajuda a fazer a ponte e a explodir nas raspagens.","variacoes":["Elevação de quadril com barra","Elevação de quadril HBL"],"objetivos":["hipertrofia"]},
  {"nome":"Elevação pélvica unilateral","grupo":"Pernas","dose":"3×10 / lado","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Glúteo de uma perna por vez; estabilidade de quadril e força para a ponte.","variacoes":["Elevação de quadril na cadeira","Elevação de quadril no sofá","Elevação de quadril unilateral"],"objetivos":[]},
  {"nome":"Flexão nórdica","grupo":"Pernas","dose":"3×8","pse":9,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Ajoelhado com os pés presos, desce o tronco devagar; posteriores de coxa fortes. Se for difícil, segure 15 s embaixo ou troque pela mesa flexora.","variacoes":[],"objetivos":["forca","mobilidade"]},
  {"nome":"Mesa flexora","grupo":"Pernas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Isola os posteriores de coxa; protege o joelho e dá força para fechar a guarda.","variacoes":["Flexão de joelhos com caneleiras"],"objetivos":["hipertrofia"]},
  {"nome":"Panturrilha","grupo":"Pernas","dose":"3×10–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Complemento para panturrilha e capacidade de produzir força no apoio.","variacoes":[],"objetivos":["hipertrofia","jiu"]},
  {"nome":"Passada para frente","grupo":"Pernas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"media","explicacao":"Força unilateral, equilíbrio e estabilidade de quadril e joelho.","variacoes":["Passada com halteres"],"objetivos":["jiu"]},
  {"nome":"Ponte invertida unilateral","grupo":"Pernas","dose":"3×20 s / lado","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Ponte com um pé apoiado longe do corpo, em isometria; posteriores de coxa fortes e protegidos.","variacoes":["Ponte inversa unilateral"],"objetivos":["mobilidade"]},
  {"nome":"Sissy squat","grupo":"Pernas","dose":"3–4×6","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Agachamento levando os joelhos à frente com o tronco reto; quadríceps alongado e joelho mais resistente.","variacoes":[],"objetivos":[]},
  {"nome":"Step up","grupo":"Pernas","dose":"3×10 / lado","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Sobe no banco ou step com uma perna, com halter ou caneleira (pode pausar embaixo); força unilateral e equilíbrio.","variacoes":["Step up com caneleira","Step up com pausa embaixo"],"objetivos":["forca","hipertrofia"]},
  {"nome":"Stiff","grupo":"Pernas","dose":"3×8","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"baixa","explicacao":"Posteriores de coxa e glúteos levando o quadril para trás; cadeia posterior forte.","variacoes":["Stiff com barra","Stiff pés afastados"],"objetivos":["hipertrofia"]},
  {"nome":"Barra fixa","grupo":"Costas","dose":"4×8","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Puxada com o peso do corpo; dorsais, bíceps e pegada para controlar o oponente. Se não conseguir, faça a puxada no cabo.","variacoes":["Barra fixa supinada"],"objetivos":["forca"]},
  {"nome":"Extensão de ombros no cabo","grupo":"Costas","dose":"3×15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Braços esticados levando o cabo de cima até o quadril; isola as dorsais.","variacoes":[],"objetivos":[]},
  {"nome":"Face pull","grupo":"Costas","dose":"3×15","pse":8,"hipertrofia":"media","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Puxa a corda do cabo até o rosto abrindo os cotovelos (pode ser com um braço); parte de trás do ombro e postura.","variacoes":["Remada alta unilateral no rosto","Remada alta na polia com corda"],"objetivos":["hipertrofia","mobilidade"]},
  {"nome":"Puxada","grupo":"Costas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Dorsais e flexores do cotovelo; força de puxada e massa nas costas.","variacoes":["Puxada aberta","Puxada com barra reta"],"objetivos":["hipertrofia","jiu"]},
  {"nome":"Remada curvada","grupo":"Costas","dose":"1×6 válida","pse":9,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Dorsais e trapézio com a lombar firme; força de puxada para quebrar a postura do oponente.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Remada inversa","grupo":"Costas","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"media","explicacao":"Costas, bíceps, escápulas e controle corporal; excelente para puxadas.","variacoes":[],"objetivos":["jiu","mobilidade"]},
  {"nome":"Remada serrote","grupo":"Costas","dose":"1×6 / lado válida","pse":9,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Com uma mão e um joelho apoiados no banco, puxa o halter até o quadril; dorsais fortes de um lado por vez. Pode apoiar na estante de halteres.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Remada unilateral no cabo","grupo":"Costas","dose":"3×5 / lado","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Um lado por vez com o tronco controlando a rotação; corrige diferenças de força entre os lados.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Crucifixo","grupo":"Peito","dose":"2–3×8","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"baixa","explosao":"baixa","explicacao":"Isola o peitoral com alongamento controlado; complemento de hipertrofia do peito.","variacoes":["Crucifixo no banco reto","Crucifixo na polia"],"objetivos":["hipertrofia"]},
  {"nome":"Flexão de braços","grupo":"Peito","dose":"3×15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Peito, tríceps e ombros com o peso do corpo; dá para fazer em qualquer lugar.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Paralela","grupo":"Peito","dose":"4×8","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Peitoral, tríceps e ombros com o peso do corpo; força de empurrar e braços firmes na base.","variacoes":[],"objetivos":[]},
  {"nome":"Supino inclinado","grupo":"Peito","dose":"3×5","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Parte de cima do peitoral e ombros; força para empurrar e criar distância.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Supino no chão","grupo":"Peito","dose":"3×20","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Peitoral e tríceps com boa estabilidade; ajuda a manter massa da parte superior.","variacoes":[],"objetivos":["jiu"]},
  {"nome":"Supino reto","grupo":"Peito","dose":"1×6 válida","pse":9,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Supino com barra no banco reto, segurando 3 s com a barra no peito em cada repetição; força de empurrar sem usar o embalo.","variacoes":["Supino reto pausado","Supino com barra"],"objetivos":["forca","hipertrofia"]},
  {"nome":"Supino reto alternado","grupo":"Peito","dose":"3×12 totais","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Peito e tríceps um braço por vez; ombro estável e core que segura a rotação.","variacoes":[],"objetivos":[]},
  {"nome":"Ananias com peso dinâmico","grupo":"Ombros","dose":"2–3×12","pse":7,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Feito junto do Cuban press, em sequência: mobilidade e controle do ombro com carga leve. Veja a execução no vídeo.","variacoes":["Ananias"],"objetivos":[]},
  {"nome":"Arremesso com elástico","grupo":"Ombros","dose":"3×10 / lado","pse":6,"hipertrofia":"baixa","mobilidade":"media","forca":"baixa","explosao":"media","explicacao":"Imita o gesto de arremessar com elástico, toalha ou peso leve; manguito rotador e ombro protegido.","variacoes":["Arremesso"],"objetivos":[]},
  {"nome":"Crucifixo inverso sentado","grupo":"Ombros","dose":"3×15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Sentado e inclinado à frente, abre os halteres para os lados; parte de trás do ombro e escápulas.","variacoes":[],"objetivos":[]},
  {"nome":"Cuban press","grupo":"Ombros","dose":"2–3×8","pse":7,"hipertrofia":"baixa","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Rotação externa e elevação do ombro; manguito rotador forte e ombro protegido.","variacoes":[],"objetivos":[]},
  {"nome":"Desenvolvimento","grupo":"Ombros","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Deltoides e tríceps; força de empurrar e desenvolvimento de ombros.","variacoes":["Desenvolvimento sentado"],"objetivos":["forca","hipertrofia","jiu"]},
  {"nome":"Desenvolvimento semiajoelhado","grupo":"Ombros","dose":"2×4 válidas","pse":9,"hipertrofia":"alta","mobilidade":"media","forca":"alta","explosao":"baixa","explicacao":"Empurrar acima da cabeça com um joelho no chão; ombro forte sem compensar com a lombar.","variacoes":[],"objetivos":[]},
  {"nome":"Elevação frontal","grupo":"Ombros","dose":"3×15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Sobe o peso à frente até a altura dos ombros, com halter ou na polia com corda; deltoide anterior.","variacoes":["Flexão de ombros sentado","Elevação frontal na polia com corda"],"objetivos":[]},
  {"nome":"Elevação lateral","grupo":"Ombros","dose":"3×12–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Complemento estético para deltoide lateral, aumentando o estímulo de hipertrofia.","variacoes":["Abdução de ombros unilateral","Elevação lateral com halteres"],"objetivos":["hipertrofia","jiu"]},
  {"nome":"Elevação lateral 180°","grupo":"Ombros","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Elevação lateral com halter que continua até os braços ficarem acima da cabeça; ombro forte em todo o arco.","variacoes":["Abdução de ombros 180°"],"objetivos":[]},
  {"nome":"Encolhimento","grupo":"Ombros","dose":"3×20","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Sobe os ombros em direção às orelhas com halteres; trapézio forte para proteger o pescoço.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Halo","grupo":"Ombros","dose":"3×10","pse":8,"hipertrofia":"media","mobilidade":"alta","forca":"media","explosao":"baixa","explicacao":"Mobilidade e estabilidade dos ombros com controle do core.","variacoes":[],"objetivos":["hipertrofia","jiu"]},
  {"nome":"Peso à frente","grupo":"Ombros","dose":"3×10","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Deltoide anterior e core segurando o peso à frente do corpo; ombros firmes para enquadrar.","variacoes":[],"objetivos":[]},
  {"nome":"Bíceps de cócoras no cabo","grupo":"Braços","dose":"3–4×12–15","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Rosca no cabo agachado na posição de cócoras; bíceps e mobilidade de quadril ao mesmo tempo.","variacoes":[],"objetivos":[]},
  {"nome":"Bíceps isométrico","grupo":"Braços","dose":"2–3×20 s","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Segurar o cotovelo dobrado sob carga; resistência para manter a pegada no controle.","variacoes":["Bíceps ISO"],"objetivos":[]},
  {"nome":"Bíceps neutro alternado","grupo":"Braços","dose":"2–3×16 totais","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Bíceps e antebraço com a pegada neutra; braço mais forte para segurar e puxar.","variacoes":[],"objetivos":[]},
  {"nome":"Extensão de punho","grupo":"Braços","dose":"3×20 / lado","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Antebraço apoiado, sobe o halter só com o punho; equilibra a força da pegada e protege o cotovelo.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Flexão de punho","grupo":"Braços","dose":"3×15","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Antebraço e pegada; aguenta mais tempo segurando a gola e a manga.","variacoes":["Flexão de punho semiajoelhado","Flexão de punho no cabo"],"objetivos":["mobilidade"]},
  {"nome":"Pega anilha","grupo":"Braços","dose":"3×30 s","pse":8,"hipertrofia":"baixa","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Segura anilhas pela borda só com os dedos; força de pinça para pegar a gola e a manga.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Rosca alternada no banco inclinado","grupo":"Braços","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Encostado no banco inclinado, alterna os braços; bíceps alongado e mais estímulo de hipertrofia.","variacoes":[],"objetivos":["hipertrofia"]},
  {"nome":"Rosca bíceps","grupo":"Braços","dose":"3×10–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Complemento direto para bíceps e hipertrofia do braço.","variacoes":[],"objetivos":["hipertrofia","jiu"]},
  {"nome":"Rosca com desenvolvimento","grupo":"Braços","dose":"3×10","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Rosca com halteres emendada num desenvolvimento acima da cabeça; bíceps e ombros no mesmo movimento.","variacoes":["Bíceps com desenvolvimento"],"objetivos":[]},
  {"nome":"Rosca concentrada","grupo":"Braços","dose":"3–4×12–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Cotovelo apoiado na coxa, sobe o halter devagar; isola o bíceps.","variacoes":["Bíceps concentrado"],"objetivos":[]},
  {"nome":"Rotação de antebraço no cabo","grupo":"Braços","dose":"2×15 / lado","pse":9,"hipertrofia":"media","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Gira o antebraço contra o cabo; força para controlar a manga e o punho do oponente.","variacoes":[],"objetivos":["mobilidade"]},
  {"nome":"Suspensão na barra","grupo":"Braços","dose":"3×30 s–1 min","pse":8,"hipertrofia":"baixa","mobilidade":"media","forca":"alta","explosao":"baixa","explicacao":"Pendurado na barra fixa; pegada resistente e ombros descomprimidos.","variacoes":["Suspensão"],"objetivos":["mobilidade"]},
  {"nome":"Tríceps","grupo":"Braços","dose":"3×10–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Complemento direto para tríceps e hipertrofia do braço.","variacoes":["Tríceps no cabo"],"objetivos":["jiu"]},
  {"nome":"Tríceps francês unilateral","grupo":"Braços","dose":"3×12 / lado","pse":8,"hipertrofia":"alta","mobilidade":"media","forca":"media","explosao":"baixa","explicacao":"Tríceps alongado acima da cabeça, um braço por vez; hipertrofia da parte de trás do braço.","variacoes":[],"objetivos":[]},
  {"nome":"Tríceps na corda","grupo":"Braços","dose":"3–4×12–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Empurra a corda do cabo para baixo abrindo as mãos no fim; tríceps.","variacoes":["Tríceps na polia com corda"],"objetivos":["hipertrofia"]},
  {"nome":"Tríceps testa","grupo":"Braços","dose":"3–4×12–15","pse":8,"hipertrofia":"alta","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Deitado, dobra os cotovelos levando o peso até a testa, com halter, no TRX ou na polia (um braço); tríceps.","variacoes":["Tríceps testa no TRX","Tríceps testa unilateral na polia"],"objetivos":["hipertrofia"]},
  {"nome":"Flexão de pescoço","grupo":"Pescoço","dose":"2–3×12","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Fortalece a frente do pescoço para resistir a estrangulamentos e à quebra de postura.","variacoes":[],"objetivos":["forca"]},
  {"nome":"Flexão lateral de pescoço","grupo":"Pescoço","dose":"2–3×15 / lado","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"media","explosao":"baixa","explicacao":"Inclina a cabeça para o lado contra uma resistência; laterais do pescoço fortes para segurar a postura na pegada de nuca.","variacoes":[],"objetivos":[]},
  {"nome":"Ponte posterior isométrica","grupo":"Pescoço","dose":"3×20–30 s","pse":8,"hipertrofia":"media","mobilidade":"baixa","forca":"alta","explosao":"baixa","explicacao":"Parte de trás do pescoço em isometria; postura firme quando puxam sua cabeça para baixo.","variacoes":[],"objetivos":[]},
  {"nome":"Cardio curto intervalado","grupo":"Cardio","dose":"2×8 tiros de 10 s","pse":9,"hipertrofia":"baixa","mobilidade":"baixa","forca":"baixa","explosao":"alta","explicacao":"8 tiros de 10 s forte com 20 s de descanso, 2 rounds com 3 min entre eles, 1 a 2 vezes por semana. Prefira airbike, bike, remo ou corrida na rua; fôlego para as explosões do rola.","variacoes":["Cardio 1","Cardio curto"],"objetivos":["forca"]},
  {"nome":"Cardio intermediário","grupo":"Cardio","dose":"3×3 min","pse":8,"hipertrofia":"baixa","mobilidade":"baixa","forca":"baixa","explosao":"media","explicacao":"3 rounds de 3 min de trabalho com 1 min 30 s de descanso, 1 vez por semana; resistência para aguentar um rola inteiro em ritmo forte.","variacoes":["Cardio 2"],"objetivos":["forca"]}
]$catalogo$::jsonb) as x(nome text, grupo text, dose text, pse smallint, hipertrofia text, mobilidade text, forca text, explosao text, explicacao text, variacoes jsonb, objetivos jsonb)
where not exists (select 1 from public.exercicios e where e.nome = x.nome or x.nome = any(e.nomes_antigos))
on conflict do nothing;

insert into public.jornadas (id, ordem, dados)
select x.id, x.ordem, x.dados from jsonb_to_recordset($catalogo$[
  {"id":"jiu","ordem":1,"dados":{"nome":"Jiu Jitsu","resumo":"Força que vai para o tatame.","nivel":"Intermediário","dias":3,"tempo":"50–60 min","equipamento":"Academia","semana":{"1":["t2"],"3":["t1"],"5":["t3"]},"treinos":{"1":{"nome":"Treino 1","subtitulo":"Costas + bíceps","objetivo":"Ganhar massa e força nas costas e nos bíceps, reforçando a pegada e o controle do tronco.","esperado":"Remada inversa e puxada em PSE 8, com técnica limpa e sem chegar à falha. Sair com costas e braços bem trabalhados e a pegada cansada, mas sem dor no cotovelo ou na lombar. Com o tempo, evoluir carga ou repetições na remada e na puxada.","impacto_jiu":"Puxadas mais fortes para controlar pegadas, quebrar a postura do oponente e manter a sua. Pegada que aguenta mais tempo no rola.","impacto_fisico":"Costas mais largas e braços maiores, com melhora da postura.","exercicios":[{"nome":"Escorpião","dose":"3×10","pse":5},{"nome":"Carregada na marcha","dose":"3×20","pse":5},{"nome":"Alcance diagonal","dose":"3×10","pse":7},{"nome":"Remada inversa","dose":"3×10","pse":8},{"nome":"Rotação no cabo","dose":"3×10 / lado","pse":8},{"nome":"Puxada","dose":"3×10","pse":8},{"nome":"Superman","dose":"3×30 s","pse":7},{"nome":"Rosca bíceps","dose":"3×10–15","pse":8}]},"2":{"nome":"Treino 2","subtitulo":"Peito, tríceps e ombro","objetivo":"Ganhar massa e força em peito, ombros e tríceps, mantendo os ombros estáveis e protegidos.","esperado":"Quadrupedia, TGU e halo deixam o ombro aquecido e firme antes do supino e do desenvolvimento. Empurrar com controle em PSE 8 e terminar sem desconforto articular no ombro.","impacto_jiu":"Mais força para enquadrar, criar distância e escapar de posições por baixo (cem quilos, montada). Base mais firme nos braços e ombros mais preparados para apoio e pressão.","impacto_fisico":"Peito e ombros mais cheios e braços mais volumosos com o tríceps.","exercicios":[{"nome":"Rolamento","dose":"3×10","pse":5},{"nome":"Quadrupedia tocando os ombros","dose":"3×20","pse":6},{"nome":"Supino no chão","dose":"3×20","pse":8},{"nome":"TGU parcial","dose":"3×5 / lado","pse":8},{"nome":"Desenvolvimento","dose":"3×10","pse":8},{"nome":"Halo","dose":"3×10","pse":8},{"nome":"Elevação lateral","dose":"3×12–15","pse":8},{"nome":"Tríceps","dose":"3×10–15","pse":8}]},"3":{"nome":"Treino 3","subtitulo":"Pernas","objetivo":"Desenvolver força e hipertrofia de pernas e cadeia posterior, com o quadril móvel para posições baixas.","esperado":"É o treino mais exigente da semana. Agachamento e deadlift com técnica impecável em PSE 8; as pernas podem ficar cansadas por 1–2 dias, por isso ele fica na sexta. Se o deadlift pesar após o agachamento, baixe para PSE 7.","impacto_jiu":"Base mais firme e mais força para quedas, raspagens, passagem com pressão e para levantar com o oponente. Quadril mais solto para guarda e transições.","impacto_fisico":"Pernas e glúteos maiores e maior gasto de energia, o que ajuda na perda de gordura rumo aos 73–74 kg.","exercicios":[{"nome":"Cócoras","dose":"3×1 min","pse":5},{"nome":"Quadril alto/baixo","dose":"3×5","pse":6},{"nome":"Agachamento","dose":"3×10","pse":8},{"nome":"Deadlift","dose":"3×10","pse":8},{"nome":"Passada para frente","dose":"3×10","pse":8},{"nome":"Panturrilha","dose":"3×10–15","pse":8}]}}}},
  {"id":"hipertrofia","ordem":2,"dados":{"nome":"Hipertrofia","resumo":"Ganhar massa muscular com 4 treinos por semana.","nivel":"Intermediário","dias":4,"tempo":"55–65 min","equipamento":"Academia (halteres, barra, cabos e máquinas)","semana":{"1":["t1"],"2":["t2"],"4":["t3"],"5":["t4"]},"treinos":{"1":{"nome":"Treino 1","subtitulo":"Peito + costas","objetivo":"Ganhar massa no peito e nas costas, trabalhando os dois lados do tronco por igual para proteger os ombros e a postura.","esperado":"Sair com o tronco cheio e cansado, sem dor no ombro. Quando completar as repetições com folga, aumentar a carga do supino e da remada.","impacto_jiu":"Mais força para empurrar e puxar o oponente, com o tronco equilibrado para aguentar a pressão por cima.","impacto_fisico":"Peito mais cheio e costas mais largas, com melhora da postura.","exercicios":[{"nome":"Mobilidade de ombros 180°","dose":"2×10","pse":5},{"nome":"Supino reto","dose":"4×8–10","pse":8},{"nome":"Remada curvada","dose":"4×8–10","pse":8},{"nome":"Supino inclinado","dose":"3×10–12","pse":8},{"nome":"Puxada","dose":"3×10–12","pse":8},{"nome":"Crucifixo","dose":"3×12","pse":8},{"nome":"Remada unilateral no cabo","dose":"3×12 / lado","pse":8},{"nome":"Flexão de braços","dose":"2×até perto da falha","pse":9}]},"2":{"nome":"Treino 2","subtitulo":"Pernas (quadríceps)","objetivo":"Coxas mais fortes e volumosas, com joelhos estáveis.","esperado":"Pernas bem cansadas e queimando na extensora. Agachar com amplitude completa antes de aumentar a carga.","impacto_jiu":"Base mais firme para passar a guarda e levantar com o oponente, e joelhos mais protegidos nas torções.","impacto_fisico":"Coxas mais grossas e definidas e panturrilhas mais fortes.","exercicios":[{"nome":"Mobilidade de quadril na cócoras","dose":"2×8","pse":5},{"nome":"Agachamento","dose":"4×8–10","pse":8},{"nome":"Agachamento búlgaro","dose":"3×10 / lado","pse":8},{"nome":"Cadeira extensora","dose":"3×12–15","pse":8},{"nome":"Step up","dose":"3×10 / lado","pse":7},{"nome":"Cadeira adutora","dose":"3×15","pse":8},{"nome":"Panturrilha","dose":"4×12–15","pse":8},{"nome":"Prancha lateral","dose":"3×30 s / lado","pse":7}]},"3":{"nome":"Treino 3","subtitulo":"Ombros + braços","objetivo":"Ombros mais largos e braços maiores, com a parte de trás do ombro em dia para não desequilibrar.","esperado":"Pump forte nos braços. Na elevação lateral, priorizar o controle em vez da carga.","impacto_jiu":"Braços que aguentam segurar a pegada e ombros mais resistentes nas chaves e nos apoios.","impacto_fisico":"Ombros mais redondos e braços mais volumosos.","exercicios":[{"nome":"Halo","dose":"2×10","pse":5},{"nome":"Desenvolvimento","dose":"4×8–10","pse":8},{"nome":"Elevação lateral","dose":"3×12–15","pse":8},{"nome":"Rosca bíceps","dose":"3×10–12","pse":8},{"nome":"Tríceps testa","dose":"3×10–12","pse":8},{"nome":"Face pull","dose":"3×15","pse":7},{"nome":"Rosca alternada no banco inclinado","dose":"3×12","pse":8},{"nome":"Tríceps na corda","dose":"3×12–15","pse":8},{"nome":"Encolhimento","dose":"3×15","pse":8}]},"4":{"nome":"Treino 4","subtitulo":"Pernas (glúteo e posterior)","objetivo":"Glúteos e posteriores de coxa fortes, que sustentam a lombar e dão potência ao quadril.","esperado":"Cansaço atrás das coxas e no glúteo, nunca na lombar. Coluna neutra no levantamento terra e no stiff.","impacto_jiu":"Quadril mais forte para raspar, fazer a ponte e escapar por baixo, com a lombar mais protegida.","impacto_fisico":"Glúteos mais firmes e posteriores de coxa mais fortes.","exercicios":[{"nome":"Mobilidade de quadril","dose":"2×8 / lado","pse":5},{"nome":"Deadlift","dose":"4×6–8","pse":8},{"nome":"Elevação de quadril","dose":"4×10","pse":8},{"nome":"Stiff","dose":"3×10","pse":8},{"nome":"Mesa flexora","dose":"3×12","pse":8},{"nome":"Abdução de quadril no cabo","dose":"3×15 / lado","pse":8},{"nome":"Agachamento sumô","dose":"3×12","pse":7},{"nome":"Dead bug","dose":"3×10 / lado","pse":6}]}}}},
  {"id":"forca","ordem":3,"dados":{"nome":"Força e potência","resumo":"Mais forte e mais explosivo, com mobilidade junto.","nivel":"Intermediário a avançado","dias":3,"tempo":"50–60 min","equipamento":"Academia (barra, halteres e barra fixa)","semana":{"1":["t1"],"3":["t2"],"5":["t3"]},"treinos":{"1":{"nome":"Treino A","subtitulo":"Corpo inteiro: agachar e empurrar","objetivo":"Força nas pernas e no empurrar, com explosão.","esperado":"Séries curtas e pesadas, com 2 a 3 minutos de descanso. Cada repetição rápida e limpa; pare a série se a velocidade cair muito.","impacto_jiu":"Explosão para entrar na queda, levantar na base e sair de posições ruins de uma vez.","impacto_fisico":"Mais força geral nas pernas e no tronco, com músculos mais densos.","exercicios":[{"nome":"Windmill semiajoelhado","dose":"2×6 / lado","pse":6},{"nome":"Dead bug","dose":"2×10 / lado","pse":6},{"nome":"Salto","dose":"3×5","pse":8},{"nome":"Agachamento","dose":"4×5","pse":8},{"nome":"Remada serrote","dose":"3×8 / lado","pse":8},{"nome":"Supino reto","dose":"4×5","pse":8},{"nome":"Step up","dose":"3×8 / lado","pse":8},{"nome":"Carregada farmer","dose":"3×30 s","pse":8}]},"2":{"nome":"Treino B","subtitulo":"Corpo inteiro: puxar e quadril","objetivo":"Força de puxada e de quadril, com potência no arranque.","esperado":"O clean é técnico: carga leve e boa execução antes de pesar. Barra fixa com o corpo controlado, sem balançar.","impacto_jiu":"Puxadas mais fortes para controlar e derrubar, e quadril potente para raspagens e levantadas.","impacto_fisico":"Costas e posteriores mais fortes, com mais potência no corpo todo.","exercicios":[{"nome":"Alcance no pé semiajoelhado","dose":"2×8 / lado","pse":5},{"nome":"Perdigueiro alternado","dose":"2×10 / lado","pse":6},{"nome":"Hang power clean","dose":"3×4","pse":8},{"nome":"Deadlift","dose":"4×5","pse":8},{"nome":"Barra fixa","dose":"4×5–8","pse":8},{"nome":"Desenvolvimento","dose":"3×6","pse":8},{"nome":"Flexão nórdica","dose":"3×5","pse":8},{"nome":"Flexão de pescoço","dose":"2×12","pse":7}]},"3":{"nome":"Cardio","subtitulo":"Intervalado curto e intermediário","objetivo":"Fôlego para aguentar mais tempo de esforço e recuperar mais rápido entre eles.","esperado":"Curto e intenso. Bike, remo, corrida ou corda. Pode ser feito depois do jiu, no lugar de um dia livre.","impacto_jiu":"Gás para o rola inteiro e recuperação mais rápida entre uma luta e outra.","impacto_fisico":"Coração e pulmões mais condicionados e mais gasto de energia.","exercicios":[{"nome":"Cardio curto intervalado","dose":"8×20 s forte / 40 s leve","pse":9},{"nome":"Cardio intermediário","dose":"3×3 min / 1 min 30 s leve","pse":8},{"nome":"Alongamento de posteriores","dose":"2×30 s","pse":4}]}}}},
  {"id":"mobilidade","ordem":4,"dados":{"nome":"Mobilidade e prevenção","resumo":"Corpo solto, articulações protegidas e pegada de ferro.","nivel":"Todos os níveis","dias":3,"tempo":"20–30 min","equipamento":"Pouco equipamento (halter ou kettlebell, elástico e barra fixa)","semana":{"1":["t1"],"3":["t2"],"5":["t3"]},"treinos":{"1":{"nome":"Mobilidade","subtitulo":"Ombros, coluna e quadril","objetivo":"Mais amplitude em ombros, coluna e quadril, para se mexer melhor no tatame e no dia a dia.","esperado":"Sair mais solto do que entrou. Movimentos lentos, sem forçar até doer.","impacto_jiu":"Guarda mais flexível, mais facilidade para girar e se encaixar e menos travas nas posições.","impacto_fisico":"Menos rigidez e dores, com uma postura melhor.","exercicios":[{"nome":"Mobilidade de ombros 180°","dose":"2×10","pse":5},{"nome":"Jefferson curl","dose":"2×8 (leve)","pse":5},{"nome":"Mobilidade de quadril na cócoras","dose":"2×8","pse":5},{"nome":"Rolamento tocando os pés","dose":"2×6","pse":5},{"nome":"Windmill semiajoelhado","dose":"2×6 / lado","pse":6},{"nome":"Mobilidade de tronco na parede","dose":"2×8 / lado","pse":5},{"nome":"Alongamento de posterior com mobilidade escapular","dose":"2×30 s","pse":4}]},"2":{"nome":"Anti-lesão","subtitulo":"Ombros, joelhos e lombar","objetivo":"Reforçar os pontos que mais sofrem no jiu: ombros, joelhos, lombar e posterior de coxa.","esperado":"Um treino de controle, não de carga. Técnica perfeita vale mais que o peso.","impacto_jiu":"Ombros e joelhos mais preparados para chaves, quedas e torções.","impacto_fisico":"Articulações mais estáveis e menos risco de lesão.","exercicios":[{"nome":"Face pull","dose":"3×15","pse":6},{"nome":"Armbar com kettlebell","dose":"2×5 / lado","pse":6},{"nome":"Ponte Copenhagen dinâmica","dose":"2×8 / lado","pse":7},{"nome":"Rotação de quadril ajoelhado","dose":"2×8 / lado","pse":6},{"nome":"Flexão nórdica","dose":"3×5","pse":8},{"nome":"Prancha lateral","dose":"2×30 s / lado","pse":7},{"nome":"Ponte invertida unilateral","dose":"2×20 s / lado","pse":7},{"nome":"Carregada farmer","dose":"3×30 s","pse":7}]},"3":{"nome":"Pegada","subtitulo":"Dedos, punhos e antebraços","objetivo":"Dedos, punhos e antebraços que aguentam o rola inteiro segurando gola e manga.","esperado":"Antebraço queimando. Descansar 1 minuto entre as séries para manter a qualidade.","impacto_jiu":"Pegadas que não abrem no fim da luta e mais controle das mangas e golas.","impacto_fisico":"Antebraços mais fortes e punhos mais firmes.","exercicios":[{"nome":"Mobilidade de punho","dose":"2×15","pse":4},{"nome":"Suspensão na barra","dose":"3×30–45 s","pse":8},{"nome":"Flexão de punho","dose":"3×15","pse":8},{"nome":"Extensão de punho","dose":"3×15","pse":7},{"nome":"Remada inversa","dose":"3×10","pse":8},{"nome":"Rotação de antebraço no cabo","dose":"2×12 / lado","pse":7},{"nome":"Carregada farmer","dose":"3×40 s","pse":8},{"nome":"Pega anilha","dose":"3×20 s","pse":8}]}}}}
]$catalogo$::jsonb) as x(id text, ordem int, dados jsonb)
on conflict (id) do nothing;
-- catalogo:fim

-- ---------- Visitantes sem login ----------
-- As regras de acesso (RLS) já bloqueiam tudo para quem não entrou; isto tira também as permissões
-- padrão do Supabase nas tabelas, como reforço.
revoke all on public.perfis, public.checkins, public.cargas, public.eventos, public.admins, public.convites, public.emails_enviados, public.exercicios, public.jornadas from anon;
