## PRD — App Bauer: Jiu-Jitsu + Hipertrofia

2026-10-18 · @Bauer

### Visão geral

O App Bauer transforma o plano de 6 semanas "Jiu-Jitsu + Hipertrofia" (hoje um PDF de 15 páginas) numa aplicação web responsiva, usada no navegador do celular, que diz o que treinar hoje, registra cargas e acompanha o peso rumo ao alvo. A primeira versão é compartilhada com um grupo fechado de amigos, cada um com sua conta, seus dados e seus alvos.

**Problema.** O PDF repete as mesmas tabelas em 12 páginas, não registra cargas, não reorganiza a semana quando surge uma aula extra de jiu-jitsu e deixa o controle de progresso numa tabela em branco para preencher à mão.

**Solução.** Um app que:

- Mostra a atividade do dia (Treino 1, 2 ou 3, jiu-jitsu, bike ou descanso) com base na agenda semanal e nos dias de jiu-jitsu escolhidos pelo usuário.
- Registra a carga de cada série por exercício, pré-preenchida com a da última vez, com vídeo de execução.
- Faz check-in de cada treino (musculação, jiu-jitsu ou bike), quantas vezes for preciso no mesmo dia.
- Mostra um Dashboard com calendário de check-ins, os treinos feitos em cada um e a semana comparada ao plano.
- Aplica as regras do plano automaticamente: fase da semana, passada em 3×16 nas semanas 5–6, deslocamento das pernas de sexta para sábado.
- Acompanha peso médio semanal, % de gordura, proteína e recuperação.

**Objetivo do produto.** Fazer cada usuário completar as 6 semanas com aderência alta, perdendo gordura de forma gradual (no caso do Bauer, 76 → 74 kg) sem perder força nem desempenho no tatame.

### Estado atual do app

Existe um protótipo funcional (um único `index.html`, sem build) que roda no navegador do celular. Ele guarda tudo no `localStorage` do aparelho, ainda sem contas nem sincronização. A navegação é feita por uma barra inferior com três telas:

| Tela | O que já faz |
| --- | --- |
| **Treino** | Data, hora e atividade de hoje no topo; abas Treino 1, 2 e 3 (abre no treino do dia); filtro por foco (Hipertrofia, Força, Explosão, Mobilidade); "Sobre o treino" com objetivo, o que esperar e impacto no jiu e no físico; ficha com os exercícios, dose, PSE-alvo, graus H/F/E/M, botão "Registrar pesos" e vídeo; botão de check-in; agenda da semana com dias feitos e treinos extras |
| **Dashboard** | Números (check-ins no total, no mês, horas treinadas no mês, recuperação média em 30 dias); esta semana × plano; calendário mensal com selos por tipo; lista dos check-ins do dia com detalhe dos exercícios e cargas; exclusão de check-in; novo check-in (rápido, extra ou retroativo); barras por tipo no mês |
| **Você** | Dados pessoais (nome, e-mail validado, foto recortada no aparelho e exibida na barra inferior); tema (automático, claro, escuro); dias de jiu-jitsu, com avisos de conflito |

Ainda não existem: contas, convites, sincronização em nuvem, onboarding com peso e alvo, semana/fase do bloco de 6 semanas, registro de peso e proteína, tela de progresso, timer de descanso, exportação e instalação como PWA. A seção de requisitos mostra o status de cada item.

### Público-alvo e persona

O MVP atende um grupo fechado: o Bauer, criador do plano e administrador do grupo, e amigos convidados por ele que treinam jiu-jitsu e musculação. A abertura ao público fica para uma versão futura.

**Persona: Bauer, praticante de jiu-jitsu em recomposição corporal**

| Atributo | Valor |
| --- | --- |
| Peso atual | 76 kg |
| Gordura corporal | 13,8% |
| Primeiro alvo | 74 kg (73 kg só se desempenho e recuperação estiverem bons) |
| Rotina | 3× musculação + 2× jiu-jitsu por semana; bike leve opcional |
| Dieta | Não conta calorias; referência de 140–165 g de proteína/dia |
| Onde usa | Navegador do celular, na academia, entre séries, muitas vezes com uma mão só |

