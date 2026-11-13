# Observabilidad de TPP

`tpp-observability` encapsula OpenTelemetry y exporta trazas por OTLP al Collector,
que las envía a Jaeger. Los consumidores importan únicamente
`from tpp_observability import tracing`. La biblioteca administra configuración,
spans, contexto, errores y cierre; no devuelve objetos del SDK.

## Instalación e integración

Python 3.11 o superior; dependencias fijadas en `pyproject.toml`. Desde la raíz:

```sh
python -m pip install './libs/observability/python[fastapi]'
```

El backend ya instala el paquete desde `backend/requirements.txt`. Su imagen se
construye con `docker compose build backend`, usando la raíz como contexto.

```python
from fastapi import FastAPI
from tpp_observability import tracing

app = FastAPI()
tracing.instrument_fastapi(app)  # Después de los otros middleware, antes de servir.

@app.get("/example")
@tracing.traced("example.calculate")
async def example():
    tracing.set_attributes({"app.item_count": 1})
    return {"result": 4}
```

`instrument_fastapi` crea un SERVER por petición y compone el lifespan existente:
inicializa en startup y vacía/cierra al terminar, fuera del event loop. No usar
Uvicorn con `--lifespan off`. Una sola aplicación administra el proveedor del
proceso. El cierre es terminal; reiniciar el proceso para cambiar configuración.
Registrar dos veces la misma declaración es inocuo; configuraciones incompatibles,
registro tardío o un proveedor ajeno se rechazan.

El middleware conserva streaming, CORS, handlers sync y tareas que finalizan antes
del retorno ASGI. Registra método, ruta plantilla y código; 5xx marca ERROR y 4xx
controlado queda UNSET. Con tracing deshabilitado delega directamente.
`trusted_headers=False` ignora contexto entrante; habilitarlo únicamente cuando el
ingreso autorice continuar trazas externas. WebSockets no están instrumentados.

Para un proceso sin FastAPI, instalar el paquete sin el extra y gestionar el cierre:

```python
from tpp_observability import tracing

tracing.initialize(tracing.TracingConfig(
    service_name="example", otlp_export=False, console_export=True,
))
try:
    with tracing.trace("example.operation"):
        tracing.event("example.validated", attributes={"app.item_count": 3})
finally:
    tracing.shutdown()
```

## Interfaz pública

| Método | Uso |
| --- | --- |
| `instrument_fastapi(app, config=None, *, trusted_headers=False)` | Instalar HTTP y ciclo de vida una vez |
| `initialize(config=None)` | Inicializar; sin objeto lee el entorno |
| `trace(name, *, attributes=None, kind="internal", links=())` | Medir un bloque `with`; no devuelve span |
| `traced(name, *, attributes=None, kind="internal")` | Decorar una función sync o async |
| `set_attributes(attributes)` | Enriquecer el span activo |
| `event(name, *, attributes=None)` | Agregar un evento |
| `record_error(error, *, attributes=None)` | Marcar un error capturado y convertido en resultado controlado |
| `headers()` | Obtener un nuevo diccionario W3C para el transporte saliente |
| `receive_context(carrier, *, trusted=True)` | Activar contexto recibido y restaurar el anterior al salir |
| `current_ids()` | Diccionario con `trace_id` y `span_id` hexadecimales para logs |
| `flush(timeout_millis=5000)` | Esperar procesamiento de spans finalizados; devuelve bool |
| `shutdown(timeout_millis=None)` | Vaciar y cerrar recursos propios; idempotente, devuelve bool |

Los tipos públicos son `TracingConfig`, `Attributes`, `AttributeValue` y `SpanKind`.
`kind` admite `internal`, `server`, `client`, `producer` y `consumer`. Usar nombres
estables, sin IDs ni argumentos. La API no inspecciona parámetros ni retornos.

