#!/bin/bash
# Equivalente en la nube de reiniciar-base.sh: borra TODOS los esquemas de una base Postgres
# administrada (Neon, o cualquier otra) y los recrea desde cero con las migraciones. Lo usa el
# job "deploy" del CI (.github/workflows/ci.yml) cuando la variable de repositorio
# RESET_SEED_CLOUD está en "true" — mismo interruptor y mismo significado que RESET_SEED en
# iniciar.sh, pero sobre la base real, no sobre un contenedor local.
#
# Esto borra todo lo que haya en esa base, no solo lo que sembraron las migraciones. No se
# recomienda dejarlo en "true" de forma permanente: cada push a la rama que dispara el deploy
# volvería a borrar lo que se haya probado desde la última vez.
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "uso: $0 <cadena-de-conexion>" >&2
    exit 1
fi

URL="$1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Borrando los esquemas existentes..."
psql "$URL" -v ON_ERROR_STOP=1 -c "
drop schema if exists
    config, catalog, customers, inventory, orders, payments, invoicing, logistics, notifications,
    integration, audit
cascade;
"

echo "Recreando desde las migraciones..."
"$DIR/aplicar-migraciones-nube.sh" "$URL"
