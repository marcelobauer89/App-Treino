-- Regras de acesso do banco, conferidas como o app conversa com ele (papel authenticated + quem está logado).
-- Cada bloco para o teste com "FALHOU: …" se a regra não estiver valendo. Tudo roda numa transação desfeita no fim.
\set ON_ERROR_STOP 1
begin;

-- Pessoas de teste: u1 é administrador; u2 e u3 usam o app.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@exemplo.com', '{"full_name":"Admin"}'),
  ('22222222-2222-2222-2222-222222222222', 'ana@exemplo.com', '{"full_name":"Ana"}'),
  ('33333333-3333-3333-3333-333333333333', 'bruno@exemplo.com', '{"full_name":"Bruno"}');
update public.perfis set liberado = true;
insert into public.admins (usuario_id) values ('11111111-1111-1111-1111-111111111111');
insert into public.videos_exercicios (exercicio, video_id) values ('Supino reto', 'abcdefghijk'), ('Agachamento', 'ABCDEFGHIJK');
insert into public.checkins (id, usuario_id, tipo, inicio, fim)
  values (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'jiu', '2026-11-01 19:00', '2026-11-01 20:00');

do $$ begin
  if (select count(*) from public.perfis) <> 3 then raise exception 'FALHOU: o perfil é criado sozinho para cada conta nova'; end if;
end $$;

-- ---------- Usuária comum (Ana) ----------
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); end $$;

do $$ declare n int; begin
  -- Pode salvar os próprios treinos, semana, objetivo, temporizador e novidades ocultas (o grant de jornada já faltou uma vez).
  update public.perfis set treinos = '{"1":{"nome":"Treino 1","subtitulo":"","exercicios":[{"nome":"Supino reto","dose":"3×10","pse":8}]}}',
    semana = '[[], ["t1"], ["jiu"], [], [], [], []]', jornada = 'hipertrofia', tema = 'escuro',
    temporizador = '{"ativo":true,"segundos":60,"vibrar":true}', novidades_ocultas = '{evolucao}'
    where id = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: a pessoa salva os próprios treinos, semana e objetivo (atualizou % linhas)', n; end if;

  -- Não muda o perfil de outra pessoa (a regra de acesso esconde a linha).
  update public.perfis set tema = 'claro' where id = '33333333-3333-3333-3333-333333333333';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: não altera o perfil de outra pessoa'; end if;
end $$;

do $$ begin
  begin update public.perfis set liberado = false where id = auth.uid();
    raise exception 'FALHOU: a pessoa não muda o próprio acesso (liberado)';
  exception when insufficient_privilege then null; end;
  begin update public.perfis set videos_liberados = true where id = auth.uid();
    raise exception 'FALHOU: a pessoa não se libera os vídeos sozinha';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.videos_exercicios;
    raise exception 'FALHOU: a lista de vídeos não pode ser lida direto';
  exception when insufficient_privilege then null; end;
end $$;

do $$ begin
  if (select count(*) from public.meus_videos()) <> 0 then raise exception 'FALHOU: sem liberação, nenhum vídeo chega'; end if;
  if (select count(*) from public.checkins) <> 0 then raise exception 'FALHOU: só vê os próprios check-ins'; end if;
  insert into public.checkins (id, tipo, inicio, fim) values (gen_random_uuid(), 't1', '2026-11-02 07:00', '2026-11-02 08:00');
  -- Futebol e Futvôlei são aceitos.
  insert into public.checkins (id, tipo, inicio, fim) values (gen_random_uuid(), 'futebol', '2026-11-03 19:00', '2026-11-03 20:30'),
    (gen_random_uuid(), 'futvolei', '2026-11-04 07:00', '2026-11-04 08:30');
  begin insert into public.checkins (id, tipo, inicio, fim) values (gen_random_uuid(), 'cali', '2026-11-02 07:00', '2026-11-02 08:00');
    raise exception 'FALHOU: tipo de check-in que não existe (cali) é recusado';
  exception when check_violation then null; end;
end $$;

do $$ begin
  begin perform * from public.admin_usuarios();
    raise exception 'FALHOU: funções do painel recusam quem não é administrador';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_liberar_videos('22222222-2222-2222-2222-222222222222', true);
    raise exception 'FALHOU: só o administrador libera vídeos';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- Catálogo: todo mundo lê; ninguém além do administrador muda.
do $$ begin
  if (select count(*) from public.exercicios where ativo) < 100 then raise exception 'FALHOU: a pessoa lê o catálogo de exercícios'; end if;
  if (select count(*) from public.jornadas) <> 4 then raise exception 'FALHOU: a pessoa lê os objetivos prontos'; end if;
  begin update public.exercicios set dose = '9×9' where nome = 'Puxada';
    raise exception 'FALHOU: a pessoa não muda o catálogo';
  exception when insufficient_privilege then null; end;
  begin insert into public.exercicios (nome, grupo) values ('Inventado', 'Core');
    raise exception 'FALHOU: a pessoa não cria exercício';
  exception when insufficient_privilege then null; end;
  begin perform * from public.admin_exercicios();
    raise exception 'FALHOU: só o administrador vê a lista do painel';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_salvar_exercicio('Puxada', '{"nome":"Puxada","grupo":"Costas"}');
    raise exception 'FALHOU: só o administrador salva exercício';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- ---------- Administrador ----------
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true); end $$;

