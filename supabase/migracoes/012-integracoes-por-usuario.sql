-- 012 (18/11/2026): integrações (Você → Integrações, app do dojo) escondidas por padrão. O administrador libera
-- para cada pessoa no painel → Usuários → detalhe. Pode rodar de novo sem estrago.

alter table public.perfis add column if not exists integracoes_liberadas boolean not null default false;

-- O painel passa a receber integracoes_liberadas (outro retorno: apagar antes de recriar).
drop function if exists public.admin_usuarios();
create function public.admin_usuarios()
returns table (
  id uuid, nome text, email text, cadastro timestamptz, ultimo_acesso timestamptz, acessos integer,
  semana jsonb, dias_jiu smallint[], sem_peso text[], emails_resumo boolean,
  liberado boolean, acesso_pedido_em timestamptz, liberado_como text, liberado_em timestamptz,
  videos_liberados boolean, integracoes_liberadas boolean
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
      p.liberado, p.acesso_pedido_em, p.liberado_como, p.liberado_em, p.videos_liberados, p.integracoes_liberadas
    from public.perfis p join auth.users u on u.id = p.id
    order by 2;
end;
$$;
revoke execute on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;

-- Os parceiros ativos e se a pessoa já ligou cada um (Você → Integrações). Vazio para quem o administrador
-- não liberou as integrações: a linha some do app.
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
    and coalesce((select integracoes_liberadas from public.perfis where id = (select auth.uid())), false)
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
  if not coalesce((select integracoes_liberadas from public.perfis where id = eu), false) then
    raise exception 'Integrações não liberadas para a sua conta.' using errcode = '42501';
  end if;
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
  -- Conta liberada e integrações liberadas pelo administrador (tirar o recurso mantém o vínculo, mas recusa).
  if not coalesce((select liberado and integracoes_liberadas from public.perfis where id = i.usuario_id), false) then
    return 'nao_liberado';
  end if;
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

-- Liberar ou tirar as integrações de um usuário (só administradores), no painel → Usuários → detalhe.
create or replace function public.admin_liberar_integracoes(alvo uuid, liberar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  update public.perfis set integracoes_liberadas = coalesce(liberar, false) where id = alvo;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end;
$$;
revoke execute on function public.admin_liberar_integracoes(uuid, boolean) from public, anon;
grant execute on function public.admin_liberar_integracoes(uuid, boolean) to authenticated;
