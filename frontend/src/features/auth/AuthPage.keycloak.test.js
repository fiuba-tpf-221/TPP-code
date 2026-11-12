import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from './AuthPage';
import { AuthContext } from './context';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let ctx;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  ctx = { provider: 'keycloak', isAuthenticated: false, user: null, notice: '', login: jest.fn(), register: jest.fn() };
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async (entry = '/login') => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={ctx}><AuthPage /></AuthContext.Provider></MemoryRouter>);
  });
};
const click = (el) => act(() => { el.click(); });
const actionButton = () => container.querySelector('button.btn');

test('con Keycloak la ventana mantiene las pestañas y el carrusel, sin formularios ni Google', async () => {
  await render();
  expect(container.querySelector('.carousel')).not.toBeNull();
  expect([...container.querySelectorAll('[role=tab]')].map((t) => t.textContent)).toEqual(['Iniciar sesión', 'Crear cuenta']);
  expect(container.querySelectorAll('input')).toHaveLength(0);
  expect(container.textContent).not.toContain('Continuar con Google');
  expect(actionButton().textContent).toBe('Iniciar sesión');
});

test('"Iniciar sesión" pasa por Keycloak y vuelve a la pantalla que el usuario quería abrir', async () => {
  await render({ pathname: '/login', state: { from: { pathname: '/usuarios' } } });
  click(actionButton());
  expect(ctx.login).toHaveBeenCalledWith('/usuarios');
});

test('sin pantalla previa vuelve al inicio, y la pestaña "Crear cuenta" usa el alta de Keycloak', async () => {
  await render();
  click(actionButton());
  expect(ctx.login).toHaveBeenCalledWith('/');

  click([...container.querySelectorAll('[role=tab]')].find((t) => t.textContent === 'Crear cuenta'));
  expect(actionButton().textContent).toBe('Crear cuenta');
  click(actionButton());
  expect(ctx.register).toHaveBeenCalledWith('/');
});

test('muestra el aviso de sesión expirada', async () => {
  ctx.notice = 'Tu sesión expiró por inactividad. Iniciá sesión nuevamente.';
  await render();
  expect(container.textContent).toContain('Tu sesión expiró por inactividad');
});