**O que ele precisa:** saber em segundos o treino do dia, anotar a carga sem digitar muito, ver se está progredindo e ajustar a semana quando a agenda do tatame muda.

**O que o frustra:** rolar o PDF procurando a semana certa, esquecer a carga da semana anterior e não saber se o peso está caindo rápido ou devagar demais.

**Persona secundária: amigo convidado**

Pratica jiu-jitsu, tem peso e alvo próprios e recebe o link de convite do Bauer. Quer seguir o mesmo plano sem montar nada, ver os próprios números e ter a segurança de que seus dados de corpo não ficam visíveis para o grupo sem sua permissão.

### Objetivos e métricas de sucesso

O MVP é bem-sucedido se os usuários concluírem o bloco de 6 semanas registrando pelo menos 90% das sessões e atingirem o primeiro alvo de peso mantendo as cargas principais.

| Métrica | Meta | Como medir |
| --- | --- | --- |
| Aderência à musculação | ≥ 90% das 18 sessões previstas | Check-ins de musculação concluídos ÷ sessões planejadas |
| Aderência ao jiu-jitsu | ≥ 10 de 12 aulas | Check-ins de jiu-jitsu |
| Registro de cargas | ≥ 95% dos exercícios principais com carga registrada | Agachamento, deadlift, supino no chão, desenvolvimento, puxada, remada inversa, passada |
| Peso médio semanal | Alvo individual (Bauer: 76 → 74 kg, ~0,3 kg/semana) | Média das pesagens da semana |
| Força preservada | Carga dos exercícios principais igual ou maior que na semana 1 | Comparação semana 1 × semana 6 |
| Tempo para registrar uma série | ≤ 5 s | Teste de usabilidade |

Métricas do grupo (metas propostas): ≥ 70% dos amigos convidados criam conta e ≥ 50% concluem as 6 semanas.

### Escopo do MVP

O MVP cobre um grupo de amigos convidados, cada um com conta e dados próprios, um único bloco de 6 semanas e funciona offline, sincronizando com a nuvem quando houver internet.

**Dentro do escopo**

- Contas individuais com login e convite por link ou código, gerado pelo administrador.
- Dados de cada usuário separados e privados; sincronização entre aparelho e nuvem.
- Plano Bauer como modelo comum; cada usuário define peso, alvo e data de início.
- Perfil do usuário (nome, e-mail, foto), tema claro/escuro e dias de jiu-jitsu.
- Agenda semanal com a atividade do dia e regra de deslocamento das pernas de sexta para sábado.
- Execução dos Treinos 1, 2 e 3 com registro da carga de cada série.
- Filtro dos exercícios por foco e explicação de cada treino ("Sobre o treino").
- Vídeo de referência por exercício (YouTube Shorts).
- Progressão automática por fase (semanas 1–2, 3–4, 5–6).
- Check-in de treino para musculação (Treinos 1, 2 e 3), jiu-jitsu e bike, com nota de recuperação; vários check-ins no mesmo dia.
- Dashboard com calendário de check-ins: visão do mês com os dias treinados e detalhe de cada check-in com os treinos e exercícios feitos.
- Registro de peso diário e % de gordura opcional; média semanal calculada.
- Registro simples de proteína diária.
- Tela de progresso que substitui a página "Controle de progresso" do PDF.
- Timer de descanso entre séries.
- Acesso pelo navegador via link, sem loja de apps; instalável na tela inicial do celular (PWA).

**Fora do escopo (MVP)**

- Apps nativos para iOS e Android e publicação nas lojas.
- Contagem de calorias e plano alimentar completo.
- Criação de planos personalizados por IA ou por treinador.
- Integração com relógios e apps de saúde.
- Feed social, chat e ranking entre usuários.
- Recomendações médicas ou de lesão (o app mantém o aviso de que não substitui profissional).

