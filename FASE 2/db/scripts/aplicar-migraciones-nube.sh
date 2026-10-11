#!/usr/bin/env bash
# Uses the same tracked migrations as Compose. Requires ownership and permission to create roles.
set -euo pipefail
DATABASE_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DATABASE_URL" ]; then echo 'Uso: DATABASE_URL=... ./aplicar-migraciones-nube.sh' >&2; exit 1; fi
if [ -z "${DB_APP_PASSWORD:-}" ]; then echo 'Definir DB_APP_PASSWORD para el rol restringido de aplicación.' >&2; exit 1; fi
export DATABASE_URL DB_APP_PASSWORD
carpeta="$(cd "$(dirname "$0")/.." && pwd)"
docker run --rm --network host -e DATABASE_URL -e DB_APP_PASSWORD \
    -v "$carpeta/migrations:/migrations:ro" -v "$carpeta/migrate.sh:/migrate.sh:ro" \
    --entrypoint sh postgres:16-alpine /migrate.sh
