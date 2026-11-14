# App-Treino

App web (celular primeiro) do plano de 6 semanas **Jiu Jitsu + Hipertrofia**: treino do dia, registro de cargas, check-ins, calendário e dashboard. O app está em `index.html`, `css/` e `js/` (sem build) e os dados ficam no **Supabase**, com login pela conta **Google**.

- `index.html`: o app (HTML das telas); estilos em `css/app.css` e JavaScript em `js/` (um arquivo por área, sem build; mapa em [docs/MAPA.md](docs/MAPA.md)).
- `admin.html`: o monitoramento, só para administradores (`css/admin.css` e `js/admin.js`).
- `personal.html`: a área do personal, para personal trainers liberados (`css/personal.css`, `js/personal.js` e o `js/admin.js` no modo personal); veja [Área do personal](docs/RECURSOS.md#área-do-personal).
- Na publicação, o `?v=dev` dos endereços de `css/` e `js/` vira o commit publicado, para o navegador não misturar versões.
- `ambiente.js`: endereço e chave do Supabase de produção e do de desenvolvimento (veja [Ambiente de desenvolvimento](#ambiente-de-desenvolvimento)).
- `supabase/schema.sql`: tabelas, regras de acesso por usuário e criação automática do perfil.
- `docs/PRD.md`: requisitos do produto.
- `docs/mapa-oss.html`: animação da dor à produção (negócio, design, arquitetura e ambientes), publicada em `https://marcelobauer89.github.io/App-Treino/docs/mapa-oss.html`.

## Como colocar no ar

São seis passos, feitos uma vez. Anote o endereço onde o app vai ficar publicado (passo 2), porque ele é usado nos passos 4 e 5.

### 1. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. Pode rodar de novo depois sem duplicar nada.

### 2. Publicar o app

O login com Google não funciona abrindo o arquivo direto do computador; o app precisa de um endereço HTTPS. O caminho mais simples é o GitHub Pages:

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**. A publicação é feita pelo `.github/workflows/publicar.yml` a cada push na `main` (e na `dev`, veja [Ambiente de desenvolvimento](#ambiente-de-desenvolvimento)).
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
2. No `ambiente.js`, preencha em `producao` (este repositório já está configurado):

   ```js
   url: 'https://<seu-projeto>.supabase.co',
   chave: 'sb_publishable_...',
   ```

3. Faça commit e push. A chave publicável pode ficar no código: quem protege os dados são as regras de acesso (RLS) do `schema.sql`, que deixam cada usuário ler e alterar só os próprios registros.

A chave **secreta** (`sb_secret_...` ou `service_role`) nunca vai no app nem no repositório, porque ela passa por cima das regras de acesso. Se ela vazar, crie outra em **Project Settings → API Keys** e apague a antiga.

## Ambiente de desenvolvimento

Para testar mudanças sem mexer no app de verdade, existe um segundo app, de desenvolvimento, com **banco, logins e fotos próprios**:

| | Produção | Desenvolvimento |
|---|---|---|
| Endereço | `https://marcelobauer89.github.io/App-Treino/` | `https://marcelobauer89.github.io/App-Treino/dev/` |
| Branch | `main` | `dev` |
| Supabase | projeto atual | projeto só de testes |

- O `ambiente.js` escolhe o projeto pelo endereço: tudo o que está em `/dev/` (e em `localhost`) usa o projeto de testes.
- O app de desenvolvimento mostra um selo **DEV** no canto e `[DEV]` no título da aba.
- **Testar as boas-vindas:** abra `/App-Treino/dev/?boas-vindas` para ver as 3 etapas (o app, seus dados e o objetivo) em qualquer conta, mesmo uma que já usa o app. Escolher um objetivo troca de verdade os treinos dessa conta no dev (dá para Desfazer). Na produção, o parâmetro não faz nada.
- Os dois apps ficam no mesmo domínio, então o `ambiente.js` separa o que fica guardado no aparelho: no dev, tudo ganha o prefixo `dev:`, e as sessões, a fila de check-ins e as marcas não se misturam.

### Como as mudanças andam

1. As mudanças entram primeiro na branch `dev` (o PR vai para `dev`). O dev é publicado sozinho em 1 a 2 minutos.
2. Teste em `/dev/`. Se a mudança precisar de banco, rode o `schema.sql` no projeto de **testes** primeiro.
3. Aprovado, abra um PR de `dev` para `main`. Ao fazer o merge, rode o `schema.sql` no projeto de **produção**.

### Como montar (uma vez)

1. **Projeto de testes no Supabase:** crie um projeto novo (ex.: `oss-dev`; o plano gratuito permite dois). No **SQL Editor**, rode o `supabase/schema.sql` inteiro.
2. **Google:** no [Google Cloud Console](https://console.cloud.google.com), na mesma credencial do passo 3, adicione em **URIs de redirecionamento autorizados** o retorno do projeto novo: `https://<projeto-dev>.supabase.co/auth/v1/callback`. No projeto de testes, abra **Authentication → Sign In / Providers → Google**, ative e cole o mesmo **Client ID** e **Client Secret**.
3. **Endereços:** no projeto de testes, em **Authentication → URL Configuration**:
   - **Site URL:** `https://marcelobauer89.github.io/App-Treino/dev/`;
   - **Redirect URLs:** `https://marcelobauer89.github.io/App-Treino/dev/**` e `http://localhost:8000/**`.
4. **Chaves no app:** em **Project Settings → API Keys** do projeto de testes, copie a URL e a chave **publishable** e cole em `desenvolvimento`, no `ambiente.js`.
5. **Seu acesso:** entre uma vez em `/dev/` com o Google e rode no SQL Editor do projeto de testes, com o seu e-mail, para virar administrador e ficar liberado:

   ```sql
   insert into public.admins (usuario_id)
   select id from auth.users where email = 'seu-email@gmail.com'
   on conflict do nothing;
   update public.perfis set liberado = true where email = 'seu-email@gmail.com';
   ```

6. **Publicação:** em **Settings → Pages → Source**, escolha **GitHub Actions** (passo 2 de "Como colocar no ar") e crie a branch `dev` a partir da `main`.

O resumo semanal e o aviso de pedido de acesso **não precisam** existir no dev. Se quiser testá-los lá, publique a função no projeto de testes e troque o endereço `mlovfgbndtpeczgnvivi` pelo do projeto de testes nos arquivos de `supabase/agendamentos/` antes de rodar (só no SQL Editor). Use também um `RESUMO_TOKEN` diferente do de produção.

### Copiar a produção para o dev

O workflow **Copiar produção para dev** (GitHub → **Actions**) enche o banco de dev com os dados da produção, **anonimizados**:

- **Os seus dados vêm completos** (pelo e-mail informado ao rodar). A conta precisa já ter entrado no app de dev.
- **Os outros usuários:**
  - viram "Usuário N", com e-mail `usuarioN@exemplo.invalid`, sem foto de perfil e com um id novo a cada cópia;
  - os check-ins, pesos, semana, treinos e eventos vêm sem as observações e sem nomes ou e-mails dentro dos eventos;
  - ninguém consegue entrar com essas contas.
- **Os convites** viram "Convite N".
- **Não vêm:** os e-mails enviados, as fotos dos check-ins e os logins.
- **A anonimização acontece dentro da produção,** que só é lida (sessão em modo só leitura, com um usuário que não tem permissão de gravar).
- **Pode rodar quantas vezes quiser:** cada cópia substitui a anterior e os seus dados no dev. Contas reais que entraram no dev continuam lá.

Os arquivos ficam em `supabase/dev/`: `copiar.sh` (o passo a passo), `exportar.sql`, `importar.sql` e `leitor-producao.sql`.

**Configurar (uma vez):**
1. **Usuário de leitura na produção:**
   - no SQL Editor da **produção**, cole o `supabase/dev/leitor-producao.sql`, troque `TROQUE-POR-UMA-SENHA-FORTE` por uma senha longa só com letras e números e rode;
   - não salve a senha no arquivo.
2. **Conexões:**
   - em cada projeto, clique em **Connect** no topo e copie a **Session pooler** (os servidores do GitHub não acessam a conexão direta);
   - produção: troque o usuário `postgres.<id>` por `leitor_copia.<id>` e `[YOUR-PASSWORD]` pela senha do passo 1;
   - dev: use como está, trocando `[YOUR-PASSWORD]` pela senha do banco do oss-dev.
3. **Segredos:** no GitHub, em **Settings → Secrets and variables → Actions → New repository secret**, crie `PROD_DB_URL` e `DEV_DB_URL` com as conexões do passo 2.

**Rodar:**
1. Abra **Actions → Copiar produção para dev → Run workflow**, informe o seu e-mail e confirme.
2. Ao terminar, o log mostra quantos usuários, check-ins, pesos, eventos e convites foram copiados.

Por segurança, o workflow só importa no projeto `tnpgxukcrfcwjvzlimkm` (oss-dev) e recusa rodar com as duas conexões iguais.

## Atualizar o banco depois de uma nova versão

Quando uma versão nova do app precisar de mudanças no banco, rode no **SQL Editor** a migração nova de `supabase/migracoes/` (veja o [README da pasta](supabase/migracoes/README.md)). Rodar de novo o `supabase/schema.sql` inteiro (passo 1) também funciona. Ele só cria o que falta e não apaga dados. A tela **Minha semana** precisa da coluna `perfis.semana` e o registro de pesos precisa da tabela `cargas`: se o app avisar "Para salvar a semana…" ou "Para salvar os pesos, rode de novo o supabase/schema.sql", é isso que falta.

## Recursos

Como cada recurso funciona, onde fica no banco e o que rodar para ligar está em [docs/RECURSOS.md](docs/RECURSOS.md): [Treinos personalizados](docs/RECURSOS.md#treinos-personalizados), [Evolução (Dashboard)](docs/RECURSOS.md#evolução-dashboard), [Atualização automática](docs/RECURSOS.md#atualização-automática), [Aviso de novidade (Evolução)](docs/RECURSOS.md#aviso-de-novidade-evolução), [Futebol e Futvôlei](docs/RECURSOS.md#futebol-e-futvôlei), [Celebração do check-in](docs/RECURSOS.md#celebração-do-check-in), [Temporizador de descanso](docs/RECURSOS.md#temporizador-de-descanso), [Jornadas prontas](docs/RECURSOS.md#jornadas-prontas), [App instalável (PWA)](docs/RECURSOS.md#app-instalável-pwa), [Catálogo de exercícios e objetivos](docs/RECURSOS.md#catálogo-de-exercícios-e-objetivos), [Vídeos liberados por usuário](docs/RECURSOS.md#vídeos-liberados-por-usuário), [Convites (acesso só para convidados)](docs/RECURSOS.md#convites-acesso-só-para-convidados), [Área do personal](docs/RECURSOS.md#área-do-personal), [Excluir conta](docs/RECURSOS.md#excluir-conta), [Foto no check-in (opcional)](docs/RECURSOS.md#foto-no-check-in-opcional), [Privacidade e LGPD](docs/RECURSOS.md#privacidade-e-lgpd), [Monitoramento de uso](docs/RECURSOS.md#monitoramento-de-uso), [Resumo semanal por e-mail](docs/RECURSOS.md#resumo-semanal-por-e-mail).

## Ajustes únicos de dados

Scripts em `supabase/ajustes/` corrigem dados já gravados e rodam uma vez só, no **SQL Editor**, depois do `schema.sql`:

- `2026-10-20-peso-zero-para-sem-peso.sql`: marca como **Sem peso** os exercícios em que todas as cargas registradas pelo usuário são zero (gravadas como número ou como texto, como `"0"`). A primeira consulta do arquivo mostra o que vai mudar; a segunda faz o ajuste. Não apaga nenhum registro de peso.
- `2026-10-20-zero-vira-feito-usuario.sql`: para um usuário (troque o nome no arquivo antes de rodar), marca como **Sem peso** os exercícios registrados só com carga zero e troca esses zeros pelo registro de "feito" do dia. Exercícios com algum peso maior que zero não mudam.
- `2026-10-29-nome-vazio.sql`: preenche o nome dos perfis que ficaram sem nome com o nome do Google e lista quem continua sem nome (a conta do Google não tem nome). Pode rodar de novo; só mexe em quem está sem nome. O painel já mostra o nome do Google quando o perfil está vazio (depois do `schema.sql`).
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

Abra `http://localhost:8000/`. No computador, o app usa o projeto de **testes** (o endereço precisa estar em **Redirect URLs** dele, passo 3 de [Como montar](#como-montar-uma-vez)).

### Testes automáticos

Os testes do app, do painel e do resumo por e-mail ficam em `tests/` e rodam em paralelo com `node tests/rodar.cjs` (detalhes em [tests/README.md](tests/README.md)). Eles usam um Supabase falso: não mexem nos bancos de dev nem de produção.

## Como os dados ficam guardados

- **perfis:** nome, e-mail e foto (vindos do Google no primeiro login), os treinos montados em **Você → Meus treinos** (coluna `treinos`; vazia = o plano pronto do app), a jornada pronta escolhida (`jornada`), a última resposta ao aviso da novidade (`novidade_treinos`) e se pediu para não mostrar mais (`novidade_oculta`), tema, se quer receber o resumo semanal (`emails_resumo`), os exercícios marcados como **Sem peso** (coluna `sem_peso`) e a semana montada em **Você → Minha semana** (coluna `semana`: o que fazer em cada dia, até 2 atividades). Contas sem semana salva usam a padrão, montada com os antigos dias de Jiu Jitsu (`dias_jiu`).
- **checkins:** cada check-in de treino, com horário e observação (opcional) (check-ins de versões anteriores também guardavam as cargas).
- **cargas:** os pesos registrados na ficha, por dia e treino. Salvar um peso não abre check-in.
- **eventos:** uso do app (telas, recursos, erros), para o dashboard de monitoramento.
- **admins:** contas que podem ver o dashboard de monitoramento.
- **exercicios** e **jornadas:** o catálogo (biblioteca de exercícios e objetivos prontos), igual para todos e editado no monitoramento.
- **emails_enviados:** registro dos resumos semanais enviados (quem e de qual semana), para não mandar o mesmo duas vezes. A opção de receber fica em `perfis.emails_resumo`.
- O app funciona online: cada alteração vai para o Supabase na hora. Se a gravação falhar, o app avisa e recarrega os dados do servidor.
- No primeiro login em cada aparelho, os check-ins e configurações que estavam salvos só no navegador (versões anteriores do app) são enviados para a conta.