### Requisitos funcionais

São 35 requisitos em 9 grupos; os marcados P0 bloqueiam o lançamento do MVP. A coluna Status mostra o que o protótipo atual já entrega: **Feito**, **Parcial** ou **Pendente**.

| ID | Requisito | Prioridade | Status |
| --- | --- | --- | --- |
| **Contas e convites** |  |  |  |
| RF-01 | Cadastro e login por e-mail ou conta Google/Apple | P0 | Pendente |
| RF-02 | Administrador (Bauer) gera link ou código de convite; só entra quem foi convidado | P0 | Pendente |
| RF-03 | Cada usuário vê apenas os próprios registros; nada é compartilhado sem ele ativar | P0 | Parcial: dados ficam só no aparelho |
| RF-04 | Sincronização dos dados entre aparelho e nuvem, mantendo o uso offline | P0 | Parcial: funciona offline, sem nuvem |
| RF-05 | Usuário pode excluir a conta e todos os seus dados | P0 | Pendente |
| **Onboarding e configuração** |  |  |  |
| RF-06 | Usuário informa peso atual, % de gordura, alvo próprio e data de início do bloco | P0 | Pendente |
| RF-07 | Usuário escolhe os dias de jiu-jitsu (padrão: terça e quinta; segunda a sábado, domingo bloqueado); a agenda, o topo da tela Treino e as metas do Dashboard se ajustam na hora | P0 | Feito |
| RF-31 | Tela Você com dados pessoais: nome, e-mail (validado) e foto, recortada e reduzida no aparelho e exibida na barra inferior | P1 | Feito |
| RF-32 | Tema do app: automático (segue o celular), claro ou escuro, aplicado antes da primeira pintura | P1 | Feito |
| **Agenda e treino do dia** |  |  |  |
| RF-08 | Tela Treino mostra data, hora e atividade do dia; mostra também semana atual (1–6) e fase | P0 | Parcial: falta semana e fase |
| RF-09 | Agenda fixa: segunda Treino 2, quarta Treino 1, sexta Treino 3 (pernas); a ficha abre no treino do dia na primeira visita de cada dia | P0 | Feito |
| RF-10 | Botão "Teve jiu na sexta" move o Treino 3 para sábado ou o marca como pulado | P0 | Pendente |
| RF-11 | Usuário pode reagendar manualmente qualquer sessão dentro da semana | P1 | Pendente |
| **Execução do treino** |  |  |  |
| RF-12 | Lista os exercícios do treino na ordem do plano, com dose, PSE-alvo e graus de contribuição H/F/E/M (Alta/Média/Baixa) | P0 | Feito |
| RF-13 | Registro da carga (kg) de cada série num painel "Registrar pesos"; aceita vírgula ou ponto, Enter passa para a próxima série; o botão do exercício mostra as cargas de hoje | P0 | Feito |
| RF-14 | Pré-preenche a carga com o valor do último check-in do mesmo treino e mostra "Última vez: …" | P0 | Feito |
| RF-15 | Abre o vídeo de execução do exercício | P1 | Parcial: 18 de 22 exercícios com vídeo |
| RF-16 | Timer de descanso configurável, iniciado ao concluir a série | P1 | Pendente |
| RF-17 | Exibe "Sobre o treino" (objetivo, o que esperar, impacto no jiu-jitsu e no físico) e o motivo de cada exercício | P2 | Feito |
| RF-33 | Filtro da ficha por foco (Hipertrofia, Força, Explosão, Mobilidade), mostrando só os exercícios de alta contribuição | P2 | Feito |
| **Jiu-jitsu e cardio** |  |  |  |
| RF-18 | Check-in de aula de jiu-jitsu com duração e nota de recuperação (1–5) | P0 | Feito |
| RF-19 | Registro de bike (20–40 min, intensidade leve/moderada) | P1 | Parcial: check-in com duração, sem intensidade |
| **Corpo e nutrição** |  |  |  |
| RF-20 | Registro de peso diário; média semanal e tendência calculadas | P0 | Pendente |
| RF-21 | Registro opcional de % de gordura e proteína diária, com meta calculada pelo peso do usuário (~1,8–2,2 g/kg) | P1 | Pendente |
| **Progresso e grupo** |  |  |  |
| RF-22 | Tela de progresso: peso médio, carga dos exercícios principais e aderência por semana | P0 | Parcial: aderência semanal no Dashboard |
| RF-23 | Exportar o histórico do bloco em CSV ou PDF | P2 | Pendente |
| RF-24 | Compartilhar, se o usuário ativar, só a aderência semanal (treinos feitos) com o grupo | P2 | Pendente |
| **Check-in de treino** |  |  |  |
| RF-25 | Check-in de musculação: começa pelo botão "Iniciar check-in" ou ao salvar o primeiro peso; uma barra "em andamento" fica visível em todas as telas; ao encerrar, mostra quantos exercícios tiveram carga e pede recuperação (opcional) e observação; as cargas ficam ligadas ao check-in | P0 | Feito |
| RF-26 | Permitir mais de um check-in no mesmo dia (ex.: musculação de manhã e jiu-jitsu à noite), cada um com horário, tipo e duração próprios | P0 | Feito |
| RF-30 | Novo check-in rápido, extra ou retroativo (tipo, data até hoje, início, duração de 1 a 600 min, recuperação, observação); excluir check-in com confirmação; editar check-in | P1 | Parcial: falta editar |
| **Dashboard e calendário** |  |  |  |
| RF-27 | Calendário mensal no Dashboard: cada dia mostra selos por tipo (1, 2, 3 para musculação, J para jiu-jitsu, B para bike); com mais de dois check-ins mostra o primeiro e "+N"; navegação entre meses até o mês atual | P0 | Feito |
| RF-28 | Ao tocar num dia, listar os check-ins daquele dia em ordem de horário, com tipo, horário, duração e recuperação; dia sem check-in oferece "Registrar check-in neste dia" | P0 | Feito |
| RF-29 | Ao abrir um check-in de musculação, mostrar a observação e cada exercício do treino com as cargas por série; exercícios sem carga aparecem como "sem registro" | P0 | Feito |
| RF-34 | Números do Dashboard: check-ins no total, check-ins e horas treinadas no mês, recuperação média dos últimos 30 dias | P1 | Feito |
| RF-35 | "Esta semana" × plano (musculação 3, jiu-jitsu = dias escolhidos, bike opcional) e barras com a contagem de check-ins por tipo no mês exibido | P1 | Feito |

