-- 002 (13/11/2026): tipos de check-in cadastrados no painel (tabela tipos_checkin), Cardio com modalidades
-- (Bike e Corrida) e km no check-in (checkins.modalidade e checkins.km). Pode rodar de novo sem estrago.

-- Atividades além da musculação (Jiu Jitsu, Cardio, Natação...), cadastradas no painel → Tipos de check-in.
-- id é a chave gravada nos check-ins e na semana (não muda depois de criado). cor/cor_escura (opcionais) trocam a
-- cor do selo no tema claro e no escuro; sem elas fica a cor de sempre do app. modalidades: [{id, nome, km}], ex.:
-- Cardio → Bike e Corrida, as duas pedindo os km. Desativar tira o tipo do check-in e da semana; os check-ins antigos
-- continuam com o nome. A musculação (t1 a t6) vem dos treinos de cada pessoa e não entra aqui.
create table if not exists public.tipos_checkin (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,19}$' and id <> 'musc' and id !~ '^t[0-9]+$'),
  nome text not null check (char_length(nome) between 1 and 40 and nome = btrim(nome)),
  selo text not null check (char_length(selo) between 1 and 2),
  cor text check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$'),
  cor_escura text check (cor_escura is null or cor_escura ~ '^#[0-9a-fA-F]{6}$'),
  duracao smallint not null default 60 check (duracao between 5 and 600),
  ordem int not null default 0,
  ativo boolean not null default true,
  modalidades jsonb not null default '[]' check (jsonb_typeof(modalidades) = 'array' and jsonb_array_length(modalidades) <= 20),
  atualizado_em timestamptz not null default now()
);
insert into public.tipos_checkin (id, nome, selo, duracao, ordem, modalidades) values
  ('jiu', 'Jiu Jitsu', 'J', 60, 1, '[]'),
  ('muay', 'Muay Thai', 'M', 60, 2, '[]'),
  ('surf', 'Surf', 'S', 90, 3, '[]'),
  ('futebol', 'Futebol', 'F', 90, 4, '[]'),
  ('futvolei', 'Futvôlei', 'V', 90, 5, '[]'),
  -- 'bike' é o Cardio (a chave antiga continua nos check-ins e na semana).
  ('bike', 'Cardio', 'C', 30, 6, '[{"id":"bike","nome":"Bike","km":true},{"id":"corrida","nome":"Corrida","km":true}]')
on conflict (id) do nothing;
alter table public.tipos_checkin enable row level security;
revoke all on public.tipos_checkin from anon, authenticated;
grant select on public.tipos_checkin to authenticated;
drop policy if exists "tipos de check-in: todos leem" on public.tipos_checkin;
create policy "tipos de check-in: todos leem" on public.tipos_checkin for select to authenticated using (true);

-- O check-in aceita os tipos cadastrados (além de t1 a t6), guarda a modalidade e os km.
alter table public.checkins drop constraint if exists checkins_tipo_check;
alter table public.checkins add constraint checkins_tipo_check check (tipo ~ '^(t[1-6]|[a-z][a-z0-9_]{1,19})$');
alter table public.checkins add column if not exists modalidade text check (modalidade is null or modalidade ~ '^[a-z][a-z0-9_]{0,19}$');
alter table public.checkins add column if not exists km numeric(6, 2) check (km is null or (km > 0 and km <= 1000));
-- O tipo precisa estar cadastrado (ou ser t1 a t6). Um tipo desativado depois continua valendo nos check-ins antigos.
create or replace function public.checkin_tipo_valido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo !~ '^t[1-6]$' and not exists (select 1 from public.tipos_checkin t where t.id = new.tipo) then
    raise exception 'Tipo de check-in desconhecido: %', new.tipo using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.checkin_tipo_valido() from public, anon, authenticated;
drop trigger if exists checkin_tipo_valido on public.checkins;
create trigger checkin_tipo_valido before insert or update of tipo on public.checkins
  for each row execute function public.checkin_tipo_valido();

