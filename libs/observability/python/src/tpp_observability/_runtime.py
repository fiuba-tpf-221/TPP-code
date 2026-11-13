"""Coordina el SDK, los módulos técnicos privados y su ciclo de vida."""

import logging
import threading
import time
from contextlib import contextmanager
from typing import Iterator, Mapping, Sequence

from opentelemetry import context as otel_context, trace as otel_trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import SpanLimits, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased
from opentelemetry.trace import (
    ProxyTracerProvider,
    Span,
    SpanKind,
    Status,
    StatusCode,
    Tracer,
)

from ._config import TracingConfig, positive_millis
from ._export import ConsoleSink, OtlpSink, SafeExporter
from ._privacy import Privacy
from ._types import Attributes
from . import _propagation

_logger = logging.getLogger(__name__)


def _discard_provider(provider: TracerProvider, exporters: list[SafeExporter]) -> None:
    """Liberar una inicialización incompleta sin bloquear por un transporte."""
    for exporter in exporters:
        exporter.abort()
    threading.Thread(
        target=provider.shutdown, name="tpp-tracing-init-cleanup", daemon=True
    ).start()


def _make_provider(config: TracingConfig) -> tuple[TracerProvider, list[SafeExporter]]:
    # Ninguna opción implícita del entorno contradice TracingConfig.
    provider = TracerProvider(
        resource=Resource(
            {
                "service.name": config.service_name,
                "service.version": config.service_version,
                "deployment.environment": config.environment,
            }
        ),
        sampler=ParentBased(TraceIdRatioBased(config.sample_ratio)),
        span_limits=SpanLimits(
            max_attributes=config.max_attributes,
            max_span_attributes=config.max_attributes,
            max_event_attributes=config.max_attributes,
            max_link_attributes=config.max_attributes,
            max_events=config.max_events,
            max_links=config.max_links,
            max_attribute_length=config.max_attribute_length,
            max_span_attribute_length=config.max_attribute_length,
        ),
        shutdown_on_exit=False,
    )
    exporters = []
    try:
        # Construir sinks antes de crear workers: una CA/config inválida falla
        # en el arranque, no se convierte en un fallo silencioso de exportación.
        if config.otlp_export:
            exporters.append(SafeExporter(OtlpSink(config), config))
        if config.console_export:
            exporters.append(SafeExporter(ConsoleSink(), config))
        for exporter in exporters:
            provider.add_span_processor(
                BatchSpanProcessor(
                    exporter,
                    max_queue_size=config.max_queue_size,
                    max_export_batch_size=config.max_export_batch_size,
                    schedule_delay_millis=config.schedule_delay_millis,
                    export_timeout_millis=max(
                        1, int(config.export_timeout_seconds * 1000)
                    ),
                )
            )
    except BaseException:
        _discard_provider(provider, exporters)
        raise
    return provider, exporters


def _record_error(
    span: Span, error: BaseException, attributes: Attributes | None, *, escaped: bool
) -> None:
    if span.is_recording():
        data = dict(attributes or {})
        # No se serializan argumentos de la excepción, mensajes ni stack traces.
        # Las claves reservadas no pueden ser sobrescritas por el consumidor.
        data["exception.type"] = f"{type(error).__module__}.{type(error).__qualname__}"
        data["exception.escaped"] = escaped
        span.set_status(Status(StatusCode.ERROR))
        span.add_event("exception", attributes=data)


