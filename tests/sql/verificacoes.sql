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

-- Tipos de check-in: todo mundo lê; só o administrador cadastra. Check-in de Cardio guarda modalidade e km.
do $$ begin
  if (select count(*) from public.tipos_checkin where ativo) < 6 then raise exception 'FALHOU: a pessoa lê os tipos de check-in'; end if;
  begin update public.tipos_checkin set nome = 'X' where id = 'jiu';
    raise exception 'FALHOU: a pessoa não muda os tipos de check-in';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_salvar_tipo_checkin('{"nome":"Natação","selo":"N"}');
    raise exception 'FALHOU: só o administrador cadastra tipo de check-in';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  insert into public.checkins (id, tipo, inicio, fim, modalidade, km) values (gen_random_uuid(), 'bike', '2026-11-06 07:00', '2026-11-06 07:40', 'corrida', 7.5);
  begin insert into public.checkins (id, tipo, inicio, fim, km) values (gen_random_uuid(), 'bike', '2026-11-07 07:00', '2026-11-07 07:40', -3);
    raise exception 'FALHOU: km negativo é recusado';
  exception when check_violation then null; end;
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

-- Administrador cadastra tipo novo (id a partir do nome) e muda as modalidades do Cardio.
do $$ declare v text; begin
  v := public.admin_salvar_tipo_checkin('{"nome":"Natação livre","selo":"N","cor":"#0e7490","duracao":45,"modalidades":[{"nome":"Piscina","km":true}]}');
  if v <> 'natacao_livre' then raise exception 'FALHOU: id do tipo novo a partir do nome (veio %)', v; end if;
  if (select modalidades->0->>'id' from public.tipos_checkin where id = v) <> 'piscina' then raise exception 'FALHOU: id da modalidade'; end if;
  begin perform public.admin_salvar_tipo_checkin('{"nome":"natacao livre","selo":"N"}');
    raise exception 'FALHOU: nome repetido é recusado';
  exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; end;
  perform public.admin_salvar_tipo_checkin('{"id":"bike","nome":"Cardio","selo":"C","modalidades":[{"nome":"Bike","km":true},{"nome":"Corrida","km":true},{"nome":"Remo","km":false}]}');
  if (select jsonb_array_length(modalidades) from public.tipos_checkin where id = 'bike') <> 3 then raise exception 'FALHOU: modalidades do Cardio salvas'; end if;
end $$;

do $$ begin
  if (select count(*) from public.admin_usuarios()) <> 3 then raise exception 'FALHOU: o painel vê todos os usuários'; end if;
  if (select count(*) from public.admin_checkins()) <> 5 then raise exception 'FALHOU: o painel vê os check-ins de todos (inclui o de Cardio com km)'; end if;
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

-- ---------- Área do personal ----------
-- Paula (444) pede para ser personal; Bruno (333) vira aluno dela; Ana (222) não é aluna e nada dela aparece.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'paula@exemplo.com', '{"full_name":"Paula"}'),
  ('55555555-5555-5555-5555-555555555555', 'caio@exemplo.com', '{"full_name":"Caio"}');
insert into public.cargas (usuario_id, data, treino, series)
  values ('33333333-3333-3333-3333-333333333333', '2026-11-05', 't1', '{"Supino reto":[{"carga":30}]}');
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
do $$ begin
  perform public.pedir_acesso_profissional('Paula Exemplo', '000000-g', 'sp');
  if public.eh_profissional() then raise exception 'FALHOU: o pedido sozinho não libera a área do personal'; end if;
  begin perform public.personal_criar_convite('Bruno');
    raise exception 'FALHOU: sem liberação, não gera convite de aluno';
  exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; end;
  if (select count(*) from public.profissionais) + (select count(*) from public.vinculos) <> 0
    then raise exception 'FALHOU: profissionais e vínculos não são lidos direto (só pelas funções)'; end if;
  if (select cref from public.meu_cadastro_profissional()) <> '000000-G' then raise exception 'FALHOU: o cadastro guarda o CREF'; end if;
end $$;

-- O administrador libera; a lista mostra o pedido.
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true); end $$;
do $$ begin
  if (select count(*) from public.admin_profissionais()) <> 1 then raise exception 'FALHOU: o administrador vê o pedido do profissional'; end if;
  perform public.admin_liberar_profissional('44444444-4444-4444-4444-444444444444', true);
