import io
import socket

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from tpp_observability import tracing

app = FastAPI(title="FIUBA TPP API")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
tracing.instrument_fastapi(app)

# Configuración de MinIO
minio_client = None
try:
    from minio import Minio

    minio_client = Minio(
        "minio:9000",
        access_key="minioadmin",
        secret_key="minioadminpassword",
        secure=False,
    )
except Exception as e:
    print(f"Aviso MinIO: {e}")


@tracing.traced("infrastructure.check_tcp", kind="client")
def check_tcp_service(host: str, port: int) -> str:
    """Verifica conectividad TCP directa con contenedores internos"""
    tracing.set_attributes({"server.address": host, "server.port": port})
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1.5)
            result = sock.connect_ex((host, port))
        if result != 0:
            tracing.record_error(OSError())
        return "ONLINE" if result == 0 else "OFFLINE"
    except Exception as error:
        tracing.record_error(error)
        return "OFFLINE"


@app.get("/")
def read_root():
    """Redirige la raíz a la documentación de Swagger"""
    return RedirectResponse(url="/docs")


@app.get("/health")
def health_check():
    """Estado de salud integral de la infraestructura TPP"""
    services = {
        "postgres": check_tcp_service("postgres", 5432),
        "rabbitmq": check_tcp_service("rabbitmq", 5672),
        "redis": check_tcp_service("redis_keycloak", 6379),
        "minio": check_tcp_service("minio", 9000),
        "otel": check_tcp_service("otel-collector", 4317),
    }

    # Excluimos 'otel' de los servicios críticos que determinan si la app está ONLINE
    critical_services = [
        services["postgres"],
        services["rabbitmq"],
        services["redis"],
        services["minio"],
    ]
    overall = (
        "ONLINE"
        if all(status == "ONLINE" for status in critical_services)
        else "DEGRADED"
    )

    return {"status": overall, "service": "backend-api", "dependencies": services}


@app.get("/files")
def list_files():
    """Lista los archivos almacenados en tpp-bucket"""
    if not minio_client:
        raise HTTPException(status_code=500, detail="Cliente MinIO no disponible")
    try:
        with tracing.trace(
            "storage.list_objects",
            kind="client",
            attributes={
                "app.component": "object-storage",
                "app.operation": "list_objects",
            },
        ):
            # MinIO ejecuta la petición al consumir el iterador.
            file_list = [
                obj.object_name for obj in minio_client.list_objects("tpp-bucket")
            ]
        return {"bucket": "tpp-bucket", "files": file_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/files/test-upload")
def create_test_file():
    """Crea un archivo de prueba en MinIO desde el Backend"""
    if not minio_client:
        raise HTTPException(status_code=500, detail="Cliente MinIO no disponible")
    try:
        content = b"Archivo generado desde FastAPI TPP"
        data = io.BytesIO(content)
        with tracing.trace(
            "storage.put_object",
            kind="client",
            attributes={
                "app.component": "object-storage",
                "app.operation": "put_object",
            },
        ):
            minio_client.put_object(
                "tpp-bucket",
                "test-api.txt",
                data,
                len(content),
                content_type="text/plain",
            )
        return {"message": "Archivo test-api.txt creado en tpp-bucket con exito"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