class Runtime:
    """Estado del ciclo de vida; el span activo vive exclusivamente en OTel."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._config: TracingConfig | None = None
        self._provider: TracerProvider | None = None
        self._tracer: Tracer | None = None
        self._closed = False
        self._shutdown_result = True
        self._shutdown_done = threading.Event()
        self._shutdown_deadline: float | None = None
        self._exporters: list[SafeExporter] = []
        self._privacy: Privacy | None = None
        self._application_owner: object | None = None
        self._reported_failures: set[str] = set()

    @property
    def enabled(self) -> bool:
        """Consulta interna sin locks ni trabajo de red para adaptadores."""
        return self._tracer is not None

    @contextmanager
    def _protect(self, operation: str) -> Iterator[None]:
        """Frontera técnica: nunca envolver código de negocio con este bloque."""
        try:
            yield
        except Exception:
            # Una falla persistente no debe emitir un warning por petición.
            # Las claves son constantes internas; no se retienen excepciones.
            with self._lock:
                reported = operation in self._reported_failures
                self._reported_failures.add(operation)
            if not reported:
                try:
                    _logger.warning("tracing_%s_failed", operation)
                except Exception:
                    # Un handler de logging ajeno tampoco puede afectar negocio.
                    pass

    @contextmanager
    def _activate(self, context: otel_context.Context) -> Iterator[None]:
        token = None
        with self._protect("context_attach"):
            token = otel_context.attach(context)
        try:
            yield
        finally:
            if token is not None:
                with self._protect("context_detach"):
                    otel_context.detach(token)

    def initialize_application(self, owner: object, config: TracingConfig) -> None:
        """Un solo lifespan puede cerrar el proveedor compartido del proceso."""
        with self._lock:
            if (
                self._application_owner is not None
                and self._application_owner is not owner
            ):
                raise RuntimeError(
                    "Otra aplicación ya administra el lifecycle de tracing"
                )
            self.initialize(config)
            self._application_owner = owner

    def initialize(self, config: TracingConfig) -> None:
        with self._lock:
            if self._closed:
                raise RuntimeError(
                    "Tracing cerrado: iniciar otro proceso para reinicializar el SDK"
                )
            if self._config is not None:
                if config != self._config:
                    raise RuntimeError("Tracing ya inicializado con otra configuración")
                return
            if not config.enabled:
                self._config = config
                return
            if not isinstance(otel_trace.get_tracer_provider(), ProxyTracerProvider):
                raise RuntimeError(
                    "Ya existe un proveedor OpenTelemetry; resolver su propiedad antes de inicializar"
                )
            provider, exporters = _make_provider(config)
            try:
                otel_trace.set_tracer_provider(provider)
                if otel_trace.get_tracer_provider() is not provider:
                    raise RuntimeError(
                        "Otro inicializador instaló un proveedor OpenTelemetry concurrentemente"
                    )
                tracer = provider.get_tracer("tpp_observability.tracing", "0.1.0")
            except BaseException:
                _discard_provider(provider, exporters)
                raise
            self._provider = provider
            self._exporters = exporters
            self._privacy = Privacy(config)
            self._tracer = tracer
            self._config = config

    @contextmanager
    def operation(
        self,
        name: str,
        attributes: Attributes | None,
        kind: str,
        links: Sequence[Mapping[str, object]],
    ) -> Iterator[None]:
        if not isinstance(name, str) or not name.strip():
            raise ValueError("El nombre del span no puede estar vacío")
        if kind not in {"internal", "server", "client", "producer", "consumer"}:
            raise ValueError(
                "kind debe ser internal, server, client, producer o consumer"
            )
        # La lectura del tracer no espera el lock de flush/shutdown: el trabajo
        # medido no debe bloquearse detrás de una espera de exportación.
        tracer = self._tracer
        if tracer is None:
            yield
            return
        span = None
        # Si falla el inicio, los atributos/errores del hijo no deben terminar
        # escritos sobre el span padre. El contexto vacío se restaura al salir.
        active_context = otel_context.Context()
        with self._protect("span_start"):
            span = tracer.start_span(
                self._privacy.text(name),
                attributes=self._privacy.attributes(attributes),
                kind=SpanKind[kind.upper()],
                links=_propagation.links(
                    links[: self._config.max_links],
                    propagate_tracestate=self._config.propagate_tracestate,
                ),
            )
            active_context = otel_trace.set_span_in_context(span)
        try:
            with self._activate(active_context):
                try:
                    yield
                except BaseException as error:
                    # Se observa también cancelación, pero siempre se relanza la
                    # misma excepción aunque falle el registro del error.
                    if span is not None:
                        with self._protect("error_record"):
                            _record_error(span, error, None, escaped=True)
                    raise
        finally:
            if span is not None:
                # Restaurar el contexto antes de notificar a los processors.
                # end() puede fallar; no debe reemplazar resultado/excepción.
                with self._protect("span_end"):
                    span.end()

    def set_attributes(self, attributes: Attributes) -> None:
        if self._tracer is not None:
            with self._protect("attributes"):
                otel_trace.get_current_span().set_attributes(
                    self._privacy.attributes(attributes)
                )

    def event(self, name: str, attributes: Attributes | None) -> None:
        if self._tracer is not None:
            with self._protect("event"):
                otel_trace.get_current_span().add_event(
                    self._privacy.text(name),
                    attributes=self._privacy.attributes(attributes),
                )

    def record_error(self, error: BaseException, attributes: Attributes | None) -> None:
        if self._tracer is not None:
            with self._protect("error_record"):
                _record_error(
                    otel_trace.get_current_span(),
                    error,
                    self._privacy.attributes(attributes),
                    escaped=False,
                )

    def http_response(self, method: str, route: str | None, status: int | None) -> None:
        """Completar el SERVER desde el adaptador sin exponer objetos del SDK."""
        if self._tracer is None:
            return
        with self._protect("http_response"):
            span = otel_trace.get_current_span()
            if status is not None:
                self.set_attributes({"http.status_code": status})
                if status >= 500:
                    span.set_status(Status(StatusCode.ERROR))
            if route:
                span.update_name(self._privacy.text(f"{method} {route}"))
                self.set_attributes({"http.route": route})

    def headers(self) -> dict[str, str]:
        if self._tracer is not None:
            with self._protect("context_inject"):
                return _propagation.headers(
                    propagate_tracestate=self._config.propagate_tracestate
                )
        return {}

    def current_ids(self) -> dict[str, str]:
        if self._tracer is None:
            return {}
        with self._protect("context_ids"):
            current = otel_trace.get_current_span().get_span_context()
            if current.is_valid:
                return {
                    "trace_id": f"{current.trace_id:032x}",
                    "span_id": f"{current.span_id:016x}",
                }
        return {}

    @contextmanager
    def receive_context(
        self, carrier: Mapping[str, object], *, trusted: bool
    ) -> Iterator[None]:
        if self._tracer is None:
            yield
        else:
            # Si el parser falla, aislar igualmente el mensaje/petición del
            # contexto local ajeno, en lugar de heredarlo accidentalmente.
            received = otel_context.Context()
            with self._protect("context_extract"):
                received = _propagation.extract(
                    carrier,
                    trusted=trusted,
                    propagate_tracestate=self._config.propagate_tracestate,
                )
            with self._activate(received):
                yield

    def flush(self, timeout_millis: int) -> bool:
        deadline = time.monotonic() + positive_millis(timeout_millis) / 1000
        if not self._lock.acquire(timeout=max(0, deadline - time.monotonic())):
            return False
        try:
            provider, closed = self._provider, self._closed
        finally:
            self._lock.release()
        if closed:
            return (
                self._shutdown_done.wait(max(0, deadline - time.monotonic()))
                and self._shutdown_result
            )
        if provider is None:
            return True
        try:
            remaining = deadline - time.monotonic()
            return (
                remaining > 0
                and provider.force_flush(timeout_millis=max(1, int(remaining * 1000)))
                and not any(exporter.failed for exporter in self._exporters)
            )
        except Exception:
            _logger.warning("tracing_flush_failed")
            return False

    def _close_provider(self, provider, deadline):
        flushed = False
        try:
            remaining = deadline - time.monotonic()
            if remaining > 0:
                flushed = provider.force_flush(
                    timeout_millis=max(1, int(remaining * 1000))
                )
        except Exception:
            _logger.warning("tracing_shutdown_flush_failed")
        finally:
            try:
                provider.shutdown()
            except Exception:
                flushed = False
                _logger.warning("tracing_shutdown_close_failed")
            with self._lock:
                self._shutdown_result = (
                    self._shutdown_result
                    and flushed
                    and time.monotonic() <= deadline
                    and not any(exporter.failed for exporter in self._exporters)
                )
                self._provider = None
                self._shutdown_done.set()

    def shutdown(self, timeout_millis: int | None = None) -> bool:
        budget = (
            timeout_millis
            if timeout_millis is not None
            else (self._config.shutdown_timeout_millis if self._config else 5000)
        )
        deadline = time.monotonic() + positive_millis(budget) / 1000
        if not self._lock.acquire(timeout=max(0, deadline - time.monotonic())):
            return False
        try:
            if self._config is None:
                return True
            if not self._closed:
                self._closed = True
                self._tracer = None
                self._shutdown_deadline = deadline
                if self._provider is None:
                    self._shutdown_done.set()
                else:
                    threading.Thread(
                        target=self._close_provider,
                        args=(self._provider, deadline),
                        name="tpp-tracing-shutdown",
                        daemon=True,
                    ).start()
            # Llamadas repetidas nunca amplían el presupuesto original.
            deadline = min(deadline, self._shutdown_deadline)
        finally:
            self._lock.release()
        if not self._shutdown_done.wait(max(0, deadline - time.monotonic())):
            self._shutdown_result = False
            for exporter in self._exporters:
                exporter.abort()
            _logger.warning("tracing_shutdown_timeout")
            return False
        return self._shutdown_result
