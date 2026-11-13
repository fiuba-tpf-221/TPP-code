"""API pública compartida. Los consumidores no necesitan importar OpenTelemetry."""

import inspect
from contextlib import AbstractContextManager
from functools import wraps
from typing import TYPE_CHECKING, Callable, Mapping, ParamSpec, Sequence, TypeVar

from ._config import TracingConfig
from ._runtime import Runtime
from ._types import Attributes, AttributeValue, SpanKind

if TYPE_CHECKING:
    from fastapi import FastAPI

__all__ = [
    "Attributes",
    "AttributeValue",
    "TracingConfig",
    "initialize",
    "instrument_fastapi",
    "shutdown",
    "flush",
    "trace",
    "traced",
    "set_attributes",
    "event",
    "record_error",
    "headers",
    "receive_context",
    "current_ids",
    "SpanKind",
]

_runtime = Runtime()
_P = ParamSpec("_P")
_R = TypeVar("_R")


def initialize(config: TracingConfig | None = None) -> None:
    """Inicializar una vez por proceso; sin config se lee el entorno.

    Repetir la misma configuración no agrega exportadores. Una configuración
    distinta, un proveedor ajeno o reinicializar tras shutdown producen RuntimeError.
    """
    _runtime.initialize(TracingConfig.from_env() if config is None else config)


def instrument_fastapi(
    app: "FastAPI",
    config: TracingConfig | None = None,
    *,
    trusted_headers: bool = False,
) -> None:
    """Instalar HTTP y lifecycle una vez, después de otros middleware y antes de servir.

    Requiere el extra `fastapi`. Conserva el lifespan existente y cierra el SDK
    sin bloquear el event loop. Solo admite una aplicación dueña por proceso.
    Por defecto ignora el contexto remoto; habilitarlo solo tras revisar el ingreso.
    No captura URLs, headers completos, cuerpos ni mensajes de excepciones.
    """
    from ._fastapi import instrument

    instrument(app, config, trusted_headers=trusted_headers)


def shutdown(timeout_millis: int | None = None) -> bool:
    """Vaciar spans finalizados y cerrar recursos propios. Es idempotente.

    Sin argumento usa shutdown_timeout_millis de la configuración. El límite
    cubre toda la espera; false indica timeout o fallo observado. No garantiza
    recepción remota. Un driver bloqueado puede quedar en un thread daemon.
    """
    return _runtime.shutdown(timeout_millis)


def flush(timeout_millis: int = 5000) -> bool:
    """Esperar el procesamiento de spans pendientes; no garantiza su recepción."""
    return _runtime.flush(timeout_millis)


def trace(
    name: str,
    *,
    attributes: Attributes | None = None,
    kind: SpanKind = "internal",
    links: Sequence[Mapping[str, object]] = (),
) -> AbstractContextManager[None]:
    """Medir un bloque `with`, también dentro de async def a través de await.

    El bloque activa un span hijo del contexto OTel actual y lo finaliza siempre.
    No devuelve objetos del SDK. Sin inicialización/habilitación es no-op para
    argumentos válidos. Nombre vacío o kind inválido producen ValueError al entrar.
    links recibe carriers W3C confiables; no reemplaza el padre activo.
    Fallos técnicos de instrumentación se aíslan y pueden perder telemetría;
    nunca se suprimen resultados, excepciones ni cancelación del bloque medido.
    """
    # Los links son carriers confiables W3C, nunca objetos del SDK. Para una
    # nueva raíz con links, abrir antes receive_context({}).
    return _runtime.operation(name, attributes, kind, links)


def traced(
    name: str, *, attributes: Attributes | None = None, kind: SpanKind = "internal"
) -> Callable[[Callable[_P, _R]], Callable[_P, _R]]:
    """Decorar funciones sync o async preservando firma, metadatos y resultados.

    Rechaza funciones generadoras: delimitar su consumo con trace(). Las funciones
    que retornan iteradores diferidos también deben instrumentarse con un bloque.
    No se capturan argumentos ni valores de retorno. Reaplicar la misma
    declaración devuelve el wrapper existente; otra declaración produce ValueError.
    """

    declared = (name, dict(attributes or {}), kind)

    def decorate(function: Callable[_P, _R]) -> Callable[_P, _R]:
        previous = getattr(function, "__tpp_tracing__", None)
        if previous is not None:
            if previous != declared:
                raise ValueError(
                    "La función ya está instrumentada con otra declaración"
                )
            return function
        if inspect.isgeneratorfunction(function) or inspect.isasyncgenfunction(
            function
        ):
            raise TypeError(
                "Para generadores/streaming, usar trace() alrededor del consumo"
            )
        if inspect.iscoroutinefunction(function):

            @wraps(function)
            async def async_wrapper(*args, **kwargs):
                with trace(name, attributes=declared[1], kind=kind):
                    return await function(*args, **kwargs)

            async_wrapper.__tpp_tracing__ = declared
            return async_wrapper

        @wraps(function)
        def sync_wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _R:
            with trace(name, attributes=declared[1], kind=kind):
                return function(*args, **kwargs)

        sync_wrapper.__tpp_tracing__ = declared
        return sync_wrapper

    return decorate


def set_attributes(attributes: Attributes) -> None:
    """Agregar/reemplazar atributos del span activo. Sin span activo es no-op."""
    _runtime.set_attributes(attributes)


def event(name: str, *, attributes: Attributes | None = None) -> None:
    """Agregar un evento al span activo. Sin span activo es no-op."""
    _runtime.event(name, attributes)


def record_error(error: BaseException, *, attributes: Attributes | None = None) -> None:
    """Marcar un error manejado, con su tipo y atributos explícitos seguros.

    No captura mensaje/stack trace. Sin span activo es no-op. No volver a llamar
    para una excepción que saldrá del bloque, porque se registrará automáticamente.
    """
    _runtime.record_error(error, attributes)


def headers() -> dict[str, str]:
    """Obtener traceparent (y tracestate si se habilitó) para HTTP o mensajes.

    No incluye baggage ni atributos. Sin contexto válido/habilitación devuelve {}.
    La biblioteca no envía el request ni publica el mensaje.
    """
    return _runtime.headers()


def current_ids() -> dict[str, str]:
    """IDs hex del contexto activo para logs; {} si no hay contexto habilitado.

    Puede haber IDs válidos aunque el sampler decida no exportar el span.
    No genera ni sustituye IDs de negocio.
    """
    return _runtime.current_ids()


def receive_context(
    carrier: Mapping[str, object],
    *,
    trusted: bool = True,
) -> AbstractContextManager[None]:
    """Activar un contexto W3C recibido y restaurar el anterior al salir.

    Abrir trace() dentro para medir al consumidor. Contextos inválidos o ausentes
    comienzan una raíz. trusted=False ignora el carrier entero. Sin habilitación
    conserva el contexto actual. No verifica autenticación ni integridad.
    """
    return _runtime.receive_context(carrier, trusted=trusted)
