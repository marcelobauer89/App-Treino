# Recursos do app: como funcionam e como ligar

Referência de cada recurso: o que faz, onde fica no banco e o que rodar para ligar. Os requisitos e o status ficam no [PRD](PRD.md); a instalação, no [README](../README.md).

Ao mudar um recurso, atualize só a seção dele (ache pelo índice).

## Índice

- [Treinos personalizados](#treinos-personalizados)
- [Evolução (Dashboard)](#evolução-dashboard)
- [Atualização automática](#atualização-automática)
- [Aviso de novidade (Evolução)](#aviso-de-novidade-evolução)
- [Futebol e Futvôlei](#futebol-e-futvôlei)
- [Celebração do check-in](#celebração-do-check-in)
- [Temporizador de descanso](#temporizador-de-descanso)
- [Jornadas prontas](#jornadas-prontas)
- [Catálogo de exercícios e objetivos](#catálogo-de-exercícios-e-objetivos)
- [Vídeos liberados por usuário](#vídeos-liberados-por-usuário)
- [Convites (acesso só para convidados)](#convites-acesso-só-para-convidados)
- [Excluir conta](#excluir-conta)
- [Foto no check-in (opcional)](#foto-no-check-in-opcional)
- [Privacidade e LGPD](#privacidade-e-lgpd)
- [Monitoramento de uso](#monitoramento-de-uso)
  - [On-line agora (Realtime)](#on-line-agora-realtime)
  - [Mundo ao vivo](#mundo-ao-vivo)
- [Resumo semanal por e-mail](#resumo-semanal-por-e-mail)
  - [Como ligar (uma vez)](#como-ligar-uma-vez)

## Treinos personalizados

Cada pessoa pode montar até 6 treinos (t1 a t6), com até 15 exercícios cada, em **Você → Meus treinos**:
- **Biblioteca:** 136 exercícios, sem repetição. O grupo Core aparece como "Core e abdômen", e buscar "abdominal", "abdômen" ou "barriga" mostra o grupo inteiro. São os 22 do plano pronto mais os das fichas de treino em PDF. Variações do mesmo movimento com outro equipamento (halter ou barra) entram uma vez só; os outros nomes delas (`VARIACOES`) servem para a busca.
- **Vídeos dos exercícios:** só para quem o administrador libera (veja "Vídeos liberados por usuário").
- **O que a pessoa ajusta:** nome e foco de cada treino, séries/repetições e PSE. A ordem dos exercícios muda arrastando a alça ⠿ de cada cartão (no teclado, setas para cima e para baixo na alça); o botão flutuante "Adicionar exercício" abre a biblioteca.
- **No banco:** a coluna `perfis.treinos` guarda só nome, séries e PSE de cada exercício. Os níveis, o grupo e a explicação vêm do catálogo (veja "Catálogo de exercícios e objetivos"), pelo nome.
- **Quem já usa o app:** continua no plano pronto (coluna vazia) até salvar outra coisa. Ao abrir o app, aparece o aviso **"Baita atualização!"**, com "Personalizar meus treinos" ou "Manter meu treino atual". Ele volta a cada abertura (inclusive ao voltar para o app depois de 30 min em segundo plano) até a pessoa marcar **"Não mostrar esta mensagem de novo"**.
- **Conta nova:** escolhe uma **jornada pronta** ou "Montar do zero" (veja abaixo).
- **O aviso no banco:** a última resposta fica em `perfis.novidade_treinos` e o "não mostrar mais" em `perfis.novidade_oculta`. Sem essa coluna (schema antigo), o aviso aparece do mesmo jeito e o "não mostrar mais" fica guardado só no aparelho.
- **Desfazer e versão anterior:** ao salvar, aparece "Desfazer" por 8 s, e a versão de antes (treinos e semana) fica em `perfis.treinos_anterior`. Em Você → Meus treinos, "Restaurar versão anterior" traz ela de volta depois.
- **Treino excluído:** sai da semana. Os check-ins e pesos dele continuam no Dashboard, com o nome "Treino N".
- **Histórico de pesos:** a carga da última vez e os recordes seguem o exercício em qualquer treino.

Para ligar, rode de novo o `supabase/schema.sql`. Ele libera t4 a t6 nos check-ins e nas cargas e cria as colunas `treinos`, `novidade_treinos` e `novidade_oculta`.

## Evolução (Dashboard)

- **Onde:** no topo do Dashboard, a troca **Resumo | Evolução**. A escolhida fica no endereço (`#dashboard/evolucao`).
- **Treinos por mês:** os últimos 6 meses em colunas empilhadas por tipo, com o total de cada mês. Tocar num mês mostra o resumo dele; o balão traz o detalhe; "Ver tabela" mostra os números. As setas andam de 6 em 6 meses, até o primeiro check-in.
- **Resumo do mês:** treinos, dias com treino, horas e % do plano (pela semana montada; no mês atual, até hoje), cada um comparado ao mês anterior (▲/▼).
- **Quanto falta** (só no mês atual): quantos treinos faltam para fechar o mês com 100% do plano, com a barra do que já foi feito, os dias pela frente e o % no ritmo de agora.
- **O que você treinou:** os tipos do mês, com quantas vezes fez cada treino de musculação.
- **Seu plano no mês:** cada atividade da semana montada, com quantas vezes caiu no mês (até hoje, no mês atual) e quantas foram feitas, as mais puladas primeiro. No mês atual, uma dica 💡 aponta o dia da semana que mais falha nos últimos 3 meses (com plano em 3 dias ou mais e menos da metade feita) e leva à Minha semana.
- **Seus pesos no mês:** a maior carga de cada exercício, a variação para o mês anterior, "novo" e 🏆 quando bateu recorde. Usa o nome de hoje no catálogo e junta os nomes antigos.
- **Hora de subir a carga?:** os exercícios com a mesma carga máxima há 3 meses seguidos ou mais ("parado", com a sugestão de +2 kg até 20 kg e +2,5 kg acima) e os que caíram em relação ao mês anterior ("caiu"). Sem nenhum, a seção não aparece.
- Usa os check-ins e as cargas que o app já carrega (o histórico inteiro da conta); não precisa de SQL. Para esconder a Evolução, troque `EVOLUCAO_LIGADA` para `false` no `index.html`.

## Atualização automática

- A cada publicação, o GitHub Pages grava `versao.json` (o commit de cada ambiente: `/versao.json` e `/dev/versao.json`).
- Quando a pessoa volta para o app (no máximo a cada 2 minutos), ele confere esse arquivo. Se a versão mudou, recarrega sozinho, mas só quando é seguro: sem janela aberta, sem campo em edição e sem séries esperando gravar. Senão, tenta de novo ao fechar a janela ou na próxima volta. O check-in em andamento fica no banco e volta depois de recarregar.
- Assim quem deixa o app aberto em segundo plano também recebe as novidades. No Monitoramento aparece "O app se atualizou para a versão nova" (evento `app_atualizado`), seguido de "Abriu o app".
- Sem o `versao.json` (rodando local), fica desligado. O arquivo é gravado pelo workflow **Publicar site** da `main`, que publica os dois ambientes.

## Aviso de novidade (Evolução)

- Ao abrir o app, quem já usa (conta nova vê as boas-vindas) vê o aviso **"Sua evolução, mês a mês"**: uma ilustração do atalho Resumo | Evolução com as colunas subindo, os três destaques (treinos mês a mês, quanto falta para o plano, pesos e hora de subir a carga), **Ver minha evolução** (abre Dashboard → Evolução) e **Agora não**.
- Volta a cada abertura até a pessoa marcar **"Não mostrar esta novidade de novo"**, que grava `perfis.novidades_ocultas` (lista de avisos ocultos, serve para as próximas novidades) e uma cópia no navegador. Vem antes do aviso antigo dos treinos (um por abertura).
- Eventos `novidade_evolucao` (viu, ver, depois, fechou e se ocultou) no Monitoramento.
- **Para ligar o "não mostrar" no banco:** rode de novo o `supabase/schema.sql` (cria a coluna `novidades_ocultas`). Sem ele, a escolha vale só no aparelho.

## Futebol e Futvôlei

- Tipos de check-in `futebol` (selo F) e `futvolei` (selo V), cada um com cor própria e 90 min por padrão. Entram no check-in, na Minha semana, no Dashboard, no resumo semanal por e-mail e no monitoramento.
- **Para ligar:** rode de novo o `supabase/schema.sql` (o banco passa a aceitar os dois tipos) e publique de novo a função `resumo-semanal`.

## Celebração do check-in

- Ao salvar um check-in novo ou encerrar um treino em andamento, a tela inteira mostra um ✓ grande na cor da atividade, o nome dela, o horário, a duração e o nº do treino na semana. Fecha sozinha em uns 4 segundos ou no **Continuar**. Editar um check-in não celebra.

## Temporizador de descanso

- **Configurar:** Você → Temporizador. Vem ligado (dá para desligar). Escolha o descanso padrão (30 s a 3 min) e se, ao terminar, toca um som e o celular vibra (o iPhone não vibra; o aviso fica na tela).
- **Usar:** ligado, aparece um botão redondo no canto direito da tela Treino, logo acima do "Fazer check-in". Ele abre a janela para escolher o tempo e iniciar; durante o descanso há −15 s, +15 s e Pular, e o botão mostra o tempo que falta.
- **Banco:** a escolha fica em `perfis.temporizador`. Rode de novo o `supabase/schema.sql` para criar a coluna e liberar a gravação; sem ela, o temporizador funciona, mas a escolha vale só até recarregar.

## Jornadas prontas

- **O que são:** conjuntos de treinos prontos com uma semana sugerida, na tabela `jornadas` do banco (a cópia de reserva fica na constante `JORNADAS_APP` do `index.html`):
  - Jiu Jitsu: o plano pronto de sempre;
  - Hipertrofia: 4 treinos;
  - Força e potência: A, B e Cardio;
  - Mobilidade e prevenção: Mobilidade, Anti-lesão e Pegada.
- **Exercícios:** todos são da biblioteca, por nome. Cada treino tem o próprio "Sobre o treino", que só aparece enquanto os exercícios forem os mesmos da jornada.
- **Conta nova:** passa pelas boas-vindas em passos, que não fecham sem uma escolha:
  1. **Bem-vindo ao OSS:** o que o app faz (não grava nada);
  2. **Seus dados:** o aviso de privacidade, com Entendi (só se a política ainda não foi aceita; vem antes de qualquer escolha ser gravada);
  3. **Qual é o seu objetivo?:** os objetivos prontos ou Montar do zero (sair do editor sem salvar volta para a escolha).

  Escolher grava os treinos (`perfis.treinos`), a semana sugerida (mantendo jiu, muay, surf, futebol, futvôlei e cardio) e a jornada (`perfis.jornada`), e encerra as boas-vindas.
- **Quem já usa:** "Mudar meu objetivo", em Você → Meus treinos: "Escolher" marca o cartão e o rodapé mostra o **Confirmar**. Ao confirmar, a animação "Montando seus treinos" mostra os treinos e a semana se formando; ao salvar treinos alterados no editor, a mesma animação aparece como "Atualizando seus treinos". A versão de antes vai para `treinos_anterior`, e o "Desfazer" volta a ela. **Nenhum treino de quem já usa muda sozinho.**
- **Personalizar:** depois de escolher, tudo continua editável. Meus treinos mostra "Jornada X" ou "X (personalizada)".
- **No banco:** a coluna `perfis.jornada` guarda só o id da jornada. Sem ela (schema antigo), escolher funciona do mesmo jeito, sem o rótulo.
- **Monitoramento:** os eventos `jornadas_abertas` e `jornada_escolhida` alimentam o card "Objetivos escolhidos".
- **De onde veio:** as jornadas foram montadas com seleção, ordem, doses e textos próprios, usando planilhas de treino só como referência de método. Ao criar uma jornada nova, não copie a sequência nem os textos de nenhuma planilha.

## Catálogo de exercícios e objetivos

- **Onde fica:** no banco, nas tabelas `exercicios` (a biblioteca) e `jornadas` (os objetivos prontos). Quem entra no app lê; só administradores mudam.
- **Editar os exercícios:** no monitoramento, aba **Exercícios**. Dá para buscar e, na janela do botão **Filtros**, filtrar por grupo, objetivo e situação (ativos, desativados, sem vídeo), que só valem ao tocar em **Filtrar**; criar, editar (nome, grupo, séries, PSE, níveis, explicação, outros nomes e vídeo do YouTube, colando o link) e desativar. Vale na hora para todos, sem publicar o app. Cada exercício mostra em quantas contas está.
- **Quem já usa não perde nada:** os treinos das contas guardam só nome, séries e PSE, e mudar o catálogo não mexe neles.
  - **Renomear:** o nome antigo fica em `nomes_antigos`. O app continua achando o exercício por ele, com vídeo, cargas e recordes, e o painel avisa quantas contas usam antes de salvar.
  - **Desativar:** o exercício sai da lista de escolha, mas continua completo nos treinos de quem já o tem.
  - **Excluir** (lixeira na lista ou no fim da edição): só um exercício que ninguém tem nos treinos (nem no plano pronto) e que não faz parte de um objetivo pronto; nos outros casos, o painel sugere desativar. O excluído sai junto com o vídeo, fica em `exercicios_excluidos` e não volta quando o `schema.sql` roda de novo (criar outro com o mesmo nome libera o nome).
  - **Plano pronto:** quem nunca montou treino continua com a mesma lista de exercícios, com os detalhes do catálogo.
- **O que muda para quem usa:** nome, explicação, níveis, grupo e vídeo mudados no painel aparecem no cartão do exercício de quem já o tem. O app busca o catálogo ao abrir e de novo ao voltar para ele (no máximo a cada 2 min). Séries e PSE continuam as do treino da pessoa. O nome salvo no treino segue como chave das cargas e do histórico, que continuam ligados depois de renomear.
- **Campos do cadastro:** séries por campos (séries × repetições ou tempo, unidade, "/ lado", totais ou válidas), gerando sempre o formato do app (`3×10`, `2–3×12 / lado`, `3×30 s`); o que não cabe nisso vai em "Outro formato". PSE em lista (como no editor do app), níveis em botões e nome com a primeira letra maiúscula. No celular, a janela ocupa a tela toda.
- **Objetivo do exercício (opcional):** marque um ou mais objetivos (coluna `exercicios.objetivos`). No app, quem tem objetivo vê o chip **"Do meu objetivo"** em "Adicionar exercício". A carga inicial marca cada exercício com os objetivos em que ele já aparece.
- **Objetivos prontos:** por enquanto, mudam só por SQL (a edição pelo painel vem depois).
- **No aparelho:** o app guarda uma cópia do catálogo e abre com ela. Sem as tabelas (SQL ainda não rodado) ou sem internet, usa a cópia ou a lista que vem no `index.html` (`BIBLIOTECA_APP` e `JORNADAS_APP`).
- **Como ligar:** rode de novo o `supabase/schema.sql`. Ele cria as tabelas e carrega os 136 exercícios e os 4 objetivos. Rodar de novo não duplica, não traz de volta um exercício renomeado e não desfaz o que foi mudado no painel.
- **Carga inicial:** é gerada da lista do `index.html` por `node supabase/gerar-catalogo.cjs` (o teste confere com `--conferir`). Ao mudar a lista do código, rode o gerador.
- **Exercícios mandados em lista:** viram um SQL de `insert into public.exercicios ...`, rodado primeiro no projeto de testes e depois no de produção.

## Vídeos liberados por usuário

- **Como liberar:** no monitoramento, abra a ficha da pessoa na aba **Usuários** e toque em **Liberar vídeos** (ou **Tirar vídeos**). Quem está liberado aparece com a etiqueta "Vídeos" na tabela.
- **O que muda no app:** a pessoa liberada vê o vídeo da execução nos exercícios que têm vídeo (deslizando o cartão). Sem liberação, que é o padrão, os exercícios aparecem sem vídeo.
- **Onde ficam os vídeos:** só no banco, na tabela `videos_exercicios` (exercício → id do vídeo no YouTube). Ninguém lê essa tabela pela API: o app recebe a lista pela função `meus_videos()`, que só devolve os vídeos para a própria pessoa liberada (coluna `perfis.videos_liberados`, que só o administrador muda, pela função `admin_liberar_videos`). A lista não fica no código nem no repositório.
- **Como ligar (uma vez por projeto):**
  1. Rode o `supabase/schema.sql`.
  2. Rode a carga dos vídeos (um SQL com `insert into public.videos_exercicios ...`). Esse arquivo não fica no repositório: peça a ele a quem mantém o app.
- **Adicionar ou trocar um vídeo:** no monitoramento → Exercícios, no campo "Vídeo do YouTube" do exercício (cola o link). Ou no SQL Editor, `insert into public.videos_exercicios (exercicio, video_id) values ('Nome do exercício', 'idDoYouTube') on conflict (exercicio) do update set video_id = excluded.video_id;`. O nome tem que ser igual ao da biblioteca.

## Convites (acesso só para convidados)

- **Convidar alguém:** no monitoramento, aba **Convites** → "Para quem?" (opcional) → **Gerar convite**. Copie o link ou toque em **Enviar pelo WhatsApp**. Cada link vale para uma pessoa e por 7 dias.
- **O amigo:** abre o link, entra com o Google e o app libera a conta sozinho. Se o link já tiver sido usado, tiver expirado ou sido cancelado, ele vê o motivo e pode digitar outro código.
- **Quem entra sem convite:** vê "O OSS é só para convidados", com um campo para o código e o botão **Pedir acesso**. Os pedidos aparecem na aba Convites, com Liberar e Recusar, e a aba mostra um selo com a quantidade.
- **Aviso por e-mail de pedido de acesso:** a cada novo pedido, os administradores recebem um e-mail ("Novo pedido de acesso: Nome") com o botão "Liberar ou recusar", que abre a aba Convites. Quem envia é a Edge Function `resumo-semanal` (mesmo Gmail do resumo), chamada por um gatilho no banco. Para ligar, publique a versão atual da função e rode `supabase/agendamentos/aviso-pedido-acesso.sql` no SQL Editor (depois do `resumo-semanal.sql`, que guarda o token no Vault). Pedidos repetidos da mesma pessoa em menos de 1 hora não geram outro e-mail.
- **Convites gerados e utilizados:** a aba separa os convites ainda não usados (aguardando, expirados e cancelados) dos **convites utilizados**, que mostram quem entrou e quando. Quem foi liberado depois de pedir acesso também aparece ali, com o selo "Pedido de acesso". Tocar no nome abre o detalhe da pessoa.
- **Excluir convite:** a lixeira de cada convite apaga o registro, com confirmação. Excluir um convite usado não tira o acesso de quem entrou; num convite aguardando, o link para de funcionar.
- **Bloquear ou liberar:** no detalhe de cada usuário (aba Usuários), seção Acesso.
- **Quem já tinha conta:** continua liberado. Administradores também entram sempre.
- **No banco:** `perfis.liberado`, `perfis.acesso_pedido_em` e `perfis.liberado_como` / `liberado_em` (convite, pedido ou administrador; só as funções gravam), a tabela `convites` (sem acesso direto pela API) e as funções `usar_convite`, `pedir_acesso` e `admin_*_convite` (inclusive `admin_excluir_convite`) / `admin_liberar_usuario` / `admin_bloquear_usuario` / `admin_recusar_pedido`. Check-ins e cargas só são gravados por contas liberadas. A pessoa não consegue apagar nem recriar o próprio perfil pela API (só cria as colunas básicas, e `liberado` nasce falso), para ninguém pular o convite; visitantes sem login não têm permissão em nenhuma tabela. Para ligar, rode de novo o `supabase/schema.sql`.

## Excluir conta

- **Pelo app:** Você → **Excluir conta**. A confirmação mostra tudo o que será apagado e só libera o botão depois de a pessoa marcar "Entendi".
- **Pelo monitoramento:** na aba Usuários, a lixeira de cada usuário abre a mesma confirmação. O administrador não exclui a própria conta nem a de outro administrador.
- **No banco:** as funções `excluir_conta()` e `admin_excluir_usuario(alvo)` apagam o usuário em `auth.users`. Perfil, check-ins, cargas, eventos e e-mails enviados saem junto, em cascata. Para ligar, rode de novo o `supabase/schema.sql`.

## Foto no check-in (opcional)

- **Como funciona:** no formulário de check-in (novo ou editar), "Adicionar foto" abre a câmera ou a galeria. A foto é reduzida no aparelho (lado maior até 1280 px, JPEG) e enviada ao salvar. Trocar e Remover ficam no mesmo lugar.
- **Quem vê:** só quem postou. A foto aparece no formulário (prévia), no detalhe do check-in no Dashboard (com ícone de câmera na linha) e em tela cheia ao tocar. O painel de monitoramento nunca mostra nem baixa fotos.
- **Onde fica:** no Supabase Storage, bucket privado `fotos-checkin`, em `<usuário>/<check-in>.jpg` (até 2 MB, só JPEG); o check-in guarda só o caminho em `checkins.foto`. Cada pessoa lê e grava só a própria pasta. O administrador tem leitura e exclusão só para apagar as fotos ao excluir uma conta pelo painel.
- **Apagar:** remover a foto, excluir o check-in ou excluir a conta (pelo app ou pelo painel) apaga o arquivo. "Baixar meus dados" traz links de 24 h para cada foto.
- **Se o envio falhar:** o check-in fica salvo e o app avisa para tentar de novo em Editar check-in.
- **Para ligar:** rode de novo o `supabase/schema.sql`; ele cria a coluna, o bucket e as regras de acesso. O plano gratuito do Supabase tem 1 GB de Storage (cerca de 4 a 5 mil fotos).

## Privacidade e LGPD

- **Política:** `privacidade.html`, com link na tela de entrada e em Você → Privacidade. O contato do responsável é marcelobauer.mbb@gmail.com.
- **Aviso de nova versão:** quando `perfis.politica_versao` é diferente de `POLITICA_VERSAO` (no `index.html`), o app mostra um resumo com "Entendi". Ao mudar o que o app guarda ou o que o painel mostra, atualize a política (texto e data) e a constante `POLITICA_VERSAO`, para todos verem o aviso de novo.
- **Dados de saúde:** as observações dos check-ins só aparecem para quem ligar "Registrar observações nos check-ins" em Você → Privacidade, que vem desligado; ligar é dar o consentimento (`perfis.consentimento_saude = 'sim'`). Desligar não pede confirmação: retira o consentimento e apaga as observações já registradas. A nota de recuperação (1 a 5) saiu do app, e o `schema.sql` apaga a coluna `checkins.recuperacao`; rode-o **depois** de publicar essa versão do app.
- **Baixar meus dados:** Você → Privacidade gera um JSON com perfil, check-ins, cargas, treinos, registro de uso e e-mails (função `meus_dados_extras()`).
- **Tempo de guarda:** enquanto a conta existir; excluir a conta apaga tudo.
- **Fonte:** a Archivo fica em `fonts/` (licença OFL, em `fonts/OFL.txt`), sem Google Fonts.
- Para ligar, rode de novo o `supabase/schema.sql`. O texto da política não é parecer jurídico: vale revisar com um advogado.

## Monitoramento de uso

O app registra eventos de uso na tabela `eventos` (telas abertas, exercícios concluídos, check-ins criados, editados e excluídos, recordes, vídeos vistos, "Sem peso", semana, tema, foto, erros e sessões que caíram sem a pessoa sair). Os eventos vão em lote, a cada 10 s ou quando o app vai para segundo plano, e não levam pesos corporais, cargas nem observações. Se a internet cair ou a sessão vencer, o lote volta para a fila e é reenviado depois (inclusive quando a internet volta); um evento recusado pelo banco é descartado sem levar os outros junto; textos longos são encurtados para caber no limite de 2.000 bytes. Cada usuário só grava os próprios eventos e não consegue lê-los.

Quem lê esses dados é o dashboard de monitoramento, só para administradores: https://marcelobauer89.github.io/App-Treino/admin.html. Ele lê tudo por funções do banco (`admin_usuarios`, `admin_checkins`, `admin_eventos`) que recusam quem não está na tabela `admins`, e nunca mostra pesos, cargas nem observações. Para se tornar administrador, rode uma vez no **SQL Editor**, com o seu e-mail:

```sql
insert into public.admins (usuario_id)
select id from auth.users where email = 'seu-email@gmail.com'
on conflict do nothing;
```

Para o login do Google voltar ao dashboard, o endereço dele precisa estar liberado em **Authentication → URL Configuration → Redirect URLs** do Supabase. Adicione `https://marcelobauer89.github.io/App-Treino/admin.html` (ou `https://marcelobauer89.github.io/App-Treino/**`, que libera o app e o dashboard).

O dashboard é dividido em quatro abas: **Visão geral**, **Usuários**, **Saúde do app** e **E-mails**. O período escolhido (Hoje, 7, 30, 90 dias ou Tudo) vale para todas, e a aba aberta fica no endereço (por exemplo `admin.html#saude`).

O dashboard mostra:

- **On-line agora**, ao vivo: quem está com o app aberto, em que tela (Treino, Dashboard ou Você) e há quanto tempo, com um ponto verde pulsando. O mesmo ponto aparece no avatar da lista e no detalhe.
- **Números principais** do período (7, 30, 90 dias ou tudo), com a variação em relação ao período anterior: usuários ativos, check-ins, treinos por semana por usuário ativo, aderência ao plano (feito ÷ planejado na semana montada), quantos voltaram nesta semana, quantos sumiram e quantos recordes foram batidos.
- **Quem sumiu** (possíveis churn): quem usou o app nas últimas 4 semanas, mas está há 7 dias ou mais sem usar. Qualquer uso conta: check-in, pesos registrados, eventos ou só abrir o app (quem registra pesos sem fazer check-in não aparece). Mostra há quantos dias está sem usar, o último uso, o último check-in (ou "nunca fez check-in") e quantos dias por semana usava antes; quem usava mais vem primeiro. Não muda com o período e não inclui o administrador logado.
- **Quem mais evoluiu**: ranking de recordes pessoais no período (vezes em que a pessoa superou o próprio peso máximo num exercício; o primeiro peso não conta), com os exercícios de cada um. O painel não mostra os pesos. As regras das duas listas ficam no ícone "i" de cada cartão.
- **Gráficos** de check-ins por dia (por tipo de treino) e de usuários ativos por dia, agrupados por semana em períodos longos, cada um com a opção de ver como tabela.
- **Usuários**, com situação (Ativo até 7 dias sem usar, Em risco de 8 a 14, Inativo depois disso, Nunca usou), busca, ordenação e exportação em CSV.
- **Detalhe de cada usuário**: check-ins das últimas 8 semanas, semana montada, exercícios sem peso, se recebe o resumo por e-mail e atividade recente (7 por vez, agrupada por dia, inclusive erros e sessões que caíram).
- **Saúde do app**: só **erros críticos**, isto é, falhas do app que precisam de correção, e quantos usuários foram afetados.
  - Entram: erros de programação, gravações recusadas pelo banco (por exemplo, `schema.sql` não rodado depois de uma versão nova, com a dica para rodar) e falha ao excluir conta.
  - Ficam de fora, porque são normais: quedas de internet ("Failed to fetch", "Load failed", tempo esgotado), reconexões do "On-line agora", login de novo e ruídos do navegador ("Script error.", "ResizeObserver loop"). O app nem registra esses casos, e o painel também ignora os que versões antigas gravaram. A regra está em `ehErroComum`, igual no `index.html` e no `admin.html`.
  - Erros iguais aparecem agrupados, com o selo "Acontecendo agora" quando ocorreram nas últimas 24 h; tocando no grupo, aparece quando e com qual usuário.
  - A aba mostra uma bolinha vermelha com os erros críticos das últimas 24 h.
- **E-mails**: os resumos semanais enviados no período, com quantos foram abertos e clicados.
  - Tocando numa semana, aparece quem recebeu (Enviado, Abriu ou Clicou, com o horário) e quem não recebeu e por quê.
  - A abertura é medida por uma imagem invisível e é aproximada: o Mail do iPhone/Mac pode carregar a imagem sozinho, e quem bloqueia imagens não conta. O clique no botão "Abrir o App Treino" é exato.
  - Precisa da função `admin_emails` do `schema.sql`.

### On-line agora (Realtime)

A presença usa o **Supabase Realtime Presence**. Enquanto o app está aberto na tela, ele publica só a tela atual, desde quando está aberto, o sistema do aparelho e a última ação (exercício concluído, recorde, check-in, vídeo ou semana alterada, com o nome do exercício ou o tipo do treino, nunca a carga), no canal privado `online:<id do usuário>`. Ao ir para segundo plano ou sair da conta, a presença some.

As regras do `schema.sql` (políticas em `realtime.messages`) deixam cada pessoa ler e publicar só no próprio canal; administradores leem o canal de todos. Para garantir que só canais privados funcionem, no Supabase vá em **Realtime → Settings** e desligue **Allow public access** (o app não usa canais públicos).

Se o painel mostrar "Ao vivo indisponível", confira se o `schema.sql` foi aplicado e se o Realtime está ligado no projeto.

### Mundo ao vivo

Em https://marcelobauer89.github.io/App-Treino/mundo.html (ou pelo botão **Mundo ao vivo** do monitoramento), quem está com o app aberto aparece como um personagem num mapa em pixel art e anda até o lugar do que está fazendo:

| No app | No mapa |
| --- | --- |
| Entrou | Surge no Portão OSS |
| Tela Treino, exercício concluído, recorde ou vídeo | Academia (levanta a barra; recorde mostra "RECORDE!") |
| Check-in de Jiu Jitsu ou muay thai | Tatame |
| Check-in de cardio | Pista |
| Tela Dashboard | Torre |
| Tela Você ou semana alterada | Casa |
| Fechou o app | Volta ao portão e some |

Cada personagem fica 5 minutos no lugar da última ação e depois volta para o lugar da tela aberta. Embaixo do mapa ficam o que aconteceu hoje (eventos do dia mais as ações ao vivo) e quem está fora do app. **Tela cheia** deixa o mapa ocupando a tela inteira, para um telão. Só administradores abrem a página; ela usa os mesmos canais e funções do monitoramento e não precisa de nada novo no Supabase.

## Resumo semanal por e-mail

Toda **sexta-feira às 9h** (Brasília), cada pessoa recebe no e-mail um resumo dos últimos 7 dias (de sexta a quinta):

- quantos treinos fez e de que tipo;
- em que dias treinou;
- quanto do plano cumpriu (pela semana montada em Você);
- a comparação com a semana anterior;
- os recordes da semana.

Quem não treinou recebe uma versão de incentivo.

**"E aí, sumiu?"**: quem está no card "Quem sumiu" do monitoramento (usou o app nas últimas 4 semanas, mas não nos últimos 7 dias) recebe, no lugar do resumo, um e-mail para voltar. Ele mostra:
- há quantos dias a pessoa não aparece;
- quantos treinos fez no mês e o ritmo por semana antes de sumir;
- o último treino, com o nome dado por ela;
- os recordes do mês;
- o que está na semana dela para o dia;
- uma dica para retomar.

O botão leva ao app. O envio conta como o resumo da semana (não repete), e a resposta da função traz `voltas` (quantos foram assim). Para ver a versão de volta na prévia de qualquer pessoa, mande `"volta": true` junto com `"previa"`.

**Não recebem:** quem nunca usou o app, quem ainda não foi liberado (convite ou pedido de acesso pendente) e quem está há 4 semanas ou mais sem abrir o app. Quem volta a abrir o app volta a receber na sexta seguinte. A prévia (abaixo) vai sempre, para testar.

O envio sai do seu Gmail, pela Edge Function `supabase/functions/resumo-semanal/index.ts`, e um agendamento do próprio Supabase a dispara.

**Não querer receber**
- Cada pessoa pode desligar em **Você → Conta → Resumo semanal por e-mail**, ou pelo link "Não quero mais receber" no rodapé de cada e-mail.
- O Gmail também mostra o botão "Cancelar inscrição", que funciona com um clique.

**Duplicados e privacidade**
- A tabela `emails_enviados` registra cada envio, então o mesmo resumo nunca vai duas vezes.
- O e-mail não leva pesos, cargas nem observações.

### Como ligar (uma vez)

1. **Senha de app do Google:**
   - na conta Google que vai enviar, ative a verificação em duas etapas;
   - em https://myaccount.google.com/apppasswords, crie uma senha de app chamada "App Treino";
   - guarde os 16 caracteres.
2. **Banco:** rode de novo o `supabase/schema.sql` no SQL Editor. Ele cria a opção `emails_resumo` no perfil e a tabela `emails_enviados`.
3. **Função:** no Supabase, abra **Edge Functions → Deploy a new function → Via Editor**:
   - dê o nome `resumo-semanal`;
   - cole o conteúdo de `supabase/functions/resumo-semanal/index.ts` e publique;
   - nos detalhes da função, desligue **Verify JWT** (a proteção é o token próprio do passo 4);
   - anote o **endereço** que aparece embaixo do nome da função, como `https://…supabase.co/functions/v1/rapid-worker`. O painel gera o final sozinho e ele não muda depois.
4. **Segredos:** em **Edge Functions → Secrets**, cadastre:
   - `GMAIL_USER`: o Gmail que envia (ex.: `seu-email@gmail.com`);
   - `GMAIL_APP_PASSWORD`: a senha de app do passo 1;
   - `RESUMO_TOKEN`: um texto longo e aleatório, que você inventa e não compartilha. Ele protege a função e assina os links de descadastro;
   - `APP_URL`: `https://marcelobauer89.github.io/App-Treino/`;
   - `FUNCAO_URL`: o endereço da função anotado no passo 3, usado no link "Não quero mais receber".
5. **Agendamento:**
   - em **Database → Extensions**, ligue `pg_cron` e `pg_net`;
   - abra `supabase/agendamentos/resumo-semanal.sql`, troque `COLE_AQUI_O_RESUMO_TOKEN` pelo mesmo `RESUMO_TOKEN` (só no SQL Editor, nunca no arquivo do repositório). Se o endereço da sua função não terminar em `rapid-worker`, troque também esse final nas URLs do arquivo. Depois rode.
6. **Teste:** a função só envia para todos quando o pedido diz `enviar` (o agendamento já diz); sem pedido, ela responde 400 e não envia nada. No mesmo arquivo há consultas prontas para:
   - **simular**: mostra quem receberia, sem enviar;
   - mandar uma **prévia só para você**;
   - ver a resposta e o histórico de execuções.

**Limites**
- O Gmail envia até cerca de 500 e-mails por dia, folgado para o grupo.
- A função manda um e-mail por vez e tem até 150 s por execução, o suficiente para algumas dezenas de pessoas.

Se a resposta da função disser "Configuração incompleta", falta algum dos segredos do passo 4.

**Abertura e clique:** cada e-mail leva uma imagem invisível e o botão passa pela própria função, que registra em `emails_enviados` (`aberto_em`, `aberturas`, `clicado_em`, `cliques`) e leva a pessoa ao app. Os links são assinados com o `RESUMO_TOKEN`, então ninguém consegue registrar abertura por outra pessoa. O rodapé do e-mail avisa que a abertura é registrada. A prévia não conta. Ao atualizar o código da função, rode também o `schema.sql`, que cria essas colunas.
