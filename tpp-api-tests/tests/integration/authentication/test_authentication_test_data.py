import pytest


pytestmark = pytest.mark.integration


def get_authentication_state(
    db,
    user_id,
):

    return db.fetch_one(
        """
        SELECT
            u.activo,
            d.activo,
            c.bloqueada,
            c.intentos_fallidos_consecutivos,
            c.cambio_password_requerido,
            c.password_hash
        FROM usuario u
        INNER JOIN dominio d
            ON d.id_dominio = u.id_dominio
        INNER JOIN credencial c
            ON c.id_usuario = u.id_usuario
        WHERE u.id_usuario = %s
        """,
        (user_id,),
    )


def test_valid_user(
    db,
    authentication_test_users,
    password_hasher,
):

    user = authentication_test_users[
        "valid"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    (
        user_active,
        domain_active,
        blocked,
        failed_attempts,
        password_change_required,
        password_hash,
    ) = row

    assert user_active is True
    assert domain_active is True
    assert blocked is False
    assert failed_attempts == 0

    assert (
        password_change_required
        is False
    )

    assert password_hasher.verify(
        password_hash,
        user["password"],
    )


def test_user_requires_password_change(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "password_change_required"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[4] is True


def test_inactive_user(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "inactive_user"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[0] is False
    assert row[1] is True
    assert row[2] is False


def test_inactive_domain(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "inactive_domain"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[0] is True
    assert row[1] is False
    assert row[2] is False


def test_blocked_credential(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "blocked_credential"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[0] is True
    assert row[1] is True
    assert row[2] is True


def test_failed_attempts_zero(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "wrong_password_counter_0"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[3] == 0


def test_failed_attempts_two(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "wrong_password_counter_2"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[3] == 2
    assert row[2] is False


def test_user_without_permissions(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "without_permissions"
    ]

    row = db.fetch_one(
        """
        SELECT COUNT(*)
        FROM usuario_rol
        WHERE id_usuario = %s
        """,
        (user["id"],),
    )

    assert row[0] == 0


def test_user_with_previous_failed_attempt(
    db,
    authentication_test_users,
):

    user = authentication_test_users[
        "failed_attempts_before_success"
    ]

    row = get_authentication_state(
        db,
        user["id"],
    )

    assert row[3] == 1
    assert row[2] is False