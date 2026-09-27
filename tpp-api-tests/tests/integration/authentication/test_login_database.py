import pytest


pytestmark = pytest.mark.integration


def test_wrong_password_increments_counter(
    db,
    user_factory,
    unique_email,
    bff_client,
):

    user = user_factory(
        email=unique_email,
    )

    response = bff_client.login(
        user["email"],
        "PasswordIncorrecta#",
    )

    assert response.status_code == 401

    row = db.fetch_one(
        """
        SELECT
            intentos_fallidos_consecutivos,
            bloqueada
        FROM credencial
        WHERE id_usuario = %s
        """,
        (user["id"],),
    )

    assert row[0] == 1
    assert row[1] is False

def test_third_wrong_password_blocks_credential(
    db,
    user_factory,
    unique_email,
    bff_client,
):

    user = user_factory(
        email=unique_email,
        failed_attempts=2,
    )

    response = bff_client.login(
        user["email"],
        "PasswordIncorrecta#",
    )

    assert response.status_code == 401

    row = db.fetch_one(
        """
        SELECT
            intentos_fallidos_consecutivos,
            bloqueada
        FROM credencial
        WHERE id_usuario = %s
        """,
        (user["id"],),
    )

    assert row[0] == 3
    assert row[1] is True