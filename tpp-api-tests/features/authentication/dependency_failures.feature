Feature: Manejo de fallas de servicios dependientes

  Scenario: Session API no disponible durante un login válido
    Given las credenciales son correctas
    And Session API no se encuentra disponible
    When Profile/Auth intenta crear la sesión
    Then Profile/Auth responde 503 con código "SESSION_SERVICE_UNAVAILABLE"
    And el BFF responde 503 con código "SERVICE_UNAVAILABLE"
    And no se incrementan intentos fallidos
    And no se genera auditoría de credenciales inválidas

  Scenario: Redis no disponible durante la creación de sesión
    Given las credenciales son correctas
    And Redis no se encuentra disponible
    When Session API intenta persistir la sesión
    Then Profile/Auth termina respondiendo 503 "SESSION_SERVICE_UNAVAILABLE"
    And el BFF responde 503 "SERVICE_UNAVAILABLE"
    And no se incrementan intentos fallidos

  Scenario: Error inesperado en Profile/Auth
    Given Profile/Auth produce un error inesperado
    When el BFF recibe el error
    Then responde 500 con código "INTERNAL_ERROR"
    And no expone stack trace
    And no expone detalles técnicos internos

  Scenario: Error inesperado en BFF
    Given ocurre un error inesperado en el BFF
    When se procesa la petición de login
    Then la respuesta HTTP es 500
    And el código es "INTERNAL_ERROR"
    And la respuesta cumple el contrato ErrorResponse