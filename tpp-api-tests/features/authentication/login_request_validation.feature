Feature: Validación del contrato de entrada del login

  Scenario: Request sin email
    Given un request de login sin el campo "email"
    When se invoca POST /api/v1/auth/login
    Then la respuesta HTTP es 400
    And el campo "code" es "INVALID_REQUEST"

  Scenario: Request sin password
    Given un request de login sin el campo "password"
    When se invoca POST /api/v1/auth/login
    Then la respuesta HTTP es 400
    And el campo "code" es "INVALID_REQUEST"

  Scenario: Email con formato inválido
    Given un request con un email sintácticamente inválido
    When se invoca POST /api/v1/auth/login
    Then la respuesta HTTP es 400