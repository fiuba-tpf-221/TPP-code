Feature: Transformación de respuestas entre Profile/Auth API y BFF

  Scenario Outline: Ocultar el motivo real de autenticación
    Given Profile/Auth responde 401 con código "<codigo_interno>"
    When el BFF procesa la respuesta
    Then el BFF responde 401
    And el código público es "AUTHENTICATION_FAILED"
    And el motivo interno no aparece en el body público

    Examples:
      | codigo_interno       |
      | USER_NOT_FOUND       |
      | USER_INACTIVE        |
      | DOMAIN_INACTIVE      |
      | CREDENTIAL_BLOCKED   |
      | INVALID_PASSWORD     |

  Scenario: Transformar sesión ACTIVE
    Given Profile/Auth responde 200 con status "ACTIVE"
    And incluye un "sessionId"
    When el BFF procesa la respuesta
    Then el BFF elimina "sessionId" del body público
    And devuelve "status" igual a "AUTHENTICATED"
    And genera la cookie opaca de sesión

  Scenario: Propagar estado PASSWORD_CHANGE_REQUIRED
    Given Profile/Auth responde 200 con status "PASSWORD_CHANGE_REQUIRED"
    And incluye un "sessionId"
    When el BFF procesa la respuesta
    Then el BFF elimina "sessionId" del body público
    And devuelve "status" igual a "PASSWORD_CHANGE_REQUIRED"
    And genera la cookie opaca de sesión