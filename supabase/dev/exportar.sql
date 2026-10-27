-- Exporta a produção para o ambiente de dev, JÁ ANONIMIZADA (README → "Copiar a produção para o dev").
-- Quem roda é o workflow "Copiar produção para dev", com a sessão em modo só leitura: nada é gravado na produção.
-- Variáveis (psql -v): email = conta que vem completa; dono_dev = id dessa conta no dev; sal = texto aleatório da execução.
-- Saída: um arquivo .tsv por tabela, com uma linha JSON por registro, na pasta atual.
--
-- O que muda para os outros usuários: id novo (md5 do id com o sal, impossível de ligar à produção),
-- nome "Usuário N", e-mail usuarioN@exemplo.invalid, sem foto de perfil e sem observações nos check-ins;
-- dos eventos saem as chaves "nome" e "email". Os convites viram "Convite N".
-- Não saem: e-mails enviados, fotos dos check-ins e nada de auth.users.
\set ON_ERROR_STOP on
\set QUIET on

select set_config('copia.email', lower(:'email'), false),
       set_config('copia.dono_dev', :'dono_dev', false),
       set_config('copia.sal', :'sal', false) \g /dev/null

do $$
begin
  if not exists (select 1 from public.perfis where lower(email) = current_setting('copia.email')) then
    raise exception 'O e-mail % não tem conta na produção.', current_setting('copia.email');
  end if;
end $$;

-- Mapa de ids: a sua conta vira o seu id no dev; as outras, um id novo.
-- (Repetido em cada consulta porque a sessão só leitura não pode criar tabela temporária.)
-- Os arquivos saem por "copy … to stdout \g arquivo", que aceita as variáveis do psql.
\set mapa 'select p.id as velho, case when lower(p.email) = current_setting(''copia.email'') then current_setting(''copia.dono_dev'')::uuid else md5(p.id::text || current_setting(''copia.sal''))::uuid end as novo, lower(p.email) = current_setting(''copia.email'') as dono, row_number() over (order by lower(p.email) = current_setting(''copia.email''), md5(p.id::text || current_setting(''copia.sal''))) as n from public.perfis p'

copy (with m as (:mapa) select (case when m.dono then to_jsonb(p) || jsonb_build_object('id', m.novo) else to_jsonb(p) || jsonb_build_object('id', m.novo, 'nome', 'Usuário ' || m.n, 'email', 'usuario' || m.n || '@exemplo.invalid', 'foto', '') end)::text from public.perfis p join m on m.velho = p.id) to stdout \g 'perfis.tsv'

copy (with m as (:mapa) select (to_jsonb(c) || jsonb_build_object('usuario_id', m.novo, 'foto', '') || case when m.dono then '{}'::jsonb else jsonb_build_object('obs', '') end)::text from public.checkins c join m on m.velho = c.usuario_id) to stdout \g 'checkins.tsv'

copy (with m as (:mapa) select (to_jsonb(c) || jsonb_build_object('usuario_id', m.novo))::text from public.cargas c join m on m.velho = c.usuario_id) to stdout \g 'cargas.tsv'

copy (with m as (:mapa) select (to_jsonb(e) || jsonb_build_object('usuario_id', m.novo, 'dados', case when m.dono then e.dados else e.dados - 'nome' - 'email' end))::text from public.eventos e join m on m.velho = e.usuario_id) to stdout \g 'eventos.tsv'

copy (with m as (:mapa) select (to_jsonb(c) || jsonb_build_object('nome', 'Convite ' || row_number() over (order by c.criado_em), 'criado_por', cp.novo, 'usado_por', up.novo))::text from public.convites c left join m cp on cp.velho = c.criado_por left join m up on up.velho = c.usado_por) to stdout \g 'convites.tsv'

copy (with m as (:mapa) select jsonb_build_object('usuario_id', m.novo, 'criado_em', a.criado_em)::text from public.admins a join m on m.velho = a.usuario_id) to stdout \g 'admins.tsv'
