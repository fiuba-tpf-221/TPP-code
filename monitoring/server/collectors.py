"""Sondas independientes y métricas de PostgreSQL con transacciones de lectura."""

import asyncio
import logging
import os
import time
from contextlib import closing

import httpx
import psycopg2
from prometheus_client import CollectorRegistry, Gauge, generate_latest

from .config import DATABASE, HTTP_SERVICES, POSTGRES_STORAGE, TCP_SERVICES


def storage_snapshot() -> dict:
    """Mide el filesystem del volumen PostgreSQL, sin leer archivos del clúster.

    La capacidad puede ser compartida con otros volúmenes de Docker. No equivale
    a una cuota de PostgreSQL ni al tamaño de sus tablas.
    """
    try:
        # Evita reportar el disco de la imagen si el volumen no fue montado.
        if not POSTGRES_STORAGE.is_mount():
            return {"available": False, "error": "No se montó el volumen de PostgreSQL."}
        stats = os.statvfs(POSTGRES_STORAGE)
        total = stats.f_blocks * stats.f_frsize
        if total <= 0:
            return {"available": False, "error": "El volumen no informa capacidad."}
        free = stats.f_bfree * stats.f_frsize
        return {
            "available": True,
            "totalBytes": total,
            "usedBytes": total - free,
            "freeBytes": free,
            "availableBytes": stats.f_bavail * stats.f_frsize,
            "observedAt": time.time(),
        }
    except OSError:
        return {"available": False, "error": "No se pudo consultar el almacenamiento de PostgreSQL."}


def database_snapshot() -> dict:
    """Consulta tamaños y conexiones de PostgreSQL con una credencial de solo lectura."""
    if not DATABASE["password"]:
        return {
            "configured": False,
            "available": False,
            "error": "Falta configurar el usuario de monitoreo de PostgreSQL.",
            "databases": [],
        }
    try:
        with (
            closing(psycopg2.connect(**DATABASE)) as connection,
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "SELECT d.datname, pg_database_size(d.oid), s.numbackends "
                "FROM pg_database d JOIN pg_stat_database s ON s.datid = d.oid "
                "WHERE d.datallowconn AND NOT d.datistemplate ORDER BY d.datname"
            )
            databases = [
                {"name": name, "bytes": size, "connections": connections}
                for name, size, connections in cursor.fetchall()
            ]
            cursor.execute("SHOW max_connections")
            maximum = int(cursor.fetchone()[0])
        return {
            "configured": True,
            "available": True,
            "databases": databases,
            "maxConnections": maximum,
            "observedAt": time.time(),
        }
    except (psycopg2.Error, OSError, ValueError):
        return {
            "configured": True,
            "available": False,
            "error": "No se pudo leer PostgreSQL con la credencial de monitoreo.",
            "databases": [],
        }


