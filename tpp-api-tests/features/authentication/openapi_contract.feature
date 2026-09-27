Feature: Validación del contrato OpenAPI de EDH-22

  Scenario: Validar request público
    Given un request enviado a POST /api/v1/auth/login
    When se valida contra "LoginRequest"
    Then debe cumplir el schema OpenAPI definido en EDH-22

  Scenario: Validar response público exitoso
    Given una respuesta 200 del BFF
    When se valida contra "LoginResponse"
    Then debe cumplir el schema OpenAPI definido en EDH-22

  Scenario Outline: Validar respuesta pública de error
    Given una respuesta HTTP "<status>" del BFF
    When se valida contra "ErrorResponse"
    Then debe cumplir el schema OpenAPI definido en EDH-22

    Examples:
      | status |
      | 400    |
      | 401    |
      | 500    |
      | 503    |

  Scenario: Validar request interno
    Given un request enviado a POST /internal/v1/auth/login
    When se valida contra "InternalLoginRequest"
    Then debe cumplir el schema OpenAPI definido en EDH-22

  Scenario: Validar response interno exitoso
    Given una respuesta 200 de Profile/Auth
    When se valida contra "InternalLoginResponse"
    Then debe cumplir el schema OpenAPI definido en EDH-22

  Scenario Outline: Validar códigos permitidos de rechazo interno
    Given Profile/Auth responde 401
    And el código interno es "<codigo>"
    When se valida contra el contrato
    Then el código debe ser aceptado por "InternalAuthenticationErrorResponse"

    Examples:
      | codigo               |
      | USER_NOT_FOUND       |
      | USER_INACTIVE        |
      | DOMAIN_INACTIVE      |
      | CREDENTIAL_BLOCKED   |
      | INVALID_PASSWORD     |