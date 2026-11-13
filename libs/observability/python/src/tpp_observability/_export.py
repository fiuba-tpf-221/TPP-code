"""Batch del SDK + envío OTLP con presupuesto explícito y frontera de fallos.

El SDK 1.22 no expone configuración de intentos y permite RetryInfo remoto sin
cota. Reutilizamos su encoder protobuf; solo transporte/retry se controlan aquí.
"""

import logging
import ssl
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from opentelemetry.sdk.trace.export import (
    ConsoleSpanExporter,
    SpanExporter,
    SpanExportResult,
)

from ._config import TracingConfig
from ._privacy import Privacy

_logger = logging.getLogger(__name__)


class OtlpSink:
    def __init__(self, config: TracingConfig):
        self.config = config
        if config.certificate_file:
            # Fallo de configuración antes de instalar proveedor/crear worker.
            ssl.create_default_context(cafile=config.certificate_file)
        if config.protocol == "grpc":
            import grpc
            from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import (
                TraceServiceStub,
            )

            target = urlsplit(config.endpoint).netloc
            options = (("grpc.enable_retries", 0),)
            if config.insecure:
                self.channel = grpc.insecure_channel(target, options=options)
            else:
                roots = (
                    Path(config.certificate_file).read_bytes()
                    if config.certificate_file
                    else None
                )
                self.channel = grpc.secure_channel(
                    target, grpc.ssl_channel_credentials(roots), options=options
                )
            self.client = TraceServiceStub(self.channel)
        else:
            import requests

            self.session = requests.Session()
            # No credenciales de .netrc, proxies ni configuración implícita.
            self.session.trust_env = False

    def _send(self, payload, timeout):
        if self.config.protocol == "grpc":
            import grpc

            try:
                response = self.client.Export(payload, timeout=timeout)
            except grpc.RpcError as error:
                retryable = error.code() in {
                    grpc.StatusCode.CANCELLED,
                    grpc.StatusCode.DEADLINE_EXCEEDED,
                    grpc.StatusCode.RESOURCE_EXHAUSTED,
                    grpc.StatusCode.ABORTED,
                    grpc.StatusCode.UNAVAILABLE,
                    grpc.StatusCode.DATA_LOSS,
                    grpc.StatusCode.OUT_OF_RANGE,
                }
                # No logs de detalles remotos ni espera sugerida por RetryInfo.
                return "retry" if retryable else "failure"
            return "failure" if response.partial_success.rejected_spans else "success"
        import requests

        # Session reutiliza conexiones, pero no debe reenviar cookies que un
        # receptor haya adjuntado a una respuesta OTLP anterior.
        self.session.cookies.clear()
        try:
            with self.session.post(
                self.config.endpoint,
                data=payload.SerializeToString(),
                headers={"Content-Type": "application/x-protobuf"},
                timeout=timeout,
                verify=self.config.certificate_file or True,
                allow_redirects=False,
                stream=True,
            ) as response:
                if response.status_code in (200, 202):
                    from google.protobuf.message import DecodeError
                    from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
                        ExportTraceServiceResponse,
                    )

                    # Respuesta protobuf acotada; nunca loguear texto remoto.
                    data = bytearray()
                    for chunk in response.iter_content(chunk_size=4096):
                        data.extend(chunk)
                        if len(data) > 65536:
                            return "failure"
                    try:
                        result = ExportTraceServiceResponse.FromString(bytes(data))
                    except DecodeError:
                        return "failure"
                    return (
                        "failure"
                        if result.partial_success.rejected_spans
                        else "success"
                    )
                return (
                    "retry"
                    if response.status_code in (429, 502, 503, 504)
                    else "failure"
                )
        except (requests.Timeout, requests.ConnectionError):
            return "retry"

    def export(self, spans, deadline, cancelled):
        from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans

        payload = encode_spans(spans)
        delay = self.config.export_retry_backoff_seconds
        for attempt in range(self.config.export_max_attempts):
            remaining = deadline - time.monotonic()
            if cancelled.is_set() or remaining <= 0:
                break
            outcome = self._send(
                payload, min(remaining, self.config.export_attempt_timeout_seconds)
            )
            if outcome == "success":
                return SpanExportResult.SUCCESS
            if outcome != "retry" or attempt + 1 == self.config.export_max_attempts:
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0 or cancelled.wait(min(delay, remaining)):
                break
            delay = min(delay * 2, self.config.export_retry_max_backoff_seconds)
        return SpanExportResult.FAILURE

    def shutdown(self):
        if self.config.protocol == "grpc":
            self.channel.close()
        else:
            self.session.close()


