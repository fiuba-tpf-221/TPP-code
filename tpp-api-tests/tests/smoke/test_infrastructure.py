import psycopg
import redis

from config.settings import settings


def test_postgres_connection():

    connection = psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()

        assert result[0] == 1

    finally:
        connection.close()


def test_redis_connection():

    client = redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        decode_responses=True,
    )

    assert client.ping() is True


def test_profile_schema_is_loaded():

    expected_tables = {
        "dominio",
        "usuario",
        "credencial",
        "rol",
        "usuario_rol",
        "modulo",
        "permiso",
        "rol_permiso",
        "outbox_event",
    }

    connection = psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                """
            )

            actual_tables = {
                row[0]
                for row in cursor.fetchall()
            }

        assert expected_tables.issubset(
            actual_tables
        )

    finally:
        connection.close()