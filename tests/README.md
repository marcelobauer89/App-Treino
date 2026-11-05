# Testes

Testes automáticos do app (`index.html`), do painel (`admin.html`) e do resumo semanal por e-mail. Rodam num navegador de verdade (Chromium, pelo Playwright) contra um **Supabase falso** (`apoio/mock-supabase.js`): nada toca os bancos de dev ou de produção.

## Como rodar

Precisa de Node 22 e do Playwright com o Chromium (`npm install` nesta pasta e `npx playwright install chromium`, se ainda não tiver).

```bash
node tests/rodar.cjs                 # todos, em paralelo
node tests/rodar.cjs test36 test63   # só alguns (aceita parte do nome)
node tests/rodar.cjs --paralelo 2    # quantos ao mesmo tempo (padrão: um por núcleo, de 2 a 6)
cd tests && npm run edge             # resumo semanal por e-mail (Edge Function)
```

Cada teste sobe o próprio servidor numa porta diferente (`PORTA_TESTE`), então vários rodam juntos. No fim aparece o resumo (✅/❌) e, para cada teste que falhou, o que falhou. As capturas de tela vão para `tests/saida/` (fora do Git).

## No GitHub (a cada PR)

O workflow `.github/workflows/testes.yml` roda tudo sozinho a cada PR para a `dev` ou a `main`, em três partes ao mesmo tempo: **App e painel**, **Banco** e **Resumo semanal por e-mail**. O resultado aparece no PR, verde ou vermelho, e em **Actions → Testes** dá para acompanhar ao vivo. Se a parte do app falhar, as capturas de tela ficam no resumo da execução (*capturas-de-tela*). Também dá para rodar à mão em **Actions → Testes → Run workflow**.

Para o banco no computador: `tests/sql/rodar.sh` (com `PGHOST`, `PGPORT`, `PGUSER` e `PGPASSWORD` de um Postgres 16).

## O que tem aqui

- `e2e/testNN.cjs`: cada arquivo testa uma área (o comentário da primeira linha diz qual), em claro e escuro e em celular e computador quando importa.
- `apoio/harness.cjs`: abre o app com o Supabase falso, as fontes locais e os dados do teste.
- `apoio/mock-supabase.js`: o Supabase falso, guardado no `localStorage` da página. Simula as tabelas, as funções do banco, a falta de colunas ou funções (schema antigo), as falhas de rede e o limite de 1.000 linhas por chamada (`maxLinhas`).
- `apoio/videos-exemplo.json`: ids de vídeo **inventados**. A lista real fica só no banco (`videos_exercicios`) e nunca entra aqui.
- `H.catalogo()` (em `apoio/harness.cjs`): o catálogo do banco (exercícios e objetivos) igual à carga inicial do schema.sql, para pôr no banco falso. Sem ele, o app usa a lista que vem no index.html, como antes de rodar o SQL.
- `apoio/plano-padrao.txt`: cópia do plano pronto, para garantir que ele não muda sem querer.
- `edge/`: testes do resumo semanal (`supabase/functions/resumo-semanal/index.ts`), sem servidor e sem enviar e-mail.
- `sql/`: aplica o `supabase/schema.sql` duas vezes num Postgres comum (com o mínimo do Supabase em `supabase-falso.sql`) e confere as regras de acesso como o app usa o banco (`verificacoes.sql`): o que cada pessoa pode salvar, o que só o administrador faz, a lista de vídeos fechada, os tipos de check-in aceitos e o catálogo (só o administrador muda; renomear guarda o nome antigo; rodar o schema.sql de novo não mexe nos treinos e nas cargas das contas).

## Regras

- Dados só de exemplo: nada de e-mails, nomes ou documentos de pessoas reais, nem ids de vídeo reais.
- Teste novo: `e2e/testNN.cjs` com o próximo número, primeira linha dizendo o que testa, `ok(condição, 'descrição')` e, no fim, `process.exit(falhas ? 1 : 0)`.
- Se uma mudança tira um recurso do app, o teste dele sai junto.
