"""Entrada de compatibilidad; la implementación pertenece a la biblioteca."""

from tpp_observability import tracing


def setup_telemetry() -> None:
    """Inicializar tracing para consumidores anteriores sin crear otro proveedor."""
    tracing.initialize()