### Modelo de dados

O plano é um modelo único, compartilhado por todos os usuários e guardado como dados, não como 12 telas fixas: 3 treinos-modelo, 22 exercícios e 3 fases geram as 6 semanas.

| Entidade | Campos principais |
| --- | --- |
| Usuário | nome, e-mail, foto, papel (administrador ou membro), data de cadastro |
| Configuração | usuário, tema (automático, claro, escuro), dias de jiu-jitsu |
| Convite | código, criado por, validade, usado por |
| Plano (modelo) | nome, duração (6 semanas) |
| Inscrição no plano | usuário, plano, data de início, peso inicial, alvo, compartilha aderência (sim/não) |
| Fase | número (1–3), semanas (1–2, 3–4, 5–6), foco, orientação |
| Treino-modelo | código (1, 2 ou 3), nome, subtítulo, objetivo, o que esperar, impacto no jiu-jitsu, impacto no físico, lista ordenada de exercícios |
| Exercício | nome, dose (séries × reps/tempo/por lado), PSE-alvo, graus H/F/E/M (Alta/Média/Baixa), justificativa, vídeo, é principal (sim/não) |
| Ajuste por fase | exercício, fase, nova dose (ex.: Passada 3×16 na fase 3) |
| Sessão | inscrição, data, tipo (Treino 1, 2, 3, jiu-jitsu, bike, descanso), semana, status (planejada, feita, pulada, movida) |
| Check-in | usuário, tipo (Treino 1, 2, 3, jiu-jitsu, bike), início, fim (vazio enquanto aberto), sem horário (sim/não), recuperação (1–5, opcional), observação, retroativo (sim/não), hora da última série |
| Série registrada | check-in, exercício, nº da série, carga (kg) |
| Medida corporal | usuário, data, peso (kg), % de gordura (opcional) |
| Proteína | usuário, data, gramas |