class ConsoleSink:
    def __init__(self):
        self.exporter = ConsoleSpanExporter()

    def export(self, spans, deadline, cancelled):
        if cancelled.is_set() or time.monotonic() >= deadline:
            return SpanExportResult.FAILURE
        return self.exporter.export(spans)

    def shutdown(self):
        self.exporter.shutdown()


@dataclass
class _Flight:
    done: threading.Event = field(default_factory=threading.Event)
    wake: threading.Event = field(default_factory=threading.Event)
    cancelled: threading.Event = field(default_factory=threading.Event)
    result: SpanExportResult = SpanExportResult.FAILURE


class SafeExporter(SpanExporter):
    """Como máximo un envío activo, sin acumular threads ante IO bloqueado.

    El thread daemon permite devolver control al vencer el presupuesto. Python
    no permite matar de forma segura un thread bloqueado en un driver externo.
    La limpieza se serializa con ese envío, nunca cierra un cliente en uso.
    """

    def __init__(self, sink, config: TracingConfig):
        self.sink = sink
        self.config = config
        self.privacy = Privacy(config)
        self._lock = threading.Lock()
        self._flight: _Flight | None = None
        self._stopped = False
        self._closed = threading.Event()
        self._closing = False
        self.failed = False

    def _close(self):
        try:
            self.sink.shutdown()
        except Exception:
            self.failed = True
            _logger.warning("tracing_export_close_failed")
        finally:
            self._closed.set()

    def _run(self, flight, spans, deadline):
        try:
            safe = tuple(self.privacy.span(span) for span in spans)
            flight.result = self.sink.export(safe, deadline, flight.cancelled)
        except Exception:
            # Frontera técnica: nunca imprimir el error ni el payload del driver.
            _logger.warning("tracing_export_failed")
        finally:
            if flight.result != SpanExportResult.SUCCESS:
                self.failed = True
                _logger.warning("tracing_export_batch_dropped")
            with self._lock:
                flight.done.set()
                flight.wake.set()
                close = self._stopped and not self._closing
                if close:
                    self._closing = True
            if close:
                self._close()

    def export(self, spans):
        deadline = time.monotonic() + self.config.export_timeout_seconds
        with self._lock:
            if self._stopped or (self._flight and not self._flight.done.is_set()):
                self.failed = True
                _logger.warning("tracing_export_busy_or_stopped")
                return SpanExportResult.FAILURE
            flight = _Flight()
            self._flight = flight
            threading.Thread(
                target=self._run,
                args=(flight, tuple(spans), deadline),
                name="tpp-tracing-export",
                daemon=True,
            ).start()
        flight.wake.wait(max(0, deadline - time.monotonic()))
        if not flight.done.is_set():
            flight.cancelled.set()
            self.failed = True
            _logger.warning("tracing_export_timeout")
            return SpanExportResult.FAILURE
        return flight.result

    def abort(self):
        """Cerrar admisión/cancelar retries; no esperar IO ni crear otro envío."""
        with self._lock:
            self._stopped = True
            if self._flight:
                self._flight.cancelled.set()
                self._flight.wake.set()
            close = (
                self._flight is None or self._flight.done.is_set()
            ) and not self._closing
            if close:
                self._closing = True
        if close:
            threading.Thread(
                target=self._close, name="tpp-tracing-export-close", daemon=True
            ).start()

    def shutdown(self):
        self.abort()
        # El runtime impone además un único deadline global para todos los sinks.
        if not self._closed.wait(self.config.shutdown_timeout_millis / 1000):
            self.failed = True
