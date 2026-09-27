from pathlib import Path

import pytest
import yaml


pytestmark = pytest.mark.contract


CONTRACT = (
    Path(__file__).parents[2]
    / "contracts"
    / "EDH-22-openapi-authentication.yaml"
)


def test_openapi_file_exists():

    assert CONTRACT.exists()


def test_openapi_is_valid_yaml():

    with CONTRACT.open(
        encoding="utf-8"
    ) as file:

        document = yaml.safe_load(file)

    assert document["openapi"] == "3.1.0"

    assert (
        "/api/v1/auth/login"
        in document["paths"]
    )

    assert (
        "/internal/v1/auth/login"
        in document["paths"]
    )