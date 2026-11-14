-- 003 (14/11/2026): área do personal (personal.html). Cadastro do profissional com CREF, liberado pelo administrador;
-- convite do personal e aceite do aluno; fichas do personal aplicadas aos alunos; leitura dos dados dos alunos só
-- por funções que conferem o vínculo. Pode rodar de novo sem estrago.

-- ---------- Área do personal ----------
-- Profissionais: quem pode abrir a área do personal. A pessoa pede pelo personal.html (nome, CREF e UF) e um
-- administrador libera no monitoramento → Profissionais. Sem acesso direto pela API: só pelas funções abaixo.
create table if not exists public.profissionais (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  cref text not null check (char_length(cref) between 3 and 20),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  pedido_em timestamptz not null default now(),
  liberado_em timestamptz,
  bloqueado_em timestamptz,
  limite_alunos smallint not null default 30 check (limite_alunos between 1 and 500)
);
alter table public.profissionais enable row level security;

-- Vínculo personal → aluno. Nasce como convite (código de 6 letras, vale 7 dias) e vira acompanhamento quando o
-- aluno aceita. Um aluno tem um personal por vez; aceitar outro encerra o anterior. Encerrar (aluno ou personal)
-- corta o acesso na hora; a ficha continua com o aluno.
create table if not exists public.vinculos (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references auth.users (id) on delete cascade,
  codigo text not null unique check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  nome text not null default '' check (char_length(nome) <= 80),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  cancelado_em timestamptz,
  aluno_id uuid references auth.users (id) on delete cascade,
  aceito_em timestamptz,
  encerrado_em timestamptz,
  encerrado_por text check (encerrado_por is null or encerrado_por in ('aluno', 'personal', 'troca', 'admin'))
);
create unique index if not exists vinculos_um_ativo on public.vinculos (aluno_id) where aceito_em is not null and encerrado_em is null;
create index if not exists vinculos_personal on public.vinculos (personal_id);
alter table public.vinculos enable row level security;

-- Fichas do personal: até 6 treinos de até 15 exercícios (o mesmo formato de perfis.treinos) e a semana sugerida.
create table if not exists public.fichas_personal (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  descricao text not null default '' check (char_length(descricao) <= 300),
  treinos jsonb not null check (public.treinos_validos(treinos)),
  semana jsonb check (semana is null or (jsonb_typeof(semana) = 'array' and jsonb_array_length(semana) = 7)),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists fichas_personal_dono on public.fichas_personal (personal_id);
alter table public.fichas_personal enable row level security;

-- No perfil do aluno: quem acompanha (enquanto houver vínculo), quem montou os treinos, quando e de qual ficha.
-- Só as funções gravam (fora do grant update).
alter table public.perfis add column if not exists acompanhado_por uuid references auth.users (id) on delete set null;
alter table public.perfis add column if not exists treinos_por uuid references auth.users (id) on delete set null;
alter table public.perfis add column if not exists treinos_em timestamptz;
alter table public.perfis add column if not exists ficha_id uuid references public.fichas_personal (id) on delete set null;
-- Conta liberada pelo convite de um personal.
alter table public.perfis drop constraint if exists perfis_liberado_como_check;
alter table public.perfis add constraint perfis_liberado_como_check check (liberado_como is null or liberado_como in ('convite', 'pedido', 'admin', 'personal'));

-- Enquanto houver personal, os treinos do aluno são os que o personal monta: o próprio aluno não os muda.
create or replace function public.treinos_do_personal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.acompanhado_por is not null and (select auth.uid()) = new.id and new.treinos is distinct from old.treinos then
    raise exception 'Seus treinos são montados pelo seu personal.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.treinos_do_personal() from public, anon, authenticated;
drop trigger if exists perfis_treinos_do_personal on public.perfis;
create trigger perfis_treinos_do_personal before update of treinos on public.perfis
  for each row execute function public.treinos_do_personal();

-- A pessoa logada é um personal liberado (e não bloqueado)?
create or replace function public.eh_profissional()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profissionais p
    where p.usuario_id = (select auth.uid()) and p.liberado_em is not null and p.bloqueado_em is null);
