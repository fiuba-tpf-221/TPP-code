import pika
from app.config import settings

def get_rabbitmq_connection():
    parameters = pika.URLParameters(settings.RABBITMQ_URL)
    return pika.BlockingConnection(parameters)
