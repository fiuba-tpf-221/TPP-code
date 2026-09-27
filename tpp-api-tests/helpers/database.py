from contextlib import contextmanager

import psycopg

from config.settings import settings


class Database:

    @contextmanager
    def connection(self):

        conn = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )

        try:
            yield conn
            conn.commit()

        except Exception:
            conn.rollback()
            raise

        finally:
            conn.close()

    def execute(
        self,
        sql: str,
        params=None,
    ):

        with self.connection() as conn:

            with conn.cursor() as cursor:
                cursor.execute(
                    sql,
                    params or (),
                )

    def fetch_one(
        self,
        sql: str,
        params=None,
    ):

        with self.connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    sql,
                    params or (),
                )

                return cursor.fetchone()