Feature: Auditoría de autenticación

  Scenario Outline: Auditar motivo real de login fallido
    Given el login es rechazado por "<motivo>"
    When Profile/Auth finaliza la evaluación
    Then se genera un evento de auditoría/outbox de login fallido
    And el evento registra "<motivo>"
    And el evento no contiene la contraseña

    Examples:
      | motivo               |
      | USER_NOT_FOUND       |
      | USER_INACTIVE        |
      | DOMAIN_INACTIVE      |
      | CREDENTIAL_BLOCKED   |
      | INVALID_PASSWORD     |

  Scenario: Auditar login exitoso
    Given las credenciales son válidas
    And la sesión fue creada correctamente
    When finaliza el login
    Then se genera un evento "LOGIN_SUCCESS"
    And el evento no contiene la contraseña

  Scenario: No persistir información sensible
    Given se ejecutó un intento de login
    When se inspeccionan logs, outbox y eventos de auditoría
    Then no aparece la contraseña en texto plano
    And no aparece el hash de contraseña
    And no aparece información equivalente que permita reconstruirla