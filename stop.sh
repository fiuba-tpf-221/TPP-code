#!/bin/sh
# Baja la Central de Monitoreo y luego la infraestructura principal
# (orden inverso a start.sh, ya que la central depende de la red/volumen del compose principal).
set -e

cd "$(dirname "$0")"

echo "==> Bajando la Central de Monitoreo..."
docker compose -f monitoring/docker-compose.yml down

echo "==> Bajando infraestructura y aplicación principales..."
docker compose down

echo "==> Listo. Todos los servicios fueron detenidos."
