#!/usr/bin/env bash
# Copia a produção para o dev, anonimizada (README → "Copiar a produção para o dev").
# Usado pelo workflow "Copiar produção para dev"; também roda num computador com psql:
#   PROD_DB_URL=... DEV_DB_URL=... EMAIL=voce@gmail.com supabase/dev/copiar.sh
# DEV_PROJETO (opcional): id do projeto de dev que o DEV_DB_URL precisa conter, para nunca importar na produção.
set -euo pipefail
pasta_sql="$(cd "$(dirname "$0")" && pwd)"

: "${PROD_DB_URL:?Falta o PROD_DB_URL (conexão da produção).}"
: "${DEV_DB_URL:?Falta o DEV_DB_URL (conexão do dev).}"
: "${EMAIL:?Falta o EMAIL da conta que vem completa.}"

if [ "$PROD_DB_URL" = "$DEV_DB_URL" ]; then
  echo "::error::PROD_DB_URL e DEV_DB_URL são iguais. A cópia não roda." >&2; exit 1
fi
if [ -n "${DEV_PROJETO:-}" ]; then
  case "$DEV_DB_URL" in *"$DEV_PROJETO"*) ;; *) echo "::error::O DEV_DB_URL não é do projeto de dev ($DEV_PROJETO). A cópia não roda." >&2; exit 1 ;; esac
  case "$PROD_DB_URL" in *"$DEV_PROJETO"*) echo "::error::O PROD_DB_URL aponta para o projeto de dev. A cópia não roda." >&2; exit 1 ;; esac
fi

trabalho="$(mktemp -d)"
trap 'rm -rf "$trabalho"' EXIT
cd "$trabalho"

# 1. Sua conta no dev.
dono="$(echo "select id from auth.users where lower(email) = lower(:'email')" | psql "$DEV_DB_URL" -X -At -v ON_ERROR_STOP=1 -v email="$EMAIL" 2>&1)" || { echo "$dono" >&2; exit 1; }
if [ -z "$dono" ]; then
  echo "::error::A conta $EMAIL ainda não existe no dev. Entre uma vez no app de dev com o Google e rode de novo." >&2; exit 1
fi

# 2. Exporta da produção em modo só leitura, já anonimizado.
sal="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v email="$EMAIL" -v dono_dev="$dono" -v sal="$sal" -f "$pasta_sql/exportar.sql"

# 3. Importa no dev, numa transação.
psql "$DEV_DB_URL" -X -v ON_ERROR_STOP=1 -v dono="$dono" -f "$pasta_sql/importar.sql"
