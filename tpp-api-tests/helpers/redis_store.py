import json

import redis

from config.settings import settings


class RedisStore:

    def __init__(self):

        self.client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
        )

    def get_session(
        self,
        session_id: str,
    ):

        value = self.client.get(
            f"session:{session_id}"
        )

        if value is None:
            return None

        return json.loads(value)

    def ttl(
        self,
        session_id: str,
    ) -> int:

        return self.client.ttl(
            f"session:{session_id}"
        )

    def exists(
        self,
        session_id: str,
    ) -> bool:

        return bool(
            self.client.exists(
                f"session:{session_id}"
            )
        )

    def delete(
        self,
        session_id: str,
    ):

        self.client.delete(
            f"session:{session_id}"
        )