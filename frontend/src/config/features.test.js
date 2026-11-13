// features.js se evalúa al importarlo: cada prueba lo carga de nuevo con el entorno que quiere probar.
const load = (env = {}) => {
  const saved = { ...process.env };
  ['REACT_APP_MODE', 'REACT_APP_SIMULATE_INFRA'].forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  let features;
  jest.isolateModules(() => { features = require('./features').FEATURES; });
  process.env = saved;
  return features;
};

test('sin configurar, el ambiente es el controlado: todo simulado', () => {
  expect(load()).toMatchObject({ AUTH_PROVIDER: 'mock', SIMULATE_INFRA: true, USE_MOCK_API: true });
});

test('REACT_APP_MODE=keycloak activa el login real y el panel Sistema real', () => {
  expect(load({ REACT_APP_MODE: 'keycloak' })).toMatchObject({ AUTH_PROVIDER: 'keycloak', SIMULATE_INFRA: false });
});

test('REACT_APP_MODE=mock explícito equivale al valor por defecto', () => {
  expect(load({ REACT_APP_MODE: 'mock' })).toMatchObject({ AUTH_PROVIDER: 'mock', SIMULATE_INFRA: true });
});

test('se puede combinar: login simulado con el panel Sistema real (y al revés)', () => {
  expect(load({ REACT_APP_MODE: 'mock', REACT_APP_SIMULATE_INFRA: 'false' })).toMatchObject({ AUTH_PROVIDER: 'mock', SIMULATE_INFRA: false });
  expect(load({ REACT_APP_MODE: 'keycloak', REACT_APP_SIMULATE_INFRA: 'true' })).toMatchObject({ AUTH_PROVIDER: 'keycloak', SIMULATE_INFRA: true });
});

test('un valor inválido no rompe la app: avisa y usa el modo controlado', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(load({ REACT_APP_MODE: 'produccion' }).AUTH_PROVIDER).toBe('mock');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('"produccion" no es válido'));
  warn.mockRestore();
});

test('un valor raro en REACT_APP_SIMULATE_INFRA se ignora y queda lo que corresponde al modo', () => {
  expect(load({ REACT_APP_MODE: 'keycloak', REACT_APP_SIMULATE_INFRA: 'quizás' }).SIMULATE_INFRA).toBe(false);
});
