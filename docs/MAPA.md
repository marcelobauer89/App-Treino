# Mapa do código e dos testes

Para achar o trecho certo sem ler o arquivo inteiro. Cada parte do JS começa com um comentário `// ---------- Nome ----------`: procure por ele (`grep -rn -- '---------- Nome' js/`) e leia só daquela linha até a próxima seção. Os números de linha mudam; os nomes, não.

Ao criar, renomear ou apagar uma seção ou um teste, atualize este mapa no mesmo PR.

## Arquivos

| Arquivo | O que tem |
| --- | --- |
| `index.html` | HTML das telas e janelas do app; carrega `css/app.css` e os arquivos de `js/` na ordem abaixo |
| `css/app.css` | Estilos do app |
| `js/*.js` | JavaScript do app, um arquivo por área (tabela abaixo). Todos dividem o mesmo escopo global: o que um arquivo define, os seguintes usam. Código que roda ao carregar só pode usar o que já foi carregado antes |
| `admin.html`, `css/admin.css`, `js/admin.js` | Monitoramento (só administradores) |
| `mundo.html` | Mundo ao vivo (só administradores) |
| `privacidade.html` | Política de Privacidade |
| `manifest.webmanifest`, `manifest-dev.webmanifest`, `icones/`, `sw.js` | App instalável (PWA): manifesto, ícones e service worker (registrado no `js/inicio.js`) |
| `ambiente.js` | Projeto Supabase de produção ou de testes (por endereço) e o selo DEV |
| `supabase/schema.sql` | Banco inteiro (tabelas, RLS, funções); roda de novo sem duplicar |
| `supabase/migracoes/` | Uma mudança do banco por arquivo (`NNN-descricao.sql`), para rodar só o que mudou |
| `supabase/functions/resumo-semanal/` | Edge Function do resumo semanal e do aviso de pedido de acesso |
| `supabase/agendamentos/` | Agendamento do resumo e gatilho do aviso por e-mail |
| `supabase/ajustes/` | Correções de dados que rodam uma vez |
| `supabase/dev/` | Cópia anonimizada da produção para o banco de testes |
| `docs/PRD.md` | Requisitos (RF-xx), com status |
| `docs/RECURSOS.md` | Como cada recurso funciona e como ligar |

## App: arquivos de `js/` e suas seções

Na ordem de carga. Cada linha é uma seção (comentário `// ---------- Nome ----------`).

| Seção (comentário) | O que faz |
| --- | --- |
| **`js/dados.js`** | |
| Dados (do PDF) | Plano pronto, `EXERCICIOS_EXTRAS`, `BIBLIOTECA_APP`, `VARIACOES`, `JORNADAS_APP` (reserva do catálogo do banco) |
| **`js/nucleo.js`** | |
| Conexão com o Supabase | Cria o cliente `sb` a partir do `ambiente.js` |
| Catálogo (exercícios e objetivos) | Lê `exercicios` e `jornadas` do banco e guarda cópia no aparelho |
| Perfil e configurações | Tema, estilo, semana, treinos e opções vindas de `perfis` |
| Datas | Helpers de data e semana |
| Estado da tela | Variáveis globais da interface |
| Check-ins | Modelo do check-in |
| Supabase | `salvarCheckin`, `salvarCarga`, `salvarPerfil`, avisos "rode o schema.sql" |
| Fila de envio e cópia dos dados no aparelho (uso sem internet) | `enfileirar`, `sincronizar`, cópia `bauer-copia-<id>`, faixa "Sem internet" (`atualizarPendentesUI`) |
| Eventos de uso | Fila e envio em lote para `eventos` |
| Atualização automática | `versao.json` e recarga segura; logo depois, `todasLinhas` (páginas de 1.000), `buscarDoServidor`, `carregarDados` (servidor ou cópia do aparelho) e `aplicarDados` |
| Helpers de interface | `toast`, `$` e afins |
| **`js/checkin.js`** | |
| Registro de pesos | Séries, cargas, Sem peso, recordes |
| Encerrar check-in | Fecha o check-in em andamento |
| Celebração do check-in | Tela cheia ao salvar |
| Check-in rápido, extra ou retroativo | Formulário de check-in |
| Foto do check-in | Câmera, redução e Storage |
| **`js/treino.js`** | |
| Render: tela Treino | Abas, cartões dos exercícios, Ficha |
| Vídeo de execução no cartão | Carrossel do vídeo |
| **`js/dashboard.js`** | |
| Render: Dashboard | Resumo, calendário, check-ins do dia |
| Dashboard → Evolução | Mês a mês, pesos e "hora de subir a carga" |
| **`js/voce.js`** | |
| Render: Você | Lista de opções |
| Minha semana | Arrastar atividades nos dias |
| Meus treinos (editor) | Montar até 6 treinos, biblioteca |
| Mudar a ordem dos exercícios | Arrastar pela alça |
| Jornadas prontas | Objetivos com treinos prontos |
| Animação "Montando seus treinos" | |
| Aviso da novidade / Novidade: Evolução | Avisos ao abrir o app |
| Instalar o app | Linha em Você: pedido do navegador (Android) ou passo a passo (iPhone) |
| **`js/telas.js`** | |
| Telas | Navegação e endereço (`#tela`) |
| Eventos | Cliques e formulários (delegação) |
| **`js/temporizador.js`** | |
| Temporizador de descanso | |
| **`js/conta.js`** | |
| Excluir conta | |
| Privacidade (LGPD) | Política, consentimento, baixar meus dados |
| Convites | `?convite=` e pedir acesso |
| **`js/inicio.js`** | |
| Entrada (login com Google) | Tela de login e sessão |
| Início | Abertura do app (chama `carregarDados`) |

