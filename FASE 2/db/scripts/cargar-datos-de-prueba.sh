#!/usr/bin/env bash
# Carga órdenes de prueba en la base que corre en Docker.
# Uso: ./cargar-datos-de-prueba.sh [cantidad de órdenes]   (por defecto 200)

set -euo pipefail

ordenes="${1:-200}"
contenedor="${CONTENEDOR:-sgologic-db}"
carpeta="$(cd "$(dirname "$0")" && pwd)"

if ! [[ "$ordenes" =~ ^[0-9]+$ ]] || [ "$ordenes" -lt 1 ]; then
    echo "La cantidad de órdenes debe ser un número entero mayor que 0." >&2
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$contenedor"; then
    echo "No encuentro el contenedor $contenedor. Levántalo con: docker compose up -d db" >&2
    exit 1
fi

docker exec -i "$contenedor" psql -q -U sgologic -d sgologic \
    -v ON_ERROR_STOP=1 -v ordenes="$ordenes" < "$carpeta/datos-de-prueba-ordenes.sql"
