from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FIUBA TPP - Platform API"
    API_V1_STR: str = "/api/v1"
    
    # Base de Datos PostGIS
    DATABASE_URL: str = "postgresql://user:password@postgres:5432/appdb"
    
    # Message Broker
    RABBITMQ_URL: str = "amqp://user:password@rabbitmq:5672/"
    
    # Storage MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = "minioadminpassword"
    
    # Telemetría OTel
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://otel-collector:4317"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