end $$;

-- Paula gera dois convites e monta uma ficha.
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
create temp table conv (quem text, codigo text);
grant all on conv to authenticated;
do $$ declare f uuid; begin
  if not public.eh_profissional() then raise exception 'FALHOU: liberada, a área do personal abre'; end if;
  insert into conv values ('bruno', public.personal_criar_convite('Bruno')), ('caio', public.personal_criar_convite('Caio'));
  if (select count(*) from public.personal_alunos()) <> 0 then raise exception 'FALHOU: convite não aceito ainda não é aluno'; end if;
  f := public.personal_salvar_ficha('{"nome":"Ficha A","treinos":{"1":{"nome":"A","subtitulo":"Peito","exercicios":[{"nome":"Supino reto","dose":"4×8","pse":8}]}},"semana":[[],["t1"],[],[],[],[],[]]}');
  if (select count(*) from public.personal_fichas()) <> 1 then raise exception 'FALHOU: a ficha fica salva'; end if;
  begin perform public.personal_salvar_ficha('{"nome":"Vazia","treinos":{"1":{"nome":"A","exercicios":[]}}}');
    raise exception 'FALHOU: ficha com treino sem exercício é recusada';
  exception when check_violation then null; end;
end $$;

-- O próprio convite: bloqueado por padrão; liberado só com o ajuste 'convite_proprio' (projeto de testes).
do $$ begin
  if (select situacao from public.ver_convite_personal((select codigo from conv where quem = 'bruno'))) <> 'proprio' then
    raise exception 'FALHOU: o personal não aceita o próprio convite'; end if;
  begin insert into public.ajustes_banco values ('convite_proprio', 'sim'); raise exception 'FALHOU: a API não grava em ajustes_banco';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.ajustes_banco values ('convite_proprio', 'sim');
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
do $$ begin
  if (select situacao from public.ver_convite_personal((select codigo from conv where quem = 'bruno'))) <> 'ok' then
    raise exception 'FALHOU: com o ajuste ligado, o personal pode abrir o próprio convite'; end if;
end $$;
reset role;
delete from public.ajustes_banco;

-- Bruno vê o convite e aceita; Caio é aluno de outro jeito? Não: Caio aceita e depois encerra.
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true); end $$;
do $$ declare c text := (select codigo from conv where quem = 'bruno'); begin
  if (select situacao from public.ver_convite_personal(c)) <> 'ok' then raise exception 'FALHOU: o aluno vê o convite válido'; end if;
  if (select cref from public.ver_convite_personal(c)) <> '000000-G' then raise exception 'FALHOU: o aluno vê o CREF do personal'; end if;
  if public.aceitar_vinculo(c) <> 'ok' then raise exception 'FALHOU: o aluno aceita o convite'; end if;
  if (select nome from public.meu_personal()) <> 'Paula Exemplo' then raise exception 'FALHOU: o aluno vê quem o acompanha'; end if;
  if public.aceitar_vinculo('ZZZZZZ') <> 'invalido' then raise exception 'FALHOU: código inexistente é inválido'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true); end $$;
do $$ declare c text := (select codigo from conv where quem = 'caio'); begin
  if (select liberado from public.perfis where id = auth.uid()) then raise exception 'FALHOU: conta nova começa sem acesso'; end if;
  if public.aceitar_vinculo((select codigo from conv where quem = 'bruno')) <> 'usado' then raise exception 'FALHOU: convite já aceito por outro é recusado'; end if;
  if public.aceitar_vinculo(c) <> 'ok' then raise exception 'FALHOU: o segundo aluno aceita'; end if;
  if not (select liberado from public.perfis where id = auth.uid()) then raise exception 'FALHOU: aceitar o convite do personal libera a conta'; end if;
  perform public.encerrar_vinculo();
  if (select count(*) from public.meu_personal()) <> 0 then raise exception 'FALHOU: o aluno encerra o acompanhamento'; end if;
end $$;

