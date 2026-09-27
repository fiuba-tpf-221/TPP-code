Feature: Autenticación de usuario desde el BFF

  Scenario: Login exitoso con sesión activa
    Given existe un usuario activo con dominio activo
    And su credencial está habilitada
    And la contraseña ingresada es correcta
    And el usuario posee permisos efectivos
    When el usuario ejecuta el login
    Then la respuesta HTTP es 200
    And el campo "status" es "AUTHENTICATED"
    And la respuesta no contiene "sessionId"
    And la respuesta incluye una cookie "session"

  Scenario: Login exitoso con cambio obligatorio de contraseña
    Given existe un usuario activo con dominio activo
    And su credencial está habilitada
    And la contraseña ingresada es correcta
    And el usuario requiere cambio obligatorio de contraseña
    When el usuario ejecuta el login
    Then la respuesta HTTP es 200
    And el campo "status" es "PASSWORD_CHANGE_REQUIRED"
    And el campo "permissions" es un arreglo vacío

  Scenario Outline: Rechazo funcional sin exposición del motivo real
    Given la autenticación será rechazada por "<motivo_interno>"
    When el usuario ejecuta el login
    Then la respuesta HTTP es 401
    And el campo "code" es "AUTHENTICATION_FAILED"

    Examples:
      | motivo_interno     |
      | USER_NOT_FOUND     |
      | USER_INACTIVE      |
      | DOMAIN_INACTIVE    |
      | CREDENTIAL_BLOCKED |
      | INVALID_PASSWORD   |