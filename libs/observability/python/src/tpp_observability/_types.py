"""Contratos de datos públicos, independientes del SDK y de sus adaptadores."""

from typing import Literal, Mapping, Sequence, TypeAlias

AttributeValue: TypeAlias = (
    str
    | bool
    | int
    | float
    | Sequence[str]
    | Sequence[bool]
    | Sequence[int]
    | Sequence[float]
)
Attributes: TypeAlias = Mapping[str, AttributeValue]
SpanKind = Literal["internal", "server", "client", "producer", "consumer"]
