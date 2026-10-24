import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import KeycloakAuthProvider from './KeycloakAuthProvider';
import { useAuth } from './context';
import { keycloak } from './keycloak';
import { http } from '../../shared/api/httpClient';
import { sessionStore } from '../../shared/utils/session';
import { SESSION_TIMEOUT_NOTICE } from './messages';

jest.mock('./keycloak', () => ({
  INIT_OPTIONS: { onLoad: 'check-sso' },
  keycloak: { init: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn(), updateToken: jest.fn(), token: 'tok-123', tokenParsed: null },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TOKEN = { sub: 'u1', preferred_username: 'testuser', realm_access: { roles: ['administrador', 'default-roles-tpp-realm'] } };
let container;
let root;
let auth;
const Probe = () => { auth = useAuth(); return <span>{auth.user ? `hola ${auth.user.name}` : 'anónimo'}</span>; };
const render = async () => { await act(async () => { root.render(<KeycloakAuthProvider><Probe /></KeycloakAuthProvider>); }); };
const signedIn = () => { keycloak.init.mockResolvedValue(true); keycloak.tokenParsed = TOKEN; };

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  keycloak.updateToken.mockResolvedValue(true);
  keycloak.logout.mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
  jest.resetAllMocks();
  delete global.fetch;
});

test('con sesión en Keycloak: expone usuario y permisos, y guarda solo los datos del usuario (sin token)', async () => {
  signedIn();
  await render();
  expect(container.textContent).toBe('hola testuser');
  expect(auth).toMatchObject({ provider: 'keycloak', isAuthenticated: true });
  expect(auth.can('users.manage')).toBe(true);
  const saved = sessionStore.get();
  expect(saved.user.permissions).toContain('users.manage');
  expect(saved).not.toHaveProperty('token'); // el token vive solo en memoria
  expect(localStorage.getItem('tpp.last-activity')).not.toBeNull();
});

test('sin sesión: la app queda como anónima y login/crear cuenta redirigen a Keycloak volviendo a la ruta pedida', async () => {
  keycloak.init.mockResolvedValue(false);
  await render();
  expect(auth.isAuthenticated).toBe(false);
  auth.login('/usuarios');
  expect(keycloak.login).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/usuarios` });
  auth.register();
  expect(keycloak.register).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/` });
});

test('mientras conecta avisa, y si Keycloak no responde ofrece reintentar', async () => {
  keycloak.init.mockReturnValue(new Promise(() => {})); // nunca responde
  await render();
  expect(container.textContent).toContain('Conectando con el servicio de autenticación');

  act(() => root.unmount());
  root = createRoot(container);
  keycloak.init.mockRejectedValue(new Error('sin conexión'));
  await render();
  expect(container.textContent).toContain('No se pudo conectar con el servicio de autenticación');
  expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toContain('Reintentar');
});

test('si Keycloak nunca responde (caído), tras el tiempo límite muestra el error en vez de esperar para siempre', async () => {
  jest.useFakeTimers();
  keycloak.init.mockReturnValue(new Promise(() => {}));
  await render();
  expect(container.textContent).toContain('Conectando con el servicio de autenticación');
  await act(async () => { jest.advanceTimersByTime(14000); });
  expect(container.textContent).toContain('Conectando con el servicio de autenticación'); // todavía espera
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(container.textContent).toContain('No se pudo conectar con el servicio de autenticación');
});

test('cerrar sesión limpia lo local y también la sesión de Keycloak', async () => {
  signedIn();
  await render();
  await act(async () => { await auth.logout(); });
  expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/login` });
  expect(sessionStore.get()).toBeNull();
  expect(container.textContent).toBe('anónimo');
});

test('timeout: a los 30 minutos sin actividad cierra la sesión de Keycloak y vuelve a /login con el aviso', async () => {
  jest.useFakeTimers();
  signedIn();
  await render();
  localStorage.setItem('tpp.last-activity', String(Date.now() - 31 * 60 * 1000));
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/login?expired=1` });
});

test('sin vencer, el temporizador no cierra la sesión', async () => {
  jest.useFakeTimers();
  signedIn();
  await render();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(keycloak.logout).not.toHaveBeenCalled();
  expect(auth.isAuthenticated).toBe(true);
});

test('al volver de un timeout muestra el aviso una vez y deja la URL limpia', async () => {
  window.history.replaceState(null, '', '/login?expired=1');
  keycloak.init.mockResolvedValue(false);
  await render();
  expect(auth.notice).toBe(SESSION_TIMEOUT_NOTICE);
  expect(window.location.search).toBe('');
});

test('las peticiones al backend renuevan el token antes de enviarse', async () => {
  signedIn();
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  await render();
  await http('/cosas');
  expect(keycloak.updateToken).toHaveBeenCalledWith(30);
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
});

test('si Keycloak ya no tiene la sesión al renovar el token, se cierra la sesión', async () => {
  signedIn();
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  await render();
  keycloak.updateToken.mockRejectedValue(new Error('sesión vencida'));
  await act(async () => { await http('/cosas'); });
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/login?expired=1` });
});