do $$ begin
  if (select count(*) from public.admin_usuarios()) <> 3 then raise exception 'FALHOU: o painel vê todos os usuários'; end if;
  if (select count(*) from public.admin_checkins()) <> 4 then raise exception 'FALHOU: o painel vê os check-ins de todos'; end if;
  perform public.admin_liberar_videos('22222222-2222-2222-2222-222222222222', true);
end $$;

-- Catálogo pelo painel: contagem de uso, criar, renomear (nome antigo e vídeo acompanham), repetidos e desativar.
do $$ declare n int; r record; begin
  if (select count(*) from public.admin_exercicios()) <> (select count(*) from public.exercicios) then raise exception 'FALHOU: o painel vê todos os exercícios'; end if;
  if (select usos from public.admin_exercicios() where nome = 'Supino reto') <> 1 then raise exception 'FALHOU: conta quem tem o exercício nos treinos'; end if;
  -- Admin e Bruno estão no plano pronto (treinos vazio): contam nos exercícios do Jiu Jitsu.
  if (select usos from public.admin_exercicios() where nome = 'Puxada') <> 2 then raise exception 'FALHOU: quem usa o plano pronto conta no uso'; end if;
  if (select video_id from public.admin_exercicios() where nome = 'Agachamento') <> 'ABCDEFGHIJK' then raise exception 'FALHOU: o painel vê o vídeo do exercício'; end if;

  perform public.admin_salvar_exercicio(null, '{"nome":"  exercício   de teste ","grupo":"Core","dose":"3×12","pse":7,"hipertrofia":"media","variacoes":["outro nome"],"objetivos":["forca","jiu"],"video_id":"zzzzzzzzzzz"}');
  select * into r from public.admin_exercicios() where nome = 'Exercício de teste';
  if r is null or r.dose <> '3×12' or r.pse <> 7 or r.hipertrofia <> 'media' or r.video_id <> 'zzzzzzzzzzz' or r.variacoes <> array['Outro nome'] then
    raise exception 'FALHOU: cria exercício com os campos e o vídeo (nome e outros nomes padronizados)'; end if;
  if r.objetivos <> array['forca', 'jiu'] then raise exception 'FALHOU: grava os objetivos do exercício'; end if;
  if (select objetivos from public.admin_exercicios() where nome = 'Puxada') <> array['hipertrofia', 'jiu'] then raise exception 'FALHOU: carga inicial com os objetivos em que o exercício aparece'; end if;

  perform public.admin_salvar_exercicio('Agachamento', '{"nome":"Agachamento livre","grupo":"Pernas","dose":"3×10","pse":8,"hipertrofia":"alta","forca":"alta"}');
  if not exists (select 1 from public.exercicios where nome = 'Agachamento livre' and 'Agachamento' = any(nomes_antigos)) then raise exception 'FALHOU: renomear guarda o nome antigo'; end if;
  if exists (select 1 from public.exercicios where nome = 'Agachamento') then raise exception 'FALHOU: renomear não duplica'; end if;
  if (select video_id from public.admin_exercicios() where nome = 'Agachamento livre') is distinct from 'ABCDEFGHIJK' then raise exception 'FALHOU: o vídeo acompanha o exercício renomeado'; end if;
  if (select usos from public.admin_exercicios() where nome = 'Agachamento livre') <> 2 then raise exception 'FALHOU: o uso conta pelo nome antigo também'; end if;

  begin perform public.admin_salvar_exercicio(null, '{"nome":"supino RETO","grupo":"Peito"}');
    raise exception 'FALHOU: não cria nome repetido (sem diferenciar maiúsculas)';
  exception when raise_exception then if sqlerrm not like 'Já existe%' then raise; end if; end;
  begin perform public.admin_salvar_exercicio(null, '{"nome":"Agachámento","grupo":"Pernas"}');
    raise exception 'FALHOU: não reaproveita o nome antigo de outro exercício';
  exception when raise_exception then if sqlerrm not like 'Esse nome já foi%' then raise; end if; end;
  begin perform public.admin_salvar_exercicio(null, '{"nome":"Errado","grupo":"Inventado"}');
    raise exception 'FALHOU: grupo que não existe é recusado';
  exception when check_violation then null; end;
  begin perform public.admin_salvar_exercicio('Puxada', '{"nome":"Puxada","grupo":"Costas","video_id":"curto"}');
    raise exception 'FALHOU: vídeo inválido é recusado';
  exception when raise_exception then if sqlerrm not like 'Vídeo inválido%' then raise; end if; end;

  perform public.admin_salvar_exercicio('Exercício de teste', '{"nome":"Exercício de teste","grupo":"Core","ativo":false,"video_id":""}');
  if (select ativo from public.exercicios where nome = 'Exercício de teste') then raise exception 'FALHOU: desativa o exercício'; end if;
  if (select video_id from public.admin_exercicios() where nome = 'Exercício de teste') is not null then raise exception 'FALHOU: video_id vazio tira o vídeo'; end if;
  begin delete from public.exercicios where nome = 'Exercício de teste';
    raise exception 'FALHOU: nem o administrador apaga direto pela API';
  exception when insufficient_privilege then null; end;
