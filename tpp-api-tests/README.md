# Ejecución de tests

Este proyecto ejecuta las pruebas automatizadas completamente dentro de contenedores Docker.

No es necesario instalar Python, pytest, PostgreSQL ni Redis en la máquina host.

## Requisitos

Se necesita únicamente:

- Docker
- Docker Compose
- Git

Podés verificar Docker con:

```bash
docker --version
docker compose version
```

## Estructura utilizada

El entorno de pruebas utiliza los siguientes servicios:

- `postgres`: PostgreSQL con la base `perfilado`
- `redis`: almacenamiento de sesiones
- `tests`: contenedor Python que ejecuta pytest

El archivo de Compose se encuentra en:

```text
infra/docker-compose.yaml
```

El DDL de PostgreSQL se carga automáticamente desde:

```text
infra/init/postgres/001_modelo_perfilado.sql
```

## Construir la imagen de tests

Después de modificar:

- código Python;
- `requirements.txt`;
- fixtures;
- helpers;
- tests;

se debe reconstruir la imagen:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  build tests
```

Si se modificaron dependencias y se quiere forzar una reconstrucción completa:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  build --no-cache tests
```

## Inicializar el entorno desde cero

Cuando se modifica el DDL o se necesita recrear completamente PostgreSQL:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  down -v
```

El parámetro `-v` elimina el volumen persistente de PostgreSQL.

Esto es importante porque los scripts ubicados en:

```text
/docker-entrypoint-initdb.d
```

se ejecutan solamente durante la inicialización de una base nueva.

Luego ejecutar:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  up \
  --build \
  --abort-on-container-exit \
  --exit-code-from tests
```

Este comando:

1. inicia PostgreSQL;
2. inicia Redis;
3. espera que ambos servicios estén saludables;
4. carga el DDL de PostgreSQL;
5. construye el contenedor de tests;
6. ejecuta pytest;
7. devuelve el código de salida de los tests.

## Ejecutar los smoke tests

Los smoke tests validan:

- conexión con PostgreSQL;
- conexión con Redis;
- existencia de las tablas esperadas.

Ejecutar:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s \
  tests/smoke/test_infrastructure.py
```

Resultado esperado:

```text
test_postgres_connection PASSED
test_redis_connection PASSED
test_profile_schema_is_loaded PASSED
```

## Ejecutar tests de hashing de contraseñas

Estos tests validan la implementación definida para Argon2id:

- generación de hashes válidos;
- salts diferentes para una misma contraseña;
- detección de hashes que requieren rehash.

Ejecutar:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s \
  tests/integration/authentication/test_password_data.py
```

Resultado esperado:

```text
3 passed
```

## Ejecutar tests de datos de autenticación

Estos tests verifican la creación de los distintos estados necesarios para las pruebas de login:

- usuario válido;
- cambio obligatorio de contraseña;
- usuario inactivo;
- dominio inactivo;
- credencial bloqueada;
- contador de intentos fallidos en 0;
- contador de intentos fallidos en 2;
- usuario sin permisos;
- usuario con intentos fallidos previos.

Ejecutar:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s \
  tests/integration/authentication/test_authentication_test_data.py
```

Resultado esperado:

```text
9 passed
```

## Ejecutar todos los tests

Para ejecutar toda la suite:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s
```

También se puede ejecutar simplemente:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests
```

si el `CMD` de la imagen continúa configurado para ejecutar `pytest`.

## Ejecutar un archivo específico

Ejemplo:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s \
  tests/integration/authentication/test_password_data.py
```

## Ejecutar un único test

Ejemplo:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s \
  tests/integration/authentication/test_password_data.py::test_same_password_generates_different_hashes
```

## Levantar únicamente PostgreSQL

Para iniciar PostgreSQL en segundo plano:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  up -d postgres
```

Verificar su estado:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  ps
```

## Inspeccionar las tablas de PostgreSQL

Con PostgreSQL corriendo:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  exec postgres \
  psql -U tpp -d perfilado -c "\dt"
```

Actualmente se esperan las siguientes tablas:

```text
credencial
dominio
modulo
outbox_event
permiso
rol
rol_permiso
usuario
usuario_rol
```

## Ver logs de PostgreSQL

```bash
docker compose \
  -f infra/docker-compose.yaml \
  logs postgres
```

Para seguirlos en tiempo real:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  logs -f postgres
```

## Ver logs de Redis

```bash
docker compose \
  -f infra/docker-compose.yaml \
  logs redis
```

## Detener los servicios

Sin eliminar los datos:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  down
```

Eliminando también los volúmenes:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  down -v
```

## Cuándo usar `down -v`

Usar:

```bash
docker compose -f infra/docker-compose.yaml down -v
```

cuando:

- cambia el DDL;
- se necesita reconstruir la base desde cero;
- se quiere limpiar completamente el ambiente de pruebas.

No es necesario hacerlo cuando solamente cambia código Python de los tests.

En ese caso alcanza con:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  build tests
```

y luego volver a ejecutar pytest.

## Flujo recomendado durante desarrollo

Cuando solo cambian tests:

```bash
docker compose -f infra/docker-compose.yaml build tests

docker compose \
  -f infra/docker-compose.yaml \
  run --rm \
  tests \
  pytest -vv -s
```

Cuando cambia el DDL:

```bash
docker compose \
  -f infra/docker-compose.yaml \
  down -v

docker compose \
  -f infra/docker-compose.yaml \
  up \
  --build \
  --abort-on-container-exit \
  --exit-code-from tests
```

## Estado actual de la suite

Actualmente están validados:

- 3 smoke tests de infraestructura;
- 3 tests de hashing y rehash con Argon2id;
- 9 tests de preparación de datos de autenticación.

Estos tests sirven como base para la automatización de los escenarios definidos en EDH-39.