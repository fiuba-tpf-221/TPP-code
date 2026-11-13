# Etapa 1: Build de la interfaz independiente
FROM node:20-alpine AS build

WORKDIR /app

COPY ui/package*.json ./
RUN npm ci

COPY ui/ ./
RUN npm run build

# Etapa 2: Servidor de lectura y archivos estáticos
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./server/
COPY --from=build /app/dist ./static/

USER 65534:65534
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=2)"

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
