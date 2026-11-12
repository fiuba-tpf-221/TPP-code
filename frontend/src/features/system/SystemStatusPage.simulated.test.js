import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SystemStatusPage from './SystemStatusPage';
import { FEATURES } from '../../config/features';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  FEATURES.SIMULATE_INFRA = true;
  global.fetch = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); FEATURES.SIMULATE_INFRA = false; delete global.fetch; });

const render = async () => { await act(async () => { root.render(<SystemStatusPage />); }); };
const choose = async (value) => {
  const select = container.querySelector('#sim-scenario');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

test('en modo simulado avisa que los estados no son reales y no consulta ningún servicio', async () => {
  await render();
  expect(container.textContent).toContain('Modo simulado: estos estados no vienen de los servicios reales');
  expect(container.querySelectorAll('.svc-badge--ok')).toHaveLength(6);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('el selector ofrece los escenarios y cambiarlo actualiza las tarjetas al instante', async () => {
  await render();
  expect([...container.querySelectorAll('#sim-scenario option')].map((o) => o.textContent)).toEqual([
    'Todo en línea', 'Backend degradado (RabbitMQ caído)', 'Backend caído', 'Keycloak caído',
  ]);

  await choose('degraded');
  expect(container.querySelectorAll('.svc-badge--warn')).toHaveLength(1); // backend degradado
  expect(container.querySelectorAll('.svc-badge--off')).toHaveLength(1); // RabbitMQ
  expect(container.querySelectorAll('.svc-badge--ok')).toHaveLength(4);

  await choose('backend-down');
  expect(container.querySelectorAll('.svc-badge--off')).toHaveLength(1);
  expect(container.querySelectorAll('.svc-badge--idle')).toHaveLength(3); // sin datos
  expect(container.textContent).toContain('2 de 6 servicios en línea');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('con la infraestructura real no aparece nada de lo simulado', async () => {
  FEATURES.SIMULATE_INFRA = false;
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  await render();
  expect(container.querySelector('#sim-scenario')).toBeNull();
  expect(container.textContent).not.toContain('Modo simulado');
});
