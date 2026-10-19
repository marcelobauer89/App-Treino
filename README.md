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

- **perfis:** nome, e-mail e foto (vindos do Google no primeiro login), tema, os exercícios marcados como **Sem peso** (coluna `sem_peso`) e a semana montada em **Você → Minha semana** (coluna `semana`: o que fazer em cada dia, até 2 atividades). Contas sem semana salva usam a padrão, montada com os antigos dias de jiu-jitsu (`dias_jiu`).
- **checkins:** cada check-in de treino, com horário, recuperação e observação (check-ins de versões anteriores também guardavam as cargas).
- **cargas:** os pesos registrados na ficha, por dia e treino. Salvar um peso não abre check-in.
- O app funciona online: cada alteração vai para o Supabase na hora. Se a gravação falhar, o app avisa e recarrega os dados do servidor.
- No primeiro login em cada aparelho, os check-ins e configurações que estavam salvos só no navegador (versões anteriores do app) são enviados para a conta.
