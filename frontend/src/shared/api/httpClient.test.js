import { http, setTokenProvider, setUnauthorizedHandler, ApiError } from './httpClient';

const reply = (status, body = {}) => async () => ({ ok: status < 400, status, json: async () => body });
const ACTIVITY = 'tpp.last-activity';

beforeEach(() => localStorage.clear());
afterEach(() => { setTokenProvider(null); setUnauthorizedHandler(null); delete global.fetch; });

test('sin token no envía Authorization ni cuenta actividad', async () => {
  global.fetch = jest.fn(reply(200, { ok: 1 }));
  await expect(http('/algo')).resolves.toEqual({ ok: 1 });
  expect(global.fetch.mock.calls[0][0]).toBe('/api/algo');
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  expect(localStorage.getItem(ACTIVITY)).toBeNull();
});

test('con token envía Bearer y una respuesta aceptada cuenta como actividad (US-05)', async () => {
  global.fetch = jest.fn(reply(200));
  setTokenProvider(async () => 'abc');
  await http('/algo');
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  expect(localStorage.getItem(ACTIVITY)).not.toBeNull();
});

test('un 401 con token avisa que la sesión ya no vale y no cuenta actividad', async () => {
  global.fetch = jest.fn(reply(401, { detail: 'token vencido' }));
  const onUnauthorized = jest.fn();
  setUnauthorizedHandler(onUnauthorized);
  setTokenProvider(async () => 'abc');
  await expect(http('/algo')).rejects.toMatchObject({ status: 401, message: 'token vencido' });
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(ACTIVITY)).toBeNull();
});

test('un 401 sin token (por ejemplo un login fallido) no cierra ninguna sesión', async () => {
  global.fetch = jest.fn(reply(401));
  const onUnauthorized = jest.fn();
  setUnauthorizedHandler(onUnauthorized);
  await expect(http('/algo')).rejects.toBeInstanceOf(ApiError);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('el error del backend conserva el campo para marcarlo en el formulario', async () => {
  global.fetch = jest.fn(reply(422, { detail: 'Email inválido', field: 'email' }));
  await expect(http('/algo')).rejects.toMatchObject({ status: 422, field: 'email' });
});
