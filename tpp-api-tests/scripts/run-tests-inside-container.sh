#!/usr/bin/env bash

set -euo pipefail

echo "=== Smoke tests ==="
pytest -m smoke

echo "=== Functional tests ==="
pytest -m functional

echo "=== Integration tests ==="
pytest -m integration

echo "=== Contract tests ==="
pytest -m contract

echo "=== Schemathesis BFF ==="
schemathesis run \
  contracts/bff/openapi.yaml \
  --url http://bff:8080

echo "=== Schemathesis Profile/Auth ==="
schemathesis run \
  contracts/profile-auth/openapi.yaml \
  --url http://profile-auth:8080