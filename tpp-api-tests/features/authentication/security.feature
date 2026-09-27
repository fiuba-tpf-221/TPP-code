Feature: Seguridad de autenticación

  Scenario: No exponer sessionId al frontend
    Given un login exitoso
    When el BFF construye la respuesta pública
    Then el body no contiene "sessionId"

  Scenario: Cookie protegida contra acceso JavaScript
    Given un login exitoso
    When el BFF genera la cookie de sesión
    Then la cookie posee el atributo "HttpOnly"

  Scenario: Cookie enviada únicamente por HTTPS
    Given un login exitoso
    When el BFF genera la cookie de sesión
    Then la cookie posee el atributo "Secure"

  Scenario: Cookie con política SameSite estricta
    Given un login exitoso
    When el BFF genera la cookie de sesión
    Then la cookie posee "SameSite=Strict"

  Scenario Outline: No permitir enumeración de usuarios por la respuesta pública
    Given el login falla por "<motivo>"
    When el BFF responde al frontend
    Then la respuesta HTTP es 401
    And el código es "AUTHENTICATION_FAILED"
    And el mensaje público es siempre el mismo

    Examples:
      | motivo               |
      | USER_NOT_FOUND       |
      | USER_INACTIVE        |
      | DOMAIN_INACTIVE      |
      | CREDENTIAL_BLOCKED   |
      | INVALID_PASSWORD     |