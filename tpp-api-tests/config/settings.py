import os

from dotenv import load_dotenv

load_dotenv()


class Settings:

    bff_base_url = os.getenv(
        "BFF_BASE_URL",
        "http://bff:8080",
    )

    profile_auth_base_url = os.getenv(
        "PROFILE_AUTH_BASE_URL",
        "http://profile-auth:8080",
    )

    session_api_base_url = os.getenv(
        "SESSION_API_BASE_URL",
        "http://session-api:8080",
    )

    postgres_host = os.getenv(
        "POSTGRES_HOST",
        "postgres",
    )

    postgres_port = int(
        os.getenv("POSTGRES_PORT", "5432")
    )

    postgres_db = os.getenv(
        "POSTGRES_DB",
        "perfilado",
    )

    postgres_user = os.getenv(
        "POSTGRES_USER",
        "tpp",
    )

    postgres_password = os.getenv(
        "POSTGRES_PASSWORD",
        "tpp",
    )

    redis_host = os.getenv(
        "REDIS_HOST",
        "redis",
    )

    redis_port = int(
        os.getenv("REDIS_PORT", "6379")
    )

    redis_db = int(
        os.getenv("REDIS_DB", "0")
    )

    test_domain = os.getenv(
        "TEST_DOMAIN",
        "qa.local",
    )

    test_password = os.getenv(
        "TEST_PASSWORD",
        "Password123#",
    )

settings = Settings()