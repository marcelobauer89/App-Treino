# Migrações do banco

Cada mudança no banco vira um arquivo pequeno aqui, com número e nome: `001-descricao.sql`, `002-...`. É esse arquivo que se roda no **SQL Editor** do Supabase, primeiro no projeto de **testes** (ao ir para a `dev`) e depois no de **produção** (ao ir para a `main`). Assim não é preciso rodar o `schema.sql` inteiro a cada versão.

Regras:

- **Pode rodar de novo sem estrago** (`if not exists`, `create or replace`, `on conflict do nothing`), como o `schema.sql`.
- **A mesma mudança entra também no `supabase/schema.sql`**, que continua sendo a foto completa do banco: é por ele que se monta um projeto novo do zero e é ele que os testes (`tests/sql/rodar.sh`) aplicam.
- A primeira linha diz o que a migração faz e a data. Não apagar migrações antigas: elas contam a história do banco.
- Ainda não há nenhuma: as mudanças até 13/11/2026 estão só no `schema.sql`. Quem montar um projeto novo roda o `schema.sql` e não precisa das migrações.
