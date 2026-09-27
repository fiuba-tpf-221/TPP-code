Feature: Orden de validación de autenticación

  Scenario: Usuario inactivo con contraseña incorrecta
    Given existe un usuario inactivo
    And la contraseña ingresada es incorrecta
    When se intenta autenticar
    Then el motivo interno es "USER_INACTIVE"
    And no se incrementa el contador de intentos fallidos
    And la respuesta pública es 401 "AUTHENTICATION_FAILED"

  Scenario: Dominio inactivo con contraseña incorrecta
    Given existe un usuario activo
    And su dominio está inactivo
    And la contraseña ingresada es incorrecta
    When se intenta autenticar
    Then el motivo interno es "DOMAIN_INACTIVE"
    And no se incrementa el contador de intentos fallidos
    And la respuesta pública es 401 "AUTHENTICATION_FAILED"

  Scenario: Credencial bloqueada con contraseña incorrecta
    Given existe un usuario activo con dominio activo
    And la credencial está bloqueada
    And la contraseña ingresada es incorrecta
    When se intenta autenticar
    Then el motivo interno es "CREDENTIAL_BLOCKED"
    And no se incrementa el contador de intentos fallidos
    And la respuesta pública es 401 "AUTHENTICATION_FAILED"

  Scenario: Contraseña incorrecta con credencial habilitada
    Given existe un usuario activo con dominio activo
    And la credencial está habilitada
    And el contador de intentos fallidos es 0
    When se intenta autenticar con contraseña incorrecta
    Then el motivo interno es "INVALID_PASSWORD"
    And el contador de intentos fallidos pasa a 1
    And la respuesta pública es 401 "AUTHENTICATION_FAILED"

  Scenario: Tercer intento fallido consecutivo
    Given existe un usuario activo con dominio activo
    And la credencial está habilitada
    And el contador de intentos fallidos es 2
    When se intenta autenticar con contraseña incorrecta
    Then el contador de intentos fallidos pasa a 3
    And la credencial queda bloqueada
    And la respuesta pública es 401 "AUTHENTICATION_FAILED"
    And se genera el evento de auditoría correspondiente

  Scenario: Login exitoso reinicia intentos fallidos
    Given existe un usuario válido
    And el contador de intentos fallidos es mayor que 0
    And la contraseña ingresada es correcta
    When se ejecuta el login
    Then el contador de intentos fallidos pasa a 0
    And se crea una sesión
    And la respuesta HTTP es 200