Los bloques y decoradores registran automáticamente las excepciones que escapan,
incluida cancelación, y relanzan la misma instancia. `record_error` registra solo
tipo y si escapó, sin mensaje/stack. No llamarlo antes de relanzar desde el mismo
bloque, para evitar duplicar el evento. Los fallos técnicos del tracing se aíslan
y emiten un warning genérico por frontera/runtime; pueden perder telemetría.
Configuración inválida y declaraciones inválidas siguen siendo errores explícitos.

`with trace(...)` funciona dentro de `async def`, atravesando `await`; no usar
`async with`. El decorador espera la coroutine real y rechaza generadores. Medir
iteradores y streaming alrededor de su consumo y cierre, no de su creación.
Las tareas concurrentes usan contextvars; `asyncio.to_thread` las propaga. Para
otros ejecutores transportar un carrier explícito.

```python
with tracing.trace("example.send", kind="client"):
    outgoing = tracing.headers()  # Inyectar dentro del span que realiza el envío.

# En el receptor, antes de comenzar a procesar:
with tracing.receive_context(outgoing, trusted=True):
    with tracing.trace("example.receive", kind="server"):
        tracing.event("example.received")
```

La biblioteca no realiza el envío ni autentica el origen. Contexto ausente,
inválido o no confiable inicia raíz, sin heredar una operación local ajena.
Se seleccionan solo `traceparent` y, con opt-in, `tracestate`; se rechazan campos
duplicados o mayores a 512 caracteres. No se propaga baggage.
`links` recibe carriers confiables para expresar otras causas sin cambiar el padre.
Para una raíz con links, abrir antes `receive_context({})`.

Antes de inicializar, con `enabled=False` y después del cierre, la instrumentación
válida es no-op y los getters devuelven `{}`. Deshabilitar no crea conexiones ni
workers ni modifica un proveedor externo.

## Configuración

Los defaults se definen únicamente en `TracingConfig`. Un objeto explícito usa
esos defaults y no mezcla entorno. `initialize()` y el startup FastAPI leen
`TracingConfig.from_env()`, sin cargar `.env`. Compose sí lee su propio `.env`.
Los booleanos de entorno aceptan `true`/`false`; valores inválidos fallan al inicio.

