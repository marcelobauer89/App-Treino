#!/usr/bin/env bash
# Confere o supabase/schema.sql num Postgres comum: aplica duas vezes (tem que poder rodar de novo)
# e testa as regras de acesso. Usa as variáveis padrão do psql (PGHOST, PGPORT, PGUSER, PGPASSWORD).
#   tests/sql/rodar.sh            → cria e apaga o banco "teste_schema"
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
cd "$(dirname "$0")"
BANCO=${BANCO_TESTE:-teste_schema}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $BANCO" -c "create database $BANCO"
trap 'psql -q -d postgres -c "drop database if exists $BANCO" >/dev/null 2>&1 || true' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$BANCO" -f supabase-falso.sql
for vez in 1 2; do
  psql -v ON_ERROR_STOP=1 -q -d "$BANCO" -f ../../supabase/schema.sql > /dev/null
  echo "schema.sql aplicado ($vez.ª vez) sem erro"
done
psql -v ON_ERROR_STOP=1 -q -d "$BANCO" -f verificacoes.sql
