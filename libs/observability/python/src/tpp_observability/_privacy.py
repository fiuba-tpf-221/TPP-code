"""Lista permitida y defensa de exportación; nunca registra valores descartados."""

import math
import re
from collections.abc import Mapping

from opentelemetry.attributes import BoundedAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import Event, ReadableSpan
from opentelemetry.trace import Link, SpanContext, Status, TraceState

from ._config import TracingConfig

_DENIED_KEY = re.compile(
    r"(?:password|passwd|secret|token|authorization|credential|cookie|payload|body|"
    r"query|statement|parameter|stacktrace|exception\.message|header)",
    re.I,
)
_SENSITIVE_VALUE = re.compile(
    r"(?:\b(?:bearer|basic)\s+\S+|\beyJ[\w-]*\.[\w-]+\.[\w-]+|"
    r"(?:password|passwd|secret|token|api[_-]?key|authorization)\s*[:=]|"
    r"[a-z][a-z0-9+.-]*://[^\s]*[@?#])",
    re.I,
)


class Privacy:
    """Política por runtime; nombres permitidos exactos y denylist no anulable."""

    def __init__(self, config: TracingConfig):
        self.config = config
        self.allowed = frozenset(config.allowed_attributes)

    def text(self, value: str) -> str:
        if _SENSITIVE_VALUE.search(value):
            return "[REDACTED]"[: self.config.max_attribute_length]
        return value[: self.config.max_attribute_length]

    def attributes(self, values: Mapping | None, *, exception: bool = False) -> dict:
        result = {}
        for key, value in (values or {}).items():
            if not isinstance(key, str) or _DENIED_KEY.search(key):
                continue
            if key not in self.allowed and not (
                exception and key in {"exception.type", "exception.escaped"}
            ):
                continue
            if isinstance(value, str):
                result[key] = self.text(value)
            elif type(value) in (bool, int) or (
                type(value) is float and math.isfinite(value)
            ):
                result[key] = value
            elif isinstance(value, (tuple, list)) and value:
                items = value[: self.config.max_attributes]
                if all(type(item) is type(items[0]) for item in items) and type(
                    items[0]
                ) in (str, bool, int, float):
                    if all(
                        type(item) is not float or math.isfinite(item) for item in items
                    ):
                        result[key] = tuple(
                            self.text(item) if isinstance(item, str) else item
                            for item in items
                        )
            if len(result) >= self.config.max_attributes:
                break
        return result

    def context(self, value: SpanContext | None) -> SpanContext | None:
        if value is None or self.config.propagate_tracestate:
            return value
        return SpanContext(
            value.trace_id,
            value.span_id,
            value.is_remote,
            value.trace_flags,
            TraceState(),
        )

    def span(self, span: ReadableSpan) -> ReadableSpan:
        """Copia saneada, también para spans de futuros instrumentadores externos."""
        return ReadableSpan(
            name=self.text(span.name),
            context=self.context(span.context),
            parent=self.context(span.parent),
            resource=Resource(
                {
                    key: self.text(str(value))
                    for key, value in span.resource.attributes.items()
                    if key
                    in {"service.name", "service.version", "deployment.environment"}
                }
            ),
            attributes=self.attributes(span.attributes),
            events=[
                Event(
                    self.text(event.name),
                    # El encoder OTLP 1.22 consulta attributes.dropped. Un dict
                    # plano permite inspeccionar el span, pero falla al enviarlo.
                    BoundedAttributes(
                        maxlen=self.config.max_attributes,
                        attributes=self.attributes(
                            event.attributes, exception=event.name == "exception"
                        ),
                    ),
                    event.timestamp,
                )
                for event in span.events[-self.config.max_events :]
            ],
            links=[
                Link(self.context(link.context), self.attributes(link.attributes))
                for link in span.links[-self.config.max_links :]
            ],
            kind=span.kind,
            status=Status(span.status.status_code),
            start_time=span.start_time,
            end_time=span.end_time,
            # La descripción/métadatos de instrumentadores ajenos no se exportan.
        )
