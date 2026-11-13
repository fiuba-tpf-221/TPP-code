#!/bin/sh
# Levanta la infraestructura principal y luego la Central de Monitoreo
# (que depende de la red y el volumen que crea el compose principal).
set -e

cd "$(dirname "$0")"

echo "==> Levantando infraestructura y aplicación principales..."
docker compose up -d --build

echo "==> Levantando la Central de Monitoreo..."
docker compose -f monitoring/docker-compose.yml up -d --build monitoring

echo "==> Listo. Servicios disponibles:"
echo "    - App:                 http://localhost"
echo "    - Central de monitoreo: http://localhost:3002"
echo "    - Grafana:              http://localhost:3001"
echo "    - Keycloak:             http://localhost:8080"
