-- 009 (15/11/2026): o personal vê a foto de perfil dos alunos também quando ela foi enviada pelo app (antes, só a do Google).
-- Rodar nos dois projetos (testes e produção), depois da 008; pode rodar de novo sem estrago.

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
      case when p.foto like 'https://%' or p.foto like 'data:image/%' then p.foto else '' end
    from public.vinculos v join public.perfis p on p.id = v.aluno_id
    where v.personal_id = (select auth.uid()) and v.aceito_em is not null and v.encerrado_em is null
    order by 2;
end;
$$;
