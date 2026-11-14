-- 006 (14/11/2026): exercícios próprios do personal (só ele vê e usa nas fichas). Tabela exercicios_personal,
-- funções personal_exercicios, personal_salvar_exercicio e personal_excluir_exercicio, e o Baixar meus dados com eles.
-- Rodar nos dois projetos (testes e produção); pode rodar de novo sem estrago.

-- Exercícios do personal: criados por ele, só aparecem para ele (no editor de fichas, junto da biblioteca do app).
-- Nos treinos vão como os da biblioteca (nome, séries e PSE). Sem acesso direto pela API: só pelas funções.
create table if not exists public.exercicios_personal (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  grupo text not null default '' check (char_length(grupo) <= 30),
  dose text not null default '3×10' check (char_length(dose) between 1 and 30),
  pse smallint not null default 8 check (pse between 1 and 10),
  criado_em timestamptz not null default now()
);
create unique index if not exists exercicios_personal_nome on public.exercicios_personal (personal_id, lower(nome));
alter table public.exercicios_personal enable row level security;
revoke all on public.exercicios_personal from anon;

-- Meus exercícios (área do personal → Fichas): listar, criar ou renomear e excluir. Excluir não mexe nas fichas nem nos
-- treinos dos alunos, que guardam o nome. Um nome que já está na biblioteca do app é recusado (use o da biblioteca).
create or replace function public.personal_exercicios()
returns table (id uuid, nome text, grupo text, dose text, pse smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_profissional() then raise exception 'acesso restrito' using errcode = '42501'; end if;
  return query select e.id, e.nome, e.grupo, e.dose, e.pse from public.exercicios_personal e
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
begin
  if not public.eh_profissional() then raise exception 'Área restrita a profissionais liberados.'; end if;
  if char_length(v_nome) not between 2 and 80 then raise exception 'Dê um nome ao exercício (de 2 a 80 letras).'; end if;
  if exists (select 1 from public.exercicios x where lower(x.nome) = lower(v_nome)) then
    raise exception 'Esse exercício já está na biblioteca do app.';
  end if;
  if exists (select 1 from public.exercicios_personal x where x.personal_id = eu and lower(x.nome) = lower(v_nome) and x.id is distinct from v_id) then
    raise exception 'Você já tem um exercício com esse nome.';
  end if;
  if v_id is null then
    if (select count(*) from public.exercicios_personal where personal_id = eu) >= 300 then raise exception 'Limite de 300 exercícios.'; end if;
    insert into public.exercicios_personal (personal_id, nome, grupo, dose, pse) values (eu, v_nome, v_grupo, v_dose, v_pse)
    returning exercicios_personal.id into v_id;
  else
    update public.exercicios_personal set nome = v_nome, grupo = v_grupo, dose = v_dose, pse = v_pse
      where exercicios_personal.id = v_id and personal_id = eu;
    if not found then raise exception 'Exercício não encontrado.'; end if;
  end if;
  return v_id;
end;
$$;
create or replace function public.personal_excluir_exercicio(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.exercicios_personal where id = p_id and personal_id = (select auth.uid());
$$;
revoke execute on function public.personal_exercicios(), public.personal_salvar_exercicio(jsonb), public.personal_excluir_exercicio(uuid) from public, anon;
grant execute on function public.personal_exercicios(), public.personal_salvar_exercicio(jsonb), public.personal_excluir_exercicio(uuid) to authenticated;

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
      from public.fichas_personal f where f.personal_id = (select auth.uid())), '[]'::jsonb),
    'exercicios_personal', coalesce((select jsonb_agg(to_jsonb(e) - 'personal_id' order by e.criado_em)
      from public.exercicios_personal e where e.personal_id = (select auth.uid())), '[]'::jsonb)
  );
$$;
revoke execute on function public.meus_dados_extras() from public, anon;
grant execute on function public.meus_dados_extras() to authenticated;
