## PRD — App Bauer: Jiu-Jitsu + Hipertrofia

2026-10-26 · @Bauer

### Visão geral

O App Bauer transforma o plano de 6 semanas "Jiu-Jitsu + Hipertrofia" (hoje um PDF de 15 páginas) numa aplicação web responsiva, usada no navegador do celular, que diz o que treinar hoje, registra cargas e acompanha o peso rumo ao alvo. A primeira versão é compartilhada com um grupo fechado de amigos, cada um com sua conta, seus dados e seus alvos.

**Problema.** O PDF repete as mesmas tabelas em 12 páginas, não registra cargas, não reorganiza a semana quando surge uma aula extra de jiu-jitsu e deixa o controle de progresso numa tabela em branco para preencher à mão.

**Solução.** Um app que:

- Mostra a atividade do dia (treinos de musculação, jiu-jitsu, muay thai, surf, cardio ou descanso) com base na semana que o próprio usuário monta.
- Registra a carga de cada série por exercício, pré-preenchida com a da última vez, com vídeo de execução no próprio cartão.
- Faz check-in de cada treino (musculação, jiu-jitsu ou cardio) por um botão fixo, quantas vezes for preciso no mesmo dia.
- Mostra um Dashboard com calendário de check-ins, os treinos feitos em cada um e a semana comparada ao plano.
- Aplica as regras do plano automaticamente: fase da semana, passada em 3×16 nas semanas 5–6, avisos de conflito na semana.
- Acompanha peso médio semanal, % de gordura e proteína.

**Objetivo do produto.** Fazer cada usuário completar as 6 semanas com aderência alta, perdendo gordura de forma gradual (no caso do Bauer, 76 → 74 kg) sem perder força nem desempenho no tatame.

### Estado atual do app

O app está no ar em https://marcelobauer89.github.io/App-Treino/ (GitHub Pages). É um único `index.html`, sem build, que funciona online: o login é feito com a conta Google e os dados de cada usuário ficam no **Supabase** (Postgres com regras de acesso por usuário). Na tela de entrada aparecem o título "OSS", a descrição "Exercícios de Jiu Jitsu e hipertrofia", o botão "Continuar com o Google", a nota "Usamos sua conta Google só para entrar e guardar seus treinos." e o crédito "Desenvolvido por Marcelo Bauer". Há também um painel de monitoramento separado, `admin.html`, e o Mundo ao vivo, `mundo.html`, que só administradores conseguem abrir. No app, a navegação é feita por uma barra inferior com três telas, e um botão verde fixo, "Fazer check-in", fica no canto inferior direito das telas Treino e Dashboard.

| Tela | O que já faz |
| --- | --- |
| **Treino** | Data, hora e atividade de hoje no topo; uma aba por treino (os 3 do plano pronto ou até 5 montados pela pessoa, com nome e foco ou número de exercícios; abre no treino do dia); filtro por foco (Hipertrofia, Força, Explosão, Mobilidade); "Sobre o treino" com objetivo, o que esperar e impacto no jiu e no físico; cada exercício num cartão próprio com dose, PSE-alvo, graus H/F/E/M e botão "Terminei o exercício" (com peso: cargas por série; sem peso: marca como feito) e troféu quando a carga do dia é recorde; deslizando o cartão para o lado aparece o vídeo de execução, que toca sem som; agenda da semana com dias feitos e treinos extras |
| **Dashboard** | Números (check-ins no total, no mês, horas treinadas no mês, dias com treino no mês); esta semana × plano; calendário mensal com selos por tipo; lista dos check-ins do dia com detalhe dos exercícios e cargas; edição do check-in e correção dos pesos de cada exercício naquele dia; exclusão de check-in; barras por tipo no mês |
| **Você** | Lista no estilo dos Ajustes do celular: cartão do perfil (foto, nome, e-mail) que abre Dados pessoais, salvos automaticamente; grupos com ícone, nome, valor atual e seta: **Meus treinos** (montar até 5 treinos com a biblioteca de 71 exercícios, Desfazer e Restaurar versão anterior), **Minha semana** (arrastar as atividades para os dias, com avisos), **Aparência** (tema), **Notificações** (resumo semanal por e-mail), **Privacidade** (aviso do registro de uso, Política de Privacidade, interruptor "Registrar observações nos check-ins" e Baixar meus dados), Sair da conta e Excluir conta, em vermelho; cada opção abre a própria tela com "‹ Você" para voltar |
| **Monitoramento** (`admin.html`, só administradores) | Cinco abas (Visão geral, Usuários, Saúde do app, E-mails, Convites), com o período comum (Hoje, 7, 30, 90 dias ou Tudo) e a aba guardada no endereço (ex.: `admin.html#saude`). **Visão geral:** On-line agora (ao vivo, com a tela atual, há quanto tempo está no app e status da conexão: "Ao vivo", "Ao vivo em X de Y usuários" ou o erro exato), com ponto verde pulsando na aba quando há alguém on-line; números do período (usuários ativos, check-ins, treinos por semana, ou por usuário em Hoje, aderência, retorno, quem sumiu e recordes), cada um com seta de comparação com o período anterior e ícone de informação; gráficos de check-ins por tipo e de usuários ativos (por hora em Hoje, por dia ou por semana), também com ícone de informação e "Ver tabela"; "Quem sumiu" (check-in nas últimas 4 semanas e nenhum nos últimos 7 dias, com o último treino e o ritmo anterior, quem treinava mais primeiro) e "Quem mais evoluiu" (ranking de recordes pessoais no período, com os exercícios, sem os pesos). **Usuários:** lista com situação, busca, ordenação, CSV e lixeira para excluir a conta de um usuário; detalhe com check-ins das últimas 8 semanas, semana montada, exercícios sem peso, se recebe o resumo e atividade recente (7 por vez, com "Mostrar mais", agrupada por dia). **Saúde do app:** só erros críticos (erros de programação, gravações recusadas pelo banco, com a dica de rodar o `schema.sql`, e falha ao excluir conta) e usuários afetados; gráfico de erros críticos, erros agrupados com "Acontecendo agora" e ocorrências por usuário, bolinha com os erros críticos das últimas 24 h. Quedas de internet, reconexões do ao vivo, login de novo e ruídos do navegador ficam de fora. **E-mails:** cartão do próximo resumo (dia, quanto falta, período e quem vai receber), envios por semana com abertos e clicados, quem recebeu (Enviado, Abriu, Clicou) e quem não recebeu e por quê. **Convites:** gerar link por pessoa (vale 7 dias), copiar ou enviar pelo WhatsApp, cancelar e excluir; convites gerados separados dos utilizados (inclusive quem foi liberado por pedido de acesso); pedidos de acesso com Liberar e Recusar, com selo da quantidade na aba. Nunca mostra pesos, cargas nem observações |
| **Mundo ao vivo** (`mundo.html`, só administradores) | Mapa em pixel art com um personagem por pessoa com o app aberto, que anda até o lugar da tela ou da última ação (Portão, Academia, Tatame, Pista, Torre, Casa), com balão do nome e da ação e animação de recorde; placar de quem está no app e dos check-ins e recordes de hoje; linha do tempo do dia; quem está fora do app e há quanto tempo; tela cheia para telão. Nunca mostra pesos, cargas nem observações |

Ainda não existem: modo offline, onboarding com peso e alvo, semana/fase do bloco de 6 semanas, registro de peso e proteína, tela de progresso, timer de descanso, exportação do histórico em CSV ou PDF (já há "Baixar meus dados" em JSON) e instalação como PWA. A seção de requisitos mostra o status de cada item.

### Público-alvo e persona

O MVP atende um grupo fechado: o Bauer, criador do plano e administrador do grupo, e amigos convidados por ele que treinam jiu-jitsu e musculação. A abertura ao público fica para uma versão futura.

**Persona: Bauer, praticante de jiu-jitsu em recomposição corporal**

| Atributo | Valor |
| --- | --- |
| Peso atual | 76 kg |
| Gordura corporal | 13,8% |
| Primeiro alvo | 74 kg (73 kg só se desempenho e recuperação estiverem bons) |
| Rotina | 3× musculação + 2× jiu-jitsu por semana; cardio leve opcional |
| Dieta | Não conta calorias; referência de 140–165 g de proteína/dia |
| Onde usa | Navegador do celular, na academia, entre séries, muitas vezes com uma mão só |