$$;
-- O aluno tem vínculo ativo com a pessoa logada (personal liberado)?
create or replace function public.eh_meu_aluno(p_aluno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_profissional() and exists (select 1 from public.vinculos v
    where v.personal_id = (select auth.uid()) and v.aluno_id = p_aluno and v.aceito_em is not null and v.encerrado_em is null);
$$;
revoke execute on function public.eh_profissional(), public.eh_meu_aluno(uuid) from public, anon;
grant execute on function public.eh_profissional(), public.eh_meu_aluno(uuid) to authenticated;

-- Cadastro do profissional (pedido de acesso à área). Mudar nome, CREF ou UF depois de liberado mantém a liberação.
create or replace function public.pedir_acesso_profissional(p_nome text, p_cref text, p_uf text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare eu uuid := (select auth.uid());
begin
  if eu is null then raise exception 'Entre com o Google para pedir o acesso.'; end if;
  insert into public.profissionais (usuario_id, nome, cref, uf)
  values (eu, left(trim(coalesce(p_nome, '')), 80), upper(left(trim(coalesce(p_cref, '')), 20)), upper(trim(coalesce(p_uf, ''))))
  on conflict (usuario_id) do update set nome = excluded.nome, cref = excluded.cref, uf = excluded.uf,
    pedido_em = case when public.profissionais.liberado_em is null then now() else public.profissionais.pedido_em end;
end;
$$;
create or replace function public.meu_cadastro_profissional()
returns table (nome text, cref text, uf text, pedido_em timestamptz, liberado_em timestamptz, bloqueado_em timestamptz, limite_alunos smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nome, p.cref, p.uf, p.pedido_em, p.liberado_em, p.bloqueado_em, p.limite_alunos
  from public.profissionais p where p.usuario_id = (select auth.uid());
$$;
revoke execute on function public.pedir_acesso_profissional(text, text, text), public.meu_cadastro_profissional() from public, anon;
grant execute on function public.pedir_acesso_profissional(text, text, text), public.meu_cadastro_profissional() to authenticated;

-- Monitoramento → Profissionais (só administradores).
create or replace function public.admin_profissionais()
returns table (
  usuario_id uuid, nome text, cref text, uf text, email text, pedido_em timestamptz, liberado_em timestamptz,
  bloqueado_em timestamptz, limite_alunos smallint, alunos integer, fichas integer, convites integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select p.usuario_id, p.nome, p.cref, p.uf, coalesce(u.email, '')::text, p.pedido_em, p.liberado_em, p.bloqueado_em, p.limite_alunos,
      (select count(*)::int from public.vinculos v where v.personal_id = p.usuario_id and v.aceito_em is not null and v.encerrado_em is null),
      (select count(*)::int from public.fichas_personal f where f.personal_id = p.usuario_id),
      (select count(*)::int from public.vinculos v where v.personal_id = p.usuario_id and v.aceito_em is null and v.cancelado_em is null and v.expira_em > now())
    from public.profissionais p join auth.users u on u.id = p.usuario_id
    order by p.liberado_em nulls first, p.nome;
end;
$$;
-- Liberar (também libera a conta no app) ou bloquear a área de um profissional.
create or replace function public.admin_liberar_profissional(alvo uuid, liberar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  if liberar then
    update public.profissionais set liberado_em = coalesce(liberado_em, now()), bloqueado_em = null where usuario_id = alvo;
    update public.perfis set liberado = true, acesso_pedido_em = null,
      liberado_como = case when liberado then liberado_como else 'admin' end,
      liberado_em = case when liberado then liberado_em else now() end
      where id = alvo;
  else
    update public.profissionais set bloqueado_em = now() where usuario_id = alvo;
  end if;
end;
$$;
revoke execute on function public.admin_profissionais(), public.admin_liberar_profissional(uuid, boolean) from public, anon;
grant execute on function public.admin_profissionais(), public.admin_liberar_profissional(uuid, boolean) to authenticated;

-- ---------- Convites do personal e aceite do aluno ----------
create or replace function public.personal_criar_convite(p_nome text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  novo text;
begin
  if not public.eh_profissional() then raise exception 'Área restrita a profissionais liberados.'; end if;
  if (select count(*) from public.vinculos where personal_id = (select auth.uid()) and aceito_em is null and cancelado_em is null and expira_em > now()) >= 50 then
    raise exception 'Você já tem 50 convites aguardando. Cancele alguns antes de gerar outro.';
  end if;
  loop
    novo := '';
    for i in 1..6 loop
      novo := novo || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    exit when not exists (select 1 from public.vinculos where codigo = novo) and not exists (select 1 from public.convites where codigo = novo);
  end loop;
  insert into public.vinculos (personal_id, codigo, nome) values ((select auth.uid()), novo, left(trim(coalesce(p_nome, '')), 80));
  return novo;
end;
$$;
create or replace function public.personal_convites()
returns table (codigo text, nome text, criado_em timestamptz, expira_em timestamptz, cancelado_em timestamptz,
  aceito_em timestamptz, encerrado_em timestamptz, encerrado_por text, aluno_id uuid, aluno_nome text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select v.codigo, v.nome, v.criado_em, v.expira_em, v.cancelado_em, v.aceito_em, v.encerrado_em, v.encerrado_por, v.aluno_id,
      coalesce(nullif(trim(p.nome), ''), '')::text
    from public.vinculos v left join public.perfis p on p.id = v.aluno_id
    where v.personal_id = (select auth.uid())
    order by v.criado_em desc;
end;
$$;
create or replace function public.personal_cancelar_convite(p_codigo text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vinculos set cancelado_em = now()
  where codigo = p_codigo and personal_id = (select auth.uid()) and aceito_em is null and cancelado_em is null;
$$;

-- O que o aluno vê antes de aceitar: o nome e o CREF do personal e se o convite vale.
-- situacao: 'ok', 'invalido', 'usado', 'expirado', 'cancelado', 'proprio' ou 'lotado'.
create or replace function public.ver_convite_personal(p_codigo text)
returns table (situacao text, nome text, cref text, uf text, atual text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
  p public.profissionais;
  eu uuid := (select auth.uid());
  s text := 'ok';
begin
  select * into v from public.vinculos where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if found then select * into p from public.profissionais where usuario_id = v.personal_id; end if;
  if not found or p.liberado_em is null or p.bloqueado_em is not null then
    return query select 'invalido'::text, ''::text, ''::text, ''::text, ''::text; return;
  end if;
  if v.cancelado_em is not null then s := 'cancelado';
  elsif v.aceito_em is not null then s := case when v.aluno_id = eu and v.encerrado_em is null then 'ok' else 'usado' end;
  elsif v.expira_em < now() then s := 'expirado';
  elsif v.personal_id = eu then s := 'proprio';
  elsif (select count(*) from public.vinculos x where x.personal_id = v.personal_id and x.aceito_em is not null and x.encerrado_em is null) >= p.limite_alunos then s := 'lotado';
  end if;
  return query select s, p.nome, p.cref, p.uf,
    coalesce((select pr.nome from public.vinculos x join public.profissionais pr on pr.usuario_id = x.personal_id
      where x.aluno_id = eu and x.aceito_em is not null and x.encerrado_em is null and x.personal_id <> v.personal_id limit 1), '')::text;
end;
$$;

-- Aceitar: vira aluno do personal (encerra o vínculo anterior, se houver) e a conta fica liberada no app.
-- Devolve a situação do convite ('ok' quando deu certo).
create or replace function public.aceitar_vinculo(p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  v public.vinculos;
  s text;
begin
  if eu is null then raise exception 'Entre com o Google para aceitar o convite.'; end if;
  select c.situacao into s from public.ver_convite_personal(p_codigo) c;
  if s <> 'ok' then return s; end if;
  select * into v from public.vinculos where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')) for update;
  if v.aluno_id = eu and v.aceito_em is not null then return 'ok'; end if;
  update public.vinculos set encerrado_em = now(), encerrado_por = 'troca'
    where aluno_id = eu and aceito_em is not null and encerrado_em is null;
  update public.vinculos set aluno_id = eu, aceito_em = now() where id = v.id;
  update public.perfis set acompanhado_por = v.personal_id, liberado = true, acesso_pedido_em = null,
    liberado_como = case when liberado then liberado_como else 'personal' end,
    liberado_em = case when liberado then liberado_em else now() end
    where id = eu;
  return 'ok';
end;
$$;
-- Quem acompanha a pessoa logada (vazio = ninguém).
create or replace function public.meu_personal()
returns table (nome text, cref text, uf text, desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nome, p.cref, p.uf, v.aceito_em
  from public.vinculos v join public.profissionais p on p.usuario_id = v.personal_id
  where v.aluno_id = (select auth.uid()) and v.aceito_em is not null and v.encerrado_em is null;
$$;
-- Encerrar pelo aluno (Você → Meu personal) ou pelo personal (ficha do aluno). Os treinos ficam com o aluno.
create or replace function public.encerrar_vinculo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vinculos set encerrado_em = now(), encerrado_por = 'aluno'
    where aluno_id = (select auth.uid()) and aceito_em is not null and encerrado_em is null;
  update public.perfis set acompanhado_por = null where id = (select auth.uid());
end;
$$;
create or replace function public.personal_encerrar_vinculo(p_aluno uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_meu_aluno(p_aluno) then raise exception 'Este aluno não está com você.'; end if;
  update public.vinculos set encerrado_em = now(), encerrado_por = 'personal'
    where aluno_id = p_aluno and personal_id = (select auth.uid()) and aceito_em is not null and encerrado_em is null;
  update public.perfis set acompanhado_por = null where id = p_aluno;
end;
$$;
revoke execute on function public.personal_criar_convite(text), public.personal_convites(), public.personal_cancelar_convite(text),
  public.ver_convite_personal(text), public.aceitar_vinculo(text), public.meu_personal(), public.encerrar_vinculo(),
  public.personal_encerrar_vinculo(uuid) from public, anon;
grant execute on function public.personal_criar_convite(text), public.personal_convites(), public.personal_cancelar_convite(text),
  public.ver_convite_personal(text), public.aceitar_vinculo(text), public.meu_personal(), public.encerrar_vinculo(),
  public.personal_encerrar_vinculo(uuid) to authenticated;

-- ---------- Monitoramento do personal (só os próprios alunos) ----------
-- Mesmo formato das funções do administrador, para o personal.html reaproveitar o painel. Sem e-mail, sem
-- observações e sem fotos; cargas sim (o aluno aceita isso no convite).
create or replace function public.personal_alunos()
returns table (
  id uuid, nome text, email text, cadastro timestamptz, ultimo_acesso timestamptz, acessos integer,
  semana jsonb, dias_jiu smallint[], sem_peso text[], treinos jsonb, treinos_por_mim boolean, treinos_em timestamptz,
  ficha_id uuid, vinculado_em timestamptz, foto text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select p.id, coalesce(nullif(trim(p.nome), ''), 'Aluno sem nome')::text, ''::text, v.aceito_em, p.ultimo_acesso, p.acessos,
      p.semana, p.dias_jiu, p.sem_peso, p.treinos, p.treinos_por = (select auth.uid()), p.treinos_em, p.ficha_id, v.aceito_em,
      case when p.foto like 'http%' then p.foto else '' end
    from public.vinculos v join public.perfis p on p.id = v.aluno_id
    where v.personal_id = (select auth.uid()) and v.aceito_em is not null and v.encerrado_em is null
    order by 2;
end;
$$;
create or replace function public.personal_checkins(desde timestamp default null)
returns table (id uuid, usuario_id uuid, tipo text, inicio timestamp, fim timestamp, sem_horario boolean, retroativo boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select c.id, c.usuario_id, c.tipo, c.inicio, c.fim, c.sem_horario, c.retroativo
    from public.checkins c
    join public.vinculos v on v.aluno_id = c.usuario_id and v.personal_id = (select auth.uid()) and v.aceito_em is not null and v.encerrado_em is null
    where desde is null or c.inicio >= desde
    order by c.inicio, c.id;
end;
$$;
-- Uso do app pelos alunos: só o que importa para o acompanhamento, sem aparelho nem navegador.
create or replace function public.personal_eventos(desde timestamptz default null)
returns table (usuario_id uuid, tipo text, dados jsonb, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select e.usuario_id, e.tipo,
      jsonb_strip_nulls(jsonb_build_object('exercicio', e.dados -> 'exercicio', 'tipo', e.dados -> 'tipo', 'retroativo', e.dados -> 'retroativo',
        'sem_peso', e.dados -> 'sem_peso', 'ativo', e.dados -> 'ativo')),
      e.criado_em
    from public.eventos e
    join public.vinculos v on v.aluno_id = e.usuario_id and v.personal_id = (select auth.uid()) and v.aceito_em is not null and v.encerrado_em is null
    where e.tipo in ('sessao', 'recorde', 'exercicio_concluido', 'checkin_criado', 'checkin_editado', 'checkin_excluido', 'checkin_encerrado', 'semana_alterada', 'sem_peso')
      and (desde is null or e.criado_em >= desde)
    order by e.criado_em, e.id;
end;
$$;
create or replace function public.personal_cargas()
returns table (usuario_id uuid, data date, treino text, series jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select k.usuario_id, k.data, k.treino, k.series
    from public.cargas k
    join public.vinculos v on v.aluno_id = k.usuario_id and v.personal_id = (select auth.uid()) and v.aceito_em is not null and v.encerrado_em is null
    order by k.usuario_id, k.data, k.treino;
end;
$$;
revoke execute on function public.personal_alunos(), public.personal_checkins(timestamp), public.personal_eventos(timestamptz), public.personal_cargas() from public, anon;
grant execute on function public.personal_alunos(), public.personal_checkins(timestamp), public.personal_eventos(timestamptz), public.personal_cargas() to authenticated;

-- ---------- Fichas do personal ----------
create or replace function public.personal_fichas()
returns table (id uuid, nome text, descricao text, treinos jsonb, semana jsonb, criado_em timestamptz, atualizado_em timestamptz, alunos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query
    select f.id, f.nome, f.descricao, f.treinos, f.semana, f.criado_em, f.atualizado_em,
      (select count(*)::int from public.perfis p where p.ficha_id = f.id and p.acompanhado_por = (select auth.uid()))
    from public.fichas_personal f where f.personal_id = (select auth.uid())
    order by f.atualizado_em desc;
end;
$$;
-- p: { id (vazio = nova), nome, descricao, treinos, semana }. Devolve o id.
create or replace function public.personal_salvar_ficha(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_semana jsonb := case when jsonb_typeof(p -> 'semana') = 'array' then p -> 'semana' else null end;
begin
  if not public.eh_profissional() then raise exception 'Área restrita a profissionais liberados.'; end if;
  if v_id is null then
    if (select count(*) from public.fichas_personal where personal_id = eu) >= 200 then raise exception 'Limite de 200 fichas.'; end if;
    insert into public.fichas_personal (personal_id, nome, descricao, treinos, semana)
    values (eu, left(trim(coalesce(p ->> 'nome', '')), 60), left(trim(coalesce(p ->> 'descricao', '')), 300), p -> 'treinos', v_semana)
    returning fichas_personal.id into v_id;
  else
    update public.fichas_personal set nome = left(trim(coalesce(p ->> 'nome', '')), 60), descricao = left(trim(coalesce(p ->> 'descricao', '')), 300),
      treinos = p -> 'treinos', semana = v_semana, atualizado_em = now()
    where fichas_personal.id = v_id and personal_id = eu;
    if not found then raise exception 'Ficha não encontrada.'; end if;
  end if;
  return v_id;
end;
$$;
create or replace function public.personal_excluir_ficha(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.fichas_personal where id = p_id and personal_id = (select auth.uid());
$$;
-- Aplica uma ficha aos alunos escolhidos (só os do próprio personal). A versão anterior de cada um fica guardada
-- (Restaurar versão anterior no app). p_semana: também troca a semana do aluno pela sugerida na ficha.
create or replace function public.personal_aplicar_ficha(p_ficha uuid, p_alunos uuid[], p_semana boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  f public.fichas_personal;
  n int;
begin
  if not public.eh_profissional() then raise exception 'Área restrita a profissionais liberados.'; end if;
  select * into f from public.fichas_personal where id = p_ficha and personal_id = eu;
  if not found then raise exception 'Ficha não encontrada.'; end if;
  update public.perfis p set
    treinos_anterior = jsonb_build_object('treinos', p.treinos, 'semana', p.semana, 'em', now(), 'jornada', p.jornada),
    treinos = f.treinos,
    semana = case when p_semana and f.semana is not null then f.semana else p.semana end,
    jornada = null, ficha_id = f.id, treinos_por = eu, treinos_em = now()
  where p.id = any(p_alunos) and p.acompanhado_por = eu and public.eh_meu_aluno(p.id);
  get diagnostics n = row_count;
  return n;
end;
$$;
-- Ajuste só para um aluno (a ficha de origem continua anotada). p_semana vazio = mantém a semana do aluno.
create or replace function public.personal_salvar_treinos(p_aluno uuid, p_treinos jsonb, p_semana jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_meu_aluno(p_aluno) then raise exception 'Este aluno não está com você.'; end if;
  update public.perfis p set
    treinos_anterior = jsonb_build_object('treinos', p.treinos, 'semana', p.semana, 'em', now(), 'jornada', p.jornada),
    treinos = p_treinos,
    semana = case when jsonb_typeof(p_semana) = 'array' then p_semana else p.semana end,
    jornada = null, treinos_por = (select auth.uid()), treinos_em = now()
  where p.id = p_aluno;
end;
$$;
revoke execute on function public.personal_fichas(), public.personal_salvar_ficha(jsonb), public.personal_excluir_ficha(uuid),
  public.personal_aplicar_ficha(uuid, uuid[], boolean), public.personal_salvar_treinos(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.personal_fichas(), public.personal_salvar_ficha(jsonb), public.personal_excluir_ficha(uuid),
  public.personal_aplicar_ficha(uuid, uuid[], boolean), public.personal_salvar_treinos(uuid, jsonb, jsonb) to authenticated;

-- Baixar meus dados: inclui o acompanhamento (como aluno) e o cadastro, os convites e as fichas (como personal).
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
      from public.emails_enviados m where m.usuario_id = (select auth.uid())), '[]'::jsonb),
    'acompanhamento', coalesce((select jsonb_agg(jsonb_build_object('personal', p.nome, 'cref', p.cref, 'uf', p.uf,
        'aceito_em', v.aceito_em, 'encerrado_em', v.encerrado_em) order by v.aceito_em)
      from public.vinculos v join public.profissionais p on p.usuario_id = v.personal_id
      where v.aluno_id = (select auth.uid()) and v.aceito_em is not null), '[]'::jsonb),
    'profissional', (select to_jsonb(p) - 'usuario_id' from public.profissionais p where p.usuario_id = (select auth.uid())),
    'fichas', coalesce((select jsonb_agg(to_jsonb(f) - 'personal_id' order by f.criado_em)
      from public.fichas_personal f where f.personal_id = (select auth.uid())), '[]'::jsonb)
  );
$$;
revoke execute on function public.meus_dados_extras() from public, anon;
grant execute on function public.meus_dados_extras() to authenticated;

revoke all on public.profissionais, public.vinculos, public.fichas_personal from anon;