Um dia pode ter vários check-ins (relação 1 dia → N check-ins), e cada check-in de musculação guarda as próprias séries. O calendário é montado agrupando os check-ins por data. No protótipo, a sessão planejada não é gravada: ela é calculada pela agenda semanal, e o dia conta como feito quando há check-in encerrado do tipo planejado.

No protótipo, os dados ficam em quatro chaves do `localStorage`: check-ins com suas séries, configuração, perfil e estado da tela (treino aberto, filtro). Cargas salvas antes da criação dos check-ins são convertidas em check-ins retroativos "sem horário".

Exercícios por treino, conforme o app:

- **Treino 1 — Costas + bíceps (8):** Escorpião, Carregada na marcha, Alcance diagonal, Remada inversa, Rotação no cabo, Puxada, Superman, Rosca bíceps.
- **Treino 2 — Peito, tríceps e ombro (8):** Rolamento, Quadrupedia tocando os ombros, Supino no chão, TGU parcial, Desenvolvimento, Halo, Elevação lateral, Tríceps.
- **Treino 3 — Pernas (6):** Cócoras, Quadril alto/baixo, Agachamento, Deadlift, Passada para frente, Panturrilha.

Agenda semanal padrão:

| Seg | Ter | Qua | Qui | Sex | Sáb | Dom |
| --- | --- | --- | --- | --- | --- | --- |
| Treino 2 | Jiu-jitsu | Treino 1 | Jiu-jitsu | Treino 3 (pernas) | Bike leve ou Treino 3 deslocado | Descanso |

### Fluxos e telas principais

O fluxo central começa na tela Treino: o app mostra a atividade do dia e todo treino termina num check-in encerrado, que aparece no Dashboard e alimenta a semana.

> [Diagrama: fluxo diário · 1 decisão, 3 caminhos]

Todo treino passa por um check-in. Na musculação, o check-in é aberto ao iniciar o treino (ou ao salvar o primeiro peso) e fechado ao terminar, com o registro das cargas no meio. Jiu-jitsu e bike pedem apenas um check-in rápido pelo Dashboard. Depois de encerrado, o check-in aparece no calendário, e um novo check-in pode ser aberto no mesmo dia.

| Tela | Conteúdo principal |
| --- | --- |
| Onboarding | Entrar pelo convite, criar conta; depois peso, % de gordura, alvo, data de início, dias de jiu-jitsu (pendente) |
| Treino | Data, hora e atividade de hoje; abas Treino 1, 2 e 3; filtro por foco; "Sobre o treino"; ficha com exercícios, dose, PSE-alvo, graus H/F/E/M, "Registrar pesos" e vídeo; iniciar check-in; agenda da semana com dias feitos e extras |
| Registrar pesos | Painel (folha inferior no celular) com uma linha por série, carga pré-preenchida, "Última vez", Concluir |
| Encerrar check-in | Início e duração, exercícios com carga, recuperação 1–5, observação |
| Novo check-in | Tipo, data, início, duração, recuperação 1–5, observação |
| Dashboard | Números, esta semana × plano, calendário mensal, check-ins do dia com detalhe e exclusão, barras por tipo no mês |
| Você | Dados pessoais e foto, tema, dias de jiu-jitsu com avisos |
| Progresso | Peso médio por semana, cargas principais, aderência, % de gordura (pendente) |
| Ajustes | Unidades, exportação, privacidade, convidar amigos (administrador), excluir conta, aviso legal (pendente; parte já está em Você) |

### Regras de negócio

Todas as regras vêm do plano original; o app as aplica sem que o usuário precise lembrar delas. As marcadas como pendentes ainda não estão no protótipo.