**O que ele precisa:** saber em segundos o treino do dia, anotar a carga sem digitar muito, ver se está progredindo e ajustar a semana quando a agenda do tatame muda.

**O que o frustra:** rolar o PDF procurando a semana certa, esquecer a carga da semana anterior e não saber se o peso está caindo rápido ou devagar demais.

**Persona secundária: amigo convidado**

Pratica jiu-jitsu, tem peso e alvo próprios e recebe o link do app do Bauer. Quer seguir o mesmo plano sem montar nada, ver os próprios números e ter a segurança de que seus dados de corpo não ficam visíveis para o grupo sem sua permissão.

### Objetivos e métricas de sucesso

O MVP é bem-sucedido se os usuários concluírem o bloco de 6 semanas registrando pelo menos 90% das sessões e atingirem o primeiro alvo de peso mantendo as cargas principais.

| Métrica | Meta | Como medir |
| --- | --- | --- |
| Aderência à musculação | ≥ 90% das 18 sessões previstas | Check-ins de musculação ÷ sessões planejadas |
| Aderência ao jiu-jitsu | ≥ 10 de 12 aulas | Check-ins de jiu-jitsu |
| Registro de cargas | ≥ 95% dos exercícios principais com carga registrada | Agachamento, deadlift, supino no chão, desenvolvimento, puxada, remada inversa, passada |
| Peso médio semanal | Alvo individual (Bauer: 76 → 74 kg, ~0,3 kg/semana) | Média das pesagens da semana |
| Força preservada | Carga dos exercícios principais igual ou maior que na semana 1 | Comparação semana 1 × semana 6 |
| Tempo para registrar uma série | ≤ 5 s | Teste de usabilidade |
| Uso do app | Acessos frequentes durante o bloco | Último acesso e quantidade de acessos por usuário, consultados no Supabase |

Métricas do grupo (metas propostas): ≥ 70% dos amigos convidados criam conta e ≥ 50% concluem as 6 semanas.

### Escopo do MVP

O MVP cobre um grupo de amigos convidados, cada um com conta e dados próprios, e um único bloco de 6 semanas. Hoje o app funciona online; o modo offline com sincronização segue no escopo do MVP.

**Dentro do escopo**

- Contas individuais com login pela conta Google; convite por link ou código, gerado pelo administrador.
- Dados de cada usuário separados e privados, guardados na nuvem; uso offline com sincronização.
- Plano Bauer como modelo comum; cada usuário define peso, alvo e data de início.
- Perfil do usuário (nome, e-mail, foto) e tema claro/escuro.
- Semana montada pelo usuário (até 2 atividades por dia), com a atividade do dia no topo da tela Treino.
- Treinos personalizados: até 5 treinos montados com uma biblioteca de exercícios, ou o plano pronto (Treinos 1, 2 e 3).
- Execução dos treinos com registro da carga de cada série.
- Filtro dos exercícios por foco e explicação de cada treino ("Sobre o treino").
- Vídeo de referência por exercício (YouTube Shorts), dentro do cartão.
- Progressão automática por fase (semanas 1–2, 3–4, 5–6).
- Check-in de treino para musculação (Treinos 1 a 5), jiu-jitsu, muay thai, surf e cardio, com observação opcional; vários check-ins no mesmo dia.
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

São 57 requisitos em 11 grupos; os marcados P0 bloqueiam o lançamento do MVP. A coluna Status mostra o que o app atual já entrega: **Feito**, **Parcial** ou **Pendente**.

