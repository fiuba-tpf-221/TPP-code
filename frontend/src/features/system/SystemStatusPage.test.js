import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SystemStatusPage from './SystemStatusPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete global.fetch; });

const backend = (status, dependencies) => async (url) =>
  (url.endsWith('/health') && url.includes(':8000') ? { ok: true, json: async () => ({ status, dependencies }) } : {});
const text = () => container.textContent;
const render = async () => { await act(async () => { root.render(<SystemStatusPage />); }); };

test('muestra las 6 tarjetas de infraestructura y los accesos a las 6 consolas', async () => {
  global.fetch = jest.fn(backend('ONLINE', { postgres: 'ONLINE', rabbitmq: 'ONLINE', redis: 'ONLINE' }));
  await render();

  ['Keycloak Auth', 'MinIO S3', 'FastAPI Backend', 'PostgreSQL', 'RabbitMQ', 'Redis Cache'].forEach((n) => expect(text()).toContain(n));
  expect(container.querySelectorAll('.svc-badge--ok')).toHaveLength(6);
  expect(text()).toContain('6 de 6 servicios en línea');

  const links = [...container.querySelectorAll('a.console')];
  expect(links.map((a) => a.textContent)).toEqual(expect.arrayContaining([
    expect.stringContaining('Grafana Dashboards'), expect.stringContaining('Jaeger Tracing'), expect.stringContaining('SonarQube Quality'),
  ]));
  expect(links).toHaveLength(6);
  links.forEach((a) => { expect(a.target).toBe('_blank'); expect(a.rel).toContain('noreferrer'); });
  expect(links.find((a) => a.textContent.includes('Grafana')).href).toBe('http://localhost:3001/');
});

test('con el backend caído lo dice, y las dependencias quedan "sin datos"', async () => {
  global.fetch = jest.fn(async (url) => { if (url.includes(':8000')) throw new Error('down'); return {}; });
  await render();
  expect(container.querySelectorAll('.svc-badge--off')).toHaveLength(1); // solo el backend
  expect(container.querySelectorAll('.svc-badge--idle')).toHaveLength(3); // postgres, rabbitmq, redis
  expect(text()).toContain('2 de 6 servicios en línea'); // Keycloak y MinIO siguen en línea
});

test('Actualizar vuelve a consultar', async () => {
  global.fetch = jest.fn(backend('ONLINE', { postgres: 'ONLINE', rabbitmq: 'ONLINE', redis: 'ONLINE' }));
  await render();
  const before = global.fetch.mock.calls.length;
  await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Actualizar').click(); });
  expect(global.fetch.mock.calls.length).toBe(before * 2);
});
