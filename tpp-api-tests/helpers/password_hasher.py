from argon2 import PasswordHasher
from argon2.low_level import Type


class TestPasswordHasher:

    def __init__(self):
        self._hasher = PasswordHasher(
            memory_cost=19456,
            time_cost=2,
            parallelism=1,
            type=Type.ID,
        )

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(
        self,
        password_hash: str,
        password: str,
    ) -> bool:

        return self._hasher.verify(
            password_hash,
            password,
        )

    def needs_rehash(
        self,
        password_hash: str,
    ) -> bool:

        return self._hasher.check_needs_rehash(
            password_hash
        )