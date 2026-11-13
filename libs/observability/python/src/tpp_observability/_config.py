"""Configuración explícita e inmutable; sin lecturas de entorno al importar."""

import math
import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import urlsplit

DEFAULT_ALLOWED_ATTRIBUTES = (
    "http.method",
    "http.route",
    "http.status_code",
    "server.address",
    "server.port",
    "db.system",
    "db.operation",
    "messaging.system",
    "messaging.destination.name",
    "messaging.operation",
    "messaging.message.id",
    "messaging.message.conversation_id",
    "messaging.batch.message_count",
    "app.operation",
    "app.component",
    "app.trigger.type",
    "app.trigger.name",
    "app.context.source",
    "app.error.code",
    "app.step",
    "app.job_id",
    "app.request_id",
    "app.task.name",
    "app.message.redelivered",
    "app.message.attempt",
    "app.message.requeue",
    "app.file_count",
    "app.item_count",
    "app.input_count",
    "app.format",
    "app.recoverable",
)


def _boolean(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError("Los booleanos de tracing deben ser true o false")
    return normalized == "true"


def positive_millis(value: int) -> int:
    if type(value) is not int or value <= 0:
        raise ValueError("timeout_millis debe ser un entero positivo")
    return value


@dataclass(frozen=True)
class TracingConfig:
    """Configuración centralizada. from_env aplica las precedencias documentadas."""

    enabled: bool = True
    service_name: str = "tpp-app"
    service_version: str = "unknown"
    environment: str = "development"
    protocol: str = "grpc"
    endpoint: str | None = None
    insecure: bool | None = None
    certificate_file: str | None = None
    sample_ratio: float = 1.0
    console_export: bool = False
    otlp_export: bool = True
    export_timeout_seconds: float = 10.0
    export_attempt_timeout_seconds: float = 3.0
    export_max_attempts: int = 3
    export_retry_backoff_seconds: float = 0.2
    export_retry_max_backoff_seconds: float = 1.0
    shutdown_timeout_millis: int = 5000
    max_queue_size: int = 2048
    max_export_batch_size: int = 512
    schedule_delay_millis: int = 5000
    max_attributes: int = 32
    max_events: int = 32
    max_links: int = 32
    max_attribute_length: int = 256
    allowed_attributes: tuple[str, ...] = DEFAULT_ALLOWED_ATTRIBUTES
    propagate_tracestate: bool = False

    def __post_init__(self) -> None:
        for field in (
            "enabled",
            "console_export",
            "otlp_export",
            "propagate_tracestate",
        ):
            if type(getattr(self, field)) is not bool:
                raise ValueError(f"{field} debe ser booleano")
        if self.insecure is not None and type(self.insecure) is not bool:
            raise ValueError("insecure debe ser booleano o None")
        if self.protocol not in {"grpc", "http/protobuf"}:
            raise ValueError("protocol debe ser grpc o http/protobuf")
        endpoint = self.endpoint
        if endpoint is None:
            endpoint = (
                "http://localhost:4317"
                if self.protocol == "grpc"
                else "http://localhost:4318/v1/traces"
            )
            object.__setattr__(self, "endpoint", endpoint)
        if not isinstance(endpoint, str):
            raise ValueError("endpoint debe ser texto")
        try:
            parsed = urlsplit(endpoint)
            port = parsed.port
        except ValueError:
            raise ValueError("Endpoint OTLP inválido") from None
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or port == 0
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or any(c.isspace() for c in endpoint)
        ):
            raise ValueError(
                "El endpoint requiere http(s), host y ninguna credencial/query/fragmento"
            )
        if self.protocol == "grpc" and parsed.path not in {"", "/"}:
            raise ValueError("El endpoint gRPC no admite un path")
        insecure = parsed.scheme == "http" if self.insecure is None else self.insecure
        if insecure != (parsed.scheme == "http"):
            raise ValueError("insecure debe ser coherente con el esquema http(s)")
        object.__setattr__(self, "insecure", insecure)
        if self.certificate_file is not None:
            if (
                not isinstance(self.certificate_file, str)
                or not self.certificate_file.strip()
                or insecure
            ):
                raise ValueError(
                    "certificate_file requiere una ruta y transporte https"
                )
        for field in ("service_name", "service_version", "environment"):
            value = getattr(self, field)
            if not isinstance(value, str) or not value.strip() or len(value) > 256:
                raise ValueError(
                    f"{field} debe ser texto no vacío de hasta 256 caracteres"
                )
        if (
            type(self.sample_ratio) not in (int, float)
            or not math.isfinite(self.sample_ratio)
            or not 0 <= self.sample_ratio <= 1
        ):
            raise ValueError("sample_ratio debe ser finito entre 0 y 1")
        for field in (
            "export_timeout_seconds",
            "export_attempt_timeout_seconds",
            "export_retry_backoff_seconds",
            "export_retry_max_backoff_seconds",
        ):
            value = getattr(self, field)
            if (
                type(value) not in (int, float)
                or not math.isfinite(value)
                or value <= 0
            ):
                raise ValueError(f"{field} debe ser positivo y finito")
        if self.export_retry_backoff_seconds > self.export_retry_max_backoff_seconds:
            raise ValueError("El backoff inicial no puede superar el máximo")
        for field in (
            "max_queue_size",
            "max_export_batch_size",
            "schedule_delay_millis",
            "shutdown_timeout_millis",
            "export_max_attempts",
            "max_attributes",
            "max_events",
            "max_links",
            "max_attribute_length",
        ):
            value = getattr(self, field)
            if type(value) is not int or value <= 0:
                raise ValueError(f"{field} debe ser un entero positivo")
        if self.export_max_attempts > 10:
            raise ValueError("export_max_attempts no puede superar 10")
        if self.max_export_batch_size > self.max_queue_size:
            raise ValueError("max_export_batch_size no puede superar max_queue_size")
        if not isinstance(self.allowed_attributes, tuple) or any(
            not isinstance(key, str)
            or not key
            or key != key.strip()
            or len(key) > 128
            or "*" in key
            for key in self.allowed_attributes
        ):
            raise ValueError(
                "allowed_attributes debe ser una tupla de nombres exactos sin comodines"
            )
        object.__setattr__(
            self, "allowed_attributes", tuple(sorted(set(self.allowed_attributes)))
        )

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "TracingConfig":
        """Leer solo variables soportadas; no delegar configuración implícita al SDK."""
        env = os.environ if environ is None else environ

        def otlp(suffix: str) -> str | None:
            return env.get(
                f"OTEL_EXPORTER_OTLP_TRACES_{suffix}",
                env.get(f"OTEL_EXPORTER_OTLP_{suffix}"),
            )

        protocol = otlp("PROTOCOL")
        endpoint = otlp("ENDPOINT")
        if (
            endpoint is not None
            and (protocol if protocol is not None else cls.protocol) == "http/protobuf"
            and "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT" not in env
        ):
            endpoint = endpoint.rstrip("/") + "/v1/traces"
        insecure = otlp("INSECURE")
        # Solo sobrescribir lo presente: los defaults pertenecen a la dataclass.
        options = {}
        if "TRACING_ENABLED" in env:
            options["enabled"] = _boolean(env["TRACING_ENABLED"])
        elif "OTEL_SDK_DISABLED" in env:
            options["enabled"] = not _boolean(env["OTEL_SDK_DISABLED"])
        for field, value in (
            ("service_name", env.get("OTEL_SERVICE_NAME")),
            ("service_version", env.get("TRACING_SERVICE_VERSION")),
            ("environment", env.get("TRACING_ENVIRONMENT")),
            ("protocol", protocol),
            ("endpoint", endpoint),
            ("certificate_file", otlp("CERTIFICATE")),
        ):
            if value is not None:
                options[field] = value
        if insecure is not None:
            options["insecure"] = _boolean(insecure)
        for parser, names in (
            (_boolean, ("console_export", "otlp_export", "propagate_tracestate")),
            (
                float,
                (
                    "sample_ratio",
                    "export_timeout_seconds",
                    "export_attempt_timeout_seconds",
                    "export_retry_backoff_seconds",
                    "export_retry_max_backoff_seconds",
                ),
            ),
            (
                int,
                (
                    "export_max_attempts",
                    "shutdown_timeout_millis",
                    "max_attributes",
                    "max_events",
                    "max_links",
                    "max_attribute_length",
                ),
            ),
        ):
            for field in names:
                variable = f"TRACING_{field.upper()}"
                if variable in env:
                    options[field] = parser(env[variable])
        for field, variable in (
            ("max_queue_size", "OTEL_BSP_MAX_QUEUE_SIZE"),
            ("max_export_batch_size", "OTEL_BSP_MAX_EXPORT_BATCH_SIZE"),
            ("schedule_delay_millis", "OTEL_BSP_SCHEDULE_DELAY"),
        ):
            if variable in env:
                options[field] = int(env[variable])
        if "TRACING_ALLOWED_ATTRIBUTES" in env:
            options["allowed_attributes"] = tuple(
                key.strip()
                for key in env["TRACING_ALLOWED_ATTRIBUTES"].split(",")
                if key.strip()
            )
        return cls(**options)