1. **Semana e fase (pendente):** semana = dias desde o início ÷ 7, arredondado para cima (1–6). Fase 1 = semanas 1–2, fase 2 = 3–4, fase 3 = 5–6.
2. **Agenda dos treinos:** segunda = Treino 2, quarta = Treino 1, sexta = Treino 3 (pernas). Pernas ficam na sexta para ter o fim de semana de recuperação e não pesar antes do jiu de terça.
3. **Conflito de sexta (pendente):** se houver jiu-jitsu na sexta, o Treino 3 vai para sábado; se sábado já tiver bike, a bike é substituída. Sem espaço, a sessão é marcada como pulada.
4. **Domingo:** sempre descanso; não pode ser escolhido como dia de jiu-jitsu.
5. **Avisos de jiu-jitsu:** se um dia de jiu coincidir com um treino de musculação, o app avisa para fazer um check-in de cada. Com jiu no sábado, o app alerta que ele vem logo depois das pernas de sexta e tira a bike da semana.
6. **Progressão de dose (pendente):** na fase 3, Passada para frente passa de 3×10 para 3×16.
7. **Fase 2 (tempo sob tensão) (pendente):** o app exibe lembrete de cadência controlada nos exercícios principais.
8. **PSE:** cada exercício mostra o PSE-alvo; o PSE real não é registrado. PSE 10 fica reservado ao tatame. Na fase 3, os complementos (elevação lateral, tríceps, rosca, panturrilha) devem mostrar "não ir à falha" (pendente).
9. **Peso médio (pendente):** média das pesagens de seg–dom; ajustes só são sugeridos após 2 semanas de média.
10. **Segundo alvo (pendente) (Bauer: 73 kg):** só é liberado depois de atingir o primeiro alvo (Bauer: 74 kg) com recuperação média ≥ 3 e cargas principais estáveis ou maiores.
11. **Bike:** sábado tem bike leve opcional (20–40 min) quando não há jiu-jitsu; a meta da semana conta 1 bike. Marcar como dispensável se o peso cair no ritmo previsto (≥ 0,25 kg/semana) fica pendente.
12. **Check-in e sessão:** um check-in encerrado do tipo planejado marca o dia como feito na agenda. Check-ins de tipos não planejados aparecem como extras ("+ Jiu-jitsu") e não alteram a agenda.
13. **Vários check-ins por dia:** não há limite de check-ins por dia, mas só um pode ficar aberto por vez; ao iniciar outro, o app pede para encerrar o que está aberto. Check-ins do mesmo dia não podem se sobrepor no horário.
14. **Check-in esquecido:** um check-in aberto há mais de 3 horas gera aviso na barra "em andamento"; na próxima abertura do app, ele é encerrado na hora da última série registrada (ou 1 hora após o início, se não houver série) e o usuário é avisado.
15. **Check-in retroativo:** a data não pode ser no futuro e a duração vai de 1 a 600 min; check-ins de datas passadas ficam marcados como retroativos.
16. **Duração padrão:** 60 min para musculação e jiu-jitsu, 30 min para bike.
17. **Exclusão:** excluir um check-in apaga também as cargas registradas nele, após confirmação.

### Requisitos não funcionais

