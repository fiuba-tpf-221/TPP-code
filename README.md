# 🛠️ Stack de Infraestructura y Observabilidad (IaC)

Este repositorio contiene la arquitectura completa e integrada de microservicios, almacenamiento, mensajería y el stack de observabilidad distribuida. Todo el sistema está orquestado mediante **Infrastructure as Code (IaC)** con Docker Compose, garantizando que el entorno sea completamente *plug-and-play* para cualquier miembro del equipo.

La [guía de la biblioteca interna de tracing](libs/observability/python/README.md) describe la interfaz
común que usa el backend, su configuración, propagación y cierre. OpenTelemetry
queda encapsulado en `tpp-observability`; las trazas se envían al Collector y Jaeger.

La [central de monitoreo](http://localhost:3002) reúne servicios, PostgreSQL,
métricas, paneles de Grafana y trazas con una interfaz propia basada en la rama
`Frontend`. Se ejecuta en un contenedor y proyecto Compose independientes del
backend y frontend. La guía enlazada arriba concentra su configuración y límites.

---

## 📋 Matriz Completa de Servicios, Puertos y Credenciales

| Servicio | Tecnología | Puerto Host | Puerto Contenedor | Credenciales / Entorno | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Central de monitoreo** | React + FastAPI propios | `3002` | `8080` | Acceso local | Compose independiente en `monitoring/docker-compose.yml`. |
| **Backend API** | FastAPI | `8000` | `8000` | N/A | API REST instrumentada con OpenTelemetry. |
| **Database** | PostgreSQL | `5432` | `5432` | **User:** `user`<br>**Pass:** `password`<br>**DB:** `appdb` | Base de datos relacional principal. |
| **Cache** | Redis | `6380` | `6379` | *Sin contraseña* | Caché de Keycloak. |
| **Message Queue**| RabbitMQ | `5673`<br>`15673` | `5672`<br>`15672` | **User:** `user`<br>**Pass:** `password` | AMQP desde el host en `5673`; consola web en `15673`. Entre contenedores usar `rabbitmq:5672`. |
| **Object Storage**| MinIO | `9002`<br>`9001` | `9000`<br>`9001` | **User:** `minioadmin`<br>**Pass:** `minioadminpassword` | Storage de objetos compatible con AWS S3. El puerto `9001` expone la consola web. |
| **Collector** | OTel Collector | `8888`<br>`8889` | `4317/4318` (OTLP interno)<br>`8888/8889` (métricas) | N/A | Recibe trazas OTLP; publica métricas internas y métricas OTLP recibidas. |
| **Traces UI** | Jaeger | `16686` | `16686` | N/A | Interfaz web para inspección y búsqueda de trazas distribuidas. |
| **Metrics DB** | Prometheus | `9090` | `9090` | N/A | Base de datos de series temporales para recolección de métricas. |
| **Dashboards** | Grafana (`10.4.2`)| `3001` | `3000` | **User:** `admin`<br>**Pass:** `admin` | Visualizador de métricas aprovisionado 100% automáticamente por código. |

---

## 🏗️ Arquitectura del Sistema

```text
Backend → tpp-observability → Collector → Jaeger       (trazas activas)
cAdvisor → Prometheus                                (recursos)
Collector :8888 → Prometheus                         (métricas internas)
Central /metrics → Prometheus                        (sondas y métricas SQL)
Grafana → Prometheus                                 (consultas de paneles)

Central independiente :3002
  ├── consulta Jaeger y Prometheus
  ├── lee los paneles JSON aprovisionados de Grafana
  └── sondea servicios y consulta estadísticas de PostgreSQL
```

El pipeline OTLP de métricas está configurado, pero el backend actual solo emite
trazas. La central conserva su proceso si cae el backend o frontend; comparte
el host Docker y depende de cada proveedor para consultar sus datos.

---

## 📁 Estructura del Repositorio

```text
.
├── docker-compose.yml
├── backend/                        # FastAPI; consume la interfaz pública de tracing
├── libs/observability/python/      # Biblioteca y guía de observabilidad
├── monitoring/                     # Central independiente: servidor, UI y Compose
├── prometheus/
│   └── prometheus.yml              # Configuración de targets de scraping
├── otel/
│   └── otel-collector.yaml         # Ruteo y procesamiento de trazas/métricas
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
# Infraestructura y aplicación principales
docker compose up -d --build

# Solo la central: consume los servicios existentes del Compose principal
docker compose -f monitoring/docker-compose.yml up -d --build monitoring
```

### 2. Verificar los Servicios
Accede a las siguientes URLs en tu navegador para confirmar el correcto funcionamiento de los componentes:

- **Central de monitoreo:** [http://localhost:3002](http://localhost:3002)
- 📄 **Documentación FastAPI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- 🐰 **Consola RabbitMQ:** [http://localhost:15673](http://localhost:15673) (User/Pass: `user`/`password`)
- 🪣 **Consola MinIO:** [http://localhost:9001](http://localhost:9001) (User/Pass: `minioadmin`/`minioadminpassword`)
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
