#!/usr/bin/env bash
# Borra la base con todos sus datos y la crea de nuevo desde las migraciones.
# Uso: ./reiniciar-base.sh [-y] [cantidad de órdenes de prueba]
#   -y   no pregunta antes de borrar
#   Si se pasa una cantidad, después de crear la base se cargan esas órdenes de prueba.

set -euo pipefail

carpeta="$(cd "$(dirname "$0")" && pwd)"
compose="$carpeta/../../docker-compose.yml"
contenedor="${CONTENEDOR:-sgologic-db}"
confirmar=1
ordenes=""

for arg in "$@"; do
    if [ "$arg" = "-y" ]; then
        confirmar=0
    elif [[ "$arg" =~ ^[0-9]+$ ]] && [ "$arg" -ge 1 ]; then
        ordenes="$arg"
    else
        echo "No entiendo el argumento '$arg'. Uso: $0 [-y] [cantidad de órdenes]" >&2
        exit 1
    fi
done

if [ "$confirmar" -eq 1 ]; then
    read -r -p "Esto borra todos los datos de la base y la crea de nuevo. ¿Seguir? [s/N] " respuesta || respuesta=""
    if [ "$respuesta" != "s" ] && [ "$respuesta" != "S" ]; then
        echo "No se borró nada."
        exit 0
    fi
fi

docker compose -f "$compose" down -v
docker compose -f "$compose" up -d db

echo "Esperando a que la base termine de crearse..."
for _ in $(seq 1 60); do
    estado="$(docker inspect -f '{{.State.Health.Status}}' "$contenedor" 2>/dev/null || true)"
    [ "$estado" = "healthy" ] && break
    sleep 2
done

if [ "$estado" != "healthy" ]; then
    echo "La base no quedó lista a tiempo. Revisa los mensajes con: docker logs $contenedor" >&2
    exit 1
fi

docker compose -f "$compose" run --rm migrate

echo "Base lista, con el catálogo, el stock y los clientes de ejemplo."

if [ -n "$ordenes" ]; then
    "$carpeta/cargar-datos-de-prueba.sh" "$ordenes"
fi
