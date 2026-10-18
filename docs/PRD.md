## PRD — App Bauer: Jiu-Jitsu + Hipertrofia

2026-10-17 · @Bauer

### Visão geral

O App Bauer transforma o plano de 6 semanas "Jiu-Jitsu + Hipertrofia" (hoje um PDF de 15 páginas) numa aplicação web responsiva, usada no navegador do celular, que diz o que treinar hoje, registra cargas e acompanha o peso rumo ao alvo. A primeira versão é compartilhada com um grupo fechado de amigos, cada um com sua conta, seus dados e seus alvos.

**Problema.** O PDF repete as mesmas tabelas em 12 páginas, não registra cargas nem PSE, não reorganiza a semana quando surge uma aula extra de jiu-jitsu e deixa o controle de progresso numa tabela em branco para preencher à mão.

**Solução.** Um app que:

- Mostra o treino do dia (A, B, jiu-jitsu, bike ou descanso) com base na agenda semanal.
- Registra séries, repetições, carga e PSE por exercício, com vídeo de execução.
- Aplica as regras do plano automaticamente: fase da semana, passada em 3×16 nas semanas 5–6, deslocamento da sexta para sábado.
- Acompanha peso médio semanal, % de gordura, proteína e recuperação.

**Objetivo do produto.** Fazer cada usuário completar as 6 semanas com aderência alta, perdendo gordura de forma gradual (no caso do Bauer, 76 → 74 kg) sem perder força nem desempenho no tatame.

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
| Aderência à musculação | ≥ 90% das 18 sessões previstas | Sessões concluídas ÷ planejadas |
| Aderência ao jiu-jitsu | ≥ 10 de 12 aulas | Check-ins de jiu-jitsu |
| Registro de cargas | ≥ 95% dos exercícios principais com carga e PSE | Agachamento, deadlift, supino, desenvolvimento, puxada, remada, passada |
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
- Agenda semanal com o treino do dia e regra de deslocamento sexta → sábado.
- Execução dos Treinos A e B com registro de séries, repetições, carga e PSE.
- Vídeo de referência por exercício (link do YouTube já presente no plano).
- Progressão automática por fase (semanas 1–2, 3–4, 5–6).
- Check-in de jiu-jitsu e bike, com nota de recuperação.
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

São 24 requisitos em 7 grupos; os marcados P0 bloqueiam o lançamento do MVP.

| ID | Requisito | Prioridade |
| --- | --- | --- |
| **Contas e convites** |  |  |
| RF-01 | Cadastro e login por e-mail ou conta Google/Apple | P0 |
| RF-02 | Administrador (Bauer) gera link ou código de convite; só entra quem foi convidado | P0 |
| RF-03 | Cada usuário vê apenas os próprios registros; nada é compartilhado sem ele ativar | P0 |
| RF-04 | Sincronização dos dados entre aparelho e nuvem, mantendo o uso offline | P0 |
| RF-05 | Usuário pode excluir a conta e todos os seus dados | P0 |
| **Onboarding e configuração** |  |  |
| RF-06 | Usuário informa peso atual, % de gordura, alvo próprio e data de início do bloco | P0 |
| RF-07 | Usuário confirma os dias de jiu-jitsu (padrão: terça e quinta) e de musculação (segunda, quarta, sexta) | P0 |
| **Agenda e treino do dia** |  |  |
| RF-08 | Tela inicial mostra semana atual (1–6), fase e atividade do dia | P0 |
| RF-09 | Terceira sessão semanal alterna A/B automaticamente (semana ímpar: A; semana par: B) | P0 |
| RF-10 | Botão "Teve jiu na sexta" move a musculação para sábado ou a marca como pulada | P0 |
| RF-11 | Usuário pode reagendar manualmente qualquer sessão dentro da semana | P1 |
| **Execução do treino** |  |  |
| RF-12 | Lista os 11 exercícios do treino na ordem do plano, com dose, PSE-alvo e classificação H/M/F/E | P0 |
| RF-13 | Registro por série: repetições ou tempo, carga (kg) e PSE real (1–10) | P0 |
| RF-14 | Pré-preenche a carga com o valor da última sessão do mesmo exercício | P0 |
| RF-15 | Abre o vídeo de execução do exercício | P1 |
| RF-16 | Timer de descanso configurável, iniciado ao concluir a série | P1 |
| RF-17 | Exibe "Por que está aqui" e a nota de prioridade do treino | P2 |
| **Jiu-jitsu e cardio** |  |  |
| RF-18 | Check-in de aula de jiu-jitsu com duração e nota de recuperação (1–5) | P0 |
| RF-19 | Registro de bike (20–40 min, intensidade leve/moderada) | P1 |
| **Corpo e nutrição** |  |  |
| RF-20 | Registro de peso diário; média semanal e tendência calculadas | P0 |
| RF-21 | Registro opcional de % de gordura e proteína diária, com meta calculada pelo peso do usuário (~1,8–2,2 g/kg) | P1 |
| **Progresso e grupo** |  |  |
| RF-22 | Tela de progresso: peso médio, carga dos exercícios principais e aderência por semana | P0 |
| RF-23 | Exportar o histórico do bloco em CSV ou PDF | P2 |
| RF-24 | Compartilhar, se o usuário ativar, só a aderência semanal (treinos feitos) com o grupo | P2 |

