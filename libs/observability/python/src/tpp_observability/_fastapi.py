"""Adaptador HTTP opcional: un SERVER por petición, sin capturar datos privados.

ASGI puro preserva streaming, contextvars y el threadpool de FastAPI. El SDK
permanece en Runtime; ni este adaptador ni sus consumidores reciben spans.
"""

import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from . import tracing
from ._config import TracingConfig

if TYPE_CHECKING:
    from fastapi import FastAPI
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

_logger = logging.getLogger(__name__)
_registration_lock = threading.Lock()
_METHODS = frozenset(
    {"GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"}
)


def _carrier(scope: "Scope") -> dict[str, str]:
    """Seleccionar W3C; duplicados ambiguos invalidan todo el padre recibido."""
    result: dict[str, str] = {}
    for key, value in scope.get("headers", ()):
        name = key.lower()
        if name not in {b"traceparent", b"tracestate"}:
            continue
        name = name.decode("ascii")
        if name in result:
            return {}
        result[name] = value.decode("latin-1")
    return result


class _TracingMiddleware:
    def __init__(self, app: "ASGIApp", *, trusted_headers: bool):
        self.app = app
        self.trusted_headers = trusted_headers

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] != "http" or not tracing._runtime.enabled:
            await self.app(scope, receive, send)
            return
        method = scope.get("method", "")
        method = method if method in _METHODS else "_OTHER"
        status: int | None = None

        async def traced_send(message: "Message") -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        carrier = _carrier(scope) if self.trusted_headers else {}
        with tracing.receive_context(carrier, trusted=self.trusted_headers):
            with tracing.trace(
                method, kind="server", attributes={"http.method": method}
            ):
                try:
                    await self.app(scope, receive, traced_send)
                except Exception:
                    # ServerErrorMiddleware convierte el error fuera de este
                    # middleware. El span debe conservar ese 500 implícito.
                    if status is None:
                        status = 500
                    raise
                finally:
                    route = getattr(scope.get("route"), "path", None)
                    tracing._runtime.http_response(method, route, status)


def instrument(
    app: "FastAPI", config: TracingConfig | None, *, trusted_headers: bool
) -> None:
    from fastapi import FastAPI

    if not isinstance(app, FastAPI):
        raise TypeError("instrument_fastapi requiere una aplicación FastAPI")
    if type(trusted_headers) is not bool:
        raise ValueError("trusted_headers debe ser booleano")
    declaration = (config, trusted_headers)
    with _registration_lock:
        previous = getattr(app.state, "_tpp_tracing", None)
        if previous is not None:
            if previous != declaration:
                raise ValueError("La aplicación ya tiene otra configuración de tracing")
            return
        if app.middleware_stack is not None:
            raise RuntimeError("Instrumentar FastAPI antes de servir peticiones")
        if getattr(app, "_is_instrumented_by_opentelemetry", False):
            raise RuntimeError("Retirar la instrumentación OpenTelemetry previa")
        original_lifespan = app.router.lifespan_context

        @asynccontextmanager
        async def lifespan(application):
            resolved_config = TracingConfig.from_env() if config is None else config
            await asyncio.to_thread(
                tracing._runtime.initialize_application, application, resolved_config
            )
            try:
                async with original_lifespan(application) as state:
                    yield state
            finally:
                if not await asyncio.to_thread(tracing.shutdown):
                    _logger.warning("tracing_shutdown_incomplete")

        app.add_middleware(_TracingMiddleware, trusted_headers=trusted_headers)
        app.router.lifespan_context = lifespan
        app.state._tpp_tracing = declaration
