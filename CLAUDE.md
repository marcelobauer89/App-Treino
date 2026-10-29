# Instruções para o Claude

## PRs: abrir e fazer o merge sem esperar aprovação

O dono do repositório não quer abrir nem aceitar PRs pelo GitHub. Ao terminar uma mudança:

1. Faça o commit na branch de trabalho (`claude/...`, criada a partir da `dev`) e o push.
2. Abra o PR para a **`dev`** e faça o merge você mesmo (método `merge`), sem pedir confirmação. O `/dev/` é publicado sozinho em 1 a 2 minutos.
3. **Produção:** quando o dono pedir para subir para produção ("manda pra prod", "pode publicar"), abra o PR de `dev` para `main` e faça o merge na hora, também sem pedir confirmação.

Regras:

- Se o PR tiver conflito, resolva com um merge da branch de destino (nada de force-push na `dev` ou na `main`) e só então faça o merge.
- Se a mudança mexer no `supabase/schema.sql` ou em outro SQL, avise na resposta que é preciso rodar o SQL no projeto de **testes** (ao ir para a `dev`) ou de **produção** (ao ir para a `main`), porque isso não é automático.
- Depois do merge, responda com o link do PR e o endereço publicado (`/App-Treino/dev/` ou `/App-Treino/`).

## Backlog no Notion: atualizar a cada subida para produção

O backlog do app fica numa tabela do Notion (página App-Treino → **Backlog**, privada): https://app.notion.com/p/f7832b327e3640ffa06bee686873e659 (fonte de dados `collection://888b88d6-dcdd-4ec5-8b8c-a3420e59b903`).

Toda vez que fizer o merge de `dev` para `main`:

1. Liste o que entrou em produção (os commits e PRs do merge de `dev` para `main`).
2. Para cada mudança, procure o item na tabela: pelo `ID` (RF-xx, quando a mudança cita um requisito do PRD) ou pelo nome e pelos `Detalhes`.
3. Se existir, atualize a **Situação** (`Feito` quando estiver completo; `Parcial` quando só uma parte entrou) e acrescente em `Detalhes` o que mudou e a data. Não altere Prioridade, Área nem Pedido por.
4. Se não existir, crie um item novo com Situação, Área, Origem (`PRD` se estiver no `docs/PRD.md`) e Detalhes, sem duplicar um item parecido.
5. Na resposta, diga quais itens foram atualizados ou criados, com o link da tabela.

Se o conector do Notion não estiver disponível na sessão, avise na resposta que o backlog não foi atualizado e liste o que precisaria mudar.
