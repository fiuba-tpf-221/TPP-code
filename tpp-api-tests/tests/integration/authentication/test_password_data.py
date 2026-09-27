import pytest
from argon2 import PasswordHasher
from argon2.low_level import Type

pytestmark = pytest.mark.integration


def test_user_factory_creates_valid_argon2_hash(
    db,
    user_factory,
    password_hasher,
):

    user = user_factory()

    row = db.fetch_one(
        """
        SELECT password_hash
        FROM credencial
        WHERE id_usuario = %s
        """,
        (user["id"],),
    )

    stored_hash = row[0]

    assert stored_hash.startswith(
        "$argon2id$"
    )

    assert password_hasher.verify(
        stored_hash,
        user["password"],
    )

    assert (
        password_hasher.needs_rehash(
            stored_hash
        )
        is False
    )

def test_same_password_generates_different_hashes(
    user_factory,
    password_hasher,
):

    user1 = user_factory(
        password="Password123#",
    )

    user2 = user_factory(
        password="Password123#",
    )

    assert (
        user1["password_hash"]
        != user2["password_hash"]
    )

    assert password_hasher.verify(
        user1["password_hash"],
        "Password123#",
    )

    assert password_hasher.verify(
        user2["password_hash"],
        "Password123#",
    )

def test_old_argon2_hash_requires_rehash(
    user_factory,
    password_hasher,
):

    old_hasher = PasswordHasher(
        memory_cost=10240,
        time_cost=2,
        parallelism=1,
        type=Type.ID,
    )

    password = "Password123#"

    old_hash = old_hasher.hash(
        password
    )

    assert old_hash.startswith(
        "$argon2id$"
    )

    assert old_hasher.verify(
        old_hash,
        password,
    )

    assert password_hasher.needs_rehash(
        old_hash
    ) is True

def test_persisted_old_argon2_hash_requires_rehash(
    db,
    user_factory,
    password_hasher,
):

    old_hasher = PasswordHasher(
        memory_cost=10240,
        time_cost=2,
        parallelism=1,
        type=Type.ID,
    )

    password = "Password123#"

    old_hash = old_hasher.hash(
        password
    )

    user = user_factory(
        password=password,
        password_hash=old_hash,
    )

    row = db.fetch_one(
        """
        SELECT password_hash
        FROM credencial
        WHERE id_usuario = %s
        """,
        (user["id"],),
    )

    stored_hash = row[0]

    assert stored_hash == old_hash

    assert password_hasher.verify(
        stored_hash,
        password,
    )

    assert password_hasher.needs_rehash(
        stored_hash
    ) is True