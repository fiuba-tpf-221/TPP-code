import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ModeBadge from './ModeBadge';
import { FEATURES } from '../../config/features';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const show = (provider) => {
  FEATURES.AUTH_PROVIDER = provider;
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<ModeBadge />));
  const text = container.textContent;
  act(() => root.unmount());
  return text;
};
afterEach(() => { FEATURES.AUTH_PROVIDER = 'mock'; });

test('en el ambiente controlado se ve "Modo simulado"', () => {
  expect(show('mock')).toBe('Modo simulado');
});

test('con Keycloak no se muestra nada: ahí lo que se ve es real', () => {
  expect(show('keycloak')).toBe('');
});