| Campo | Variable | Default |
| --- | --- | --- |
| `enabled` | `TRACING_ENABLED` | true |
| `service_name` | `OTEL_SERVICE_NAME` | tpp-app |
| `service_version` | `TRACING_SERVICE_VERSION` | unknown |
| `environment` | `TRACING_ENVIRONMENT` | development |
| `protocol` | `OTEL_EXPORTER_OTLP_[TRACES_]PROTOCOL` | grpc |
| `endpoint` | `OTEL_EXPORTER_OTLP_[TRACES_]ENDPOINT` | http://localhost:4317; HTTP: http://localhost:4318/v1/traces |
| `insecure` | `OTEL_EXPORTER_OTLP_[TRACES_]INSECURE` | Inferido del esquema http/https |
| `certificate_file` | `OTEL_EXPORTER_OTLP_[TRACES_]CERTIFICATE` | CA del transporte |
| `sample_ratio` | `TRACING_SAMPLE_RATIO` | 1.0 |
| `otlp_export` | `TRACING_OTLP_EXPORT` | true |
| `console_export` | `TRACING_CONSOLE_EXPORT` | false |
| `export_timeout_seconds` | `TRACING_EXPORT_TIMEOUT_SECONDS` | 10 |
| `export_attempt_timeout_seconds` | `TRACING_EXPORT_ATTEMPT_TIMEOUT_SECONDS` | 3 |
| `export_max_attempts` | `TRACING_EXPORT_MAX_ATTEMPTS` | 3 |
| `export_retry_backoff_seconds` | `TRACING_EXPORT_RETRY_BACKOFF_SECONDS` | 0.2 |
| `export_retry_max_backoff_seconds` | `TRACING_EXPORT_RETRY_MAX_BACKOFF_SECONDS` | 1 |
| `shutdown_timeout_millis` | `TRACING_SHUTDOWN_TIMEOUT_MILLIS` | 5000 |
| `max_queue_size` | `OTEL_BSP_MAX_QUEUE_SIZE` | 2048 |
| `max_export_batch_size` | `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | 512 |
| `schedule_delay_millis` | `OTEL_BSP_SCHEDULE_DELAY` | 5000 |
| `max_attributes` | `TRACING_MAX_ATTRIBUTES` | 32 |
| `max_events` | `TRACING_MAX_EVENTS` | 32 |
| `max_links` | `TRACING_MAX_LINKS` | 32 |
| `max_attribute_length` | `TRACING_MAX_ATTRIBUTE_LENGTH` | 256 |
| `allowed_attributes` | `TRACING_ALLOWED_ATTRIBUTES` | Lista exacta en `_config.py` |
| `propagate_tracestate` | `TRACING_PROPAGATE_TRACESTATE` | false |

`[TRACES_]` indica que la variante específica prevalece sobre la genérica.
`TRACING_ENABLED` prevalece sobre la inversa de `OTEL_SDK_DISABLED`.
Para HTTP, el endpoint genérico recibe `/v1/traces`; el específico es la URL final.
No se aceptan credenciales/query/fragmentos en endpoints. HTTPS permite una CA
explícita; `insecure` debe coincidir con el esquema. No hay autenticación OTLP,
mTLS, proxies, redirects ni opciones implícitas de exporters.

Tiempos y tamaños deben ser positivos, el lote no puede superar la cola, los
intentos van de 1 a 10 y el ratio de 0 a 1. El sampler respeta la decisión del
padre y aplica el ratio a raíces; `jaeger/sampling.json` no controla este sampler.
`otlp_export=False` y `console_export=False` conservan contexto sin salidas;
`enabled=False` desactiva toda instrumentación propia al siguiente arranque.

En Compose, el servicio usa `backend-api`, versión `0.1.0` y
`http://otel-collector:4317`; el Collector carga `otel/otel-collector.yaml` y envía
a `jaeger:4317`. La UI está en `http://localhost:16686`. Los puertos 4317/4318
publicados al host pertenecen a Jaeger.

## Arquitectura y decisiones

```text
backend → tracing (API pública) → runtime → SDK/contextvars
                                  ├── config: entorno y validación
                                  ├── propagation: carriers W3C y links
                                  ├── privacy: atributos y errores seguros
                                  └── export: OTLP → Collector → Jaeger
FastAPI → adaptador ASGI privado → runtime y lifecycle
```

Los módulos con `_` son internos. El backend activo instrumenta HTTP, operaciones
MinIO y probes TCP. Listado y carga permanecen en los endpoints originales de
`backend/app/main.py`; el listado consume el iterador MinIO dentro del CLIENT.
`backend/app/core/telemetry.py` conserva `setup_telemetry` como entrada de
compatibilidad que delega en la biblioteca.
Los probes miden conectividad TCP, no protocolos ni credenciales. No hay consumidores
SQL/AMQP ni workers activos; tampoco se instrumenta el frontend.

La fachada evita SDK/configuración repetidos en los consumidores. Se conserva
ASGI puro para cubrir streaming sin spans send/receive ni captura de URLs/cuerpos.
El transporte propio conserva batch y encoder del SDK 1.22, añadiendo límites de
intentos y cierre que esa versión no expone de forma suficiente. Su costo es
mantener HTTP/gRPC y un worker daemon por salida activa. Revisar estas decisiones
al actualizar SDK/framework o incorporar otro transporte.

La exportación usa colas volátiles acotadas; una cola llena descarta spans pendientes.
Hay reintentos con backoff para fallos transitorios, dentro del presupuesto por
lote. Cada salida admite un solo envío activo; un driver bloqueado no acumula
threads. Detener ingresos y drenar tareas antes de cerrar. Un driver atascado puede
sobrevivir al timeout; el cliente se libera cuando retorna. `flush`/`shutdown`
false informa timeout o fallo observado; true no confirma almacenamiento en Jaeger
ni recupera pérdidas previas por muestreo/cola/instrumentación.