-- Paula vê só o Bruno: check-ins, cargas e uso; aplica a ficha e o Bruno não muda os treinos sozinho.
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
do $$ declare f uuid := (select id from public.personal_fichas() limit 1); begin
  if (select count(*) from public.personal_alunos()) <> 1 then raise exception 'FALHOU: o personal vê só os alunos com vínculo ativo'; end if;
  if (select count(*) from public.personal_checkins()) <> 1 then raise exception 'FALHOU: o personal vê os check-ins do aluno, e só dele'; end if;
  if (select count(*) from public.personal_cargas()) <> 1 then raise exception 'FALHOU: o personal vê as cargas do aluno, e só dele'; end if;
  if exists (select 1 from public.personal_checkins() where usuario_id <> '33333333-3333-3333-3333-333333333333') then raise exception 'FALHOU: nada de quem não é aluno'; end if;
  if (select count(*) from public.perfis) <> 1 then raise exception 'FALHOU: o personal não lê o perfil do aluno direto'; end if;
  if public.personal_aplicar_ficha(f, array['33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222']::uuid[], true) <> 1
    then raise exception 'FALHOU: a ficha vale só para os próprios alunos'; end if;
  perform public.personal_salvar_treinos('33333333-3333-3333-3333-333333333333',
    '{"1":{"nome":"A","subtitulo":"","exercicios":[{"nome":"Supino reto","dose":"5×5","pse":9}]}}');
  begin perform public.personal_salvar_treinos('22222222-2222-2222-2222-222222222222', '{"1":{"nome":"A","exercicios":[{"nome":"Supino reto"}]}}');
    raise exception 'FALHOU: não monta treino de quem não é aluno';
  exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if (select treinos->'1'->'exercicios'->0->>'dose' from public.perfis where id = '33333333-3333-3333-3333-333333333333') <> '5×5'
    then raise exception 'FALHOU: o ajuste do personal chega ao aluno'; end if;
  if (select semana->>1 from public.perfis where id = '33333333-3333-3333-3333-333333333333') <> '["t1"]' then raise exception 'FALHOU: a semana sugerida foi aplicada'; end if;
  if (select treinos_anterior->'treinos' from public.perfis where id = '33333333-3333-3333-3333-333333333333') is null then raise exception 'FALHOU: a versão anterior fica guardada'; end if;
  if (select treinos from public.perfis where id = '22222222-2222-2222-2222-222222222222')->'1'->'exercicios'->0->>'dose' = '5×5' then raise exception 'FALHOU: quem não é aluno não muda'; end if;
end $$;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true); end $$;
do $$ begin
  begin update public.perfis set treinos = null where id = auth.uid();
    raise exception 'FALHOU: com personal, o aluno não muda os treinos';
  exception when insufficient_privilege then null; end;
  update public.perfis set semana = '[[], [], ["jiu"], [], [], [], []]' where id = auth.uid();
  perform public.encerrar_vinculo();
  update public.perfis set treinos = null where id = auth.uid();
  if (select (meus_dados_extras()->'acompanhamento'->0->>'personal')) <> 'Paula Exemplo' then raise exception 'FALHOU: Baixar meus dados traz o acompanhamento'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
do $$ begin
  if (select count(*) from public.personal_alunos()) <> 0 or (select count(*) from public.personal_cargas()) <> 0
    then raise exception 'FALHOU: depois de encerrado, o personal não vê mais o aluno'; end if;
end $$;
-- Com o ajuste 'convite_proprio' (banco de testes), o personal vira aluno de si mesmo e aplica a ficha em si.
reset role;
insert into public.ajustes_banco values ('convite_proprio', 'sim');
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
do $$ declare c text := public.personal_criar_convite('Eu'); f uuid := (select id from public.personal_fichas() limit 1); begin
  if public.aceitar_vinculo(c) <> 'ok' then raise exception 'FALHOU: com o ajuste, o personal aceita o próprio convite'; end if;
  if public.personal_aplicar_ficha(f, array[auth.uid()], false) <> 1 then raise exception 'FALHOU: o personal aplica a ficha em si mesmo'; end if;
  perform public.encerrar_vinculo();
end $$;
reset role;
delete from public.ajustes_banco;
-- Bloqueada pelo administrador, a área fecha.
reset role;
update public.profissionais set bloqueado_em = now();
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true); end $$;
do $$ begin
  begin perform 1 from public.personal_alunos();
    raise exception 'FALHOU: personal bloqueado não lê os alunos';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
\echo 'Regras de acesso: tudo OK'