end $$;

-- Excluir: só exercício fora dos treinos e dos objetivos prontos; excluído não volta com a carga inicial.
do $$ begin
  begin perform public.admin_excluir_exercicio('Supino reto');
    raise exception 'FALHOU: não exclui exercício que está nos treinos de alguém';
  exception when raise_exception then if sqlerrm not like 'Está nos treinos de 1 conta%' then raise; end if; end;
  begin perform public.admin_excluir_exercicio('Escorpião');
    raise exception 'FALHOU: não exclui exercício do plano pronto em uso';
  exception when raise_exception then if sqlerrm not like 'Está nos treinos de%' then raise; end if; end;
  -- Fora de treinos e de objetivos: exclui.
  perform public.admin_excluir_exercicio('Sissy squat');
end $$;
do $$ begin
  if exists (select 1 from public.admin_exercicios() where nome = 'Sissy squat') then raise exception 'FALHOU: Sissy squat continua na lista'; end if;
  begin perform public.admin_excluir_exercicio('Face pull');
    raise exception 'FALHOU: não exclui exercício que faz parte de um objetivo pronto';
  exception when raise_exception then if sqlerrm not like 'Faz parte do objetivo pronto%' then raise; end if; end;
end $$;

-- Rodar o schema.sql de novo (como em cada atualização) não mexe nos treinos, semanas, objetivos e cargas das contas
-- nem desfaz o que foi mudado no catálogo pelo painel.
reset role;
insert into public.cargas (usuario_id, data, treino, series)
  values ('22222222-2222-2222-2222-222222222222', '2026-11-02', 't1', '{"Supino reto":[{"carga":40}]}');
create temp table antes as
  select md5(string_agg(concat_ws('|', id, treinos, semana, treinos_anterior, jornada), ',' order by id)) as perfis,
    (select md5(string_agg(concat_ws('|', usuario_id, data, treino, series), ',' order by usuario_id, data)) from public.cargas) as cargas,
    (select count(*) from public.exercicios) as exercicios
  from public.perfis;
\ir ../../supabase/schema.sql
do $$ begin
  if (select perfis from antes) <> (select md5(string_agg(concat_ws('|', id, treinos, semana, treinos_anterior, jornada), ',' order by id)) from public.perfis)
    then raise exception 'FALHOU: rodar o schema.sql de novo não muda os treinos das contas'; end if;
  if (select cargas from antes) <> (select md5(string_agg(concat_ws('|', usuario_id, data, treino, series), ',' order by usuario_id, data)) from public.cargas)
    then raise exception 'FALHOU: rodar o schema.sql de novo não muda as cargas'; end if;
  if (select exercicios from antes) <> (select count(*) from public.exercicios) or exists (select 1 from public.exercicios where nome = 'Agachamento')
    then raise exception 'FALHOU: a carga inicial não traz de volta exercício renomeado nem duplica'; end if;
  if (select ativo from public.exercicios where nome = 'Exercício de teste') then raise exception 'FALHOU: a carga inicial não reativa exercício'; end if;
  if exists (select 1 from public.exercicios where nome = 'Sissy squat') then raise exception 'FALHOU: a carga inicial não traz de volta exercício excluído'; end if;
end $$;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true); end $$;

-- ---------- Ana depois de liberada ----------
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); end $$;

do $$ begin
  if (select count(*) from public.meus_videos()) <> 2 then raise exception 'FALHOU: liberada pelo admin, recebe os vídeos'; end if;
  if (select jornada from public.perfis where id = auth.uid()) <> 'hipertrofia' then raise exception 'FALHOU: o objetivo escolhido ficou salvo'; end if;
  if (select temporizador->>'segundos' from public.perfis where id = auth.uid()) <> '60' then raise exception 'FALHOU: o temporizador ficou salvo'; end if;
  if not (select 'evolucao' = any(novidades_ocultas) from public.perfis where id = auth.uid()) then raise exception 'FALHOU: "não mostrar esta novidade" ficou salvo'; end if;
end $$;

rollback;
\echo 'Regras de acesso: tudo OK'
