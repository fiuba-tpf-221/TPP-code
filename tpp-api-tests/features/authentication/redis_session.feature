Feature: Persistencia de sesión en Redis

  Scenario: Crear sesión activa
    Given las credenciales son válidas
    And el usuario no requiere cambio obligatorio de contraseña
    When Profile/Auth solicita crear la sesión
    Then Session API genera un UUID de sesión
    And Redis contiene la key "session:{sessionId}"
    And el objeto contiene "id_sesion"
    And el objeto contiene "id_usuario"
    And el objeto contiene "email"
    And el objeto contiene "nombre"
    And el objeto contiene "apellido"
    And el campo "estado" es "ACTIVA"
    And el objeto contiene el snapshot de permisos efectivos
    And el objeto contiene "fecha_inicio"
    And el TTL inicial es 1800 segundos

  Scenario: Crear sesión con cambio obligatorio de contraseña
    Given las credenciales son válidas
    And el usuario requiere cambio obligatorio de contraseña
    When Profile/Auth solicita crear la sesión
    Then Redis contiene la key "session:{sessionId}"
    And el campo "estado" es "CAMBIO_PASSWORD_REQUERIDO"
    And el campo "permisos" es un arreglo vacío
    And el TTL inicial es 1800 segundos

  Scenario Outline: La sesión no almacena información prohibida
    Given existe una sesión creada en Redis
    When se inspecciona el JSON de la sesión
    Then el objeto no contiene "<campo>"

    Examples:
      | campo                    |
      | roles                    |
      | usuario_activo           |
      | dominio_activo           |
      | password                 |
      | password_hash            |
      | ultima_actividad         |
      | fecha_expiracion         |

  Scenario: Permitir múltiples sesiones simultáneas
    Given existe un usuario válido
    When el usuario realiza dos logins exitosos consecutivos
    Then se generan dos UUID de sesión diferentes
    And existen dos keys Redis independientes
    And ambas sesiones permanecen válidas
    And cada sesión mantiene su propio TTL