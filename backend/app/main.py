from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import socket
import io

# --- Configuración de OpenTelemetry ---
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource

    # Definimos el nombre del servicio para Jaeger
    resource = Resource.create(attributes={"service.name": "backend-api"})
    provider = TracerProvider(resource=resource)
    
    # 1. Exportador a consola (imprime las trazas en los logs de Docker para depurar)
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    
    # 2. Exportador OTLP hacia otel-collector (agregado el prefijo http://)
    otlp_exporter = OTLPSpanExporter(endpoint="http://otel-collector:4317", insecure=True)
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    
    trace.set_tracer_provider(provider)
    otel_enabled = True
except Exception as e:
    print(f"Aviso OpenTelemetry: {e}")
    otel_enabled = False

app = FastAPI(title="FIUBA TPP API")

# Instrumentar la app de FastAPI si Otel cargó correctamente
if otel_enabled:
    FastAPIInstrumentor.instrument_app(app)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de MinIO
minio_client = None
try:
    from minio import Minio
    minio_client = Minio(
        "minio:9000",
        access_key="minioadmin",
        secret_key="minioadminpassword",
        secure=False
    )
except Exception as e:
    print(f"Aviso MinIO: {e}")

def check_tcp_service(host: str, port: int) -> str:
    """Verifica conectividad TCP directa con contenedores internos"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.5)
        result = sock.connect_ex((host, port))
        sock.close()
        return "ONLINE" if result == 0 else "OFFLINE"
    except Exception:
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
    critical_services = [services["postgres"], services["rabbitmq"], services["redis"], services["minio"]]
    overall = "ONLINE" if all(status == "ONLINE" for status in critical_services) else "DEGRADED"
    
    return {
        "status": overall,
        "service": "backend-api",
        "dependencies": services
    }

@app.get("/files")
def list_files():
    """Lista los archivos almacenados en tpp-bucket"""
    if not minio_client:
        raise HTTPException(status_code=500, detail="Cliente MinIO no disponible")
    try:
        objects = minio_client.list_objects("tpp-bucket")
        file_list = [obj.object_name for obj in objects]
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
        minio_client.put_object(
            "tpp-bucket",
            "test-api.txt",
            data,
            len(content),
            content_type="text/plain"
        )
        return {"message": "Archivo test-api.txt creado en tpp-bucket con exito"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
