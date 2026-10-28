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
