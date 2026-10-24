// Dónde viven los servicios de infraestructura (puertos publicados en docker-compose.yml).
// Las URLs se arman con el host desde el que se abrió la app: funciona igual con localhost o con una IP de la red.
const host = window.location.hostname;
const at = (port, path = '') => `http://${host}:${port}${path}`;

// Para apuntar a otro backend: REACT_APP_BACKEND_URL en frontend/.env (se aplica al construir la imagen).
export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || at(8000)).replace(/\/$/, '');

// Tarjetas de "Estado de la infraestructura base". El backend informa Postgres, RabbitMQ y Redis en GET /health;
// Keycloak y MinIO se consultan desde el navegador.
export const INFRA_CARDS = [
  { id: 'keycloak', name: 'Keycloak Auth', port: 8080 },
  { id: 'minio', name: 'MinIO S3', port: 9002 },
  { id: 'backend', name: 'FastAPI Backend', port: 8000 },
  { id: 'postgres', name: 'PostgreSQL', port: 5432 },
  { id: 'rabbitmq', name: 'RabbitMQ', port: 5672 },
  { id: 'redis', name: 'Redis Cache', port: 6380 },
];

// Keycloak: servicio de autenticación (mismo realm y cliente que usa la infraestructura del equipo).
export const KEYCLOAK = {
  url: (process.env.REACT_APP_KEYCLOAK_URL || at(8080)).replace(/\/$/, ''),
  realm: process.env.REACT_APP_KEYCLOAK_REALM || 'tpp-realm',
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'frontend-client',
};

export const INFRA_PROBES = {
  keycloak: `${KEYCLOAK.url}/realms/${KEYCLOAK.realm}`,
  minio: at(9002, '/minio/health/live'),
};

// Consolas de administración y monitoreo (se abren en otra pestaña).
export const CONSOLES = [
  { id: 'grafana', name: 'Grafana Dashboards', url: at(3001), desc: 'Métricas e indicadores', icon: 'dashboard' },
  { id: 'rabbitmq', name: 'RabbitMQ Console', url: at(15672), desc: 'Gestor de colas de mensajes', icon: 'queue' },
  { id: 'minio', name: 'MinIO Console', url: at(9001), desc: 'Explorador S3 / Buckets', icon: 'storage' },
  { id: 'jaeger', name: 'Jaeger Tracing', url: at(16686), desc: 'Trazado distribuido', icon: 'trace' },
  { id: 'prometheus', name: 'Prometheus Metrics', url: at(9090), desc: 'Servidor de métricas', icon: 'metrics' },
  { id: 'sonarqube', name: 'SonarQube Quality', url: at(9000), desc: 'Análisis estático de código', icon: 'quality' },
];