-- Id a partir de um nome: minúsculas, sem acento, "_" no lugar de espaços, até 20 letras, começando por letra.
create or replace function public.slug_tipo(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(left(regexp_replace(regexp_replace(public.chave_exercicio(t), '[^a-z0-9]+', '_', 'g'), '^[^a-z]+', ''), 20), '_+$', '');
$$;

-- Criar ou mudar um tipo (só administradores). Devolve o id. Tipo novo: id a partir do nome (sem acento).
create or replace function public.admin_salvar_tipo_checkin(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := btrim(coalesce(p ->> 'id', ''));
  v_nome text := regexp_replace(btrim(coalesce(p ->> 'nome', '')), '\s+', ' ', 'g');
  v_selo text := upper(btrim(coalesce(p ->> 'selo', '')));
  v_cor text := nullif(btrim(coalesce(p ->> 'cor', '')), '');
  v_cor_escura text := nullif(btrim(coalesce(p ->> 'cor_escura', '')), '');
  v_mods jsonb := '[]';
  v_novo boolean;
  v_outro text;
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  if char_length(v_nome) not between 1 and 40 then raise exception 'Informe o nome do tipo (até 40 letras).'; end if;
  if char_length(v_selo) not between 1 and 2 then raise exception 'Informe a letra do selo (1 ou 2 caracteres).'; end if;
  if v_cor is not null and v_cor !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Cor inválida: use o formato #RRGGBB.'; end if;
  if v_cor_escura is not null and v_cor_escura !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Cor do tema escuro inválida: use o formato #RRGGBB.'; end if;
  select t.id into v_outro from public.tipos_checkin t
    where public.chave_exercicio(t.nome) = public.chave_exercicio(v_nome) and t.id is distinct from nullif(v_id, '');
  if found then raise exception 'Já existe um tipo com esse nome.'; end if;
  -- Modalidades: nome obrigatório; id a partir do nome; km = pede a distância.
  select coalesce(jsonb_agg(jsonb_build_object('id', public.slug_tipo(m ->> 'nome'), 'nome', left(btrim(m ->> 'nome'), 30),
      'km', coalesce((m ->> 'km')::boolean, false)) order by o), '[]')
    into v_mods
    from jsonb_array_elements(coalesce(p -> 'modalidades', '[]'::jsonb)) with ordinality as x(m, o)
    where btrim(coalesce(m ->> 'nome', '')) <> '';
  if jsonb_array_length(v_mods) > 20 then raise exception 'No máximo 20 modalidades.'; end if;
  if exists (select 1 from jsonb_array_elements(v_mods) e where e ->> 'id' !~ '^[a-z][a-z0-9_]{0,19}$') then
    raise exception 'Use letras no nome de cada modalidade.';
  end if;
  if (select count(distinct e ->> 'id') from jsonb_array_elements(v_mods) e) <> jsonb_array_length(v_mods) then
    raise exception 'Há modalidades com o mesmo nome.';
  end if;

  v_novo := v_id = '' or not exists (select 1 from public.tipos_checkin t where t.id = v_id);
  if v_novo then
    if v_id = '' then
      v_id := public.slug_tipo(v_nome);
    end if;
    if v_id !~ '^[a-z][a-z0-9_]{1,19}$' or v_id = 'musc' or v_id ~ '^t[0-9]+$' then
      v_id := 'tipo_' || substr(md5(v_nome || clock_timestamp()::text), 1, 8);
    end if;
    while exists (select 1 from public.tipos_checkin t where t.id = v_id) loop
      v_id := left(v_id, 15) || '_' || substr(md5(random()::text), 1, 4);
    end loop;
    insert into public.tipos_checkin (id, nome, selo, cor, cor_escura, duracao, ordem, ativo, modalidades)
    values (v_id, v_nome, v_selo, v_cor, v_cor_escura, coalesce((p ->> 'duracao')::smallint, 60),
      coalesce((p ->> 'ordem')::int, (select coalesce(max(ordem), 0) + 1 from public.tipos_checkin)),
      coalesce((p ->> 'ativo')::boolean, true), v_mods);
  else
    update public.tipos_checkin t set nome = v_nome, selo = v_selo, cor = v_cor, cor_escura = v_cor_escura,
      duracao = coalesce((p ->> 'duracao')::smallint, t.duracao), ordem = coalesce((p ->> 'ordem')::int, t.ordem),
      ativo = coalesce((p ->> 'ativo')::boolean, t.ativo), modalidades = v_mods, atualizado_em = now()
    where t.id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.admin_salvar_tipo_checkin(jsonb), public.slug_tipo(text) from public, anon;
grant execute on function public.admin_salvar_tipo_checkin(jsonb) to authenticated;
