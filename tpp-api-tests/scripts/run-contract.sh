#!/usr/bin/env bash

set -euo pipefail

schemathesis run \
  contracts/EDH-22-openapi-authentication.yaml \
  --url "${BFF_BASE_URL:-http://localhost:8080}"