Solo se exportan atributos permitidos; `TRACING_ALLOWED_ATTRIBUTES` reemplaza la
lista con nombres exactos separados por comas. Se descartan claves sensibles,
mensajes/stack de errores y valores con patrones reconocibles de credenciales.
No es un detector universal de secretos: pasar únicamente valores revisados,
nunca cuerpos, tokens, SQL con valores o URLs firmadas. Consola aplica el mismo
filtro y no sustituye logging centralizado.

## Verificación

### Central de monitoreo independiente

Abrir `http://localhost:3002`. La central tiene código, imagen, servidor y proyecto
Compose propios en `monitoring/`; no utiliza el backend, frontend, gateway ni
Keycloak de negocio para servir su interfaz. El Compose secundario declara solo
`monitoring`: no incluye ni inicia Jaeger, Prometheus, Grafana, PostgreSQL u otros
servicios. Consume los que ya se ejecutan desde el Compose principal.
Conserva la paleta y distribución de `origin/Frontend`; el portal ofrece un enlace
externo a la central.

La infraestructura principal se administra por separado con `docker compose` en
la raíz. Para la central, ejecutar desde esa misma raíz:

```sh
# Solo inicia la central; los proveedores pertenecen al Compose principal.
docker compose -f monitoring/docker-compose.yml up -d --build monitoring
# Diagnóstico de la propia central.
docker compose -f monitoring/docker-compose.yml ps
docker compose -f monitoring/docker-compose.yml logs --tail=50
curl -fsS http://localhost:3002/healthz
```

Para aplicar las configuraciones de métricas a una instalación que ya estaba
corriendo, reiniciar solo el Collector y recargar Prometheus:

```sh
docker compose restart otel-collector
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose kill -s HUP prometheus
```

La central consulta los puertos publicados mediante `host.docker.internal`,
con `host-gateway` configurado; no monta el socket de Docker. El Collector expone
sus métricas internas en `8888`; Prometheus consulta ese endpoint, cAdvisor, su
propio estado y `http://host.docker.internal:3002/metrics`. El puerto `8889`
continúa disponible para las métricas OTLP recibidas por el Collector.

| Pantalla | Datos y alcance |
| --- | --- |
| Resumen | Disponibilidad de las fuentes, servicios y recursos |
| Infraestructura | Sondas HTTP/TCP, CPU, memoria, filesystem y targets de Prometheus |
| PostgreSQL | Tamaño ocupado y conexiones por base; límite de conexiones del servidor |
| OpenTelemetry | Spans aceptados/enviados/rechazados, fallos de envío, cola y memoria del Collector |
| Dashboards | Paneles JSON aprovisionados en Grafana, redibujados con gráficos propios |
| Trazas | Resumen, explorador, recorridos y detalle con waterfall, atributos y eventos |

Las sondas se ejecutan cada 15 segundos con timeout. HTTP comprueba el endpoint
configurado (y estado semántico para backend, Grafana y SonarQube); TCP comprueba
aceptación de conexiones, sin acreditar autenticación ni funcionamiento completo.
La UI distingue fuente caída, consulta fallida, ausencia de series y datos antiguos;
no reemplaza faltantes por ceros. Conserva el último dato durante un fallo de
actualización, marcándolo como anterior. Cada gráfico falla de forma independiente.
La actualización visual es configurable y se pausa con la pestaña oculta.

cAdvisor en este entorno informa IDs de contenedores, sin nombres de servicio.
CPU/RAM muestran esos IDs e incluyen los contenedores observados en el host,
incluso otros proyectos. CPU expresa porcentaje de un núcleo y puede superar
100 %. El filesystem observado por cAdvisor pertenece al host/VM de Docker;
no equivale al espacio libre disponible para PostgreSQL. El tamaño SQL incluye
las bases no plantilla: no se presenta como porcentaje de capacidad del disco.

