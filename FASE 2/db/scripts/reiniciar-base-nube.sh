#!/bin/bash
# Equivalente en la nube de reiniciar-base.sh: borra TODOS los esquemas de una base Postgres
# administrada (Neon, o cualquier otra) y los recrea desde cero con las migraciones. Se corre a
# mano: DB_APP_PASSWORD=... ./reiniciar-base-nube.sh "<cadena de conexión>".
#
# Esto borra todo lo que haya en esa base, no solo lo que sembraron las migraciones. Sirve para
# dejar un punto de partida limpio antes de una demostración, no para usarlo de forma habitual.
# Para solo agregar migraciones nuevas sin borrar datos, usar aplicar-migraciones-nube.sh.
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "uso: $0 <cadena-de-conexion>" >&2
    exit 1
fi

if [ -z "${DB_APP_PASSWORD:-}" ]; then echo "Definir DB_APP_PASSWORD antes de reiniciar." >&2; exit 1; fi
URL="$1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Borrando los esquemas existentes..."
psql "$URL" -v ON_ERROR_STOP=1 -c "
drop schema if exists
    config, catalog, customers, inventory, orders, payments, invoicing, logistics, notifications,
    integration, audit
cascade;
drop table if exists public.schema_migration;
"

echo "Recreando desde las migraciones..."
"$DIR/aplicar-migraciones-nube.sh" "$URL"
