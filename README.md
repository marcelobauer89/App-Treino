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
2. No começo do `<script>` principal do `index.html`, troque:

   ```js
   const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
   const SUPABASE_ANON_KEY = 'SUA-CHAVE-ANON';
   ```

3. Faça commit e push. A chave pública pode ficar no código: quem protege os dados são as regras de acesso (RLS) do `schema.sql`, que deixam cada usuário ler e alterar só os próprios registros. Nunca coloque a chave `service_role` (ou **secret**) no app.

## Testar no computador

```sh
python3 -m http.server 8000
```

Abra `http://localhost:8000/` (esse endereço precisa estar em **Redirect URLs**, passo 5).

## Como os dados ficam guardados

- **perfis:** nome, e-mail e foto (vindos do Google no primeiro login), tema e dias de jiu-jitsu.
- **checkins:** cada check-in de treino, com horário, recuperação, observação e as cargas por exercício.
- O app funciona online: cada alteração vai para o Supabase na hora. Se a gravação falhar, o app avisa e recarrega os dados do servidor.
- No primeiro login em cada aparelho, os check-ins e configurações que estavam salvos só no navegador (versões anteriores do app) são enviados para a conta.
