-- 007 (14/11/2026): o exercício do personal ganha o mesmo cadastro do catálogo do administrador (níveis, explicação,
-- outros nomes e vídeo do YouTube). Rodar nos dois projetos (testes e produção), depois da 006; pode rodar de novo sem estrago.

-- O mesmo cadastro do catálogo do administrador: níveis, explicação, outros nomes e vídeo do YouTube (código de 11 letras).
alter table public.exercicios_personal add column if not exists hipertrofia text not null default 'baixa' check (hipertrofia in ('baixa', 'media', 'alta'));
alter table public.exercicios_personal add column if not exists forca text not null default 'baixa' check (forca in ('baixa', 'media', 'alta'));
alter table public.exercicios_personal add column if not exists explosao text not null default 'baixa' check (explosao in ('baixa', 'media', 'alta'));
alter table public.exercicios_personal add column if not exists mobilidade text not null default 'baixa' check (mobilidade in ('baixa', 'media', 'alta'));
alter table public.exercicios_personal add column if not exists explicacao text not null default '' check (char_length(explicacao) <= 400);
alter table public.exercicios_personal add column if not exists variacoes text[] not null default '{}' check (cardinality(variacoes) <= 20);
alter table public.exercicios_personal add column if not exists video_id text not null default '' check (video_id = '' or video_id ~ '^[A-Za-z0-9_-]{11}$');

drop function if exists public.personal_exercicios();
create or replace function public.personal_exercicios()
returns table (id uuid, nome text, grupo text, dose text, pse smallint, hipertrofia text, forca text, explosao text, mobilidade text,
  explicacao text, variacoes text[], video_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query select e.id, e.nome, e.grupo, e.dose, e.pse, e.hipertrofia, e.forca, e.explosao, e.mobilidade,
      e.explicacao, e.variacoes, e.video_id from public.exercicios_personal e
    where e.personal_id = (select auth.uid()) order by lower(e.nome);
end;
$$;
create or replace function public.personal_salvar_exercicio(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_nome text := regexp_replace(trim(coalesce(p ->> 'nome', '')), '\s+', ' ', 'g');
  v_grupo text := left(trim(coalesce(p ->> 'grupo', '')), 30);
  v_dose text := left(coalesce(nullif(trim(coalesce(p ->> 'dose', '')), ''), '3×10'), 30);
  v_pse smallint := least(10, greatest(1, coalesce(nullif(p ->> 'pse', '')::smallint, 8)));
  v_why text := left(trim(coalesce(p ->> 'explicacao', '')), 400);
  v_var text[] := array(select left(trim(x), 80) from jsonb_array_elements_text(case when jsonb_typeof(p -> 'variacoes') = 'array' then p -> 'variacoes' else '[]'::jsonb end) x
    where trim(x) <> '' limit 20);
  v_video text := coalesce(p ->> 'video_id', '');
  nivel text[] := array['baixa', 'media', 'alta'];
  v_h text := case when p ->> 'hipertrofia' = any(nivel) then p ->> 'hipertrofia' else 'baixa' end;
  v_f text := case when p ->> 'forca' = any(nivel) then p ->> 'forca' else 'baixa' end;
  v_e text := case when p ->> 'explosao' = any(nivel) then p ->> 'explosao' else 'baixa' end;
  v_m text := case when p ->> 'mobilidade' = any(nivel) then p ->> 'mobilidade' else 'baixa' end;
begin
  if not public.eh_profissional() then raise exception 'Área restrita a profissionais liberados.'; end if;
  if char_length(v_nome) not between 2 and 80 then raise exception 'Dê um nome ao exercício (de 2 a 80 letras).'; end if;
  if v_video <> '' and v_video !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'Vídeo inválido: use o link do YouTube ou o código de 11 letras.'; end if;
  if exists (select 1 from public.exercicios x where lower(x.nome) = lower(v_nome)) then
    raise exception 'Esse exercício já está na biblioteca do app.';
  end if;
  if exists (select 1 from public.exercicios_personal x where x.personal_id = eu and lower(x.nome) = lower(v_nome) and x.id is distinct from v_id) then
    raise exception 'Você já tem um exercício com esse nome.';
  end if;
  if v_id is null then
    if (select count(*) from public.exercicios_personal where personal_id = eu) >= 300 then raise exception 'Limite de 300 exercícios.'; end if;
    insert into public.exercicios_personal (personal_id, nome, grupo, dose, pse, hipertrofia, forca, explosao, mobilidade, explicacao, variacoes, video_id)
    values (eu, v_nome, v_grupo, v_dose, v_pse, v_h, v_f, v_e, v_m, v_why, v_var, v_video)
    returning exercicios_personal.id into v_id;
  else
    update public.exercicios_personal set nome = v_nome, grupo = v_grupo, dose = v_dose, pse = v_pse, hipertrofia = v_h, forca = v_f,
      explosao = v_e, mobilidade = v_m, explicacao = v_why, variacoes = v_var, video_id = v_video
      where exercicios_personal.id = v_id and personal_id = eu;
    if not found then raise exception 'Exercício não encontrado.'; end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.personal_exercicios(), public.personal_salvar_exercicio(jsonb) from public, anon;
grant execute on function public.personal_exercicios(), public.personal_salvar_exercicio(jsonb) to authenticated;