### Modelo de dados

O plano é um modelo único, compartilhado por todos os usuários e guardado como dados, não como 12 telas fixas: 2 treinos-modelo, 22 exercícios e 3 fases geram as 6 semanas.

| Entidade | Campos principais |
| --- | --- |
| Usuário | nome, e-mail, papel (administrador ou membro), data de cadastro |
| Convite | código, criado por, validade, usado por |
| Plano (modelo) | nome, duração (6 semanas) |
| Inscrição no plano | usuário, plano, data de início, peso inicial, alvo, dias de jiu-jitsu, compartilha aderência (sim/não) |
| Fase | número (1–3), semanas (1–2, 3–4, 5–6), foco, orientação |
| Treino-modelo | código (A ou B), título, nota de prioridade, lista ordenada de exercícios |
| Exercício | nome, dose (séries × reps/tempo/por lado), PSE-alvo, H/M/F/E (Alta/Média/Baixa), justificativa, URL do vídeo, é principal (sim/não) |
| Ajuste por fase | exercício, fase, nova dose (ex.: Passada 3×16 na fase 3) |
| Sessão | inscrição, data, tipo (A, B, jiu-jitsu, bike, descanso), semana, status (planejada, feita, pulada, movida) |
| Série registrada | sessão, exercício, nº da série, reps ou segundos, carga (kg), PSE real |
| Check-in | sessão, duração (min), recuperação (1–5), observação |
| Medida corporal | usuário, data, peso (kg), % de gordura (opcional) |
| Proteína | usuário, data, gramas |

Exercícios por treino, conforme o PDF:

- **Treino A (11):** Cócoras, Rolamento, Quadrupedia tocando os ombros, Agachamento, Rotação no cabo, Supino no chão, TGU parcial, Desenvolvimento, Passada para frente, Elevação lateral, Tríceps.
- **Treino B (11):** Escorpião, Quadril alto/baixo, Carregada na marcha, Alcance diagonal, Deadlift, Remada inversa, Superman, Halo, Puxada, Rosca bíceps, Panturrilha.

### Fluxos e telas principais

O fluxo central começa na tela Hoje: o app escolhe a atividade do dia e todo caminho termina no resumo da sessão, que alimenta o progresso semanal.

> [Diagrama: fluxo diário · 1 decisão, 3 caminhos]

Só a musculação passa pelo registro de séries; jiu-jitsu e bike pedem apenas um check-in rápido.

| Tela | Conteúdo principal |
| --- | --- |
| Onboarding | Entrar pelo convite, criar conta; depois peso, % de gordura, alvo, data de início, dias de jiu-jitsu |
| Hoje | Semana e fase, atividade do dia, botão "Teve jiu na sexta", pesagem rápida |
| Treino | Lista dos 11 exercícios, dose, PSE-alvo, selos H/M/F/E |
| Exercício | Séries com carga pré-preenchida, PSE real, timer de descanso, vídeo |
| Check-in | Duração, recuperação 1–5, observação |
| Semana | Agenda seg–dom com status de cada sessão e reagendamento |
| Progresso | Peso médio por semana, cargas principais, aderência, % de gordura |
| Ajustes | Dias de treino, unidades, exportação, privacidade, convidar amigos (administrador), excluir conta, aviso legal |

### Regras de negócio

Todas as regras vêm do plano original; o app as aplica sem que o usuário precise lembrar delas.