El backend actual produce trazas, no métricas HTTP ni logs centralizados. Las
series internas del Collector describen su procesamiento y no sustituyen tasas
o latencias globales de requests. Un contador que el proveedor aún no publicó
se presenta sin datos. Las consultas admiten hasta siete días, unos 120 puntos y
40 series; la leyenda muestra inicialmente seis nombres y permite ver los demás.
Los gráficos tienen un botón **Ampliar** que conserva los filtros y la selección.
La vista ampliada se cierra con **Reducir**, Escape o al pulsar el fondo.

Grafana configura dashboards, mientras Prometheus almacena sus series. La central
lee en modo solo lectura los JSON montados desde
`grafana/provisioning/dashboards` y ejecuta sus expresiones contra Prometheus;
no utiliza iframes ni necesita credenciales de administración de Grafana.
Solo integra los paneles aprovisionados con expresiones PromQL estáticas, hasta
seis consultas por panel. No importa dashboards creados en la GUI ni resuelve
variables, transformaciones o plugins de Grafana. Los visores originales siguen
disponibles en sus puertos habituales.

### Credencial de PostgreSQL

La sección de almacenamiento mide capacidad total, espacio ocupado, espacio
libre y espacio disponible sin bloques reservados mediante `statvfs`. La central
monta el volumen existente `tpp-code_postgres_data` en `/app/postgres-storage`
en solo lectura; no recorre los archivos del clúster. Ese volumen debe existir
antes de iniciar el Compose de monitoreo. Si el proyecto usa otro nombre,
definir `MONITOR_POSTGRES_VOLUME` en el `.env` de la raíz o exportarlo al ejecutar
Compose. No se crea ni se elimina el volumen de datos desde la central.

La capacidad pertenece al filesystem del volumen y puede compartirse con otros
servicios Docker; no es una cuota exclusiva de PostgreSQL. Los tamaños SQL de
cada base se muestran por separado. La central publica las cuatro mediciones
como `tpp_postgres_storage_bytes{kind="total|used|free|available"}` (un valor de
`kind` por serie). El gráfico histórico compara capacidad total y espacio ocupado.

Sin contraseña de monitoreo, la central sigue funcionando y muestra SQL sin
configurar. Para habilitar su lectura, crear un rol dedicado con el administrador
local (los valores corresponden al Compose actual):

```sh
docker compose exec postgres psql -U user -d appdb
```

Dentro de psql:

```sql
CREATE ROLE tpp_monitor LOGIN;
GRANT pg_monitor TO tpp_monitor;
ALTER ROLE tpp_monitor SET default_transaction_read_only = on;
\password tpp_monitor
```

`\password` solicita la contraseña de forma interactiva. No recrear el rol si ya
existe. Copiar `monitoring/.env.example` a `monitoring/.env` solamente si no existe,
asignar esa contraseña a `MONITOR_DB_PASSWORD`, restringir permisos con
`chmod 600 monitoring/.env` y recrear la central:

```sh
docker compose -f monitoring/docker-compose.yml up -d --force-recreate
```

El archivo está ignorado por Git y excluido de la imagen. No usar la credencial de
negocio. Las consultas se ejecutan con conexión de solo lectura y timeout de tres
segundos; no modifican tablas. `pg_monitor` permite observar estadísticas del
servidor. La central exporta tamaños/conexiones a Prometheus; los históricos SQL
empiezan cuando Prometheus comienza a recolectarlos.

### Diseño y límites operativos

Se eligió un servidor pequeño de lectura que sirve la UI compilada y consulta
las fuentes, frente a alojar el panel dentro del portal o duplicar los backends
de observabilidad. Esto permite acceder al diagnóstico aunque backend/frontend
fallen, evita CORS y mantiene consultas y credenciales fuera del navegador.
El costo es mantener un contenedor y su API acotada. Se revisará esta decisión
si se necesita desplegar la central en otro host o integrar autenticación propia.

