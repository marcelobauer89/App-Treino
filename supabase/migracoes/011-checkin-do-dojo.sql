-- 011 (17/11/2026): check-in automático vindo de um app parceiro (o app do dojo). A pessoa gera um código em
-- Você → Integrações e cola no app do dojo; a cada check-in lá, o app do dojo chama a função checkin-externo,
-- que grava aqui um check-in de jiu. Pode rodar de novo sem estrago.

-- ---------- Integrações com apps parceiros (check-in automático) ----------
-- Cada parceiro tem uma chave (só o hash fica no banco), que o app dele manda a cada check-in. O parceiro é
-- cadastrado à mão no SQL Editor (ver docs/INTEGRACAO-DOJO.md); a chave vai para o desenvolvedor fora do app.
create table if not exists public.parceiros (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,19}$'),
  nome text not null check (char_length(nome) between 1 and 40 and nome = btrim(nome)),
  chave_hash text not null check (chave_hash ~ '^[0-9a-f]{64}$'),
  tipo_checkin text not null default 'jiu' references public.tipos_checkin (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
-- Quem ligou cada parceiro: só o hash do código de vínculo fica no banco (o código aparece uma vez no app).
create table if not exists public.integracoes (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  parceiro text not null references public.parceiros (id) on delete cascade,
  codigo_hash text not null unique check (codigo_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now(),
  ultimo_checkin_em timestamptz,
  primary key (usuario_id, parceiro)
);
-- Sem políticas: ninguém lê nem grava direto pela API; só pelas funções abaixo.
alter table public.parceiros enable row level security;
alter table public.integracoes enable row level security;
revoke all on public.parceiros, public.integracoes from anon, authenticated;

-- De onde veio o check-in ('app' ou o id do parceiro) e o id dele no parceiro (o mesmo check-in não entra duas vezes).
alter table public.checkins add column if not exists origem text not null default 'app' check (origem ~ '^[a-z][a-z0-9_]{1,19}$');
alter table public.checkins add column if not exists id_externo text check (id_externo is null or char_length(id_externo) between 1 and 100);
create unique index if not exists checkins_id_externo on public.checkins (usuario_id, origem, id_externo) where id_externo is not null;

-- Hash usado para a chave do parceiro e o código de vínculo: maiúsculas, sem espaços nem traços.
create or replace function public.hash_integracao(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(t, ''), '[\s-]', '', 'g')), 'UTF8')), 'hex');
$$;
revoke execute on function public.hash_integracao(text) from public, anon, authenticated;

