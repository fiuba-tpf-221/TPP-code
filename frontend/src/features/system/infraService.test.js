import { checkInfrastructure } from './infraService';

const BACKEND = 'http://localhost:8000/health';
const health = (status, dependencies) => ({ ok: true, status: 200, json: async () => ({ status, service: 'backend-api', dependencies }) });
const allOnline = { postgres: 'ONLINE', rabbitmq: 'ONLINE', redis: 'ONLINE', minio: 'ONLINE', otel: 'ONLINE' };

// Simula la red: `routes` asigna una respuesta (o un error) a cada URL.
const network = (routes) => {
  global.fetch = jest.fn(async (url) => {
    const reply = routes[url];
    if (reply instanceof Error) throw reply;
    return reply ?? {};
  });
};
afterEach(() => { delete global.fetch; });

test('todo en línea: usa lo que informa el backend y consulta Keycloak y MinIO sin CORS', async () => {
  network({ [BACKEND]: health('ONLINE', allOnline) });
  expect(await checkInfrastructure()).toEqual({
    keycloak: 'ONLINE', minio: 'ONLINE', backend: 'ONLINE', postgres: 'ONLINE', rabbitmq: 'ONLINE', redis: 'ONLINE',
  });
  const probes = global.fetch.mock.calls.filter(([url]) => url !== BACKEND);
  expect(probes.map(([url]) => url)).toEqual([
    'http://localhost:8080/realms/tpp-realm', 'http://localhost:9002/minio/health/live',
  ]);
  probes.forEach(([, options]) => expect(options.mode).toBe('no-cors'));
});

test('el backend degradado y una dependencia caída se reflejan tal cual', async () => {
  network({ [BACKEND]: health('DEGRADED', { ...allOnline, rabbitmq: 'OFFLINE' }) });
  expect(await checkInfrastructure()).toMatchObject({ backend: 'DEGRADED', rabbitmq: 'OFFLINE', postgres: 'ONLINE' });
});

test('si el backend no responde: él figura desconectado y sus dependencias "sin datos", no "caídas"', async () => {
  network({ [BACKEND]: new Error('red caída') });
  expect(await checkInfrastructure()).toEqual({
    keycloak: 'ONLINE', minio: 'ONLINE', backend: 'OFFLINE', postgres: 'UNKNOWN', rabbitmq: 'UNKNOWN', redis: 'UNKNOWN',
  });
});

test('un error HTTP del backend se trata como backend desconectado', async () => {
  network({ [BACKEND]: { ok: false, status: 500, json: async () => ({}) } });
  expect(await checkInfrastructure()).toMatchObject({ backend: 'OFFLINE', postgres: 'UNKNOWN' });
});

test('Keycloak y MinIO se evalúan por separado: uno caído no afecta al otro', async () => {
  network({
    [BACKEND]: health('ONLINE', allOnline),
    'http://localhost:9002/minio/health/live': new Error('sin conexión'),
  });
  expect(await checkInfrastructure()).toMatchObject({ keycloak: 'ONLINE', minio: 'OFFLINE', backend: 'ONLINE' });
});

test('un estado que la app no conoce se muestra como "sin datos" en vez de inventar uno', async () => {
  network({ [BACKEND]: health('ONLINE', { ...allOnline, redis: 'quizás' }) });
  expect((await checkInfrastructure()).redis).toBe('UNKNOWN');
});
