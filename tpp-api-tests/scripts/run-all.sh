#!/usr/bin/env bash

set -euo pipefail

cleanup() {
  docker compose \
    -f infra/docker-compose.yaml \
    down -v
}

trap cleanup EXIT

docker compose \
  -f infra/docker-compose.yaml \
  up \
  --build \
  --abort-on-container-exit \
  --exit-code-from tests