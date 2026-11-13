import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { authService } from '../features/auth/authService';
import { sessionStore } from '../shared/utils/session';
import { touch } from '../shared/session/activity';
import { FEATURES } from '../config/features';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => { FEATURES.SIMULATE_INFRA = true; /* el ambiente controlado por defecto */ localStorage.clear(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { FEATURES.SIMULATE_INFRA = false; act(() => root.unmount()); container.remove(); window.history.replaceState(null, '', '/'); });

// Abre la app en una ruta y espera a que terminen las respuestas simuladas.
const open = async (path) => {
  act(() => root.unmount()); // se monta de cero: cambiar la URL a mano no avisa al router
  root = createRoot(container);
  window.history.replaceState(null, '', path);
  await act(async () => { root.render(<App />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
};
const signIn = async (email = 'demo@tpp.com', password = 'demo1234') => {
  sessionStore.set(await authService.login({ email, password }));
  touch();
};
const text = () => container.textContent;
const sidebarLinks = () => [...container.querySelectorAll('.sidebar a')].map((a) => a.textContent.trim());

test('sin sesión, cualquier pantalla lleva a la de acceso, que avisa que es el modo simulado', async () => {
  await open('/usuarios');
  expect(window.location.pathname).toBe('/login');
  expect(text()).toContain('Modo simulado');
  expect(text()).toContain('demo@tpp.com / demo1234');
  expect(container.querySelector('.carousel')).not.toBeNull();
});

describe('con el administrador de demostración, todas las pestañas levantan', () => {
  beforeEach(signIn);

  test('el menú lateral muestra las siete opciones, cada una con su ícono', async () => {
    await open('/');
    expect(sidebarLinks()).toEqual(['Usuarios', 'Roles', 'Dominios', 'Auditoría', 'Sistema', 'Modelos', 'Predicción']);
    container.querySelectorAll('.sidebar a').forEach((a) => expect(a.querySelector('svg')).not.toBeNull());
    expect(text()).toContain('Modo simulado'); // también en la barra superior
  });

  test.each([
    ['/', 'Bienvenido, Usuario Demo'],
    ['/perfil', 'Mi perfil'],
    ['/usuarios', 'demo@tpp.com'],
    ['/usuarios/nuevo', 'Nuevo usuario'],
    ['/roles', 'Nuevo rol'],
    ['/roles/nuevo', 'Permisos asociados'],
    ['/dominios', 'en construcción'],
    ['/auditoria', 'en construcción'],
    ['/modelos', 'en construcción'],
    ['/prediccion', 'en construcción'],
  ])('%s carga', async (path, expected) => {
    await open(path);
    expect(window.location.pathname).toBe(path);
    expect(text()).toContain(expected);
    expect(text()).not.toContain('Sin acceso');
  });

  test('Sistema funciona simulado: seis tarjetas, seis consolas y el selector de escenarios', async () => {
    await open('/sistema');
    expect(container.querySelectorAll('.svc-card')).toHaveLength(6);
    expect(container.querySelectorAll('a.console')).toHaveLength(6);
    expect(container.querySelector('#sim-scenario')).not.toBeNull();
    expect(container.querySelectorAll('.svc-badge--ok')).toHaveLength(6);
  });

  test('el detalle de un usuario abre desde la lista', async () => {
    await open('/usuarios');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Ver / Editar');
    expect(link).toBeTruthy();
    await act(async () => { link.click(); }); // clic real, como una persona
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(window.location.pathname).toMatch(/^\/usuarios\/.+/);
    expect(text()).toContain('Detalle de usuario');
    const email = [...container.querySelectorAll('input')].find((input) => input.value === 'demo@tpp.com');
    expect(email).toBeTruthy(); // el email se muestra en un campo de solo lectura
    expect(email.readOnly).toBe(true);
  });
});

test('un usuario sin permisos ve solo Inicio y Mi perfil, y las demás pantallas le dicen "Sin acceso"', async () => {
  const { userService } = await import('../features/users/userService');
  sessionStore.set(await authService.login({ email: 'demo@tpp.com', password: 'demo1234' }));
  const { user, temporaryPassword } = await userService.create({
    firstName: 'Sin', lastName: 'Permisos', email: 'sinpermisos@tpp.com', active: true, roleIds: ['viewer'],
  });
  expect(user.email).toBe('sinpermisos@tpp.com');
  localStorage.removeItem('tpp.session.v3');
  const first = await authService.login({ email: 'sinpermisos@tpp.com', password: temporaryPassword });
  expect(first.user.permissions).toEqual([]);
  sessionStore.set({ ...first, user: { ...first.user, mustChangePassword: false } }); // como si ya hubiera cambiado la clave
  touch();

  await open('/');
  expect(container.querySelector('.sidebar')).toBeNull();
  expect(text()).toContain('Todavía no tenés permisos asignados');
  await open('/sistema');
  expect(text()).toContain('Sin acceso');
  await open('/usuarios');
  expect(text()).toContain('Sin acceso');
  await open('/roles');
  expect(text()).toContain('Sin acceso');
});
