# App-Treino

App web (celular primeiro) do plano de 6 semanas **Jiu-Jitsu + Hipertrofia**: treino do dia, registro de cargas, check-ins, calendário e dashboard. O app inteiro está em `index.html` e os dados ficam no **Supabase**, com login pela conta **Google**.

- `index.html`: o app (HTML, CSS e JavaScript, sem build).
- `supabase/schema.sql`: tabelas, regras de acesso por usuário e criação automática do perfil.
- `docs/PRD.md`: requisitos do produto.

## Como colocar no ar

São seis passos, feitos uma vez. Anote o endereço onde o app vai ficar publicado (passo 2), porque ele é usado nos passos 4 e 5.

### 1. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. Pode rodar de novo depois sem duplicar nada.

### 2. Publicar o app

O login com Google não funciona abrindo o arquivo direto do computador; o app precisa de um endereço HTTPS. O caminho mais simples é o GitHub Pages:

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`.
3. O endereço será `https://marcelobauer89.github.io/App-Treino/`.

Em repositório privado, o GitHub Pages exige plano pago; Vercel e Netlify publicam o mesmo arquivo de graça.

### 3. Criar a credencial do Google

1. No [Google Cloud Console](https://console.cloud.google.com), crie (ou escolha) um projeto.
2. Em **APIs e serviços → Tela de consentimento OAuth**, configure o app (nome, e-mail de suporte; escopos `email` e `profile`). Enquanto o app estiver em modo de teste, só entram os e-mails cadastrados como usuários de teste; publique a tela de consentimento para liberar a todos.
3. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, adicione o endereço de retorno do Supabase, que aparece no passo 4: `https://<seu-projeto>.supabase.co/auth/v1/callback`.
5. Guarde o **Client ID** e o **Client Secret**.

### 4. Ligar o Google no Supabase

1. No Supabase, abra **Authentication → Sign In / Providers → Google**.
2. Ative, cole o **Client ID** e o **Client Secret** e salve. O endereço de callback do passo 3 aparece nessa mesma tela.

### 5. Informar o endereço do app ao Supabase

Em **Authentication → URL Configuration**:

- **Site URL:** o endereço do app (ex.: `https://marcelobauer89.github.io/App-Treino/`).
- **Redirect URLs:** o mesmo endereço e, para testar no computador, `http://localhost:8000/`.

### 6. Colocar as chaves no app

1. No Supabase, abra **Project Settings → API Keys** e copie a **URL do projeto** e a chave pública (**anon**, ou **publishable** nos projetos novos).
2. No começo do `<script>` principal do `index.html`, preencha (este repositório já está configurado):

   ```js
   const SUPABASE_URL = 'https://<seu-projeto>.supabase.co';
   const SUPABASE_KEY = 'sb_publishable_...';
   ```

3. Faça commit e push. A chave publicável pode ficar no código: quem protege os dados são as regras de acesso (RLS) do `schema.sql`, que deixam cada usuário ler e alterar só os próprios registros.

A chave **secreta** (`sb_secret_...` ou `service_role`) nunca vai no app nem no repositório, porque ela passa por cima das regras de acesso. Se ela vazar, crie outra em **Project Settings → API Keys** e apague a antiga.

## Atualizar o banco depois de uma nova versão

Quando uma versão nova do app precisar de mudanças no banco, rode de novo o `supabase/schema.sql` inteiro no **SQL Editor** (passo 1). Ele só cria o que falta e não apaga dados. A tela **Minha semana** precisa da coluna `perfis.semana` e o registro de pesos precisa da tabela `cargas`: se o app avisar "Para salvar a semana…" ou "Para salvar os pesos, rode de novo o supabase/schema.sql", é isso que falta.

## Monitoramento de uso

O app registra eventos de uso na tabela `eventos` (telas abertas, exercícios concluídos, check-ins criados, editados e excluídos, recordes, vídeos vistos, "Sem peso", semana, tema, foto, erros e sessões que caíram sem a pessoa sair). Os eventos vão em lote, a cada 10 s ou quando o app vai para segundo plano, e não levam pesos corporais, cargas nem observações. Cada usuário só grava os próprios eventos e não consegue lê-los.

Quem lê esses dados é o dashboard de monitoramento, só para administradores: https://marcelobauer89.github.io/App-Treino/admin.html. Ele lê tudo por funções do banco (`admin_usuarios`, `admin_checkins`, `admin_eventos`) que recusam quem não está na tabela `admins`, e nunca mostra pesos, cargas nem observações. Para se tornar administrador, rode uma vez no **SQL Editor**, com o seu e-mail:

```sql
insert into public.admins (usuario_id)
select id from auth.users where email = 'seu-email@gmail.com'
on conflict do nothing;
```

Para o login do Google voltar ao dashboard, o endereço dele precisa estar liberado em **Authentication → URL Configuration → Redirect URLs** do Supabase. Adicione `https://marcelobauer89.github.io/App-Treino/admin.html` (ou `https://marcelobauer89.github.io/App-Treino/**`, que libera o app e o dashboard).

O dashboard mostra:

- **On-line agora**, ao vivo: quem está com o app aberto, em que tela (Treino, Dashboard ou Você) e há quanto tempo, com um ponto verde pulsando. O mesmo ponto aparece no avatar da lista e no detalhe.
- **Números principais** do período (7, 30, 90 dias ou tudo), com a variação em relação ao período anterior: usuários ativos, check-ins, treinos por semana por usuário ativo, aderência ao plano (feito ÷ planejado na semana montada) e quantos voltaram nesta semana.
- **Gráficos** de check-ins por dia (por tipo de treino) e de usuários ativos por dia, agrupados por semana em períodos longos, cada um com a opção de ver como tabela.
- **Usuários**, com situação (Ativo até 7 dias sem usar, Em risco de 8 a 14, Inativo depois disso, Nunca usou), busca, ordenação e exportação em CSV.
- **Detalhe de cada usuário**: check-ins das últimas 8 semanas, semana montada, exercícios sem peso e atividade recente (inclusive erros e sessões que caíram).

### On-line agora (Realtime)

A presença usa o **Supabase Realtime Presence**. Enquanto o app está aberto na tela, ele publica só a tela atual, desde quando está aberto e o sistema do aparelho, no canal privado `online:<id do usuário>`. Ao ir para segundo plano ou sair da conta, a presença some.

As regras do `schema.sql` (políticas em `realtime.messages`) deixam cada pessoa ler e publicar só no próprio canal; administradores leem o canal de todos. Para garantir que só canais privados funcionem, no Supabase vá em **Realtime → Settings** e desligue **Allow public access** (o app não usa canais públicos).

Se o painel mostrar "Ao vivo indisponível", confira se o `schema.sql` foi aplicado e se o Realtime está ligado no projeto.

## Resumo semanal por e-mail

Toda **sexta-feira às 9h** (Brasília), cada pessoa recebe no e-mail um resumo dos últimos 7 dias (de sexta a quinta):

- quantos treinos fez e de que tipo;
- em que dias treinou;
- quanto do plano cumpriu (pela semana montada em Você);
- a comparação com a semana anterior;
- os recordes da semana.

Quem não treinou recebe uma versão de incentivo. Quem nunca usou o app não recebe nada.

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

## Ajustes únicos de dados

Scripts em `supabase/ajustes/` corrigem dados já gravados e rodam uma vez só, no **SQL Editor**, depois do `schema.sql`:

- `2026-10-20-peso-zero-para-sem-peso.sql`: marca como **Sem peso** os exercícios em que todas as cargas registradas pelo usuário são zero (gravadas como número ou como texto, como `"0"`). A primeira consulta do arquivo mostra o que vai mudar; a segunda faz o ajuste. Não apaga nenhum registro de peso.
- `2026-10-20-zero-vira-feito-marcelo.sql`: para o usuário Marcelo Bauer (troque o nome no arquivo para outro usuário), marca como **Sem peso** os exercícios registrados só com carga zero e troca esses zeros pelo registro de "feito" do dia. Exercícios com algum peso maior que zero não mudam.
- `2026-10-20-diagnostico-sem-peso.sql`: só consulta. Lista, por usuário, os exercícios que têm alguma carga zero, com quantas séries são zero, quantas têm peso, quantas estão gravadas como texto e se o exercício já está como Sem peso.

## Ver acessos dos usuários

Cada vez que alguém abre o app já logado, o Supabase guarda no perfil o **último acesso** (`ultimo_acesso`) e soma 1 em **acessos** (`acessos`). Reabrir em menos de 30 minutos não soma de novo. Esses dados não aparecem no app.

Para ver, abra **Table Editor → perfis** ou rode no **SQL Editor**:

```sql
select nome, email, acessos,
       to_char(ultimo_acesso at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as ultimo_acesso
from public.perfis order by ultimo_acesso desc nulls last;
```

## Testar no computador

```sh
python3 -m http.server 8000
```

Abra `http://localhost:8000/` (esse endereço precisa estar em **Redirect URLs**, passo 5).

## Como os dados ficam guardados

- **perfis:** nome, e-mail e foto (vindos do Google no primeiro login), tema, se quer receber o resumo semanal (`emails_resumo`), os exercícios marcados como **Sem peso** (coluna `sem_peso`) e a semana montada em **Você → Minha semana** (coluna `semana`: o que fazer em cada dia, até 2 atividades). Contas sem semana salva usam a padrão, montada com os antigos dias de jiu-jitsu (`dias_jiu`).
- **checkins:** cada check-in de treino, com horário, recuperação e observação (check-ins de versões anteriores também guardavam as cargas).
- **cargas:** os pesos registrados na ficha, por dia e treino. Salvar um peso não abre check-in.
- **eventos:** uso do app (telas, recursos, erros), para o dashboard de monitoramento.
- **admins:** contas que podem ver o dashboard de monitoramento.
- **emails_enviados:** registro dos resumos semanais enviados (quem e de qual semana), para não mandar o mesmo duas vezes. A opção de receber fica em `perfis.emails_resumo`.
- O app funciona online: cada alteração vai para o Supabase na hora. Se a gravação falhar, o app avisa e recarrega os dados do servidor.
- No primeiro login em cada aparelho, os check-ins e configurações que estavam salvos só no navegador (versões anteriores do app) são enviados para a conta.
