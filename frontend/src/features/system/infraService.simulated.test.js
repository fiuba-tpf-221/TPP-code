import { checkInfrastructure, SIMULATED_SCENARIOS } from './infraService';
import { FEATURES } from '../../config/features';

beforeEach(() => { FEATURES.SIMULATE_INFRA = true; global.fetch = jest.fn(); });
afterEach(() => { FEATURES.SIMULATE_INFRA = false; delete global.fetch; });

const ALL = ['keycloak', 'minio', 'backend', 'postgres', 'rabbitmq', 'redis'];

test('en modo simulado no consulta la red', async () => {
  await checkInfrastructure('ok');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('escenario "ok": las seis tarjetas en línea', async () => {
  expect(await checkInfrastructure('ok')).toEqual(Object.fromEntries(ALL.map((k) => [k, 'ONLINE'])));
});

test('cada escenario muestra el estado que dice (degradado, backend caído, Keycloak caído)', async () => {
  expect(await checkInfrastructure('degraded')).toMatchObject({ backend: 'DEGRADED', rabbitmq: 'OFFLINE', postgres: 'ONLINE' });
  expect(await checkInfrastructure('backend-down')).toMatchObject({ backend: 'OFFLINE', postgres: 'UNKNOWN', rabbitmq: 'UNKNOWN', redis: 'UNKNOWN', keycloak: 'ONLINE' });
  expect(await checkInfrastructure('keycloak-down')).toMatchObject({ keycloak: 'OFFLINE', backend: 'ONLINE' });
});

test('un escenario desconocido cae en "todo en línea" en vez de romper', async () => {
  expect((await checkInfrastructure('inventado')).backend).toBe('ONLINE');
});

test('todos los escenarios definen las seis tarjetas, solo con estados que la pantalla sabe mostrar', () => {
  Object.values(SIMULATED_SCENARIOS).forEach(({ label, result }) => {
    expect(label).toBeTruthy();
    expect(Object.keys(result).sort()).toEqual([...ALL].sort());
    Object.values(result).forEach((s) => expect(['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN']).toContain(s));
  });
});

test('el resultado es una copia: modificarlo no altera el escenario', async () => {
  const first = await checkInfrastructure('ok');
  first.backend = 'OFFLINE';
  expect((await checkInfrastructure('ok')).backend).toBe('ONLINE');
});
