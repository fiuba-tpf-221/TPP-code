import uuid

import pytest

from helpers.password_hasher import TestPasswordHasher
from clients.bff_client import BffClient
from clients.profile_auth_client import ProfileAuthClient
from config.settings import settings
from helpers.database import Database
from helpers.redis_store import RedisStore

@pytest.fixture(scope="session")
def password_hasher():
    return TestPasswordHasher()

@pytest.fixture(scope="session")
def db():
    return Database()


@pytest.fixture(scope="session")
def redis_store():
    return RedisStore()


@pytest.fixture(scope="session")
def bff_client():

    client = BffClient(
        settings.bff_base_url
    )

    yield client

    client.close()


@pytest.fixture(scope="session")
def profile_auth_client():

    client = ProfileAuthClient(
        settings.profile_auth_base_url
    )

    yield client

    client.close()


@pytest.fixture
def context():
    return {}


@pytest.fixture
def unique_email():

    value = uuid.uuid4().hex[:12]

    return (
        f"qa+{value}@"
        f"{settings.test_domain}"
    )


@pytest.fixture
def user_factory(
    db,
    password_hasher,
):

    created_users = []
    created_domains = []

    def create_user(
        *,
        email=None,
        domain_name=None,
        password=None,
        password_hash=None,
        active=True,
        domain_active=True,
        blocked=False,
        failed_attempts=0,
        password_change_required=False,
        first_name="QA",
        last_name="Automation",
    ):

        unique_id = uuid.uuid4().hex[:12]

        if domain_name is None:
            domain_name = (
                f"qa-{unique_id}."
                f"{settings.test_domain}"
            )

        if email is None:
            email = (
                f"user-{unique_id}@"
                f"{domain_name}"
            )

        if password is None:
            password = settings.test_password

        email = email.strip().lower()
        domain_name = domain_name.strip().lower()

        if password_hash is None:
            password_hash = password_hasher.hash(
                password
            )

        domain_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        with db.connection() as connection:

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    INSERT INTO dominio (
                        id_dominio,
                        nombre,
                        activo,
                        fecha_creacion
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        NOW()
                    )
                    """,
                    (
                        domain_id,
                        domain_name,
                        domain_active,
                    ),
                )

                cursor.execute(
                    """
                    INSERT INTO usuario (
                        id_usuario,
                        id_dominio,
                        email,
                        nombre,
                        apellido,
                        activo,
                        fecha_creacion
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        NOW()
                    )
                    """,
                    (
                        user_id,
                        domain_id,
                        email,
                        first_name,
                        last_name,
                        active,
                    ),
                )

                cursor.execute(
                    """
                    INSERT INTO credencial (
                        id_usuario,
                        password_hash,
                        bloqueada,
                        intentos_fallidos_consecutivos,
                        cambio_password_requerido,
                        fecha_ultimo_cambio_password
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        NOW()
                    )
                    """,
                    (
                        user_id,
                        password_hash,
                        blocked,
                        failed_attempts,
                        password_change_required,
                    ),
                )

        created_users.append(user_id)
        created_domains.append(domain_id)

        return {
            "id": user_id,
            "domain_id": domain_id,
            "domain": domain_name,
            "email": email,
            "password": password,
            "password_hash": password_hash,
            "active": active,
            "domain_active": domain_active,
            "blocked": blocked,
            "failed_attempts": failed_attempts,
            "password_change_required": (
                password_change_required
            ),
        }

    yield create_user

    with db.connection() as connection:

        with connection.cursor() as cursor:

            for user_id in created_users:

                cursor.execute(
                    """
                    DELETE FROM usuario_rol
                    WHERE id_usuario = %s
                    """,
                    (user_id,),
                )

                cursor.execute(
                    """
                    DELETE FROM credencial
                    WHERE id_usuario = %s
                    """,
                    (user_id,),
                )

                cursor.execute(
                    """
                    DELETE FROM usuario
                    WHERE id_usuario = %s
                    """,
                    (user_id,),
                )

            for domain_id in created_domains:

                cursor.execute(
                    """
                    DELETE FROM dominio
                    WHERE id_dominio = %s
                    """,
                    (domain_id,),
                )

@pytest.fixture
def authentication_test_users(
    user_factory,
):

    return {

        "valid": user_factory(),

        "password_change_required": user_factory(
            password_change_required=True,
        ),

        "inactive_user": user_factory(
            active=False,
        ),

        "inactive_domain": user_factory(
            domain_active=False,
        ),

        "blocked_credential": user_factory(
            blocked=True,
        ),

        "wrong_password_counter_0": user_factory(
            failed_attempts=0,
        ),

        "wrong_password_counter_2": user_factory(
            failed_attempts=2,
        ),

        "without_permissions": user_factory(),

        "failed_attempts_before_success": user_factory(
            failed_attempts=1,
        ),
    }

@pytest.fixture
def nonexistent_user():

    unique_id = uuid.uuid4().hex[:12]

    return {
        "email": (
            f"does-not-exist-{unique_id}"
            "@nonexistent.qa.local"
        ),
        "password": "Password123#",
    }