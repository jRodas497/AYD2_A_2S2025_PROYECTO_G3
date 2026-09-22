#!/bin/bash
# Fija la contraseña real de sgologic_app a partir de la variable de entorno DB_APP_PASSWORD.
# Separado de V5 porque una migración .sql no puede leer variables de entorno.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    alter role sgologic_app with password '${DB_APP_PASSWORD:-sgologic_app_dev}';
EOSQL
