import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../app/App';
import { authService } from '../auth/authService';
import { userService } from '../users/userService';
import { roleService } from './roleService';
import { sessionStore } from '../../shared/utils/session';
import { touch } from '../../shared/session/activity';
import { readDb, writeDb } from '../../mock/db';

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

const $ = (selector) => container.querySelector(selector);
const $$ = (selector) => [...container.querySelectorAll(selector)];
const text = () => container.textContent;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
const open = async (path) => {
  act(() => root.unmount());
  root = createRoot(container);
  window.history.replaceState(null, '', path);
  await act(async () => { root.render(<App />); });
  await settle();
};
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };
const byText = (selector, label) => $$(selector).find((el) => el.textContent === label);
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const choose = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
};
const blur = (el) => act(async () => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
const rows = () => $$('tbody tr').map((tr) => [...tr.children].map((td) => td.textContent));
const names = () => rows().map((r) => r[0].replace('Protegido', ''));
const roleId = (name) => readDb().roles.find((r) => r.name === name).id;
const dialog = () => $('dialog[open]:not(.dialog--result)');
const confirmWith = async (label) => click([...dialog().querySelectorAll('button')].find((b) => b.textContent === label));
const patch = (fn) => { const d = readDb(); fn(d); writeDb(d); };

describe('consulta de roles', () => {
  test('grilla con nombre, descripción, activo, cantidad de usuarios y de permisos, y acciones', async () => {
    await open('/roles');
    expect($$('thead th').map((th) => th.textContent.replace(/[▲▼↕\s]+$/, ''))).toEqual(
      ['Nombre', 'Descripción', 'Activo', 'Usuarios asignados', 'Permisos asignados', 'Acciones']);
    expect(names()).toEqual(['Administrador', 'Analista', 'Auditor (obsoleto)', 'Consulta', 'Operador']);
    expect(rows()[0].slice(2, 5)).toEqual(['Sí', '1', '7']); // Administrador: activo, 1 usuario, 7 permisos
    expect(rows()[2][2]).toBe('No'); // el obsoleto está inactivo
    expect(text()).toContain('Protegido');
    expect($$('tbody a').map((a) => a.textContent)).toEqual(Array(5).fill('Ver / Editar'));
    expect($('a[href="/roles/nuevo"]').textContent).toBe('Nuevo rol');
  });

  test('filtra por nombre sin distinguir mayúsculas ni espacios en los bordes, y "Limpiar filtros" los quita', async () => {
    await open('/roles');
    await type($('#rf-name'), '  ANALI ');
    await click(byText('button', 'Buscar'));
    expect(names()).toEqual(['Analista']);
    expect(window.location.search).toContain('name=ANALI'); // sin los espacios
    await click(byText('button', 'Limpiar filtros'));
    expect(names()).toHaveLength(5);
    expect($('#rf-name').value).toBe('');
  });

  test('filtra por descripción y por Activo (Todos / Sí / No)', async () => {
    await open('/roles');
    await type($('#rf-description'), 'predicciones');
    await click(byText('button', 'Buscar'));
    expect(names()).toEqual(['Analista']);
    await click(byText('button', 'Limpiar filtros'));
    await choose($('#rf-active'), 'false');
    await click(byText('button', 'Buscar'));
    expect(names()).toEqual(['Auditor (obsoleto)']);
    expect($$('#rf-active option').map((o) => o.textContent)).toEqual(['Todos', 'Sí', 'No']);
  });

  test('sin coincidencias avisa "No se encontraron resultados."', async () => {
    await open('/roles?name=zzz');
    expect(text()).toContain('No se encontraron resultados.');
    expect($('table')).toBeNull();
  });

  test('ordena ascendente y descendente por cada columna y lo conserva al recargar', async () => {
    await open('/roles');
    await click(byText('button.th-sort', 'Permisos asignados ↕'));
    expect($$('th').find((th) => th.textContent.startsWith('Permisos')).getAttribute('aria-sort')).toBe('ascending');
    expect(names()[0]).toBe('Consulta'); // 0 permisos
    await click($$('button.th-sort').find((b) => b.textContent.startsWith('Permisos')));
    expect(names()[0]).toBe('Administrador'); // descendente
    expect(window.location.search).toContain('sort=permissionsCount');
    expect(window.location.search).toContain('order=desc');

    await open(`/roles${window.location.search}`); // recarga
    expect(names()[0]).toBe('Administrador');
    expect($$('th').filter((th) => th.getAttribute('aria-sort'))).toHaveLength(1);
    expect($$('thead th').find((th) => th.textContent === 'Acciones').querySelector('button')).toBeNull(); // Acciones no se ordena
  });

  test('paginada: filas por página, rango y navegación conservando orden y filtros', async () => {
    for (let i = 1; i <= 8; i += 1) await roleService.create({ name: `Rol ${String(i).padStart(2, '0')}`, description: 'prueba', permissionCodes: [] });
    await open('/roles?sort=name&order=desc');
    expect(text()).toContain('Mostrando 1–10 de 13');
    expect(names()[0]).toBe('Rol 08');
    expect(byText('button', 'Anterior').disabled).toBe(true);
    await click(byText('button', 'Siguiente'));
    expect(text()).toContain('Mostrando 11–13 de 13');
    expect(text()).toContain('Página 2 de 2');
    expect(names()).toHaveLength(3);
    expect(window.location.search).toContain('order=desc'); // el orden se mantiene
    await choose($('.pager select'), '20');
    expect(text()).toContain('Mostrando 1–13 de 13');
  });
});

describe('alta de rol', () => {
  test('"Crear rol" se habilita con nombre y descripción; el rol se crea activo por defecto', async () => {
    await open('/roles/nuevo');
    expect(byText('button', 'Crear rol').disabled).toBe(true);
    expect($$('input[name=active]').map((r) => r.checked)).toEqual([true, false]);
    await type($('#r-name'), 'Supervisor');
    expect(byText('button', 'Crear rol').disabled).toBe(true);
    await type($('#r-description'), 'Supervisa');
    expect(byText('button', 'Crear rol').disabled).toBe(false);
  });

  test('permisos agrupados por módulo, y solo los activos', async () => {
    patch((d) => { d.modules.find((m) => m.code === 'modelos').active = false; d.permissions.find((p) => p.code === 'audit.view').active = false; });
    await open('/roles/nuevo');
    expect($$('.perm-module legend').map((l) => l.textContent)).toEqual(['Administración', 'Predicción']); // Modelos inactivo: no aparece
    const labels = $$('.perm span:not(.tag)').map((s) => s.textContent);
    expect(labels).toContain('Gestión de usuarios');
    expect(labels).not.toContain('Consulta de auditoría'); // permiso inactivo
    expect(labels).not.toContain('Gestión de modelos');
  });

  test('crea el rol con permisos, vuelve a la consulta con la confirmación y lo muestra con su cantidad de permisos', async () => {
    await open('/roles/nuevo');
    await type($('#r-name'), 'Supervisor');
    await type($('#r-description'), 'Supervisa la operación');
    await click($$('.perm input')[0]); // Gestión de usuarios
    await click(byText('button', 'Crear rol'));
    expect(window.location.pathname).toBe('/roles');
    expect(text()).toContain('El rol "Supervisor" se creó correctamente.');
    expect(rows().find((r) => r[0] === 'Supervisor')).toEqual(['Supervisor', 'Supervisa la operación', 'Sí', '0', '1', 'Ver / Editar']);
    expect(window.history.state?.usr?.notice).toBeUndefined(); // el aviso no se repite al recargar
  });

  test('puede crearse sin permisos y como inactivo', async () => {
    await open('/roles/nuevo');
    await type($('#r-name'), 'Borrador');
    await type($('#r-description'), 'Aún sin permisos');
    await click($$('input[name=active]')[1]);
    await click(byText('button', 'Crear rol'));
    expect(rows().find((r) => r[0] === 'Borrador').slice(2, 5)).toEqual(['No', '0', '0']);
  });

  test('el nombre se normaliza al salir del campo', async () => {
    await open('/roles/nuevo');
    await type($('#r-name'), '   Jefe    de   Pozo ');
    await blur($('#r-name'));
    expect($('#r-name').value).toBe('Jefe de Pozo');
  });

  test('un nombre repetido (sin distinguir mayúsculas) se informa en el campo y no se crea', async () => {
    await open('/roles/nuevo');
    await type($('#r-name'), 'analista');
    await type($('#r-description'), 'Duplicado');
    await click(byText('button', 'Crear rol'));
    expect(text()).toContain('Ya existe un rol con ese nombre.');
    expect($('#r-name').getAttribute('aria-invalid')).toBe('true');
    expect(window.location.pathname).toBe('/roles/nuevo');
    expect(readDb().roles.filter((r) => r.name.toLowerCase() === 'analista')).toHaveLength(1);
  });

  test('Cancelar vuelve a la consulta sin guardar', async () => {
    await open('/roles/nuevo');
    await type($('#r-name'), 'NoSeGuarda');
    await click(byText('button', 'Cancelar'));
    expect(window.location.pathname).toBe('/roles');
    expect(readDb().roles.some((r) => r.name === 'NoSeGuarda')).toBe(false);
  });
});

describe('detalle y edición de rol', () => {
  test('nombre, estado y cantidades en solo lectura; descripción y permisos editables', async () => {
    await open(`/roles/${roleId('Analista')}`);
    const data = $('#role-data').closest('section').textContent;
    expect(data).toContain('AnalistaEstadoActivoUsuarios asignados0Permisos asignados2');
    expect($('#rd-description').value).toBe('Gestiona modelos y utiliza las predicciones.');
    expect(container.querySelector('input[name=name]')).toBeNull(); // el nombre no se edita
    const checked = $$('.perm input').filter((i) => i.checked).map((i) => i.nextSibling.textContent);
    expect(checked.sort()).toEqual(['Gestión de modelos', 'Uso de modelos']);
  });

  test('"Guardar cambios" solo se habilita con un cambio real; guarda y confirma', async () => {
    await open(`/roles/${roleId('Analista')}`);
    expect(byText('button', 'Guardar cambios').disabled).toBe(true);
    await type($('#rd-description'), 'Nueva descripción');
    expect(byText('button', 'Guardar cambios').disabled).toBe(false);
    await click($$('.perm input').find((i) => i.nextSibling.textContent === 'Consulta de auditoría')); // suma un permiso
    await click(byText('button', 'Guardar cambios'));
    expect(text()).toContain('Los cambios se guardaron correctamente.');
    expect(text()).toContain('Permisos asignados3');
    expect(byText('button', 'Guardar cambios').disabled).toBe(true);
    expect(readDb().audit.find((a) => a.action === 'ROLE_UPDATED').changes.map((c) => c.field)).toEqual(['description', 'permissions']);
  });

  test('la descripción no puede quedar vacía', async () => {
    await open(`/roles/${roleId('Analista')}`);
    await type($('#rd-description'), '   ');
    expect(text()).toContain('La descripción es obligatoria.');
    expect(byText('button', 'Guardar cambios').disabled).toBe(true);
  });

  test('permisos inactivos asociados siguen visibles y marcados, se pueden quitar y no volver a asignar; los no asociados no aparecen', async () => {
    patch((d) => {
      d.permissions.find((p) => p.code === 'models.manage').active = false; // asociado a Analista
      d.permissions.find((p) => p.code === 'audit.view').active = false; // no asociado
    });
    await open(`/roles/${roleId('Analista')}`);
    const label = (name) => $$('.perm').find((l) => l.textContent.includes(name));
    expect(label('Gestión de modelos').textContent).toContain('Inactivo');
    expect(label('Gestión de modelos').querySelector('input').checked).toBe(true);
    expect(label('Consulta de auditoría')).toBeUndefined(); // inactivo y no asociado: no se muestra

    await click(label('Gestión de modelos').querySelector('input')); // se quita
    const input = label('Gestión de modelos').querySelector('input');
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(true); // y ya no puede volver a asignarse
  });

  test('un módulo inactivo con permisos asociados se muestra identificado', async () => {
    patch((d) => { d.modules.find((m) => m.code === 'modelos').active = false; });
    await open(`/roles/${roleId('Analista')}`);
    expect($$('.perm-module legend').find((l) => l.textContent.startsWith('Modelos')).textContent).toContain('Módulo inactivo');
  });
});

describe('inactivar y reactivar', () => {
  test('inactivar pide confirmación con los avisos de la historia y deja el rol inactivo', async () => {
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst'] });
    await open(`/roles/${roleId('Analista')}`);
    await click(byText('button', 'Inactivar rol'));
    const body = dialog().textContent;
    expect(body).toContain('El rol dejará temporalmente de otorgar permisos.');
    expect(body).toContain('Los usuarios conservarán la asociación al rol.');
    expect(body).toContain('El rol dejará de estar disponible para nuevas asignaciones.');
    expect(body).toContain('Las sesiones existentes no se ven afectadas: el cambio se aplicará en el próximo login.');

    await confirmWith('Inactivar rol');
    expect(text()).toContain('El rol quedó inactivo.');
    expect($('#role-data').closest('section').textContent).toContain('Inactivo');
    expect(text()).toContain('Usuarios asignados1'); // conserva a sus usuarios
    expect(text()).toContain('Permisos asignados2'); // y sus permisos
    expect(byText('button', 'Inactivar rol')).toBeUndefined();
  });

  test('cancelar la confirmación no cambia nada', async () => {
    await open(`/roles/${roleId('Analista')}`);
    await click(byText('button', 'Inactivar rol'));
    await click([...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Cancelar'));
    expect(readDb().roles.find((r) => r.name === 'Analista').active).toBe(true);
  });

  test('reactivar pide confirmación con los avisos de la historia y vuelve a dejarlo activo', async () => {
    await open(`/roles/${roleId('Auditor (obsoleto)')}`);
    await click(byText('button', 'Reactivar rol'));
    const body = dialog().textContent;
    expect(body).toContain('El rol volverá a estar activo.');
    expect(body).toContain('Los usuarios asociados volverán a recibir los permisos activos actualmente configurados en el rol.');
    expect(body).toContain('El rol volverá a estar disponible para nuevas asignaciones.');
    expect(body).toContain('el cambio se aplicará en el próximo login');
    await confirmWith('Reactivar rol');
    expect($('#role-data').closest('section').textContent).toContain('Activo');
    expect(byText('button', 'Reactivar rol')).toBeUndefined();
    expect(byText('button', 'Inactivar rol')).toBeTruthy();
  });
});

describe('eliminar', () => {
  test('con usuarios asignados no se ofrece, y se explica cómo proceder', async () => {
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['operator'] });
    await open(`/roles/${roleId('Operador')}`);
    expect(byText('button', 'Eliminar rol')).toBeUndefined();
    expect(text()).toContain('primero deben quitarse todas las asignaciones de usuarios');
  });

  test('si algún usuario lo tomó mientras tanto, el servidor lo rechaza informando el motivo', async () => {
    await open(`/roles/${roleId('Operador')}`);
    await click(byText('button', 'Eliminar rol')); // abre la confirmación: todavía no hay usuarios
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['operator'] });
    await confirmWith('Eliminar rol');
    expect(text()).toContain('Primero deben quitarse todas las asignaciones de usuarios');
    expect(readDb().roles.some((r) => r.name === 'Operador')).toBe(true);
  });

  test('sin usuarios: pide confirmación (definitiva), elimina y vuelve a la consulta', async () => {
    await open(`/roles/${roleId('Operador')}`);
    await click(byText('button', 'Eliminar rol'));
    expect(dialog().textContent).toContain('La eliminación es definitiva.');
    expect(dialog().textContent).toContain('todas las relaciones del rol con sus permisos');
    await confirmWith('Eliminar rol');
    expect(window.location.pathname).toBe('/roles');
    expect(text()).toContain('El rol "Operador" se eliminó correctamente.');
    expect(names()).not.toContain('Operador');
    expect(readDb().audit.find((a) => a.action === 'ROLE_DELETED').values.permissions).toEqual(['predictions.use']);
  });
});