| ID | Requisito | Prioridade | Status |
| --- | --- | --- | --- |
| **Contas e convites** |  |  |  |
| RF-01 | Cadastro e login por e-mail ou conta Google/Apple | P0 | Parcial: login com Google (Supabase Auth); sem e-mail e Apple |
| RF-02 | Administrador (Bauer) gera link ou código de convite; só entra quem foi convidado | P0 | Feito: aba Convites no monitoramento (link por pessoa, vale 7 dias, copiar ou enviar pelo WhatsApp, cancelar, excluir com confirmação; convites gerados separados dos utilizados, que listam quem entrou e quando, inclusive quem foi liberado por pedido de acesso); quem entra sem convite vê "O OSS é só para convidados", com campo para o código e "Pedir acesso" (o pedido aparece no monitoramento para liberar ou recusar, e os administradores recebem um e-mail a cada novo pedido, com link para a aba Convites); bloquear ou liberar cada usuário no detalhe; quem já tinha conta segue liberado; check-ins e cargas exigem conta liberada também no banco |
| RF-03 | Cada usuário vê apenas os próprios registros; nada é compartilhado sem ele ativar | P0 | Feito: regras de acesso (RLS) por usuário em todas as tabelas |
| RF-04 | Sincronização dos dados entre aparelho e nuvem, mantendo o uso offline | P0 | Parcial: dados na nuvem e em qualquer aparelho; sem modo offline (falha ao salvar avisa e recarrega do servidor) |
| RF-05 | Usuário pode excluir a conta e todos os seus dados | P0 | Feito: "Excluir conta" em Você (detalhes em RF-53) |
| RF-36 | Tela de entrada com título "OSS", descrição, botão "Continuar com o Google" em largura total, crédito do desenvolvedor e mensagens claras para login cancelado, erro de configuração e falha de rede | P1 | Feito |
| RF-41 | Registro de eventos de uso (telas, exercícios concluídos, check-ins criados/editados/excluídos, recordes, vídeos, "Sem peso", semana, tema, foto, erros e sessões perdidas, com navegador e aparelho), enviados em lote e sem pesos, cargas ou observações; base do dashboard de monitoramento (`admin.html`, só administradores) | P1 | Parcial: eventos e dashboard (visão geral, usuários, saúde do app e e-mails) feitos; falta a análise de recursos usados e da jornada dos usuários |
| RF-42 | Ver no monitoramento quem está on-line agora, ao vivo, com a tela atual e há quanto tempo está no app (Supabase Realtime Presence em canal privado por usuário; só administradores leem). O painel mostra o status por canal: "Ao vivo" quando todos conectaram, "Ao vivo em X de Y usuários" com o detalhe do erro quando parte falha, e o erro exato quando nenhum conecta; o app registra falhas da presença como evento de erro | P2 | Feito |
| RF-43 | Cada número principal do monitoramento tem um ícone de informação que abre um balão explicando o que mede e como é calculado (um balão aberto por vez; fecha ao tocar fora, no balão ou com Esc) | P2 | Feito |
| RF-44 | Resumo semanal por e-mail toda sexta às 9h (Brasília) com os últimos 7 dias (sexta a quinta): treinos por tipo, dias treinados, aderência ao plano, comparação com a semana anterior e recordes; versão de incentivo para quem não treinou; quem nunca usou o app não recebe. Enviado pelo Gmail por uma Edge Function agendada (pg_cron e pg_net), sem reenviar o mesmo resumo; opção de não receber em Você → Conta, pelo link "Não quero mais receber" do rodapé e pelo botão "Cancelar inscrição" do Gmail | P2 | Feito |
| RF-45 | Monitoramento em abas (Visão geral, Usuários, Saúde do app, E-mails), com período comum e aba guardada no endereço. Saúde do app: só erros críticos (falhas do app que precisam de correção) e usuários afetados, erros agrupados com ocorrências por usuário e alerta das últimas 24 h; o que é normal (internet, reconexão do ao vivo, login de novo, ruído do navegador) não é registrado nem mostrado | P2 | Feito |
| RF-46 | Acompanhamento do resumo semanal no monitoramento: envios por semana, quem recebeu, quem abriu (imagem invisível, aproximado) e quem clicou (exato), quem desligou o resumo e por que alguém não recebeu | P2 | Feito |
| RF-47 | Período Hoje no monitoramento, comparado com ontem: gráficos por hora (24 colunas), "Treinos por usuário" no lugar de "por semana" e aderência pelo que a semana montada prevê para o dia (sem nada planejado, fica fora da média e aparece como —); os cards dos gráficos ganham o ícone de informação | P2 | Feito |
| RF-48 | Mundo ao vivo (`mundo.html`, só administradores): mapa em pixel art onde cada pessoa com o app aberto vira um personagem que anda até o lugar do que está fazendo (Portão ao entrar, Academia no treino, Tatame no check-in de jiu, Pista no cardio, Torre no Dashboard, Casa em Você), com balão do nome e da ação, animação de recorde, linha do tempo do dia, lista de quem está fora do app e tela cheia. A última ação vai na presença (sem cargas) para chegar na hora | P2 | Feito |
| RF-37 | Registrar o último acesso e a quantidade de acessos de cada usuário (1 acesso a cada 30 min no máximo, pela hora do servidor), visíveis só para o administrador no Supabase | P2 | Feito |
| **Onboarding e configuração** |  |  |  |
| RF-06 | Usuário informa peso atual, % de gordura, alvo próprio e data de início do bloco | P0 | Pendente |
| RF-07 | Em Você → Minha semana, o usuário monta a semana arrastando Treino 1, 2, 3, Jiu-jitsu e Cardio para qualquer dia (domingo incluso), até 2 por dia, ou pelo botão + de cada dia; a terceira atividade toma o lugar da mais antiga; soltar fora tira do dia; "Voltar à semana padrão"; a agenda, o topo da tela Treino e as metas do Dashboard se ajustam na hora | P0 | Feito |
| RF-31 | Tela Você com dados pessoais: nome, e-mail da conta Google e foto, recortada e reduzida no aparelho e exibida na barra inferior; nome e foto são salvos automaticamente, sem botão de salvar (o nome após uma pausa na digitação, ao sair do campo ou com Enter); ao escolher a foto aparece "Foto salva com sucesso." ou, ao trocar, "Foto alterada com sucesso." | P1 | Feito |
| RF-32 | Tema do app: automático (segue o celular), claro ou escuro, aplicado antes da primeira pintura | P1 | Feito |
| **Agenda e treino do dia** |  |  |  |
| RF-08 | Tela Treino mostra data, hora e atividade do dia; mostra também semana atual (1–6) e fase | P0 | Parcial: falta semana e fase |
| RF-09 | Semana padrão: segunda Treino 2, terça e quinta jiu-jitsu, quarta Treino 1, sexta Treino 3 (pernas), sábado cardio, domingo descanso; a ficha abre no treino do dia na primeira visita de cada dia | P0 | Feito |
| RF-10 | Aula extra de jiu na sexta: Treino 3 vai para sábado ou é marcado como pulado | P0 | Parcial: o usuário move as atividades em Minha semana; sem ajuste automático |
| RF-11 | Usuário pode reagendar qualquer sessão dentro da semana | P1 | Parcial: edita a semana-tipo em Minha semana, não uma semana específica |
| **Execução do treino** |  |  |  |
| RF-12 | Lista os exercícios do treino na ordem do plano, cada um num cartão, com dose, PSE-alvo e graus de contribuição H/F/E/M (Alta/Média/Baixa) | P0 | Feito |
| RF-13 | Botão "Terminei o exercício" em cada cartão abre o painel de registro da carga (kg) de cada série; aceita vírgula ou ponto, Enter passa para a próxima série; salvar só grava o peso do dia (não abre check-in nem temporizador); o botão do exercício mostra as cargas de hoje ("Hoje: … kg") | P0 | Feito |
| RF-39 | Opção "Sem peso" em cada exercício, no painel do exercício: marcada, esconde os campos de carga e "Concluir" marca o exercício como feito no dia (o cartão mostra "Feito hoje", com "Desfazer" no painel), do mesmo jeito que os exercícios com peso mostram "Hoje: … kg"; fica salva para o usuário em todos os treinos e aparelhos até ser desmarcada; pesos já registrados não são apagados | P1 | Feito |
| RF-40 | Recorde pessoal no exercício: o painel mostra "Recorde: X kg em dd/mm" (maior carga de uma série em dias anteriores); ao digitar uma carga acima dele aparece o selo "Novo recorde"; ao concluir, aviso "Novo recorde em …"; o cartão mostra um troféu quando a carga do dia é recorde. Primeiro registro e empate não contam; exercícios sem peso ficam de fora | P2 | Feito |
| RF-14 | Pré-preenche a carga com a do último dia em que o exercício teve peso e mostra "Última vez: …" | P0 | Feito |
| RF-15 | Vídeo de execução no próprio cartão: deslizando para o lado aparece o vídeo, que toca sem som e em repetição; dica de deslizar some depois do primeiro uso | P1 | Parcial: 18 de 22 exercícios com vídeo |
| RF-16 | Timer de descanso configurável, iniciado ao concluir a série | P1 | Pendente |
| RF-17 | Exibe "Sobre o treino" (objetivo, o que esperar, impacto no jiu-jitsu e no físico) e o motivo de cada exercício | P2 | Feito |
| RF-33 | Filtro da ficha por foco (Hipertrofia, Força, Explosão, Mobilidade), mostrando só os exercícios de alta contribuição | P2 | Feito |
| **Jiu-jitsu e cardio** |  |  |  |
| RF-18 | Check-in de aula de jiu-jitsu com duração (a nota de recuperação 1–5 foi removida em 26/10/2026) | P0 | Feito |
| RF-19 | Registro de cardio (20–40 min, intensidade leve/moderada) | P1 | Parcial: check-in com duração, sem intensidade |
| **Corpo e nutrição** |  |  |  |
| RF-20 | Registro de peso diário; média semanal e tendência calculadas | P0 | Pendente |
| RF-21 | Registro opcional de % de gordura e proteína diária, com meta calculada pelo peso do usuário (~1,8–2,2 g/kg) | P1 | Pendente |
| **Progresso e grupo** |  |  |  |
| RF-22 | Tela de progresso: peso médio, carga dos exercícios principais e aderência por semana | P0 | Parcial: aderência semanal no Dashboard |
| RF-23 | Exportar o histórico do bloco em CSV ou PDF | P2 | Pendente |
| RF-24 | Compartilhar, se o usuário ativar, só a aderência semanal (treinos feitos) com o grupo | P2 | Pendente |
| **Check-in de treino** |  |  |  |
| RF-38 | Botão fixo "Fazer check-in" (verde, canto inferior direito, nas telas Treino e Dashboard) é o único botão para registrar check-in: vira um círculo ao rolar para baixo e volta a mostrar o texto ao rolar para cima; abre o formulário já com o treino da aba aberta (no Dashboard, o tipo planejado do dia selecionado no calendário); fica acima da barra "em andamento" quando ela aparece | P0 | Feito |
| RF-25 | Check-in de musculação pelo formulário (tipo, data, início, duração e, para quem ligou em Privacidade, observação). Terminar um exercício (registrar pesos) não abre check-in. Check-ins abertos de versões anteriores aparecem numa barra "em andamento" com "Encerrar", que mostra quantos exercícios foram feitos no dia e, para quem ligou, a observação | P0 | Feito |
| RF-26 | Permitir mais de um check-in no mesmo dia (ex.: musculação de manhã e jiu-jitsu à noite), cada um com horário, tipo e duração próprios | P0 | Feito |
| RF-30 | Check-in rápido, extra ou retroativo (tipo, data até hoje, início, duração de 1 a 600 min, observação opcional); excluir check-in com confirmação; editar check-in encerrado pelo Dashboard ("Editar check-in" abre o mesmo formulário preenchido) | P1 | Feito |
| **Treinos personalizados** |  |  |  |
| RF-49 | Em Você → Meus treinos, cada pessoa monta até 5 treinos (até 15 exercícios cada) com os exercícios de uma biblioteca de 71, sem repetição (plano pronto + fichas em PDF). Busca por nome sem diferenciar acentos, filtro por grupo; ajusta nome, foco, séries e PSE (campos com o mesmo formato) e muda a ordem arrastando a alça de cada exercício (mouse, dedo ou setas do teclado); botão flutuante "+ Adicionar exercício", que encolhe ao rolar como o de check-in; excluir treino pede confirmação e o tira da semana; "Voltar ao plano pronto"; sair com mudanças pede confirmação; ao salvar, "Desfazer" por 8 s e "Restaurar versão anterior" (treinos e semana guardados em `perfis.treinos_anterior`) | P0 | Feito |
| RF-50 | Aviso "Baita atualização!" para quem já usa (Personalizar ou Manter o treino atual) e escolha inicial para conta nova (Montar meus treinos ou Usar o plano pronto). Aparece a cada abertura do app (e ao voltar depois de 30 min em segundo plano, sem abrir por cima de outra janela) até a pessoa marcar "Não mostrar esta mensagem de novo"; a última resposta e o "não mostrar mais" ficam salvos na conta | P0 | Feito |
| RF-51 | Muay Thai como tipo de check-in (selo M, amarelo, 60 min por padrão) e atividade da Minha semana: marca o dia como feito, conta em "Esta semana", no calendário, nas barras do mês, no painel de monitoramento e no resumo por e-mail (cartão só para quem fez ou planejou muay thai) | P1 | Feito |
| RF-57 | Surf como tipo de check-in (selo S, magenta, 90 min por padrão), entre Muay Thai e Cardio. Não entra na semana padrão: aparece na Minha semana só se a pessoa colocar, como as outras atividades. Conta em "Esta semana" (como extra quando não está no plano), no calendário, nas barras do mês, no painel de monitoramento e no resumo por e-mail (cartão só para quem surfou ou planejou surf) | P1 | Feito |
| RF-58 | Foto opcional no check-in (novo ou editar): "Adicionar foto" abre a câmera ou a galeria; a foto é reduzida no aparelho (até 1280 px, JPEG) e guardada no Supabase Storage (bucket privado `fotos-checkin`). Só quem postou vê a foto: prévia no formulário (Trocar, Remover), miniatura no detalhe do check-in no Dashboard (ícone de câmera na linha) e tela cheia ao tocar; o painel nunca mostra fotos. Remover, excluir o check-in ou a conta apaga o arquivo; se o envio falhar, o check-in fica salvo com aviso | P2 | Feito |
| RF-52 | Tela Você em lista, como os Ajustes do celular: cartão do perfil (foto, nome, e-mail) que abre Dados pessoais; grupos com ícone, nome, valor atual e seta (Meus treinos, Minha semana; Aparência, Notificações, Privacidade; Sair da conta em vermelho). Cada opção abre a própria tela (#voce/…) com "‹ Você" para voltar; o voltar do navegador também funciona | P1 | Feito |
| RF-53 | Excluir conta: em Você, "Excluir conta" abre uma confirmação amigável que lista o que se perde (check-ins, pesos e recordes, treinos e semana, foto e preferências, resumo por e-mail), avisa que não dá para desfazer, sugere sair ou desligar o resumo para quem só quer um tempo e exige marcar "Entendi" antes do botão vermelho. No monitoramento, cada usuário tem uma lixeira que abre a mesma confirmação, com o nome da pessoa; o administrador não exclui a própria conta nem a de outro administrador. Tudo é apagado em cascata pelo banco (funções `excluir_conta()` e `admin_excluir_usuario()`) | P1 | Feito |
| **Privacidade (LGPD)** |  |  |  |
| RF-54 | Política de Privacidade em `privacidade.html` (responsável e contato, dados guardados, o que o administrador vê, finalidade e base legal, operadores, tempo de guarda, direitos e como exercer, segurança, mudanças). A tela de entrada avisa "Ao entrar, você concorda com a Política de Privacidade". Quando a versão aceita (`perfis.politica_versao`) é diferente da atual, o app mostra um aviso curto com "Entendi" e "Ler a política completa", antes do aviso dos treinos personalizados | P0 | Feito |
| RF-55 | Observações dos check-ins (podem revelar saúde) só com consentimento, sem perguntar no check-in: em Você → Privacidade, "Registrar observações nos check-ins" vem desligado; ligar é consentir e faz o campo Observação (opcional) aparecer no check-in e no encerrar. Desligar não pede confirmação: retira o consentimento e apaga as observações já registradas. A nota de recuperação (1–5) foi removida e as notas salvas, apagadas | P0 | Feito |
| RF-56 | Baixar meus dados: Você → Privacidade gera `oss-meus-dados-AAAA-MM-DD.json` com perfil (sem a foto), preferências, consentimentos, treinos, semana, check-ins, cargas, registro de uso e e-mails enviados (função `meus_dados_extras()`) | P1 | Feito |
| **Dashboard e calendário** |  |  |  |
| RF-27 | Calendário mensal no Dashboard: cada dia mostra selos por tipo (1 a 5 para musculação, J para jiu-jitsu, M para muay thai, S para surf, C para cardio); com mais de dois check-ins mostra o primeiro e "+N"; navegação entre meses até o mês atual | P0 | Feito |
| RF-28 | Ao tocar num dia, listar os check-ins daquele dia em ordem de horário, com tipo, horário e duração; dia sem check-in orienta tocar em "Fazer check-in", que já usa o dia selecionado | P0 | Feito |
| RF-29 | Ao abrir um check-in de musculação, mostrar a observação e cada exercício do treino com as cargas do dia por série; exercícios sem carga aparecem como "sem registro", e os marcados como Sem peso como "feito (sem peso)" ou "sem peso"; em check-ins encerrados, tocar num exercício abre o painel para corrigir os pesos (ou o "feito" sem peso) daquele dia | P0 | Feito |
| RF-34 | Números do Dashboard: check-ins no total, check-ins, horas treinadas e dias com treino no mês | P1 | Feito |
| RF-35 | "Esta semana" × plano (quantas vezes musculação, jiu-jitsu, muay thai e cardio aparecem na semana montada) e barras com a contagem de check-ins por tipo no mês exibido | P1 | Feito |

### Modelo de dados

O plano pronto é um modelo único, compartilhado por todos os usuários e guardado como dados, não como 12 telas fixas: 3 treinos-modelo, 22 exercícios e 3 fases geram as 6 semanas. Quem prefere monta os próprios treinos (até 5) com os exercícios de uma biblioteca de 71, que inclui os 22 do plano.

| Entidade | Campos principais |
| --- | --- |
| Usuário | nome, e-mail, foto, papel (administrador ou membro), data de cadastro, último acesso, quantidade de acessos |
| Administrador | usuário (lista preenchida por SQL; dá acesso ao monitoramento) |
| Evento de uso | usuário, data e hora, tipo (sessão, tela, exercício concluído, recorde, check-in criado/editado/excluído/encerrado, vídeo, sem peso, semana alterada, tema, foto, erro, sessão perdida, saiu), dados (até 2 KB; sem pesos, cargas ou observações) |
| Configuração | usuário, tema (automático, claro, escuro), semana (7 dias, até 2 atividades cada), exercícios sem peso, recebe resumo semanal (sim/não), versão da política aceita, consentimento para registrar observações nos check-ins (desligado por padrão) e quando mudou |
| E-mail enviado | usuário, tipo (resumo semanal), referência (último dia do período), enviado em, primeira abertura, aberturas, primeiro clique, cliques |
| Convite | código (6 letras/números), para quem, criado por, criado em, expira em (7 dias), usado por, usado em, cancelado em |
| Acesso | usuário, liberado (sim/não), pedido de acesso em, liberado como (convite, pedido ou administrador), liberado em |
| Plano (modelo) | nome, duração (6 semanas) |
| Inscrição no plano | usuário, plano, data de início, peso inicial, alvo, compartilha aderência (sim/não) |
| Fase | número (1–3), semanas (1–2, 3–4, 5–6), foco, orientação |
| Treino-modelo | código (1, 2 ou 3, no plano pronto; 1 a 5 nos treinos da conta), nome, subtítulo, objetivo, o que esperar, impacto no jiu-jitsu, impacto no físico, lista ordenada de exercícios |
| Exercício (biblioteca) | nome, grupo muscular, dose (séries × reps/tempo/por lado), PSE-alvo, graus H/F/E/M (Alta/Média/Baixa), justificativa, vídeo, é principal (sim/não) |
| Ajuste por fase | exercício, fase, nova dose (ex.: Passada 3×16 na fase 3) |
| Sessão | inscrição, data, tipo (Treino 1 a 5, jiu-jitsu, muay thai, surf, cardio, descanso), semana, status (planejada, feita, pulada, movida) |
| Treinos da conta | usuário, até 5 treinos (nome, foco, exercícios com dose e PSE); vazio = plano pronto; última resposta ao aviso da novidade e quando pediu para não mostrar mais |
| Check-in | usuário, tipo (Treino 1 a 5, jiu-jitsu, muay thai, surf, cardio), início, fim (vazio enquanto aberto), sem horário (sim/não), observação (opcional, só com consentimento), foto (opcional: caminho do arquivo no bucket privado `fotos-checkin`), retroativo (sim/não) |
| Cargas do dia | usuário, data, treino (1 a 5), cargas por exercício e série (kg) ou marcação de feito para exercícios sem peso |
| Medida corporal | usuário, data, peso (kg), % de gordura (opcional) |
| Proteína | usuário, data, gramas |

Um dia pode ter vários check-ins (relação 1 dia → N check-ins). As cargas ficam por dia e treino, sem depender do check-in: o detalhe de um check-in de musculação mostra as cargas daquele treino no mesmo dia. O calendário é montado agrupando os check-ins por data. A sessão planejada não é gravada: ela é calculada pela semana montada, e o dia conta como feito quando há check-in encerrado do tipo planejado.

No Supabase, os dados do usuário ficam em três tabelas, todas com regras de acesso por usuário (`supabase/schema.sql`):
- **`perfis`:** nome, e-mail, foto, tema, `treinos` (treinos montados; vazio = plano pronto), `novidade_treinos`, `novidade_oculta`, `treinos_anterior` (versão anterior dos treinos e da semana), `semana`, `sem_peso`, `emails_resumo` (recebe o resumo semanal; padrão sim), `politica_versao` (versão da política aceita), `consentimento_saude` (`sim`, `nao` ou vazio = não respondeu) e `consentimento_saude_em`, `dias_jiu` (legado), `ultimo_acesso` e `acessos`. Os dois últimos só mudam pela função `registrar_acesso()`.
- **`checkins`:** check-ins de versões anteriores também guardavam as cargas.
- **`cargas`:** pesos por usuário, dia e treino.

O resumo semanal por e-mail usa:
- **`emails_enviados`:** um registro por usuário, tipo e período (chave única), para nunca mandar o mesmo resumo duas vezes, com a primeira abertura e o primeiro clique (`aberto_em`, `clicado_em`) e as contagens (`aberturas`, `cliques`). Não tem políticas de acesso: só a função, com a chave de serviço, lê e grava.
- **Edge Function `supabase/functions/resumo-semanal/index.ts`:** monta e envia os e-mails pelo Gmail (SMTP com senha de app). Os segredos (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `RESUMO_TOKEN`, `APP_URL`, `FUNCAO_URL`) ficam só em Edge Functions → Secrets.
- **Agendamento `supabase/agendamentos/resumo-semanal.sql`:** liga pg_cron e pg_net, agenda a chamada de sexta às 9h e traz consultas prontas para simular, mandar uma prévia só para um e-mail e ver as respostas da função (com tempo limite de 30 s). O `RESUMO_TOKEN` é colado só no SQL Editor, nunca no repositório.

O monitoramento usa mais duas tabelas e um canal ao vivo:
- **`admins`:** quem é administrador; não pode ser lida nem alterada pela API, e a função `eh_admin()` diz se o usuário logado está nela.
- **`eventos`:** cada usuário só grava os próprios eventos e não lê nenhum. O app envia os eventos em lote (a cada 10 s, a cada 20 eventos, ao ir para segundo plano e ao sair), sem avisar o usuário e sem falhar se a tabela não existir.
- **Exclusão de conta:** `excluir_conta()` apaga o próprio usuário e `admin_excluir_usuario(alvo)` apaga outro, a partir de `auth.users`; perfil, check-ins, cargas, eventos e e-mails enviados saem em cascata.
- **Funções `admin_usuarios()` (inclui se recebe o resumo), `admin_checkins()`, `admin_eventos()` e `admin_emails()`:** alimentam o `admin.html`, recusam quem não está em `admins` e não devolvem pesos, cargas nem observações.
- **`meus_dados_extras()`:** devolve à própria pessoa os seus eventos e e-mails enviados (que ela não lê pela API), para o "Baixar meus dados".
- **Presença (Supabase Realtime):** enquanto o app está visível, publica a tela atual, desde quando está aberto, o sistema e a última ação (exercício concluído, recorde, check-in, vídeo, semana; sem cargas), usada pelo Mundo ao vivo, no canal privado `online:<id>` do usuário, e retira ao ir para segundo plano ou sair. Cada pessoa só publica e lê o próprio canal; administradores leem todos.

Ajustes únicos de dados ficam em `supabase/ajustes/` e rodam uma vez no SQL Editor, depois do `schema.sql`:
- **`2026-10-20-peso-zero-para-sem-peso.sql`:** marca como Sem peso os exercícios em que todas as cargas do usuário são zero (número ou texto, como `"0"`), com prévia antes de alterar; não apaga registros.
- **`2026-10-20-zero-vira-feito-marcelo.sql`:** para um usuário (Marcelo Bauer no arquivo), marca como Sem peso os exercícios registrados só com zero e troca esses zeros pelo registro de feito do dia.
- **`2026-10-20-diagnostico-sem-peso.sql`:** só consulta; lista por usuário os exercícios com carga zero, quantas séries são zero, quantas têm peso, quantas estão como texto e se já estão como Sem peso.

No primeiro login em cada aparelho, os check-ins e configurações que estavam só no navegador (versões anteriores) são enviados para a conta. Contas sem semana salva usam a padrão, montada com os antigos dias de jiu-jitsu.

Exercícios do plano pronto, por treino:

- **Treino 1 — Costas + bíceps (8):** Escorpião, Carregada na marcha, Alcance diagonal, Remada inversa, Rotação no cabo, Puxada, Superman, Rosca bíceps.
- **Treino 2 — Peito, tríceps e ombro (8):** Rolamento, Quadrupedia tocando os ombros, Supino no chão, TGU parcial, Desenvolvimento, Halo, Elevação lateral, Tríceps.
- **Treino 3 — Pernas (6):** Cócoras, Quadril alto/baixo, Agachamento, Deadlift, Passada para frente, Panturrilha.

Semana padrão (editável em Você → Minha semana):

| Seg | Ter | Qua | Qui | Sex | Sáb | Dom |
| --- | --- | --- | --- | --- | --- | --- |
| Treino 2 | Jiu-jitsu | Treino 1 | Jiu-jitsu | Treino 3 (pernas) | Cardio | Descanso |

### Fluxos e telas principais

O fluxo central começa na tela Treino: o app mostra a atividade do dia, o usuário registra as cargas de cada exercício e, ao terminar, faz o check-in pelo botão verde. O check-in aparece no Dashboard e alimenta a semana.

> [Diagrama: fluxo diário · 1 decisão, 3 caminhos]

Terminar exercícios (registrar pesos) e fazer check-in são ações separadas. As cargas são salvas por dia e treino assim que o usuário conclui o painel, sem abrir check-in nem temporizador. O check-in de qualquer tipo é feito pelo botão fixo "Fazer check-in", que abre o formulário já com o treino da aba (o usuário pode trocar tipo, data e horário). Depois de salvo, o check-in aparece no calendário, e outro pode ser feito no mesmo dia.

| Tela | Conteúdo principal |
| --- | --- |
| Entrada | Painel azul com a faixa branca de 4 graus, título "OSS", "Exercícios de Jiu Jitsu e hipertrofia", "Continuar com o Google", "Ao entrar, você concorda com a Política de Privacidade" (abre a política numa janela dentro do app), crédito com link para o LinkedIn |
| Só para convidados | Para quem entra sem convite: "O OSS é só para convidados", campo para o código, mensagens para convite inválido, usado, expirado ou cancelado e "Pedir acesso"; um link `?convite=` é guardado até o login terminar e usado sozinho |
| Aviso da política | Quando a política muda: resumo curto com "Entendi" e "Ler a política completa", antes do aviso dos treinos personalizados |
| Onboarding | Peso, % de gordura, alvo, data de início (pendente) |
| Treino | Data, hora e atividade de hoje; uma aba por treino (plano pronto ou treinos montados); filtro por foco; "Sobre o treino"; um cartão por exercício com dose, PSE-alvo, graus H/F/E/M, "Terminei o exercício" e vídeo ao deslizar; agenda da semana com dias feitos e extras; botão fixo "Fazer check-in" |
| Terminei o exercício | Painel (folha inferior no celular) com o interruptor "Sem peso", uma linha por série, carga pré-preenchida, "Última vez", "Recorde: X kg em dd/mm" e selo "Novo recorde" no campo que passa dele, Concluir; sem peso, só Concluir (marca como feito, com "Desfazer") |
| Novo check-in | Aberto pelo botão fixo: tipo, data, início, duração e observação (só para quem ligou em Privacidade) |
| Encerrar check-in | Só para check-ins que ficaram abertos: início e duração, exercícios com carga no dia e observação (só para quem ligou) |
| Dashboard | Números, esta semana × plano, calendário mensal, check-ins do dia com detalhe, "Editar check-in", exclusão e exercícios que abrem o painel para corrigir os pesos daquele dia; barras por tipo no mês; botão fixo "Fazer check-in" |
| Você | Lista com cartão do perfil e grupos de opções; telas Dados pessoais (nome e foto salvos sozinhos), Meus treinos, Minha semana (arrastar e soltar, botão +, avisos, voltar ao padrão), Aparência, Notificações, Privacidade (registro de uso, política, interruptor "Registrar observações nos check-ins", desligado por padrão; desligar apaga as já registradas, Baixar meus dados), Sair da conta e Excluir conta |
| Meus treinos | Até 5 treinos de até 15 exercícios: nome e foco do treino; por exercício, séries e PSE em campos iguais e alça para arrastar a ordem; biblioteca com busca sem acento e filtro por grupo; botão flutuante "+ Adicionar exercício"; excluir treino, voltar ao plano pronto; Salvar treinos com Desfazer por 8 s e Restaurar versão anterior |
| Aviso da novidade | "Baita atualização!" (Personalizar ou Manter o treino atual) para quem já usa; conta nova escolhe entre Montar meus treinos ou Usar o plano pronto; caixa "Não mostrar esta mensagem de novo" |
| Monitoramento (`admin.html`) | Só administradores, com login Google, em cinco abas: Visão geral (On-line agora, números e gráficos com explicação), Usuários (busca, ordenação, CSV, detalhe com bloquear ou liberar e excluir), Saúde do app (só erros críticos), E-mails (próximo resumo, envios, aberturas e cliques) e Convites (gerar, enviar, cancelar, excluir, pedidos de acesso); no celular, números em 2 colunas e usuários em cartões compactos |
| Progresso | Peso médio por semana, cargas principais, aderência, % de gordura (pendente) |
| Excluir conta | Confirmação com o que se perde (check-ins, pesos e recordes, treinos e semana, foto e preferências, resumo por e-mail), aviso de que não dá para desfazer, sugestão de sair ou desligar o resumo, caixa "Entendi" que libera o botão vermelho; depois, volta à entrada com "Sua conta foi excluída. Obrigado por ter treinado com a gente!" |
| Ajustes | Unidades, exportação, convidar amigos (administrador), aviso legal (pendente; privacidade e exclusão de conta já estão em Você) |

### Regras de negócio

Todas as regras vêm do plano original; o app as aplica sem que o usuário precise lembrar delas. As marcadas como pendentes ainda não estão no app.

1. **Semana e fase (pendente):** semana = dias desde o início ÷ 7, arredondado para cima (1–6). Fase 1 = semanas 1–2, fase 2 = 3–4, fase 3 = 5–6.
2. **Semana padrão:** segunda = Treino 2, quarta = Treino 1, sexta = Treino 3 (pernas), terça e quinta = jiu-jitsu, sábado = cardio, domingo = descanso. Pernas ficam na sexta para ter o fim de semana de recuperação e não pesar antes do jiu de terça. O usuário pode mudar tudo em Minha semana.
3. **Semana montada:** cada dia aceita até 2 atividades; ao colocar uma terceira, sai a mais antiga e o app avisa. Dia vazio é descanso. Todos os 7 dias podem receber atividades.
4. **Conflito de sexta:** com jiu-jitsu na sexta, o usuário move o Treino 3 em Minha semana. O ajuste automático (Treino 3 para sábado ou marcado como pulado) fica pendente.
5. **Avisos da semana:** o app avisa quando:
   - algum treino (do plano pronto ou montado) ficou fora da semana ou aparece mais de uma vez;
   - um dia tem 2 atividades (fazer um check-in para cada);
   - o jiu-jitsu vem no dia seguinte ao Treino 3 (pernas) ou no mesmo dia;
   - a semana não tem dia de descanso.
6. **Progressão de dose (pendente):** na fase 3, Passada para frente passa de 3×10 para 3×16.
7. **Fase 2 (tempo sob tensão) (pendente):** o app exibe lembrete de cadência controlada nos exercícios principais.
8. **PSE:** cada exercício mostra o PSE-alvo; o PSE real não é registrado. PSE 10 fica reservado ao tatame. Na fase 3, os complementos (elevação lateral, tríceps, rosca, panturrilha) devem mostrar "não ir à falha" (pendente).
9. **Peso médio (pendente):** média das pesagens de seg–dom; ajustes só são sugeridos após 2 semanas de média.
10. **Segundo alvo (pendente) (Bauer: 73 kg):** só é liberado depois de atingir o primeiro alvo (Bauer: 74 kg) com cargas principais estáveis ou maiores.
11. **Cardio:** a meta da semana conta quantas vezes o cardio aparece na semana montada (1 no padrão, sábado, 20–40 min). Marcar como dispensável se o peso cair no ritmo previsto (≥ 0,25 kg/semana) fica pendente.
12. **Check-in e sessão:** um check-in encerrado do tipo planejado (ou de outro treino de musculação, se o planejado era musculação) marca a atividade como feita na agenda. Check-ins de grupos não planejados aparecem como extras ("+ Jiu-jitsu") e não alteram a agenda.
13. **Vários check-ins por dia:** não há limite de check-ins por dia, mas check-ins do mesmo dia não podem se sobrepor no horário. Só um check-in pode ficar aberto por vez.
14. **Check-in esquecido:** um check-in que ficou aberto há mais de 3 horas gera aviso na barra "em andamento"; na próxima abertura do app, ele é encerrado na hora da última série registrada (ou 1 hora após o início) e o usuário é avisado. Vale para check-ins abertos em versões anteriores, já que o formulário atual registra o check-in encerrado.
15. **Check-in retroativo e edição:** a data não pode ser no futuro e a duração vai de 1 a 600 min; check-ins de datas passadas ficam marcados como retroativos. As mesmas regras valem ao editar (a sobreposição ignora o próprio check-in), e um check-in "sem horário" passa a ter horário ao ser editado. Os pesos ficam no dia e no treino: mudar a data ou o tipo de um check-in não leva os pesos junto.
16. **Duração padrão:** 60 min para musculação, jiu-jitsu e muay thai, 30 min para cardio.
17. **Exclusão:** excluir um check-in pede confirmação; os pesos registrados na ficha continuam salvos.
18. **Pesos:** salvar um peso grava as cargas do dia daquele treino e não abre check-in nem temporizador. Editar um peso de hoje mantém as outras séries já registradas.
19. **Acessos:** cada abertura do app já logado atualiza o último acesso; a quantidade só sobe se o acesso anterior foi há mais de 30 min. A hora é a do servidor, e o usuário não consegue alterar esses campos.
20. **Exercício sem peso:** marcado pelo usuário, vale para aquele exercício em todos os treinos; o painel não pede carga e "Concluir" registra o exercício como feito no dia. O resumo ao encerrar conta os exercícios feitos (com carga ou sem peso concluído), e o detalhe do check-in mostra "feito (sem peso)", "sem peso" ou "sem registro".
21. **Recorde pessoal:** é a maior carga de uma série num exercício. Um dia é recorde quando a maior carga dele supera a maior carga de todos os dias anteriores (empate não conta, e o primeiro registro do exercício também não). Corrigir pesos de dias antigos recalcula os recordes.
22. **Salvamento dos dados pessoais:** o nome é salvo após 1 s de pausa na digitação, ao sair do campo, com Enter, ao sair da conta e ao fechar a página, sem mensagem; a foto é salva ao escolher ou remover, com "Foto salva com sucesso." ou "Foto alterada com sucesso."
23. **Registro de uso:** só administradores veem eventos e presença; usuários comuns não leem nem os próprios eventos. Um usuário é "ativo" no dia em que abriu o app ou fez check-in. Só erros críticos são registrados e mostrados (função `ehErroComum`, igual no app e no painel): falhas da presença (On-line agora), quedas de internet, cancelamentos, sessão expirada e ruídos do navegador ("Script error.", "ResizeObserver loop") não contam, e o painel ignora também os registros antigos desses tipos. Sessão perdida continua como evento no histórico do usuário, sem destaque de erro.
24. **Números do monitoramento:**
   - **Usuários ativos:** quem abriu o app ou fez check-in ao menos uma vez no período, sobre o total de cadastrados.
   - **Check-ins:** total do período, de todos os usuários e tipos, incluindo os retroativos.
   - **Treinos por semana:** check-ins do período ÷ usuários ativos ÷ semanas do período; no período Hoje vira "Treinos por usuário" (check-ins ÷ usuários ativos).
   - **Aderência ao plano:** média, entre os ativos, de check-ins ÷ treinos planejados no período (pela semana montada ou pela padrão), com limite de 100%; quem não tinha nada planejado fica fora da média; no período Hoje vale o que a semana montada prevê para o dia; a variação aparece em pontos percentuais.
   - **Voltaram nesta semana:** dos que usaram o app entre 8 e 14 dias atrás, quantos voltaram nos últimos 7 dias; não depende do período escolhido.
   - **Comparação:** a seta compara com os mesmos dias imediatamente anteriores (Hoje compara com ontem); no período Tudo não há comparação.
   - **Situação do usuário:** Ativo (último uso há até 7 dias), Em risco (8 a 14 dias), Inativo (mais de 14 dias) ou Nunca usou.
25. **Resumo semanal por e-mail:**
   - **Quando e o quê:** toda sexta às 9h (Brasília), com os 7 dias de sexta a quinta. Vai para quem tem o resumo ligado e já usou o app; quem não treinou na semana recebe a versão de incentivo.
   - **Conteúdo:** cabeçalho com o período; número de treinos com ▲/▼ em relação à semana anterior; faixa dos 7 dias com os selos coloridos do app (dia sem treino tracejado) e legenda; barra do plano com mensagem conforme a aderência; cartões por modalidade; cartão de recordes; botão para abrir o app. Nunca leva pesos, cargas nem observações.
   - **Sem duplicados:** cada resumo é registrado em `emails_enviados` e não é reenviado.
   - **Abertura e clique:** o e-mail leva uma imagem invisível (abertura, aproximada: alguns apps carregam imagens sozinhos e quem bloqueia imagens não conta) e o botão passa pela função antes de abrir o app (clique, exato). Os links são assinados com o `RESUMO_TOKEN`, o rodapé avisa que a abertura é registrada e a prévia não conta.
   - **Envio só com pedido explícito:** a função só envia para todos quando o pedido diz `enviar` (no corpo ou na URL), como faz o agendamento. Sem pedido, responde 400 com o que recebeu e não envia nada. Simulação (quem receberia) e prévia (só para um e-mail, sem diferenciar maiúsculas) também funcionam pela URL, e a resposta diz o modo entendido.
   - **Descadastro:** o link do rodapé é assinado (HMAC com o `RESUMO_TOKEN`) e desliga a opção com um clique, sem login; ao voltar para o app, aparece "Pronto: você não vai mais receber o resumo semanal.". Ligar ou desligar em Você mostra um aviso e gera o evento de uso `resumo_email`.

26. **Treinos personalizados:** até 5 treinos, cada um com até 15 exercícios da biblioteca. A conta guarda só nome, dose e PSE de cada exercício; sem treinos salvos, vale o plano pronto. Excluir um treino o tira da semana. O histórico de pesos e os recordes seguem o exercício em qualquer treino.
27. **Versão anterior dos treinos:** ao salvar, a versão anterior (treinos, semana e data) fica guardada; "Desfazer" (8 s) e "Restaurar versão anterior" (com confirmação) voltam treinos e semana para como estavam. Sem a coluna no banco, os treinos são salvos do mesmo jeito, sem a cópia.
28. **Aviso da novidade:** aparece a cada abertura do app, e ao voltar depois de 30 min em segundo plano, sem abrir por cima de outra janela, até a pessoa marcar "Não mostrar esta mensagem de novo" (a caixa só marca ao tocar nela ou no texto). Responder, fechar no X ou Esc grava só a última resposta, em silêncio; sem a coluna no banco, o "não mostrar mais" fica guardado no aparelho.
29. **Exclusão de conta:** só depois de marcar "Entendi" na confirmação; apaga a conta e todos os dados em cascata e não pode ser desfeita. O administrador pode excluir a conta de qualquer usuário pelo monitoramento, mas não a própria nem a de outro administrador.

### Requisitos não funcionais

| Área | Requisito |
| --- | --- |
| Plataforma | Aplicação web responsiva, mobile first, como PWA instalável; funciona em Chrome, Safari e Edge atuais. Hoje: um único HTML com JavaScript puro, sem build, ainda sem manifesto nem service worker |
| Distribuição | Amigos acessam por um link HTTPS, sem lojas de apps. Hoje: GitHub Pages (https://marcelobauer89.github.io/App-Treino/) |
| Offline | Service worker e cache local: registro de treino, peso e check-ins funciona sem internet e sincroniza ao reconectar; vídeos abrem com conexão. Hoje o app é só online: se uma gravação falhar, avisa e recarrega os dados do servidor |
| Desempenho | Primeira carga ≤ 3 s em 4G; tela inicial em ≤ 1 s após instalada; registrar uma série em ≤ 2 toques; pesos digitados são enviados depois de uma pausa de 0,8 s, não a cada tecla |
| Usabilidade | Layout para telas a partir de 360 px, botões ≥ 48 px, uso com uma mão; botão de check-in fixo ao alcance do polegar; tema claro por padrão para academia iluminada e escuro opcional; painéis abrem como folha inferior no celular; foco visível no teclado e respeito a "reduzir movimento" |
| Visual | Tipografia Archivo; paleta do kimono (fundo claro), azul vivo do tatame (#2563eb) para ações e seleções, contorno azul nos botões secundários, verde (#16a34a, ícone e texto brancos) para o check-in e verde suave para pesos registrados, âmbar com troféu para recordes (a cor nunca é o único sinal); graus de contribuição mostrados como fitas na ponteira da faixa; contraste AA em todos os pares de texto e fundo, nos dois temas |
| Dados | Supabase (Postgres) com login Google (PKCE) e regras de acesso por usuário (RLS) em `perfis`, `checkins`, `cargas` e `eventos` (`admins` fechada à API); presença ao vivo por canais privados do Supabase Realtime, com acesso público ao Realtime desligado; schema idempotente em `supabase/schema.sql`. A chave secreta nunca vai no app nem no repositório; só a chave publicável |
| Privacidade e segurança | Regras de acesso por usuário no backend; eventos de uso gravados só pelo próprio usuário e lidos só por administradores, com aviso na tela Você; resumo semanal enviado só para o e-mail da própria pessoa, com descadastro de um clique por link assinado e aviso no rodapé de que a abertura é registrada; segredos do e-mail só no Supabase; colunas de controle (`acessos`, `ultimo_acesso`) protegidas contra edição pelo usuário; dados de saúde não são vendidos nem enviados a terceiros; Política de Privacidade com aviso a cada nova versão, consentimento para observações (desligado por padrão), baixar meus dados e exclusão de conta pelo próprio usuário, com todos os dados (LGPD); fonte Archivo hospedada no próprio site, sem Google Fonts |
| Idioma | Português do Brasil; unidades em kg e minutos; cargas aceitam vírgula decimal |
| Aviso legal | Onboarding, tela de progresso e rodapé da tela Treino exibem que o app não substitui profissional de educação física ou nutrição |

### LGPD

O app trata dados pessoais de um grupo de amigos, alguns sensíveis (observações podem revelar saúde). O que foi feito para atender a LGPD:

| Ponto | Como o app atende |
| --- | --- |
| Transparência (art. 9) | Política de Privacidade em linguagem simples, link na entrada, aviso a cada nova versão e resumo em Você → Privacidade |
| Monitoramento | Explicado na política como funciona: quem está com o app aberto, em que tela e há quanto tempo, histórico de uso, números e abertura dos e-mails. Sem pesos, cargas ou observações |
| Dados de saúde (art. 11) | Observações só com consentimento, dado ao ligar a opção em Privacidade (vem desligada) e que pode ser retirado a qualquer momento: desligar apaga na hora as observações já registradas. A nota de recuperação foi removida e apagada do banco (minimização, art. 6º, III) |
| Fotos dos check-ins | Opcionais, com consentimento ao anexar; guardadas em armazenamento privado (só a própria pessoa lê); só a própria pessoa vê no app e o painel não mostra; o acesso de administrador existe só para apagar ao excluir uma conta; apagadas com o check-in ou a conta |
| Direitos do titular (art. 18) | Acesso e portabilidade (baixar meus dados), correção (nome e foto), eliminação (excluir conta), revogação do consentimento e oposição ao resumo por e-mail, tudo no app; demais pedidos pelo e-mail do responsável |
| Tempo de guarda (art. 15 e 16) | Enquanto a conta existir; ao excluir a conta, tudo é apagado em cascata. Decisão: sem limpeza automática por prazo |
| Operadores e transferência internacional (art. 33) | Supabase, Google (login, Gmail, YouTube sem cookies), GitHub Pages e jsDelivr, listados na política; a fonte deixou de vir do Google |
| Segurança (art. 46) | Acesso só por convite, HTTPS, regras de acesso por usuário no banco, painel restrito a administradores, chave secreta fora do repositório |

Pendências e cuidados:
- O texto da política não é parecer jurídico: vale uma revisão por advogado.
- O Mundo ao vivo não está na política porque será retirado do app; até lá, a presença ainda leva a última ação.
- `mundo.html` (só administradores) ainda usa o Google Fonts.

### Roadmap, riscos e questões em aberto

**Roadmap**

1. **Versão atual (no ar):**
   - telas Treino, Dashboard e Você;
   - login Google e dados no Supabase;
   - registro de cargas e check-ins com calendário;
   - semana montada pelo usuário;
   - vídeos nos cartões e botão fixo de check-in;
   - edição de check-in e correção de pesos pelo Dashboard;
   - exercícios sem peso e recordes pessoais;
   - registro de acessos e eventos de uso;
   - painel de monitoramento para administradores em abas, com quem está on-line agora, saúde do app e acompanhamento dos e-mails;
   - Mundo ao vivo para administradores;
   - treinos personalizados (até 5) com biblioteca de 71 exercícios;
   - muay thai como atividade;
   - tela Você em lista, no estilo dos Ajustes do celular;
   - exclusão de conta pelo app e pelo monitoramento;
   - acesso só por convite;
   - Política de Privacidade, observações só com consentimento, sem nota de recuperação, e baixar meus dados (LGPD);
   - resumo semanal por e-mail.
2. **MVP (web, grupo de amigos):**
   - PWA responsiva com modo offline;
   - onboarding com peso e alvo, semana e fase, peso e proteína;
   - tela de progresso e timer de descanso;
   - os demais requisitos P0 e P1 pendentes.
3. **v1.1:** análise de recursos usados e da jornada dos usuários no monitoramento (RF-41), exportação CSV/PDF (incluindo o histórico de check-ins), gráficos de carga por exercício, lembretes por notificação web, aderência compartilhada opcional (RF-24).
4. **v2 (nativo e público):** apps iOS e Android, publicação nas lojas, editor de planos, novos blocos após as 6 semanas, integração com Apple Saúde / Health Connect.

**Riscos**

| Risco | Mitigação |
| --- | --- |
| Registrar séries atrapalha o treino e o usuário abandona | Carga pré-preenchida, Enter passa para a próxima série, Concluir salva o que está na tela; salvar peso não abre check-in nem temporizador |
| Sem internet na academia o app não salva | Hoje o app avisa e recarrega do servidor; o modo offline com sincronização está no MVP |
| Qualquer conta Google com o link consegue entrar | Resolvido com convites (RF-02): contas novas só usam o app com convite ou liberação de um administrador |
| Cargas zero registradas antes da opção Sem peso distorcem recordes e o resumo do treino | Scripts de `supabase/ajustes/` convertem esses zeros em Sem peso ou em feito, com diagnóstico e prévia antes de alterar |
| Resumo semanal enviado para todos por engano num teste | A função só envia para todos com o pedido explícito `enviar`; simulação e prévia não enviam para o grupo |
| Resumo semanal cair no spam ou passar do limite do Gmail | Envio pelo Gmail com senha de app e cabeçalho de cancelamento de inscrição; o limite de cerca de 500 e-mails por dia é folgado para o grupo |
| Usuários estranharem o registro de uso | A Política de Privacidade e Você → Privacidade explicam o que o administrador vê; nada de pesos, cargas ou observações nos eventos; só administradores leem |
| A política ficar desatualizada quando o app mudar | Ao mudar o que é coletado ou mostrado no painel, atualizar `privacidade.html` e `POLITICA_VERSAO` no app, para todos verem o aviso de novo (README, seção Privacidade e LGPD) |
| Esquecer de rodar o `schema.sql` após uma atualização | O app abre normalmente e avisa ao salvar ("rode de novo o supabase/schema.sql"); o README explica o passo |
| No iPhone, o navegador limita notificações e armazenamento offline | Orientar a instalar na tela inicial; sincronizar sempre que houver conexão |
| O plano foi montado para o perfil do Bauer e pode não servir a todos os amigos | Cada um monta a semana, define alvo e cargas; aviso para buscar profissional antes de começar |
| Vazamento de dados de saúde de terceiros | Acesso restrito por usuário, nada compartilhado por padrão, exclusão de conta |
| Peso oscila e gera ajustes precipitados | Decisões só pela média de 2 semanas (regra 9) |
| Usuário treina até a falha | PSE-alvo visível em cada exercício e lembrete "não ir à falha" nos complementos |
| Vídeos do YouTube saem do ar | Guardar descrição curta de execução como alternativa |
| Fotos dos check-ins lotarem o armazenamento | Foto reduzida no aparelho (até 1280 px, JPEG, ~200 KB) e limite de 2 MB no bucket; o plano gratuito do Supabase tem 1 GB (cerca de 4 a 5 mil fotos) |
| Dor ou lesão | Botão "senti dor" que pula o exercício e recomenda procurar profissional |

**Questões em aberto**

- Quantos amigos entram no grupo inicial?
- ~~O acesso deve ser restrito a convidados (RF-02) ou basta o link?~~ Decidido: só convidados, com link por pessoa válido por 7 dias e pedido de acesso.
- Os amigos podem ver o progresso uns dos outros ou cada um vê só o seu?
- Todos seguem exatamente o plano do Bauer ou alguns precisam de variações?
- Quais são os vídeos de Rosca bíceps, Elevação lateral, Tríceps e Panturrilha (os outros 18 exercícios já têm)?
- O PSE real por série volta a ser registrado ou fica só o PSE-alvo?
- Qual cadência exata usar na fase 2 (ex.: 3 s na descida)?
- Após a semana 6, o app repete o bloco, sugere deload ou encerra?
- A semana montada deve valer para o bloco todo ou poder mudar semana a semana?
- Algum recurso exige app nativo já no MVP (ex.: notificações confiáveis no iPhone)?