-- Os parceiros ativos e se a pessoa já ligou cada um (Você → Integrações).
create or replace function public.minhas_integracoes()
returns table (parceiro text, nome text, tipo_checkin text, conectado_em timestamptz, ultimo_checkin_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.tipo_checkin, i.criado_em, i.ultimo_checkin_em
  from public.parceiros p
  left join public.integracoes i on i.parceiro = p.id and i.usuario_id = (select auth.uid())
  where p.ativo
  order by p.nome;
$$;

-- Gera (ou troca) o código de vínculo da pessoa com o parceiro: "GT-XXXX-XXXX". Um código novo invalida o anterior.
create or replace function public.gerar_codigo_integracao(p_parceiro text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  novo text;
begin
  if eu is null then raise exception 'Entre com o Google para ligar a integração.'; end if;
  if not public.liberado() then raise exception 'Sua conta ainda não foi liberada.' using errcode = '42501'; end if;
  if not exists (select 1 from public.parceiros where id = p_parceiro and ativo) then raise exception 'App parceiro não encontrado.'; end if;
  loop
    novo := '';
    for i in 1..8 loop
      novo := novo || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    novo := 'GT-' || left(novo, 4) || '-' || right(novo, 4);
    exit when not exists (select 1 from public.integracoes where codigo_hash = public.hash_integracao(novo));
  end loop;
  insert into public.integracoes (usuario_id, parceiro, codigo_hash) values (eu, p_parceiro, public.hash_integracao(novo))
  on conflict (usuario_id, parceiro) do update set codigo_hash = excluded.codigo_hash, criado_em = now();
  return novo;
end;
$$;

-- Desliga a integração: o código para de valer na hora. Os check-ins que já vieram continuam.
create or replace function public.desconectar_integracao(p_parceiro text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.integracoes where usuario_id = (select auth.uid()) and parceiro = p_parceiro;
$$;

-- Chamada só pela função checkin-externo (chave de serviço). Respostas: 'criado', 'duplicado', 'chave_invalida',
-- 'codigo_invalido', 'nao_liberado' e 'dados_invalidos'. O horário chega com fuso e é guardado no horário de Brasília,
-- como os check-ins do app. Sem fim, usa a duração padrão do tipo. Um check-in do mesmo tipo começando até 2 h antes
-- ou depois (feito no app, por exemplo) conta como o mesmo treino e não é gravado de novo.
create or replace function public.registrar_checkin_externo(
  p_chave text, p_codigo text, p_id_externo text, p_inicio timestamptz, p_fim timestamptz default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.parceiros;
  i public.integracoes;
  ini timestamp;
  fim timestamp;
  dur smallint;
begin
  select * into p from public.parceiros where chave_hash = public.hash_integracao(p_chave) and ativo;
  if not found or coalesce(p_chave, '') = '' then return 'chave_invalida'; end if;
  select * into i from public.integracoes where codigo_hash = public.hash_integracao(p_codigo) and parceiro = p.id for update;
  if not found or coalesce(p_codigo, '') = '' then return 'codigo_invalido'; end if;
  if not coalesce((select liberado from public.perfis where id = i.usuario_id), false) then return 'nao_liberado'; end if;
  if p_inicio is null or p_inicio > now() + interval '1 day' or p_inicio < now() - interval '400 days'
    or char_length(coalesce(p_id_externo, '')) not between 1 and 100
    or (p_fim is not null and (p_fim <= p_inicio or p_fim > p_inicio + interval '6 hours')) then
    return 'dados_invalidos';
  end if;
  ini := date_trunc('minute', p_inicio at time zone 'America/Sao_Paulo');
  select duracao into dur from public.tipos_checkin where id = p.tipo_checkin;
  fim := coalesce(date_trunc('minute', p_fim at time zone 'America/Sao_Paulo'), ini + make_interval(mins => coalesce(dur, 60)));
  if exists (select 1 from public.checkins c where c.usuario_id = i.usuario_id
      and ((c.origem = p.id and c.id_externo = p_id_externo)
        or (c.tipo = p.tipo_checkin and c.inicio between ini - interval '2 hours' and ini + interval '2 hours'))) then
    return 'duplicado';
  end if;
  insert into public.checkins (usuario_id, tipo, inicio, fim, origem, id_externo)
    values (i.usuario_id, p.tipo_checkin, ini, fim, p.id, p_id_externo);
  update public.integracoes set ultimo_checkin_em = now() where usuario_id = i.usuario_id and parceiro = p.id;
  return 'criado';
end;
$$;

revoke execute on function public.minhas_integracoes(), public.gerar_codigo_integracao(text), public.desconectar_integracao(text)
  from public, anon;
grant execute on function public.minhas_integracoes(), public.gerar_codigo_integracao(text), public.desconectar_integracao(text)
  to authenticated;
revoke execute on function public.registrar_checkin_externo(text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_checkin_externo(text, text, text, timestamptz, timestamptz) to service_role;

-- Baixar meus dados: inclui o acompanhamento (como aluno), o cadastro, os convites e as fichas (como personal) e as integrações.
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
      from public.fichas_personal f where f.personal_id = (select auth.uid())), '[]'::jsonb),
    'exercicios_personal', coalesce((select jsonb_agg(to_jsonb(e) - 'personal_id' order by e.criado_em)
      from public.exercicios_personal e where e.personal_id = (select auth.uid())), '[]'::jsonb),
    'integracoes', coalesce((select jsonb_agg(jsonb_build_object('parceiro', p.nome, 'conectado_em', i.criado_em,
        'ultimo_checkin_em', i.ultimo_checkin_em) order by i.criado_em)
      from public.integracoes i join public.parceiros p on p.id = i.parceiro where i.usuario_id = (select auth.uid())), '[]'::jsonb)
  );
$$;
revoke execute on function public.meus_dados_extras() from public, anon;
grant execute on function public.meus_dados_extras() to authenticated;
