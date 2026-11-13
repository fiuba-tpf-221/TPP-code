"""W3C Trace Context: sin baggage, transporte ni identificadores propios."""

from typing import Mapping, Sequence

from opentelemetry import context, trace
from opentelemetry.trace import Link
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

_PROPAGATOR = TraceContextTextMapPropagator()


def headers(*, propagate_tracestate: bool = False) -> dict[str, str]:
    carrier: dict[str, str] = {}
    _PROPAGATOR.inject(carrier)
    if not propagate_tracestate:
        carrier.pop("tracestate", None)
    return carrier


def extract(
    carrier: Mapping[str, object],
    *,
    trusted: bool = True,
    propagate_tracestate: bool = False,
) -> context.Context:
    """Validar el carrier sin interpretar ni retener payloads de aplicación."""
    normalized: dict[str, str] = {}
    if trusted:
        for name, value in carrier.items():
            if not isinstance(name, str) or name.lower() not in {
                "traceparent",
                "tracestate",
            }:
                continue
            name = name.lower()
            if name == "tracestate" and not propagate_tracestate:
                continue
            # Campos duplicados, tipos AMQP inesperados y valores demasiado
            # largos no deben causar errores ni aceptar un padre ambiguo.
            if name in normalized or not isinstance(value, str) or len(value) > 512:
                return context.Context()
            normalized[name] = value
    # Una entrada ausente/inválida inicia una raíz, sin heredar contexto local
    # ajeno a la petición/mensaje que se está recibiendo.
    return _PROPAGATOR.extract(normalized, context=context.Context())


def links(
    carriers: Sequence[Mapping[str, object]], *, propagate_tracestate: bool = False
) -> list[Link]:
    result = []
    for carrier in carriers:
        span_context = trace.get_current_span(
            extract(carrier, propagate_tracestate=propagate_tracestate)
        ).get_span_context()
        if span_context.is_valid:
            result.append(Link(span_context))
    return result
