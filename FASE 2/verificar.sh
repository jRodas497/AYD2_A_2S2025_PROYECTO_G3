#!/usr/bin/env bash
# Runs the complete reproducible QA flow; retains data and stops on the first failure.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi
export SGO_URL="${SGO_URL:-http://localhost:${FRONTEND_PORT:-8081}}"
export E2E_BASE_URL="${E2E_BASE_URL:-$SGO_URL}"
case "${1:-}" in
  '') caidas=false ;;
  --caidas) caidas=true ;;
  *) echo 'Uso: ./verificar.sh [--caidas]' >&2; exit 2 ;;
esac
for herramienta in docker python3 node npm; do
    command -v "$herramienta" >/dev/null || { echo "Falta $herramienta" >&2; exit 1; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { throw new Error("Se requiere Node 22+") }'
docker compose up -d --build --wait --wait-timeout 180
python3 pruebas/prueba_fase2.py
python3 pruebas/prueba_operaciones.py
python3 pruebas/prueba_seguridad.py
python3 pruebas/prueba_reserva_concurrente.py --base "$SGO_URL" --clientes 80
python3 pruebas/prueba_flujo_volumen.py --base "$SGO_URL" --clientes 60
python3 pruebas/prueba_rendimiento.py --base "$SGO_URL" --peticiones 1000 --concurrencia 32 --salida pruebas/resultados-rendimiento-kafka.json
if [ "$caidas" = true ]; then python3 pruebas/prueba_caidas.py; fi
cd frontend
npm ci
npm test
npm run lint
npm run build
npm exec -- playwright install chromium
npm exec -- playwright test
printf '\nVerificación completa terminada. Stack disponible en %s\n' "$SGO_URL"
