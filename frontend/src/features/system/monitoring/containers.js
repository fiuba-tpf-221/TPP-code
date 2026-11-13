// Conserva la identidad del contenedor para filtrar CPU y memoria juntas.
export const containerKey = (labels) =>
  labels.name?.replace(/^\//, '') ||
  labels.container_label_com_docker_compose_service ||
  labels.id || '';

const NAMES = {
  backend: 'Backend API',
  frontend: 'Frontend',
  postgres: 'PostgreSQL',
  rabbitmq: 'RabbitMQ',
  redis_keycloak: 'Redis',
  minio: 'MinIO',
  'minio-setup': 'Inicialización de MinIO',
  keycloak: 'Keycloak',
  'keycloak-setup': 'Inicialización de Keycloak',
  jaeger: 'Jaeger',
  otel_collector: 'OpenTelemetry Collector',
  'otel-collector': 'OpenTelemetry Collector',
  prometheus: 'Prometheus',
  grafana: 'Grafana',
  cadvisor: 'cAdvisor',
  nginx: 'Nginx',
  sonarqube: 'SonarQube',
  monitoring: 'Central de monitoreo',
};

export const containerName = (key) => {
  const name = key.replace(/^\//, '').replace(/^app_/, '');
  // Sin metadatos no se puede deducir el servicio a partir del ID.
  if (/^(docker\/)?[a-f0-9]{12,64}$/.test(name))
    return `Sin nombre (${name.replace(/^docker\//, '').slice(0, 12)})`;
  return NAMES[name] || name;
};

export const serviceContainer = (id) =>
  `app_${({ collector: 'otel_collector', redis: 'redis_keycloak' })[id] || id}`;

export const matchesContainer = (labels, selected) =>
  !selected || containerKey(labels) === selected ||
  containerName(containerKey(labels)) === containerName(selected);
