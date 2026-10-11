from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.db import get_db
from app.core.rabbitmq import get_rabbitmq_connection
from app.core.storage import get_s3_client

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    # Check Postgres
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Check RabbitMQ
    rabbitmq_status = "ok"
    try:
        conn = get_rabbitmq_connection()
        conn.close()
    except Exception as e:
        rabbitmq_status = f"error: {str(e)}"

    # Check MinIO
    minio_status = "ok"
    try:
        s3 = get_s3_client()
        s3.list_buckets()
    except Exception as e:
        minio_status = f"error: {str(e)}"

    return {
        "status": "online",
        "services": {
            "database": db_status,
            "rabbitmq": rabbitmq_status,
            "minio": minio_status
        }
    }
