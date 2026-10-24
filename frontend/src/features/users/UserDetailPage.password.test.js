import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../app/App';
import { authService } from '../auth/authService';
import { userService } from './userService';
import { sessionStore } from '../../shared/utils/session';
import { touch } from '../../shared/session/activity';
import { readDb, writeDb } from '../../mock/db';
import { validatePassword } from '../../shared/utils/password';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let target;
beforeEach(async () => {
  localStorage.clear();
  sessionStore.set(await authService.login({ email: 'demo@tpp.com', password: 'demo1234' }));
  touch();
  ({ user: target } = await userService.create({ firstName: 'Lola', lastName: 'Mento', email: 'lola@tpp.com', active: true, roleIds: ['viewer'] }));
  const db = readDb(); // la credencial de Lola está bloqueada
  Object.assign(db.users.find((u) => u.id === target.id), { blocked: true, failedAttempts: 3 });
  writeDb(db);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => {}) } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); window.history.replaceState(null, '', '/'); });

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };
const openDetail = async () => {
  window.history.replaceState(null, '', `/usuarios/${target.id}`);
  await act(async () => { root.render(<App />); });
  await settle();
};
const resultModal = () => container.querySelector('dialog.dialog--result');

test('la confirmación informa que la contraseña actual queda invalidada sin afectar sesiones abiertas', async () => {
  await openDetail();
  await click(button('Generar nueva contraseña temporal'));
  const text = container.querySelector('dialog.dialog:not(.dialog--result)').textContent;
  expect(text).toContain('La contraseña actual quedará invalidada para nuevos inicios de sesión');
  expect(text).toContain('no se ven afectadas');
  expect(resultModal()).toBeNull(); // todavía no se generó nada
});

test('al confirmar se muestra el resultado en un modal, con la contraseña de 16 caracteres, Copiar y los avisos', async () => {
  await openDetail();
  await click(button('Generar nueva contraseña temporal'));
  await click(button('Generar contraseña'));

  const modal = resultModal();
  expect(modal).not.toBeNull();
  expect(modal.hasAttribute('open')).toBe(true);
  const password = modal.querySelector('code').textContent;
  expect(password).toHaveLength(16);
  expect(validatePassword(password)).toBeNull();
  expect(modal.textContent).toContain('Esta contraseña se muestra una sola vez');
  expect(modal.textContent).toContain('deberá cambiarla en su próximo inicio de sesión');

  await click(button('Copiar'));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(password);
  expect(button('Copiada')).toBeTruthy();
});

test('el modal no se cierra con Esc (la contraseña no vuelve a mostrarse); solo con Continuar, que vuelve al detalle', async () => {
  await openDetail();
  await click(button('Generar nueva contraseña temporal'));
  await click(button('Generar contraseña'));

  const esc = new Event('cancel', { cancelable: true });
  await act(async () => { resultModal().dispatchEvent(esc); });
  expect(esc.defaultPrevented).toBe(true);
  expect(resultModal()).not.toBeNull();

  await click(button('Continuar'));
  expect(resultModal()).toBeNull();
  expect(container.textContent).toContain('Detalle de usuario'); // vuelve a la gestión del usuario
  expect(container.textContent).not.toMatch(/[A-Za-z0-9#"!$%&/()=?|+*{}[\]_<>,-]{16}(?!\w)\s*Copiar/); // la contraseña ya no se muestra
});

test('el detalle refleja el efecto: ya no está bloqueada, 0 intentos y debe cambiar la contraseña', async () => {
  await openDetail();
  expect(container.textContent).toMatch(/Credencial bloqueada\s*Sí/);
  await click(button('Generar nueva contraseña temporal'));
  await click(button('Generar contraseña'));
  await click(button('Continuar'));
  expect(container.textContent).toMatch(/Credencial bloqueada\s*No/);
  expect(container.textContent).toMatch(/Cambio de contraseña requerido\s*Sí/);
});

test('al reactivar a un usuario también se usa el modal de resultado', async () => {
  await userService.deactivate(target.id);
  await openDetail();
  await click(button('Reactivar')); // abre la confirmación
  const confirm = [...container.querySelectorAll('dialog.dialog:not(.dialog--result) button')].find((b) => b.textContent === 'Reactivar');
  await click(confirm);
  expect(resultModal().textContent).toContain('Usuario reactivado');
  expect(resultModal().querySelector('code').textContent).toHaveLength(16);
});
