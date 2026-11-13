import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from '../../app/App';
import ProfilePage from './ProfilePage';
import { AuthContext } from '../auth/context';
import { authService } from '../auth/authService';
import { userService } from '../users/userService';
import { sessionStore } from '../../shared/utils/session';
import { touch } from '../../shared/session/activity';
import { readDb } from '../../mock/db';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(async () => {
  localStorage.clear();
  sessionStore.set(await authService.login({ email: 'demo@tpp.com', password: 'demo1234' }));
  touch();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); window.history.replaceState(null, '', '/'); });

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
const open = async (path = '/perfil') => {
  window.history.replaceState(null, '', path);
  await act(async () => { root.render(<App />); });
  await settle();
};
const $ = (selector) => container.querySelector(selector);
const text = () => container.textContent;
const type = async (el, value) => {
  await act(async () => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const blur = (el) => act(async () => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
const submit = async (form) => { await act(async () => { form.querySelector('button[type=submit]').click(); }); await settle(); };
const personalForm = () => $('#pd-title').closest('section').querySelector('form');
const passwordForm = () => $('#cp-title').closest('section').querySelector('form');
const saveButton = () => personalForm().querySelector('button[type=submit]');
const passwordButton = () => passwordForm().querySelector('button[type=submit]');

describe('datos personales', () => {
  test('muestra email, nombre y apellido, con las migas "Inicio / Mi perfil"', async () => {
    await open();
    expect($('.breadcrumb').textContent).toBe('InicioMi perfil');
    expect($('.breadcrumb a').getAttribute('href')).toBe('/');
    expect($('#pf-email').value).toBe('demo@tpp.com');
    expect($('#pf-email').readOnly).toBe(true);
    expect(text()).toContain('El email no puede modificarse.');
    expect($('#pf-first').value).toBe('Usuario');
    expect($('#pf-last').value).toBe('Demo');
    expect(text()).toContain('Nombre *');
  });

  test('no muestra roles, permisos ni datos internos de seguridad (US-11)', async () => {
    await open();
    const page = $('main.content').textContent; // el menú lateral sí tiene "Roles": se mira solo la pantalla
    ['Roles', 'Permisos', 'Administrador', 'Activo', 'Credencial bloqueada', 'Intentos fallidos', 'Cambio de contraseña requerido'].forEach((word) => {
      expect(page).not.toContain(word);
    });
  });

  test('"Guardar cambios" está deshabilitado sin cambios reales y avisa "No hay cambios para guardar."', async () => {
    await open();
    expect(saveButton().disabled).toBe(true);
    expect(text()).toContain('No hay cambios para guardar.');
  });

  test('se habilita con un cambio real; agregar solo espacios de más no cuenta como cambio', async () => {
    await open();
    await type($('#pf-first'), '  Usuario   ');
    expect(saveButton().disabled).toBe(true); // normalizado, es lo mismo
    await type($('#pf-first'), 'Julia');
    expect(saveButton().disabled).toBe(false);
    expect(text()).not.toContain('No hay cambios para guardar.');
  });

  test('con un campo vacío queda deshabilitado y muestra el error del campo', async () => {
    await open();
    await type($('#pf-first'), '');
    await blur($('#pf-first'));
    expect(saveButton().disabled).toBe(true);
    expect(text()).toContain('El nombre es obligatorio.');
    expect($('#pf-first').getAttribute('aria-invalid')).toBe('true');

    await type($('#pf-last'), '   ');
    await blur($('#pf-last'));
    expect(text()).toContain('El apellido es obligatorio.');
  });

  test('al guardar: confirma, permanece en Mi perfil, actualiza el nombre de la barra superior y audita', async () => {
    await open();
    await type($('#pf-first'), '  Julia   Ana ');
    await type($('#pf-last'), 'Pérez');
    await submit(personalForm());

    expect(text()).toContain('Los datos se actualizaron correctamente.');
    expect(window.location.pathname).toBe('/perfil'); // no navega a otra pantalla
    expect($('#pf-first').value).toBe('Julia Ana'); // queda ya normalizado
    expect($('.usermenu__button').textContent).toContain('Julia Ana Pérez');
    expect(saveButton().disabled).toBe(true); // lo guardado ya no es un cambio
    const entry = readDb().audit.find((a) => a.action === 'PROFILE_UPDATED');
    expect(entry.changes.map((c) => c.field)).toEqual(['firstName', 'lastName']);
  });

  test('el mensaje de éxito desaparece al volver a editar', async () => {
    await open();
    await type($('#pf-first'), 'Julia');
    await submit(personalForm());
    expect(text()).toContain('Los datos se actualizaron correctamente.');
    await type($('#pf-first'), 'Julia Beatriz');
    expect(text()).not.toContain('Los datos se actualizaron correctamente.');
  });
});

describe('cambiar contraseña', () => {
  const fill = async (current, next, confirm) => {
    await type($('#pw-current'), current);
    await type($('#pw-new'), next);
    await type($('#pw-confirm'), confirm);
  };

  test('los tres campos están enmascarados y se pueden mostrar u ocultar temporalmente', async () => {
    await open();
    ['#pw-current', '#pw-new', '#pw-confirm'].forEach((id) => expect($(id).type).toBe('password'));
    const toggles = passwordForm().querySelectorAll('button[aria-label$="contraseña"]');
    expect(toggles).toHaveLength(3);
    await act(async () => { toggles[1].click(); });
    expect($('#pw-new').type).toBe('text');
    expect($('#pw-current').type).toBe('password'); // cada campo es independiente
    await act(async () => { toggles[1].click(); });
    expect($('#pw-new').type).toBe('password');
  });

  test('muestra los requisitos de la política y el botón se habilita solo con los tres campos completos', async () => {
    await open();
    expect(text()).toContain('Tu nueva contraseña debe:');
    expect(text()).toContain('Tener entre 8 y 64 caracteres');
    expect(text()).toContain('Ser distinta de tu contraseña actual');
    expect(passwordButton().disabled).toBe(true);
    await fill('demo1234', 'Nueva#Clave9', '');
    expect(passwordButton().disabled).toBe(true);
    await type($('#pw-confirm'), 'Nueva#Clave9');
    expect(passwordButton().disabled).toBe(false);
    await type($('#pw-current'), '');
    expect(passwordButton().disabled).toBe(true); // vuelve a deshabilitarse
  });

  test('contraseñas que no coinciden: lo informa en el campo y no llama al servidor', async () => {
    await open();
    await fill('demo1234', 'Nueva#Clave9', 'Otra#Clave9');
    await submit(passwordForm());
    expect(text()).toContain('Las contraseñas no coinciden.');
    expect(readDb().audit.some((a) => a.action === 'PASSWORD_CHANGED_VOLUNTARY')).toBe(false);
  });

  test('nueva igual a la actual, o fuera de la política: se rechaza en la misma pantalla', async () => {
    await open();
    await fill('demo1234', 'demo1234', 'demo1234');
    await submit(passwordForm());
    expect(text()).toContain('La nueva contraseña debe ser distinta de la actual.');
    await fill('demo1234', 'con espacio 1', 'con espacio 1');
    await submit(passwordForm());
    expect(text()).toContain('no puede contener espacios');
  });

  test('contraseña actual incorrecta: error bajo ese campo, los campos se conservan y no se bloquea nada', async () => {
    await open();
    await fill('incorrecta', 'Nueva#Clave9', 'Nueva#Clave9');
    await submit(passwordForm());
    expect(text()).toContain('La contraseña actual no es correcta.');
    expect($('#pw-current').getAttribute('aria-invalid')).toBe('true');
    expect($('#pw-new').value).toBe('Nueva#Clave9');
    expect(readDb().users.find((u) => u.email === 'demo@tpp.com')).toMatchObject({ failedAttempts: 0, blocked: false });
    expect(window.location.pathname).toBe('/perfil');
  });

  test('cambio correcto: confirma, limpia los tres campos y permanece en Mi perfil', async () => {
    await open();
    await fill('demo1234', 'Nueva#Clave9', 'Nueva#Clave9');
    await submit(passwordForm());
    expect(text()).toContain('La contraseña se modificó correctamente.');
    ['#pw-current', '#pw-new', '#pw-confirm'].forEach((id) => expect($(id).value).toBe(''));
    expect(window.location.pathname).toBe('/perfil');
    expect(passwordButton().disabled).toBe(true);
    await expect(authService.login({ email: 'demo@tpp.com', password: 'Nueva#Clave9' })).resolves.toBeDefined();
  });

  test('los dos formularios son independientes: guardar uno no toca al otro', async () => {
    await open();
    await type($('#pf-first'), 'Julia');
    await fill('demo1234', 'Nueva#Clave9', 'Nueva#Clave9');
    await submit(passwordForm());
    expect($('#pf-first').value).toBe('Julia'); // lo escrito en datos personales sigue ahí, sin guardar
    expect(readDb().users.find((u) => u.email === 'demo@tpp.com').firstName).toBe('Usuario');
  });
});

describe('acceso a Mi perfil', () => {
  test('un usuario sin ningún permiso también entra', async () => {
    const { temporaryPassword } = await userService.create({ firstName: 'Sin', lastName: 'Permisos', email: 'sinpermisos@tpp.com', active: true, roleIds: ['viewer'] });
    const first = await authService.login({ email: 'sinpermisos@tpp.com', password: temporaryPassword });
    sessionStore.set({ ...first, user: { ...first.user, mustChangePassword: false } });
    await open();
    expect($('#pf-email').value).toBe('sinpermisos@tpp.com');
  });

  test('con cambio de contraseña obligatorio pendiente, no accede a Mi perfil hasta completarlo', async () => {
    const { temporaryPassword } = await userService.create({ firstName: 'Con', lastName: 'Temporal', email: 'temporal@tpp.com', active: true, roleIds: ['viewer'] });
    sessionStore.set(await authService.login({ email: 'temporal@tpp.com', password: temporaryPassword })); // mustChangePassword: true
    await open('/perfil');
    expect(window.location.pathname).toBe('/cambiar-contrasena');
    expect(text()).not.toContain('Datos personales');
  });
});

describe('con el login real (Keycloak)', () => {
  test('los datos se administran en Keycloak: solo se consultan y hay un enlace a su cuenta', async () => {
    const value = { provider: 'keycloak', user: { name: 'Test User', email: '', roles: [{ id: 'administrador' }], permissions: [] }, isAuthenticated: true };
    await act(async () => {
      root.render(<MemoryRouter><AuthContext.Provider value={value}><ProfilePage /></AuthContext.Provider></MemoryRouter>);
    });
    expect(text()).toContain('Test User');
    expect(text()).toContain('se administran en Keycloak');
    expect(container.querySelectorAll('input')).toHaveLength(0);
    const link = $('a.btn');
    expect(link.href).toContain('/realms/tpp-realm/account');
    expect(link.target).toBe('_blank');
    expect(text()).not.toContain('administrador'); // tampoco muestra roles
  });
});
