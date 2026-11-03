#!/bin/bash
# ===================================================================
#  Khan Baba — create the PostgreSQL role + database, once.
#
#    bash setup-database.sh
#
#  Reads the user, password and database name from DATABASE_URL in .env,
#  so the password lives in exactly one place. Safe to run again: an
#  existing role or database is left alone.
# ===================================================================
set -euo pipefail
cd "$(dirname "$0")"

URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
[ -n "$URL" ] || { echo "DATABASE_URL missing from .env"; exit 1; }

# postgresql://USER:PASS@HOST:PORT/DB
DB_USER=$(echo "$URL" | sed -E 's|^[a-z]+://([^:]+):.*|\1|')
DB_PASS=$(echo "$URL" | sed -E 's|^[a-z]+://[^:]+:([^@]+)@.*|\1|')
DB_NAME=$(echo "$URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')

case "$DB_NAME" in
  zmobilepkdb|mobilestorepkdb) echo "Refusing: .env points at another store's database ($DB_NAME)."; exit 1;;
esac

psql_q() { sudo -u postgres psql -v ON_ERROR_STOP=1 -tA "$@" < /dev/null; }

if [ "$(psql_q -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" = "1" ]; then
  echo "role $DB_USER already exists"
else
  psql_q -c "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASS'"
  echo "role $DB_USER created"
fi

if [ "$(psql_q -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" = "1" ]; then
  echo "database $DB_NAME already exists"
else
  psql_q -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""
  echo "database $DB_NAME created"
fi

echo
echo "Next:  npx medusa db:migrate   then   npm run build && pm2 start ecosystem.config.js"