class Monitor:
    """Recolector independiente que conserva la última observación de cada fuente."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        """Prepara el estado y un registro de métricas exclusivo de la central."""
        self.client = client
        self.snapshot = {
            "checkedAt": None,
            "services": [],
            "storage": {"available": False},
            "database": {
                "configured": bool(DATABASE["password"]),
                "available": False,
                "databases": [],
            },
        }
        self.registry = CollectorRegistry()
        self.up = Gauge(
            "tpp_service_up",
            "Resultado de la última sonda configurada",
            ["service", "kind"],
            registry=self.registry,
        )
        self.duration = Gauge(
            "tpp_service_probe_duration_seconds",
            "Duración de la sonda",
            ["service"],
            registry=self.registry,
        )
        self.checked = Gauge(
            "tpp_service_last_check_timestamp_seconds",
            "Instante de la última sonda",
            ["service"],
            registry=self.registry,
        )
        self.db_ok = Gauge(
            "tpp_database_collection_success",
            "Consulta de métricas SQL exitosa",
            registry=self.registry,
        )
        self.db_size = Gauge(
            "tpp_database_size_bytes",
            "Tamaño de la base, no capacidad libre del disco",
            ["database"],
            registry=self.registry,
        )
        self.db_connections = Gauge(
            "tpp_database_connections",
            "Conexiones observadas por base",
            ["database"],
            registry=self.registry,
        )
        self.db_max = Gauge(
            "tpp_postgres_max_connections",
            "Máximo de conexiones configurado",
            registry=self.registry,
        )
        self.storage_bytes = Gauge(
            "tpp_postgres_storage_bytes",
            "Capacidad del filesystem que contiene PostgreSQL; puede ser compartida",
            ["kind"],
            registry=self.registry,
        )

    async def http_probe(self, spec) -> dict:
        """Comprueba un endpoint HTTP y, cuando corresponde, su estado semántico."""
        identifier, name, url, expected = spec
        started = time.monotonic()
        try:
            response = await self.client.get(url, timeout=3)
            healthy = response.is_success
            if healthy and expected:
                body = response.json()
                healthy = (
                    isinstance(body, dict) and body.get(expected[0]) == expected[1]
                )
            error = None if healthy else "La comprobación HTTP no está saludable."
        except (httpx.HTTPError, ValueError):
            healthy, error = False, "El servicio no respondió a la sonda HTTP."
        return {
            "id": identifier,
            "name": name,
            "kind": "HTTP",
            "up": healthy,
            "latencyMs": (time.monotonic() - started) * 1000,
            "error": error,
        }

    async def tcp_probe(self, spec) -> dict:
        """Comprueba la aceptación de conexiones TCP y cierra el socket utilizado."""
        identifier, name, host, port = spec
        started = time.monotonic()
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=3
            )
            writer.close()
            await asyncio.wait_for(writer.wait_closed(), timeout=1)
            healthy = True
        except (OSError, asyncio.TimeoutError):
            healthy = False
        return {
            "id": identifier,
            "name": name,
            "kind": "TCP",
            "up": healthy,
            "latencyMs": (time.monotonic() - started) * 1000,
            "error": None if healthy else "No acepta conexiones TCP.",
        }

    async def collect(self) -> None:
        """Actualiza sondas y métricas concurrentemente, marcando las observaciones antiguas."""
        results = await asyncio.gather(
            *(self.http_probe(spec) for spec in HTTP_SERVICES),
            *(self.tcp_probe(spec) for spec in TCP_SERVICES),
            asyncio.to_thread(database_snapshot),
            asyncio.to_thread(storage_snapshot),
        )
        services, database, storage = results[:-2], results[-2], results[-1]
        now = time.time()
        for service in services:
            self.up.labels(service["id"], service["kind"]).set(int(service["up"]))
            self.duration.labels(service["id"]).set(service["latencyMs"] / 1000)
            self.checked.labels(service["id"]).set(now)
        self.db_ok.set(int(database["available"]))
        self.db_size.clear()
        self.db_connections.clear()
        if database["available"]:
            for item in database["databases"]:
                self.db_size.labels(item["name"]).set(item["bytes"])
                self.db_connections.labels(item["name"]).set(item["connections"])
            self.db_max.set(database["maxConnections"])
        else:
            # Un dato antiguo nunca se publica como una medición actual.
            self.db_max.set(float("nan"))
            previous = self.snapshot["database"]
            if previous.get("databases"):
                database.update(
                    databases=previous["databases"],
                    observedAt=previous.get("observedAt"),
                    stale=True,
                )
        self.storage_bytes.clear()
        if storage["available"]:
            for kind in ("total", "used", "free", "available"):
                self.storage_bytes.labels(kind).set(storage[f"{kind}Bytes"])
        self.snapshot = {
            "checkedAt": now, "services": services,
            "database": database, "storage": storage,
        }

    async def run(self) -> None:
        """Recolecta periódicamente y aísla fallos sin detener la central."""
        while True:
            try:
                await self.collect()
            except Exception:
                # Conservar la UI sin publicar la última muestra como actual.
                self.snapshot = {**self.snapshot, "collectionError": True}
                self.up.clear()
                self.duration.clear()
                self.checked.clear()
                self.db_size.clear()
                self.db_connections.clear()
                self.db_ok.set(0)
                self.db_max.set(float("nan"))
                self.storage_bytes.clear()
                logging.getLogger(__name__).warning("monitoring_collection_failed")
            await asyncio.sleep(15)

    def metrics(self) -> bytes:
        """Serializa el registro propio en el formato de exposición de Prometheus."""
        return generate_latest(self.registry)
