# La UI se mudó al frontend principal (:3000 -> Sistema / Auditoría): esto ya es solo la API JSON
# que esas páginas consumen cruzando orígenes (ver server/main.py -> CORSMiddleware).
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./server/

USER 65534:65534
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=2)"

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
