#!/usr/bin/env bash
# Deja a un cliente con un historial de compras confiable en el ERP simulado, para poder
# demostrar la compra a crédito sin esperar a que acumule compras entregadas.
#
# Uso:  ./habilitar-credito.sh <correo-del-cliente> [url-base]
# Ejemplo local:  ./habilitar-credito.sh cliente@example.com http://localhost:8081
#
# Variables opcionales: ADMIN_USER (admin) y ADMIN_PASSWORD (admin123).
# Solo funciona donde el ERP simulado está levantado (docker-compose); en la nube de Render no
# hay ERP, así que ahí el crédito no se puede habilitar.
set -euo pipefail

correo="${1:-}"
base="${2:-http://localhost:8081}"
usuario="${ADMIN_USER:-admin}"
clave="${ADMIN_PASSWORD:-admin123}"

if [ -z "$correo" ]; then
  echo "Uso: $0 <correo-del-cliente> [url-base]" >&2
  exit 1
fi

json() { python3 -c "import sys,json; d=json.load(sys.stdin); $1"; }

token=$(curl -fsS -X POST "$base/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$usuario\",\"password\":\"$clave\"}" | json 'print(d["token"])')

# Busca al cliente por correo exacto.
id=$(curl -fsS -G "$base/api/customers" --data-urlencode "q=$correo" -H "Authorization: Bearer $token" \
  | CORREO="$correo" python3 -c "
import sys, json, os
c = os.environ['CORREO'].lower()
filas = [x for x in json.load(sys.stdin) if str(x.get('email', '')).lower() == c]
print(filas[0]['id'] if filas else '')")

if [ -z "$id" ]; then
  echo "No existe ningún cliente con el correo $correo" >&2
  exit 1
fi

curl -fsS -X PUT "$base/api/integration/erp/customers/$id/history" \
  -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
  -d '{"deliveredOrders":5,"purchasedAmount":1500,"latePayments":0,"overduePayments":0,"returns":0,"confirmedIncidents":0,"declinedPayments":0}' \
  | json 'print("Historial ERP cargado para el cliente %s. Evaluación: %s" % ('"$id"', d.get("history")))'
echo "Listo: abre Mi crédito con ese cliente y debe aparecer «Crédito habilitado»."
