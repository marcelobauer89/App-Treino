# Instruções para o Claude

## Onde achar as coisas (gastar menos tokens)

- **`docs/MAPA.md`**: em que seção de cada arquivo fica cada tela ou recurso, e quais testes cobrem cada área. Comece por ele; procure a seção pelo comentário `// ---------- Nome ----------` e leia só aquele trecho, nunca o `index.html` ou o `admin.html` inteiros.
- **`docs/RECURSOS.md`**: como cada recurso funciona e como ligar (índice no topo). **`docs/PRD.md`**: requisitos; ache a linha pelo ID (`grep -n 'RF-02 ' docs/PRD.md`).
- Não abra imagens (PNG/JPG) nem `tests/saida/` sem necessidade.

## PRs: perguntar antes de abrir; depois, fazer o merge sem esperar aprovação

O dono do repositório não quer abrir nem aceitar PRs pelo GitHub. Ao terminar uma mudança:

1. Faça o commit na branch de trabalho (`claude/...`, criada a partir da `dev`) e o push.
2. **Pergunte ao dono se já pode abrir o PR** (ele pode querer juntar mais ajustes antes). Só abra quando ele disser que sim.
3. Com o sim, abra o PR para a **`dev`** e, com os testes do GitHub verdes, faça o merge você mesmo (método `merge`). O `/dev/` é publicado sozinho em 1 a 2 minutos.
4. **Produção:** quando o dono pedir para subir para produção ("manda pra prod", "pode publicar"), abra o PR de `dev` para `main` e faça o merge na hora, também sem pedir confirmação.

Regras:

- Se o PR tiver conflito, resolva com um merge da branch de destino (nada de force-push na `dev` ou na `main`) e só então faça o merge.
- Se a mudança mexer no `supabase/schema.sql` ou em outro SQL, avise na resposta que é preciso rodar o SQL no projeto de **testes** (ao ir para a `dev`) ou de **produção** (ao ir para a `main`), porque isso não é automático.
- Depois do merge, responda com o link do PR e o endereço publicado (`/App-Treino/dev/` ou `/App-Treino/`).

## Backlog no Notion: atualizar a cada subida para produção

O backlog do app fica numa tabela do Notion (página App-Treino → **Backlog**, privada): https://app.notion.com/p/f7832b327e3640ffa06bee686873e659 (fonte de dados `collection://888b88d6-dcdd-4ec5-8b8c-a3420e59b903`).

Toda vez que fizer o merge de `dev` para `main`:

1. Liste o que entrou em produção (os commits e PRs do merge de `dev` para `main`).
2. Para cada mudança, procure o item na tabela: pelo `ID` (RF-xx, quando a mudança cita um requisito do PRD) ou pelo nome e pelos `Detalhes`. Busque só esses itens (consulta filtrada pelo ID ou pelo nome), sem ler a tabela inteira.
3. Se existir, atualize a **Situação** (`Feito` quando estiver completo; `Parcial` quando só uma parte entrou) e acrescente em `Detalhes` o que mudou e a data. Não altere Prioridade, Área nem Pedido por.
4. Se não existir, crie um item novo com Situação, Área, Origem (`PRD` se estiver no `docs/PRD.md`) e Detalhes, sem duplicar um item parecido.
5. Na resposta, diga quais itens foram atualizados ou criados, com o link da tabela.

Se o conector do Notion não estiver disponível na sessão, avise na resposta que o backlog não foi atualizado e liste o que precisaria mudar.

## Testes

Os testes ficam em `tests/` (ver `tests/README.md`) e rodam em paralelo com `node tests/rodar.cjs`.

- Testes locais antes do PR para a `dev` (para gastar menos tempo e tokens):
  - mudança só de texto, estilo ou documentação: **nenhum teste local**; o GitHub confere no PR;
  - outras mudanças: rodar **só os testes da área mexida** (a lista por área está em `docs/MAPA.md`: `node tests/rodar.cjs testNN …`) e abrir o PR com eles verdes;
  - **bateria completa local** só em mudança arriscada: login e abertura do app, avisos que aparecem ao abrir, `supabase/schema.sql` (mais `tests/sql/rodar.sh`) e o harness dos testes (`tests/apoio/`).
- Cada PR para a `dev` ou a `main` roda os testes no GitHub (workflow **Testes**: app e painel, banco e e-mail). Fazer o merge só com os três verdes; se algum ficar vermelho, corrigir antes. Mudança no `supabase/schema.sql` precisa passar também no `tests/sql/rodar.sh`.
- Teste novo de cada mudança vai para `tests/e2e/`, só com dados de exemplo (nunca nomes, e-mails ou ids de vídeo reais).
- Acompanhamento dos testes (enxuto, para gastar menos tokens):
  - avisar quando começam, com o link para acompanhar quando for no GitHub;
  - avisar **na hora** se algum teste (ou parte, no GitHub) falhar;
  - no fim, mandar o resumo. Não mandar mensagem a cada teste verde nem consultar o GitHub repetidas vezes: esperar o aviso do fim (inscrição no PR) em vez de ficar verificando.

## Ritmo de entrega

- Juntar os ajustes pedidos em sequência num PR só, em vez de um PR por ajuste. Quando o dono pedir dev e produção juntos, fazer os dois ciclos em seguida.
- PRD (`docs/PRD.md`), `docs/RECURSOS.md`, `docs/MAPA.md` e README: atualizar no mesmo PR da mudança, sem PR separado só de documentação, e **só a seção mexida** (achar pelo índice ou pelo RF-xx; não reler o arquivo inteiro).
- README fica curto (instalação e operação); o detalhe de cada recurso vai em `docs/RECURSOS.md`.
- Notion: atualizar só no merge de `dev` para `main` (ver "Backlog no Notion").