1. **Semana e fase:** semana = dias desde o início ÷ 7, arredondado para cima (1–6). Fase 1 = semanas 1–2, fase 2 = 3–4, fase 3 = 5–6.
2. **Alternância A/B:** segunda = A, quarta = B, sexta alterna (semanas ímpares A, pares B).
3. **Conflito de sexta:** se houver jiu-jitsu na sexta, a musculação vai para sábado; se sábado já tiver bike, a bike é substituída. Sem espaço, a sessão é marcada como pulada.
4. **Domingo:** sempre descanso; o app não permite agendar treino.
5. **Dia antes do jiu-jitsu:** o app alerta se o usuário mover um treino pesado de pernas (A) para o dia anterior a uma aula.
6. **Progressão de dose:** na fase 3, Passada para frente passa de 3×10 para 3×16.
7. **Fase 2 (tempo sob tensão):** o app exibe lembrete de cadência controlada nos exercícios principais.
8. **Teto de PSE:** PSE 10 é reservado ao tatame. Registro de PSE ≥ 9 na musculação gera aviso; na fase 3 os complementos (elevação lateral, tríceps, rosca, panturrilha) mostram "não ir à falha".
9. **Peso médio:** média das pesagens de seg–dom; ajustes só são sugeridos após 2 semanas de média.
10. **Segundo alvo (Bauer: 73 kg)****:** só é liberado depois de atingir o primeiro alvo (Bauer: 74 kg) com recuperação média ≥ 3 e cargas principais estáveis ou maiores.
11. **Bike:** 1–2 sessões de 20–40 min, sugeridas longe do Treino A; o app marca como opcional se o peso cair no ritmo previsto (≥ 0,25 kg/semana).

### Requisitos não funcionais

| Área | Requisito |
| --- | --- |
| Plataforma | Aplicação web responsiva, mobile first, como PWA instalável (ex.: Next.js ou React + Vite); funciona em Chrome, Safari e Edge atuais |
| Distribuição | Amigos acessam por um link (domínio próprio, HTTPS); sem lojas de apps |
| Offline | Service worker e cache local: registro de treino, peso e check-ins funciona sem internet e sincroniza ao reconectar; vídeos abrem com conexão |
| Desempenho | Primeira carga ≤ 3 s em 4G; tela inicial em ≤ 1 s após instalada; registrar uma série em ≤ 2 toques |
| Usabilidade | Layout para telas a partir de 360 px, botões ≥ 48 px, uso com uma mão, alto contraste para academia iluminada |
| Dados | Armazenamento local no navegador (IndexedDB) + backend na nuvem com autenticação (ex.: Supabase ou Firebase) |
| Privacidade e segurança | Regras de acesso por usuário no backend; dados de saúde não são vendidos nem enviados a terceiros; consentimento no cadastro e exclusão de conta (LGPD) |
| Idioma | Português do Brasil; unidades em kg e minutos |
| Aviso legal | Onboarding e tela de progresso exibem que o app não substitui profissional de educação física ou nutrição |

### Roadmap, riscos e questões em aberto

**Roadmap**

1. **MVP (web, grupo de amigos):** PWA responsiva, contas, convites, sincronização, requisitos P0 + P1, plano Bauer como modelo comum; acesso por link.
2. **v1.1:** exportação CSV/PDF, gráficos de carga por exercício, lembretes por notificação web, aderência compartilhada opcional (RF-24).
3. **v2 (nativo e público):** apps iOS e Android, publicação nas lojas, editor de planos, novos blocos após as 6 semanas, integração com Apple Saúde / Health Connect.

**Riscos**

| Risco | Mitigação |
| --- | --- |
| Registrar séries atrapalha o treino e o usuário abandona | Pré-preencher carga, 2 toques por série, opção "repetir sessão anterior" |
| No iPhone, o navegador limita notificações e armazenamento offline | Orientar a instalar na tela inicial; sincronizar sempre que houver conexão |
| Navegador apaga os dados locais antes da sincronização | Sincronizar após cada sessão e avisar quando houver registros pendentes |
| O plano foi montado para o perfil do Bauer e pode não servir a todos os amigos | Cada um define alvo e cargas; aviso para buscar profissional antes de começar |
| Vazamento de dados de saúde de terceiros | Acesso restrito por usuário, nada compartilhado por padrão, exclusão de conta |
| Peso oscila e gera ajustes precipitados | Decisões só pela média de 2 semanas (regra 9) |
| Usuário trata PSE 8 como falha | Avisos de teto de PSE e lembrete "não ir à falha" |
| Vídeos do YouTube saem do ar | Guardar descrição curta de execução como alternativa |
| Dor ou lesão | Botão "senti dor" que pula o exercício e recomenda procurar profissional |

**Questões em aberto**

- Quantos amigos entram no grupo inicial?
- Os amigos podem ver o progresso uns dos outros ou cada um vê só o seu?
- Todos seguem exatamente o plano do Bauer ou alguns precisam de variações?
- Quais são os links de vídeo de cada exercício (o PDF mostra apenas "YouTube")?
- Qual cadência exata usar na fase 2 (ex.: 3 s na descida)?
- Após a semana 6, o app repete o bloco, sugere deload ou encerra?
- Algum recurso exige app nativo já no MVP (ex.: notificações confiáveis no iPhone)?
