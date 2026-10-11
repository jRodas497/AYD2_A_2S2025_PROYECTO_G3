#!/usr/bin/env bash
# Punto de entrada único para levantar el stack local. Hace lo mismo que
# "docker compose up -d --build", pero antes revisa RESET_SEED en .env (plantilla en
# .env.example): en true, borra la base y la recrea desde FASE 2/db/migrations (con
# db/scripts/reiniciar-base.sh, ya probado) antes de levantar todo; en false o sin .env, no toca
# los datos existentes.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

if [ "${RESET_SEED:-false}" = "true" ]; then
    echo "RESET_SEED=true: se borra la base y se recrea desde las migraciones."
    ./db/scripts/reiniciar-base.sh -y
fi

docker compose up -d --build --wait --wait-timeout 180
