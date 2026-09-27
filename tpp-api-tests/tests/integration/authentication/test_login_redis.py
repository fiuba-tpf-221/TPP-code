import pytest


pytestmark = pytest.mark.integration


def test_login_creates_redis_session(
    user_factory,
    unique_email,
    bff_client,
    redis_store,
):

    user = user_factory(
        email=unique_email,
    )

    response = bff_client.login(
        user["email"],
        user["password"],
    )

    assert response.status_code == 200

    session_id = response.cookies.get(
        "session"
    )

    assert session_id is not None

    session = redis_store.get_session(
        session_id
    )

    assert session is not None

    assert (
        session["id_usuario"]
        == user["id"]
    )

    assert session["estado"] == "ACTIVA"

    ttl = redis_store.ttl(
        session_id
    )

    # No comparar exactamente contra 1800.
    assert 1750 <= ttl <= 1800

def test_session_does_not_store_forbidden_data(
    user_factory,
    unique_email,
    bff_client,
    redis_store,
):

    user = user_factory(
        email=unique_email,
    )

    response = bff_client.login(
        user["email"],
        user["password"],
    )

    session_id = response.cookies.get(
        "session"
    )

    session = redis_store.get_session(
        session_id
    )

    forbidden = {
        "roles",
        "usuario_activo",
        "dominio_activo",
        "password",
        "password_hash",
        "ultima_actividad",
        "fecha_expiracion",
    }

    assert forbidden.isdisjoint(
        session.keys()
    )