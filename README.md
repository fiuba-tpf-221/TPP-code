# 🛠️ Stack de Infraestructura y Observabilidad (IaC)

Este repositorio contiene la arquitectura completa e integrada de microservicios, almacenamiento, mensajería y el stack de observabilidad distribuida. Todo el sistema está orquestado mediante **Infrastructure as Code (IaC)** con Docker Compose, garantizando que el entorno sea completamente *plug-and-play* para cualquier miembro del equipo.

---

## 📋 Matriz Completa de Servicios, Puertos y Credenciales

| Servicio | Tecnología | Puerto Host | Puerto Contenedor | Credenciales / Entorno | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend API** | FastAPI | `8000` | `8000` | N/A | API REST instrumentada con OpenTelemetry. |
| **Database** | PostgreSQL | `5432` | `5432` | **User:** `postgres`<br>**Pass:** `postgres`<br>**DB:** `tpp_db` | Base de datos relacional principal. |
| **Cache** | Redis | `6379` | `6379` | *Sin contraseña* | Sistema de cache en memoria y broker ligero. |
| **Message Queue**| RabbitMQ | `5672`<br>`15672` | `5672`<br>`15672` | **User:** `guest`<br>**Pass:** `guest` | Cola de mensajes. El puerto `15672` expone la Consola Web de Administración. |
| **Object Storage**| MinIO | `9000`<br>`9001` | `9000`<br>`9001` | **User:** `minioadmin`<br>**Pass:** `minioadmin` | Storage de objetos compatible con AWS S3. El puerto `9001` expone la consola web. |
| **Collector** | OTel Collector | `4317`<br>`4318` | `4317`<br>`4318` | N/A | Colector OpenTelemetry. Recibe trazas y métricas por gRPC (`4317`) y HTTP (`4318`). |
| **Traces UI** | Jaeger | `16686` | `16686` | N/A | Interfaz web para inspección y búsqueda de trazas distribuidas. |
| **Metrics DB** | Prometheus | `9090` | `9090` | N/A | Base de datos de series temporales para recolección de métricas. |
| **Dashboards** | Grafana (`10.4.2`)| `3001` | `3000` | **User:** `admin`<br>**Pass:** `admin` | Visualizador de métricas aprovisionado 100% automáticamente por código. |

---

## 🏗️ Arquitectura del Sistema

```text
                               ┌───────────────┐
                               │  FastAPI App  │ (Backend)
                               └───────┬───────┘
                                       │ (OTLP gRPC :4317)
                                       ▼
                           ┌──────────────────────┐
                           │ OpenTelemetry-Collector│
                           └───────────┬──────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   │ (Traces)                              │ (Metrics)
                   ▼                                       ▼
           ┌───────────────┐                       ┌───────────────┐
           │    Jaeger     │                       │  Prometheus   │
           │    (:16686)   │                       │    (:9090)    │
           └───────────────┘                       └───────┬───────┘
                                                           │
                                                           ▼
                                                   ┌───────────────┐
                                                   │    Grafana    │
                                                   │    (:3001)    │
                                                   └───────────────┘
```

---

## 📁 Estructura del Repositorio

```text
.
├── docker-compose.yml
├── backend/                        # Código fuente de FastAPI con SDK de OpenTelemetry
├── prometheus/
│   └── prometheus.yml              # Configuración de targets de scraping
├── otel/
│   └── otel-collector-config.yaml  # Ruteo y procesamiento de trazas/métricas
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yaml     # Aprovisionamiento automático de la fuente de datos
        └── dashboards/
            ├── dashboards.yaml     # Configuración del proveedor de tableros
            └── tpp-infra.json      # Código JSON del Dashboard preconfigurado
```

---

## ⚙️ Aprovisionamiento Automático (IaC)

### 1. Conexión de Datos en Grafana (`datasources/prometheus.yaml`)
Grafana registra de manera automática a Prometheus como su fuente de datos predeterminada utilizando el identificador `uid: prometheus-tpp`, apuntando al contenedor interno `http://prometheus:9090`.

### 2. Tableros Preconfigurados (`dashboards/tpp-infra.json`)
Al levantar el proyecto, Grafana crea la carpeta **"TPP Project"** y carga el tablero **"TPP - Infraestructura"**, dejando un gráfico de estado activo listo sin necesidad de interacción manual en la GUI.

---

## 🚀 Guía de Inicio Rápido (Quickstart)

### 1. Levantar la Infraestructura Completa
Asegúrate de estar en la raíz del proyecto y ejecuta:

```bash
docker compose up -d
```

### 2. Verificar los Servicios
Accede a las siguientes URLs en tu navegador para confirmar el correcto funcionamiento de los componentes:

- 📄 **Documentación FastAPI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- 🐰 **Consola RabbitMQ:** [http://localhost:15672](http://localhost:15672) (User/Pass: `guest`/`guest`)
- 🪣 **Consola MinIO:** [http://localhost:9001](http://localhost:9001) (User/Pass: `minioadmin`/`minioadmin`)
- 🕵️ **Consola Jaeger (Trazas):** [http://localhost:16686](http://localhost:16686)
- 📊 **Consola Prometheus (Métricas):** [http://localhost:9090](http://localhost:9090)
- 📈 **Grafana (Dashboards):** [http://localhost:3001](http://localhost:3001) (User/Pass: `admin`/`admin`)

---

## 👨‍💻 Guía de Handover para el Equipo de Desarrollo

### ¿Cómo agregar nuevas métricas de backend al Dashboard de Grafana?

Toda la infraestructura y tuberías de datos ya están configuradas. Para visualizar nuevas métricas creadas en FastAPI:

1. **Exponer la métrica en la aplicación FastAPI** utilizando el SDK de Prometheus/OpenTelemetry.
2. Abrir el archivo local **`grafana/provisioning/dashboards/tpp-infra.json`**.
3. Buscar la sección `"targets"` dentro del panel y cambiar la consulta `"expr"`:
   ```json
   "targets": [
     {
       "datasource": {
         "type": "prometheus",
         "uid": "prometheus-tpp"
       },
       "expr": "nombre_de_tu_metrica_nueva",
       "refId": "A"
     }
   ]
   ```
4. Guardar los cambios en Git y reiniciar Grafana:
   ```bash
   docker compose restart grafana
   ```

---

## 🔧 Solución de Problemas Frecuentes

### Reinicio Limpio de Grafana (Descarte de caches o volúmenes viejos)
Si en algún momento necesitas recrear el estado de Grafana eliminando datos locales guardados:

```bash
docker compose rm -s -f -v grafana
docker compose up -d grafana
```

### Inspección de logs de aprovisionamiento
Para verificar que Grafana cargó correctamente los archivos de configuración:

```bash
docker compose logs grafana | grep -i provision