No hay dependencias de arranque ni reinicio de los proveedores para iniciar la
central. `docker compose down` en la raíz no detiene `app_monitoring`, pero sí sus
fuentes definidas en ese Compose: la UI seguirá accesible con esas fuentes sin
respuesta. Para detener exclusivamente la central:

```sh
docker compose -f monitoring/docker-compose.yml down
```

Esto aísla fallos del proceso de negocio, no es alta disponibilidad ante caída del
host o Docker. Jaeger, Prometheus y Grafana conservan su ciclo de vida y políticas
de almacenamiento existentes; no se incorporó persistencia ni respaldo nuevos.
Para conservar diagnóstico durante una caída completa del host se requiere otro
host y almacenamiento persistente para los proveedores.

El acceso conserva el alcance local de las consolas existentes, sin login del
portal. Para exposición remota, proteger esta API de lectura y los proveedores
con autenticación y TLS independientes. El adaptador limita rutas, períodos y
cantidad de datos; no acepta URLs ni PromQL arbitrario enviados por el navegador.

La UI de trazas consulta la API JSON interna de Jaeger mediante `/api/jaeger/`:
revisar compatibilidad al actualizar Jaeger. Sus indicadores describen hasta 200
trazas, no el total de requests. Los filtros quedan en la URL; el detalle permite
copiar IDs, exportar JSON y abrir el visor nativo. También admite ID exacto fuera
de la muestra. `VITE_JAEGER_UI_URL`, definido en el build de la UI independiente,
permite cambiar el enlace nativo (host actual, puerto 16686 por defecto).

El servidor admite `MONITOR_TARGET_HOST`, `MONITOR_PROMETHEUS_URL`,
`MONITOR_JAEGER_URL` y `MONITOR_DB_HOST/PORT/NAME/USER/PASSWORD` como variables de
entorno. Los endpoints, credenciales y consultas permitidas se centralizan en
`monitoring/server/config.py`; las URLs de Jaeger y Prometheus son compartidas por
sus sondas y consultas. Adaptar el catálogo si cambian los puertos publicados del
Compose principal. No se descubren automáticamente servicios nuevos.

La infraestructura sigue las convenciones del Compose principal: archivo
`docker-compose.yml`, contenedor `app_monitoring`, `restart: always`, puertos
explícitos y montajes de configuración de solo lectura. Mantiene su proyecto
`tpp-monitoring` separado, sin `depends_on`, `include` ni inicializadores de
proveedores. El build reutiliza Node 20 y Python 3.11, con React y FastAPI.
El proceso sin privilegios, el filesystem de solo lectura y los límites de
recursos son medidas específicas de esta central; no requieren alterar el stack
principal.

El código mantiene tres responsabilidades en el servidor: `config.py` declara la
configuración, `collectors.py` reúne sondas/SQL y `main.py` ofrece los endpoints de
lectura. En la UI, `App.jsx` concentra rutas y navegación; las pantallas de tracing
y métricas consumen un único cliente HTTP con cancelación y timeout. Se reutilizan
los componentes y hooks existentes, sin una jerarquía de clases ni un framework de
inyección de dependencias. Las funciones tienen una descripción breve en español.

### Comprobaciones del código

Desde la raíz, en un entorno virtual:

```sh
python -m pip install -e './libs/observability/python[fastapi,lint]'
python -m ruff check libs/observability/python/src backend/app/main.py backend/app/core/telemetry.py
python -m ruff format --check libs/observability/python/src backend/app/main.py backend/app/core/telemetry.py
docker compose config --quiet
git diff --check
```

La biblioteca no incluye tests ni fixtures propios; se conservan los archivos
de tests preexistentes del backend.
Estos comandos verifican estilo y configuración; no acreditan entrega real a
Jaeger, red S3, persistencia ni rendimiento de producción. El wheel instala solo
la biblioteca.
