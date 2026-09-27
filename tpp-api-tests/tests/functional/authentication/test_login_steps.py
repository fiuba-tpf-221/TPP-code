import pytest

from pytest_bdd import (
    scenarios,
    given,
    when,
    then,
    parsers,
)


pytestmark = pytest.mark.functional


scenarios(
    "../../../features/authentication/login.feature"
)


@given(
    "existe un usuario válido",
    target_fixture="test_user",
)
def valid_user(
    user_factory,
    unique_email,
):

    return user_factory(
        email=unique_email,
    )


@given(
    "existe un usuario válido que requiere cambio de contraseña",
    target_fixture="test_user",
)
def password_change_user(
    user_factory,
    unique_email,
):

    return user_factory(
        email=unique_email,
        password_change_required=True,
    )


@given(
    "existe un usuario inactivo",
    target_fixture="test_user",
)
def inactive_user(
    user_factory,
    unique_email,
):

    return user_factory(
        email=unique_email,
        active=False,
    )


@when(
    "el usuario ejecuta el login",
    target_fixture="login_response",
)
def execute_login(
    bff_client,
    test_user,
):

    return bff_client.login(
        test_user["email"],
        test_user["password"],
    )


@when(
    "el usuario ejecuta el login con contraseña incorrecta",
    target_fixture="login_response",
)
def execute_wrong_login(
    bff_client,
    test_user,
):

    return bff_client.login(
        test_user["email"],
        "PasswordIncorrecta#",
    )


@then(
    parsers.parse(
        "la respuesta HTTP es {status:d}"
    )
)
def response_status(
    login_response,
    status,
):

    assert (
        login_response.status_code
        == status
    )


@then(
    parsers.parse(
        'el estado público es "{status}"'
    )
)
def public_status(
    login_response,
    status,
):

    assert (
        login_response.json()["status"]
        == status
    )


@then(
    parsers.parse(
        'el código público es "{code}"'
    )
)
def public_code(
    login_response,
    code,
):

    assert (
        login_response.json()["code"]
        == code
    )


@then(
    "la respuesta no contiene sessionId"
)
def session_not_exposed(
    login_response,
):

    assert (
        "sessionId"
        not in login_response.json()
    )


@then(
    "se devuelve una cookie opaca de sesión"
)
def opaque_cookie(
    login_response,
):

    header = login_response.headers[
        "set-cookie"
    ]

    assert "session=" in header
    assert "HttpOnly" in header
    assert "Secure" in header
    assert "SameSite=Strict" in header


@then("los permisos están vacíos")
def permissions_empty(login_response):

    assert (
        login_response.json()["permissions"]
        == []
    )