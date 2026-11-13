// features.js se evalúa al importarlo: cada prueba lo carga de nuevo con el entorno que quiere probar.
const load = (env = {}) => {
  const saved = { ...process.env };
  delete process.env.REACT_APP_MODE;
  Object.assign(process.env, env);
  let features;
  jest.isolateModules(() => { features = require('./features').FEATURES; });
  process.env = saved;
  return features;
};

test('sin configurar, el ambiente es el real: login con Keycloak', () => {
  expect(load()).toMatchObject({ AUTH_PROVIDER: 'keycloak', USE_MOCK_API: true });
});

test('REACT_APP_MODE=mock activa el login simulado', () => {
  expect(load({ REACT_APP_MODE: 'mock' })).toMatchObject({ AUTH_PROVIDER: 'mock' });
});

test('REACT_APP_MODE=keycloak explícito equivale al valor por defecto', () => {
  expect(load({ REACT_APP_MODE: 'keycloak' })).toMatchObject({ AUTH_PROVIDER: 'keycloak' });
});

test('un valor inválido no rompe la app: avisa y usa el modo por defecto', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(load({ REACT_APP_MODE: 'produccion' }).AUTH_PROVIDER).toBe('keycloak');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('"produccion" no es válido'));
  warn.mockRestore();
});
