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
  -- Pode salvar os próprios treinos, semana, objetivo e temporizador (o grant de jornada já faltou uma vez).
  update public.perfis set treinos = '{"1":{"nome":"Treino 1","subtitulo":"","exercicios":[{"nome":"Supino reto","dose":"3×10","pse":8}]}}',
    semana = '[[], ["t1"], ["jiu"], [], [], [], []]', jornada = 'hipertrofia', tema = 'escuro',
    temporizador = '{"ativo":true,"segundos":60,"vibrar":true}'
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

-- ---------- Administrador ----------
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true); end $$;

do $$ begin
  if (select count(*) from public.admin_usuarios()) <> 3 then raise exception 'FALHOU: o painel vê todos os usuários'; end if;
  if (select count(*) from public.admin_checkins()) <> 2 then raise exception 'FALHOU: o painel vê os check-ins de todos'; end if;
  perform public.admin_liberar_videos('22222222-2222-2222-2222-222222222222', true);
end $$;

-- ---------- Ana depois de liberada ----------
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); end $$;

do $$ begin
  if (select count(*) from public.meus_videos()) <> 2 then raise exception 'FALHOU: liberada pelo admin, recebe os vídeos'; end if;
  if (select jornada from public.perfis where id = auth.uid()) <> 'hipertrofia' then raise exception 'FALHOU: o objetivo escolhido ficou salvo'; end if;
  if (select temporizador->>'segundos' from public.perfis where id = auth.uid()) <> '60' then raise exception 'FALHOU: o temporizador ficou salvo'; end if;
end $$;

rollback;
\echo 'Regras de acesso: tudo OK'