## `js/admin.js` (monitoramento): seções

Conexão · Estado · Acesso · On-line agora (Presence) · Cálculos (números da Visão geral) · Render (Visão geral e gráficos) · Usuários · Saúde do app · E-mails · Abas · Detalhe do usuário · Eventos de interface · Excluir conta de um usuário · Convites · Exercícios (catálogo).

Os eventos vêm só do período escolhido (`eventosNecessarios`, em Acesso). Os dados vêm de `todas()` (páginas de 1.000) nas funções `admin_usuarios`, `admin_checkins`, `admin_eventos`, `admin_emails` e `admin_convites`.

## `mundo.html`: seções do script

Conexão · Mapa · Personagens · Linha do tempo · Presença ao vivo · Acesso.

## `supabase/schema.sql`: ordem das partes

Tabelas `perfis`, `checkins`, `cargas` e RLS → `criar_perfil`, `registrar_acesso`, `treinos_validos` → `admins`, `eh_admin`, `eventos`, funções `admin_*` de leitura → Presence (`realtime.messages`) → `emails_enviados` → excluir conta → `convites` e funções de acesso → `videos_exercicios` → `meus_dados_extras` → Storage `fotos-checkin` → catálogo (`exercicios`, `jornadas`, `admin_salvar_exercicio`, `admin_excluir_exercicio`). Procure a parte por `create table if not exists public.<nome>` ou `function public.<nome>`.

## Testes por área

Rode só os da área mexida: `node tests/rodar.cjs test20 test22 …`.

| Área | Testes |
| --- | --- |
| Login, abertura e carregamento (inclui a busca em páginas) | test09, test10, test11, test12, test18, test21, test53, test62, test81 |
| Atualização automática e avisos ao abrir | test36, test78, test79 |
| Tela Treino (cartões, Ficha, vídeo) | test13, test14, test15, test16, test41, test56, test65, test80 |
| Pesos, Sem peso e recordes | test20, test22, test24, test80 |
| Check-in (botão, formulário, foto, celebração) | test19, test51, test72 |
| Atividades (muay, surf, futebol, calistenia) | test37, test48, test68, test75 |
| Dashboard e Evolução | test23, test76, test77 |
| Você (perfil, lista, temporizador) | test25, test39, test70 |
| Minha semana | test17 |
| Meus treinos, biblioteca e jornadas | test36, test38, test40, test55, test58, test59, test63, test71, test73 |
| Privacidade, LGPD e excluir conta | test42, test44, test46 |
| Convites | test43, test47 |
| Eventos de uso | test26, test57 |
| Painel: Visão geral e gráficos (inclui a busca de eventos por período) | test27, test29, test31, test50, test54, test61, test64, test67, test82 |
| Painel: usuários, on-line, saúde, e-mails | test28, test32, test33, test49, test60, test69 |
| Painel: catálogo de exercícios | test74 |
| Resumo semanal por e-mail | test30, test60 e `cd tests && npm run edge` |
| Banco (`schema.sql`) | `tests/sql/rodar.sh` |
| App instalável (PWA), service worker, Instalar o app e sem internet (cópia dos dados e fila de envio) | test83, test84, test85 |
| Harness dos testes (`tests/apoio/`) | todos |
