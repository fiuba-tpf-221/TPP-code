"""Servidor propio de la central: UI estática, sondas y consultas acotadas."""

import asyncio
import json
import math
import re
import time
from contextlib import asynccontextmanager, suppress

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .auth import require_admin
from .collectors import Monitor
from .config import (
    COLLECTOR_GAUGES,
    DASHBOARDS,
    JAEGER,
    METRICS,
    PROMETHEUS,
    SPAN_COUNTERS,
    STATIC,
)

# Todo lo que cuelga de /api expone datos de logs, trazas y métricas: requiere el rol
# administrador del mismo Keycloak que usa el front principal (ver server/auth.py).
api = APIRouter(prefix="/api", dependencies=[Depends(require_admin)])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Administra el cliente HTTP y la tarea de recolección durante la vida de la central."""
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(8, connect=2),
        limits=httpx.Limits(max_connections=20),
        follow_redirects=False,
        trust_env=False,
    ) as client:
        app.state.client = client
        app.state.monitor = Monitor(client)
        task = asyncio.create_task(app.state.monitor.run())
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


app = FastAPI(
    title="TPP Monitoring",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


async def upstream(
    request: Request, base: str, path: str, params: dict | None = None
) -> dict:
    """Consulta una fuente de lectura con timeout y errores HTTP controlados."""
    try:
        response = await request.app.state.client.get(base + path, params=params)
        if response.status_code == 404:
            raise HTTPException(404, "No se encontraron los datos solicitados.")
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "La fuente de datos no está disponible.") from None


@app.get("/healthz")
def health() -> dict:
    """Informa la disponibilidad de la central sin depender de servicios externos."""
    return {"status": "ok"}


@api.get("/overview")
async def overview(request: Request) -> dict:
    """Combina las últimas sondas con el estado de recolección de Prometheus."""
    snapshot = request.app.state.monitor.snapshot
    try:
        targets = (
            await upstream(request, PROMETHEUS, "/api/v1/targets", {"state": "active"})
        )["data"]["activeTargets"]
        scrape = [
            {
                "job": item["labels"].get("job"),
                "instance": item["labels"].get("instance"),
                "health": item["health"],
                "lastScrape": item["lastScrape"],
                "lastError": bool(item.get("lastError")),
            }
            for item in targets
        ]
        prometheus = {"available": True, "targets": scrape}
    except (HTTPException, KeyError, TypeError):
        prometheus = {
            "available": False,
            "targets": [],
            "error": "No se pudo consultar Prometheus.",
        }
    return {**snapshot, "prometheus": prometheus}


@app.get("/metrics")
def metrics(request: Request) -> Response:
    """Expone las métricas propias para que Prometheus las recolecte."""
    return Response(
        request.app.state.monitor.metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


async def prometheus_query(
    request: Request, expression: str, start: float, end: float, step: int
) -> list[dict]:
    """Normaliza una consulta temporal acotada sin convertir datos ausentes en ceros."""
    result = await upstream(
        request,
        PROMETHEUS,
        "/api/v1/query_range",
        {
            "query": expression,
            "start": start,
            "end": end,
            "step": step,
            "timeout": "5s",
        },
    )
    if (
        result.get("status") != "success"
        or result.get("data", {}).get("resultType") != "matrix"
    ):
        raise HTTPException(503, "No se pudo resolver la consulta de métricas.")
    series = []
    for item in result["data"]["result"][:40]:
        points = []
        for timestamp, raw in item.get("values", []):
            value = float(raw)
            points.append([timestamp, value if math.isfinite(value) else None])
        series.append({"labels": item.get("metric", {}), "points": points})
    return series


def time_window(start: float, end: float) -> int:
    """Valida el período y calcula el paso para limitar la cantidad de puntos."""
    if (
        not math.isfinite(start)
        or not math.isfinite(end)
        or start < 0
        or end <= start
        or end - start > 7 * 86400
        or end > time.time() + 60
    ):
        raise HTTPException(400, "El período debe ser válido y de hasta siete días.")
    return max(15, math.ceil((end - start) / 120))


@api.get("/telemetry/summary")
async def telemetry_summary(request: Request, start: float, end: float) -> dict:
    """Estima incrementos del período y consulta gauges al final de la ventana.

    increase contempla reinicios y extrapola entre scrapes; no representa un
    conteo exacto de spans únicos ni permite deducir pérdidas por diferencia.
    """
    time_window(start, end)
    seconds = math.ceil(end - start)
    expressions = {
        key: f"sum(increase({selector}[{seconds}s]))"
        for key, selector in SPAN_COUNTERS.items()
    } | COLLECTOR_GAUGES

    async def query_value(
        key: str, expression: str
    ) -> tuple[str, float | None, str | None]:
        try:
            result = await upstream(
                request, PROMETHEUS, "/api/v1/query",
                {"query": expression, "time": end, "timeout": "5s"},
            )
            if (
                result.get("status") != "success"
                or result.get("data", {}).get("resultType") != "vector"
            ):
                raise ValueError("Respuesta inválida de Prometheus")
            samples = result["data"]["result"]
            if not samples:
                return key, None, None
            value = float(samples[0]["value"][1])
            return key, value if math.isfinite(value) else None, None
        except (HTTPException, KeyError, TypeError, ValueError, IndexError):
            return key, None, "No se pudo consultar esta métrica."

    results = await asyncio.gather(
        *(query_value(key, expression) for key, expression in expressions.items())
    )
    return {
        "values": {key: value for key, value, _ in results},
        "errors": {key: error for key, _, error in results if error},
        "start": start,
        "end": end,
        "queriedAt": time.time(),
    }


@api.get("/metrics/{name}")
async def metric(name: str, request: Request, start: float, end: float) -> dict:
    """Consulta una métrica del catálogo permitido por la central."""
    if name not in METRICS:
        raise HTTPException(404, "Métrica desconocida.")
    expression, unit, title = METRICS[name]
    series = await prometheus_query(
        request, expression, start, end, time_window(start, end)
    )
    return {
        "title": title,
        "unit": unit,
        "series": series,
        "queriedAt": time.time(),
        "source": "Prometheus",
    }


def configured_dashboards() -> list[dict]:
    """Lee los paneles estáticos aprovisionados por la infraestructura principal."""
    result = []
    for path in sorted(DASHBOARDS.glob("*.json")):
        data = json.loads(path.read_text())
        panels = []
        for index, panel in enumerate(data.get("panels", [])):
            panels.append(
                {
                    "id": str(panel.get("id") or index + 1),
                    "title": panel.get("title", "Panel"),
                    "description": panel.get("description", ""),
                    "unit": panel.get("fieldConfig", {})
                    .get("defaults", {})
                    .get("unit", "short"),
                    "queries": [
                        target["expr"]
                        for target in panel.get("targets", [])
                        if target.get("expr") and not target.get("hide")
                    ],
                }
            )
        result.append(
            {
                "uid": data["uid"],
                "title": data["title"],
                "description": data.get("description", ""),
                "panels": panels,
            }
        )
    return result


@api.get("/dashboards")
def dashboards() -> dict:
    """Lista los dashboards disponibles sin exponer sus consultas internas."""
    return {
        "dashboards": [
            {
                **item,
                "panels": [
                    {k: v for k, v in panel.items() if k != "queries"}
                    for panel in item["panels"]
                ],
            }
            for item in configured_dashboards()
        ],
        "scope": "provisioned",
    }


@api.get("/dashboards/{uid}/panels/{panel_id}")
async def dashboard_panel(
    uid: str, panel_id: str, request: Request, start: float, end: float
):
    """Ejecuta únicamente las consultas registradas para el panel solicitado."""
    step = time_window(start, end)
    panel = next(
        (
            panel
            for dashboard in configured_dashboards()
            if dashboard["uid"] == uid
            for panel in dashboard["panels"]
            if panel["id"] == panel_id
        ),
        None,
    )
    if panel is None:
        raise HTTPException(404, "Panel desconocido.")
    if len(panel["queries"]) > 6 or any(
        "$" in expression for expression in panel["queries"]
    ):
        raise HTTPException(
            422, "Este panel requiere variables o una consulta no soportada."
        )
    groups = await asyncio.gather(
        *(
            prometheus_query(request, expression, start, end, step)
            for expression in panel["queries"]
        )
    )
    return {
        "title": panel["title"],
        "unit": panel["unit"],
        "series": [series for group in groups for series in group],
        "queriedAt": time.time(),
        "source": "Grafana / Prometheus",
    }


@api.get("/jaeger/services")
async def jaeger_services(request: Request):
    """Lista los servicios que ya tienen trazas almacenadas en Jaeger."""
    return await upstream(request, JAEGER, "/api/services")


@api.get("/jaeger/operations")
async def jaeger_operations(
    request: Request, service: str = Query(min_length=1, max_length=256)
):
    """Lista las operaciones del servicio seleccionado en Jaeger."""
    return await upstream(request, JAEGER, "/api/operations", {"service": service})


@api.get("/jaeger/traces")
async def jaeger_traces(
    request: Request,
    service: str = Query(min_length=1, max_length=256),
    start: int = Query(gt=0),
    end: int = Query(gt=0),
    limit: int = Query(default=200, ge=1, le=200),
    operation: str | None = Query(default=None, max_length=512),
    minDuration: str | None = Query(default=None, pattern=r"^[0-9]+(?:\.[0-9]+)?ms$"),
    tags: str | None = None,
):
    """Consulta trazas con filtros y límites validados."""
    time_window(start / 1000000, end / 1000000)
    if tags not in (None, '{"error":"true"}', '{"error": "true"}'):
        raise HTTPException(400, "Filtro de errores inválido.")
    params = {
        "service": service,
        "start": start,
        "end": end,
        "limit": limit,
        "operation": operation,
        "minDuration": minDuration,
        "tags": tags,
    }
    return await upstream(
        request,
        JAEGER,
        "/api/traces",
        {key: value for key, value in params.items() if value is not None},
    )


@api.get("/jaeger/traces/{trace_id}")
async def jaeger_trace(trace_id: str, request: Request):
    """Recupera una traza por su identificador hexadecimal."""
    if not re.fullmatch(r"(?:[0-9a-fA-F]{16}|[0-9a-fA-F]{32})", trace_id):
        raise HTTPException(400, "Trace ID inválido.")
    return await upstream(request, JAEGER, "/api/traces/" + trace_id)


app.include_router(api)

app.mount(
    "/assets", StaticFiles(directory=STATIC / "assets", check_dir=False), name="assets"
)


@app.get("/{path:path}")
def spa(path: str) -> FileResponse:
    """Sirve la interfaz y sus rutas sin capturar endpoints de API desconocidos."""
    if path.startswith("api/") or "." in path.rsplit("/", 1)[-1]:
        raise HTTPException(404, "Ruta desconocida.")
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})
