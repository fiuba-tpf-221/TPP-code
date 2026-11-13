"""Configuración de la central y catálogo de servicios existentes del Compose principal."""

import os
from pathlib import Path

# Todo esto se resuelve por nombre de servicio en la red compartida (docker-compose.yml ->
# app-net), no por host.docker.internal: en la práctica esa ruta no es confiable (en esta misma
# máquina, por ejemplo, choca con cualquier otro proceso que ya esté escuchando ese puerto en el
# host) y hacía aparecer servicios como caídos sin estarlo. Los puertos son los internos del
# contenedor, no los publicados al host (p. ej. grafana:3000, no :3001; frontend:80, no :3000).
PROMETHEUS = os.getenv("MONITOR_PROMETHEUS_URL", "http://prometheus:9090").rstrip("/")
JAEGER = os.getenv("MONITOR_JAEGER_URL", "http://jaeger:16686").rstrip("/")

# Autenticación: la central exige el mismo Keycloak e igual rol que usa el front principal
# para mostrar el panel Sistema (ver frontend/src/config/keycloakRoles.js).
KEYCLOAK = os.getenv("MONITOR_KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
KEYCLOAK_REALM = os.getenv("MONITOR_KEYCLOAK_REALM", "tpp-realm")
REQUIRED_ROLE = os.getenv("MONITOR_REQUIRED_ROLE", "administrador")
DASHBOARDS = Path(os.getenv("MONITOR_DASHBOARDS_DIR", "/app/dashboards"))
POSTGRES_STORAGE = Path(os.getenv("MONITOR_DB_STORAGE_PATH", "/app/postgres-storage"))
DATABASE = {
    "host": os.getenv("MONITOR_DB_HOST", "postgres"),
    "port": os.getenv("MONITOR_DB_PORT", "5432"),
    "dbname": os.getenv("MONITOR_DB_NAME", "appdb"),
    "user": os.getenv("MONITOR_DB_USER", "tpp_monitor"),
    "password": os.getenv("MONITOR_DB_PASSWORD", ""),
    "connect_timeout": 3,
    "application_name": "tpp-monitoring",
    "options": "-c default_transaction_read_only=on -c statement_timeout=3000",
}

HTTP_SERVICES = (
    ("backend", "Backend API", "http://backend:8000/health", ("status", "ONLINE")),
    ("frontend", "Frontend", "http://frontend:80/", None),
    (
        "keycloak",
        "Keycloak",
        "http://keycloak:8080/realms/tpp-realm/.well-known/openid-configuration",
        None,
    ),
    ("minio", "MinIO", "http://minio:9000/minio/health/live", None),
    ("prometheus", "Prometheus", PROMETHEUS + "/-/ready", None),
    ("grafana", "Grafana", "http://grafana:3000/api/health", ("database", "ok")),
    ("jaeger", "Jaeger", JAEGER + "/api/services", None),
    ("collector", "OpenTelemetry Collector", "http://otel-collector:8888/metrics", None),
    (
        "sonarqube",
        "SonarQube",
        "http://sonarqube:9000/api/system/status",
        ("status", "UP"),
    ),
)
TCP_SERVICES = (
    ("postgres", "PostgreSQL", DATABASE["host"], DATABASE["port"]),
    ("rabbitmq", "RabbitMQ", "rabbitmq", 5672),
    ("redis", "Redis", "redis_keycloak", 6379),
)

# Acota la comparación al receptor OTLP y a la salida de trazas hacia Jaeger.
# Se admiten ambas convenciones del sufijo Prometheus del contador.
SPAN_COUNTERS = {
    "accepted": '{__name__=~"otelcol_receiver_accepted_spans(_total)?",job="otel-internal",receiver="otlp"}',
    "exported": '{__name__=~"otelcol_exporter_sent_spans(_total)?",job="otel-internal",exporter="otlp/jaeger"}',
    "failed": '{__name__=~"otelcol_exporter_send_failed_spans(_total)?",job="otel-internal",exporter="otlp/jaeger"}',
    "refused": '{__name__=~"otelcol_receiver_refused_spans(_total)?",job="otel-internal",receiver="otlp"}',
}
COLLECTOR_GAUGES = {
    "queue": 'sum(otelcol_exporter_queue_size{job="otel-internal",exporter="otlp/jaeger"})',
    "queue_capacity": 'sum(otelcol_exporter_queue_capacity{job="otel-internal",exporter="otlp/jaeger"})',
    "collector_memory": 'sum(otelcol_process_memory_rss{job="otel-internal"})',
}

METRICS = {
    # image distingue contenedores Docker reconocidos de cgroups internos
    # (buildkit/buildx), cuyos registros no incluyen nombres de servicios.
    "cpu": (
        'sum(rate(container_cpu_usage_seconds_total{id!="/",image!=""}[2m])) by (id, name, container_label_com_docker_compose_service) * 100',
        "percent",
        "CPU por contenedor",
    ),
    "memory": (
        'sum(container_memory_working_set_bytes{id!="/",image!=""}) by (id, name, container_label_com_docker_compose_service)',
        "bytes",
        "Memoria de trabajo",
    ),
    "filesystem": (
        'max(container_fs_usage_bytes{id="/"})',
        "bytes",
        "Uso del filesystem observado por cAdvisor",
    ),
    "database": ("tpp_database_size_bytes", "bytes", "Tamaño de las bases de datos"),
    "storage": (
        'tpp_postgres_storage_bytes{kind=~"total|used"}',
        "bytes",
        "Capacidad total y espacio ocupado",
    ),
    "connections": ("tpp_database_connections", "short", "Conexiones a PostgreSQL"),
    "availability": ("tpp_service_up", "up", "Disponibilidad de servicios"),
    "accepted": (
        f"sum(rate({SPAN_COUNTERS['accepted']}[2m]))",
        "ops",
        "Spans aceptados por segundo",
    ),
    "exported": (
        f"sum(rate({SPAN_COUNTERS['exported']}[2m]))",
        "ops",
        "Spans enviados por segundo",
    ),
    "failed": (
        f"sum(rate({SPAN_COUNTERS['failed']}[2m]))",
        "ops",
        "Fallos de envío por segundo",
    ),
    "refused": (
        f"sum(rate({SPAN_COUNTERS['refused']}[2m]))",
        "ops",
        "Spans rechazados por segundo",
    ),
    "queue": (
        COLLECTOR_GAUGES["queue"],
        "short",
        "Elementos en cola de exportación",
    ),
    "collector_memory": (
        COLLECTOR_GAUGES["collector_memory"],
        "bytes",
        "Memoria del Collector",
    ),
}
