Feature: Normalización del email en Profile/Auth API

  Scenario: Normalizar email antes de buscar al usuario
    Given el email recibido es "  Usuario@Dominio.COM  "
    When Profile/Auth procesa el request interno
    Then el email utilizado para resolver la identidad es "usuario@dominio.com"