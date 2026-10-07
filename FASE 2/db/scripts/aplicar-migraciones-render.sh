#!/bin/bash
# Aplica las migraciones de FASE 2/db/migrations contra una base Postgres administrada (pensado
# para la base que crea render.yaml), donde no existe el hook docker-entrypoint-initdb.d que las
# corre solas en local. Es un paso manual, de una sola vez, justo después de que la base de
# Render quede lista (ver DEPLOY-RENDER.md).
#
# No corre V5__rol_de_aplicacion.sql ni V6__contrasena_de_la_app.sh: esos crean el rol
# sgologic_app de bajo privilegio, pero Render solo da un usuario por base, así que el backend
# se conecta con ese mismo usuario para todo (ver render.yaml y DEPLOY-RENDER.md).
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "uso: $0 <connection-string-externa-de-render>" >&2
    echo "  (Render > sgologic-db > Connect > External Connection String)" >&2
    exit 1
fi

URL="$1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../migrations" && pwd)"

for archivo in \
    V1__esquemas_y_tablas.sql \
    V2__datos_de_prueba.sql \
    V3__identidad.sql \
    V4__guardia_de_tarjetas.sql \
    V7__usuario_de_prueba.sql \
    V8__reserva_de_20_minutos.sql
do
    echo "==> $archivo"
    psql "$URL" -v ON_ERROR_STOP=1 -f "$DIR/$archivo"
done

echo "Listo: esquemas, datos de prueba, identidad y el usuario admin/admin123 quedaron en la base de Render."
