import pytest
import httpx

from config.settings import settings


pytestmark = pytest.mark.smoke


def test_bff_is_reachable():

    response = httpx.get(
        settings.bff_base_url,
        timeout=5,
    )

    assert response.status_code < 500


def test_profile_auth_is_reachable():

    response = httpx.get(
        settings.profile_auth_base_url,
        timeout=5,
    )

    assert response.status_code < 500