| Área | Requisito |
| --- | --- |
| Plataforma | Aplicação web responsiva, mobile first, como PWA instalável (ex.: Next.js ou React + Vite); funciona em Chrome, Safari e Edge atuais. Protótipo atual: um único HTML com JavaScript puro, ainda sem manifesto nem service worker |
| Distribuição | Amigos acessam por um link (domínio próprio, HTTPS); sem lojas de apps |
| Offline | Service worker e cache local: registro de treino, peso e check-ins funciona sem internet e sincroniza ao reconectar; vídeos abrem com conexão |
| Desempenho | Primeira carga ≤ 3 s em 4G; tela inicial em ≤ 1 s após instalada; registrar uma série em ≤ 2 toques |
| Usabilidade | Layout para telas a partir de 360 px, botões ≥ 48 px, uso com uma mão, tema claro por padrão para academia iluminada e escuro opcional; painéis abrem como folha inferior no celular; foco visível no teclado e respeito a "reduzir movimento" |
| Visual | Tipografia Archivo; paleta do kimono (fundo claro), azul do tatame para ações e preto da faixa; graus de contribuição mostrados como fitas na ponteira da faixa |
| Dados | Armazenamento local no navegador (IndexedDB) + backend na nuvem com autenticação (ex.: Supabase ou Firebase). Protótipo atual: `localStorage`, com aviso na tela de que os dados ficam só neste navegador |
| Privacidade e segurança | Regras de acesso por usuário no backend; dados de saúde não são vendidos nem enviados a terceiros; consentimento no cadastro e exclusão de conta (LGPD) |
| Idioma | Português do Brasil; unidades em kg e minutos; cargas aceitam vírgula decimal |
| Aviso legal | Onboarding, tela de progresso e rodapé da tela Treino exibem que o app não substitui profissional de educação física ou nutrição |

### Roadmap, riscos e questões em aberto

**Roadmap**

1. **Protótipo (atual):** telas Treino, Dashboard e Você; registro de cargas; check-ins com calendário; dias de jiu-jitsu; dados no navegador.
2. **MVP (web, grupo de amigos):** PWA responsiva, contas, convites, sincronização, onboarding com peso e alvo, semana e fase, peso e proteína, tela de progresso, timer de descanso, requisitos P0 + P1 pendentes, plano Bauer como modelo comum; acesso por link.
3. **v1.1:** exportação CSV/PDF (incluindo o histórico de check-ins), gráficos de carga por exercício, lembretes por notificação web, aderência compartilhada opcional (RF-24).
4. **v2 (nativo e público):** apps iOS e Android, publicação nas lojas, editor de planos, novos blocos após as 6 semanas, integração com Apple Saúde / Health Connect.

**Riscos**

| Risco | Mitigação |
| --- | --- |
| Registrar séries atrapalha o treino e o usuário abandona | Carga pré-preenchida, Enter passa para a próxima série, Concluir salva o que está na tela; opção "repetir sessão anterior" |
| No iPhone, o navegador limita notificações e armazenamento offline | Orientar a instalar na tela inicial; sincronizar sempre que houver conexão |
| Navegador apaga os dados locais antes da sincronização | Hoje não há nuvem: o protótipo avisa que os dados ficam só no navegador. No MVP, sincronizar após cada check-in e avisar quando houver registros pendentes |
| O plano foi montado para o perfil do Bauer e pode não servir a todos os amigos | Cada um define alvo e cargas; aviso para buscar profissional antes de começar |
| Vazamento de dados de saúde de terceiros | Acesso restrito por usuário, nada compartilhado por padrão, exclusão de conta |
| Peso oscila e gera ajustes precipitados | Decisões só pela média de 2 semanas (regra 9) |
| Usuário treina até a falha | PSE-alvo visível em cada exercício e lembrete "não ir à falha" nos complementos |
| Vídeos do YouTube saem do ar | Guardar descrição curta de execução como alternativa |
| Dor ou lesão | Botão "senti dor" que pula o exercício e recomenda procurar profissional |

**Questões em aberto**

- Quantos amigos entram no grupo inicial?
- Os amigos podem ver o progresso uns dos outros ou cada um vê só o seu?
- Todos seguem exatamente o plano do Bauer ou alguns precisam de variações?
- Quais são os vídeos de Rosca bíceps, Elevação lateral, Tríceps e Panturrilha (os outros 18 exercícios já têm)?
- O PSE real por série volta a ser registrado ou fica só o PSE-alvo?
- Qual cadência exata usar na fase 2 (ex.: 3 s na descida)?
- Após a semana 6, o app repete o bloco, sugere deload ou encerra?
- Algum recurso exige app nativo já no MVP (ex.: notificações confiáveis no iPhone)?
