#!/usr/bin/env bash
set -euo pipefail

# Convierte todos los .drawio de FASE 2/DRAWIO a PNG y los guarda en FASE 2/image.
# Uso: ./tools/export-fase2-diagramas.sh   (ejecutar desde cualquier ubicación)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DRAWIO_DIR="$REPO_ROOT/FASE 2/DRAWIO"
IMAGE_DIR="$REPO_ROOT/FASE 2/image"

if ! command -v drawio >/dev/null 2>&1; then
  echo "Error: no se encontró el comando 'drawio' (draw.io Desktop CLI) en el PATH." >&2
  exit 1
fi

if [ ! -d "$DRAWIO_DIR" ]; then
  echo "Error: no existe la carpeta '$DRAWIO_DIR'." >&2
  exit 1
fi

mkdir -p "$IMAGE_DIR"

shopt -s nullglob
files=("$DRAWIO_DIR"/*.drawio)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No se encontraron archivos .drawio en '$DRAWIO_DIR'."
  exit 0
fi

for f in "${files[@]}"; do
  base="$(basename "$f" .drawio)"
  out="$IMAGE_DIR/$base.png"
  echo "Exportando: $f -> $out"
  drawio -x -f png -s 2 -b 20 -o "$out" "$f"
done

echo "Listo. Imágenes generadas en '$IMAGE_DIR'."