describe('rol protegido Administrador', () => {
  test('se consulta, pero todo queda bloqueado: sin edición, sin inactivar y sin eliminar', async () => {
    await open(`/roles/${roleId('Administrador')}`);
    expect(text()).toContain('Rol protegido del sistema');
    expect($('#rd-description').disabled).toBe(true);
    expect($$('.perm input').every((i) => i.disabled)).toBe(true);
    expect($$('.perm input').filter((i) => i.checked)).toHaveLength(7); // se ven sus permisos
    expect(byText('button', 'Guardar cambios').disabled).toBe(true);
    ['Inactivar rol', 'Reactivar rol', 'Eliminar rol'].forEach((label) => expect(byText('button', label)).toBeUndefined());
    expect($('#role-actions')).toBeNull();
  });
});

describe('acceso', () => {
  test('sin "Gestión de roles" no se puede entrar a ninguna pantalla del módulo', async () => {
    const { temporaryPassword } = await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst'] });
    const session = await authService.login({ email: 'a@tpp.com', password: temporaryPassword });
    sessionStore.set({ ...session, user: { ...session.user, mustChangePassword: false } });
    for (const path of ['/roles', '/roles/nuevo', `/roles/${roleId('Analista')}`]) {
      await open(path); // eslint-disable-line no-await-in-loop
      expect(text()).toContain('Sin acceso');
    }
    expect($$('.sidebar a').map((a) => a.textContent.trim())).not.toContain('Roles');
  });

  test('el detalle de un rol inexistente avisa y permite volver', async () => {
    await open('/roles/r-inexistente');
    expect(text()).toContain('No se encontró el rol');
    expect($('a.back').getAttribute('href')).toBe('/roles');
  });
});
