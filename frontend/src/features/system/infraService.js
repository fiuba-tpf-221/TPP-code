import { BACKEND_URL, INFRA_PROBES } from '../../config/services';
import { FEATURES } from '../../config/features';

const TIMEOUT_MS = 4000;
const KNOWN = ['ONLINE', 'DEGRADED', 'OFFLINE'];
const normalize = (status) => (KNOWN.includes(status) ? status : 'UNKNOWN');

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Keycloak y MinIO no habilitan CORS para esta app: con `no-cors` solo se puede saber si responden
// (no se lee el contenido ni el código HTTP).
async function probe(url) {
  try {
    await request(url, { mode: 'no-cors' });
    return 'ONLINE';
  } catch {
    return 'OFFLINE';
  }
}

// GET /health del backend -> { status, dependencies: { postgres, rabbitmq, redis, minio, otel } }
async function backendHealth() {
  try {
    const res = await request(`${BACKEND_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dep = (name) => normalize(data.dependencies?.[name]);
    return { backend: normalize(data.status), postgres: dep('postgres'), rabbitmq: dep('rabbitmq'), redis: dep('redis') };
  } catch {
    // Si el backend no responde, no se puede saber cómo están las dependencias que él consulta: "sin datos".
    return { backend: 'OFFLINE', postgres: 'UNKNOWN', rabbitmq: 'UNKNOWN', redis: 'UNKNOWN' };
  }
}

const ONLINE = { keycloak: 'ONLINE', minio: 'ONLINE', backend: 'ONLINE', postgres: 'ONLINE', rabbitmq: 'ONLINE', redis: 'ONLINE' };

// Modo simulado: escenarios para ver cómo se muestra cada estado sin apagar contenedores.
export const SIMULATED_SCENARIOS = {
  ok: { label: 'Todo en línea', result: ONLINE },
  degraded: { label: 'Backend degradado (RabbitMQ caído)', result: { ...ONLINE, backend: 'DEGRADED', rabbitmq: 'OFFLINE' } },
  'backend-down': {
    label: 'Backend caído',
    result: { ...ONLINE, backend: 'OFFLINE', postgres: 'UNKNOWN', rabbitmq: 'UNKNOWN', redis: 'UNKNOWN' },
  },
  'keycloak-down': { label: 'Keycloak caído', result: { ...ONLINE, keycloak: 'OFFLINE' } },
};

// Devuelve { keycloak, minio, backend, postgres, rabbitmq, redis } con ONLINE | DEGRADED | OFFLINE | UNKNOWN.
// Con FEATURES.SIMULATE_INFRA no consulta nada: devuelve el escenario elegido.
export async function checkInfrastructure(scenario = 'ok') {
  if (FEATURES.SIMULATE_INFRA) {
    // Una pausa breve para que se vea "Verificando…" como con los servicios reales (en los tests no se espera).
    if (process.env.NODE_ENV !== 'test') await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...(SIMULATED_SCENARIOS[scenario] ?? SIMULATED_SCENARIOS.ok).result };
  }
  const [keycloak, minio, backend] = await Promise.all([
    probe(INFRA_PROBES.keycloak), probe(INFRA_PROBES.minio), backendHealth(),
  ]);
  return { keycloak, minio, ...backend };
}
