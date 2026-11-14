#!/bin/sh
# Levanta la infraestructura principal y luego la Central de Monitoreo
# (que depende de la red y el volumen que crea el compose principal).
set -e

cd "$(dirname "$0")"

echo "==> Levantando infraestructura y aplicación principales..."
docker compose up -d --build

echo "==> Esperando a que PostgreSQL acepte conexiones..."
until docker compose exec -T postgres pg_isready -U user -d appdb >/dev/null 2>&1; do
  sleep 2
done

# La Central de Monitoreo lee PostgreSQL con un rol de solo lectura propio
# (tpp_monitor), que no crea ningún init script. Se asegura aquí, de forma
# idempotente, usando la credencial de monitoring/.env.
MONITOR_ENV="monitoring/.env"
if [ -f "$MONITOR_ENV" ]; then
  MONITOR_DB_USER=$(grep -E '^MONITOR_DB_USER=' "$MONITOR_ENV" | tail -1 | cut -d= -f2-)
  MONITOR_DB_PASSWORD=$(grep -E '^MONITOR_DB_PASSWORD=' "$MONITOR_ENV" | tail -1 | cut -d= -f2-)
fi
MONITOR_DB_USER=${MONITOR_DB_USER:-tpp_monitor}

if [ -z "$MONITOR_DB_PASSWORD" ]; then
  echo "    ! MONITOR_DB_PASSWORD no está definida en monitoring/.env; no se creó el rol de monitoreo."
else
  echo "==> Asegurando el rol de monitoreo de PostgreSQL (${MONITOR_DB_USER})..."
  ROLE_EXISTS=$(docker compose exec -T postgres psql -U user -d appdb -tAc \
    "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${MONITOR_DB_USER}'")
  if [ "$(echo "$ROLE_EXISTS" | tr -d '[:space:]')" = "1" ]; then
    ROLE_VERB="ALTER ROLE"
  else
    ROLE_VERB="CREATE ROLE"
  fi
  docker compose exec -T postgres psql -U user -d appdb -v ON_ERROR_STOP=1 -v monitor_pass="$MONITOR_DB_PASSWORD" <<SQL
${ROLE_VERB} "${MONITOR_DB_USER}" LOGIN PASSWORD :'monitor_pass';
GRANT pg_monitor TO "${MONITOR_DB_USER}";
ALTER ROLE "${MONITOR_DB_USER}" SET default_transaction_read_only = on;
SQL
fi

echo "==> Levantando la Central de Monitoreo..."
docker compose -f monitoring/docker-compose.yml up -d --build monitoring

echo "==> Listo. Servicios disponibles:"
echo "    - App:                 http://localhost"
echo "    - Central de monitoreo: http://localhost:3002"
echo "    - Grafana:              http://localhost:3001"
echo "    - Keycloak:             http://localhost:8080"
