import { userService } from './userService';
import { authService } from '../auth/authService';
import { readDb, writeDb } from '../../mock/db';
import { sessionStore } from '../../shared/utils/session';

const as = (email) => sessionStore.set({ token: 't', user: { email } });
beforeEach(() => { localStorage.clear(); as('demo@tpp.com'); });

const valid = { firstName: '  Ana   María ', lastName: ' Pérez ', email: '  Ana.Perez@TPP.com ', active: true, roleIds: ['analyst'] };
const make = (over = {}) => userService.create({ ...valid, ...over });

describe('US-01 alta', () => {
  test('normaliza, genera contraseña temporal y audita; la contraseña no queda en el storage', async () => {
    const { user, temporaryPassword } = await make();
    expect(user).toMatchObject({ firstName: 'Ana María', lastName: 'Pérez', email: 'ana.perez@tpp.com' });
    expect(temporaryPassword).toHaveLength(12);
    expect(readDb().audit[0]).toMatchObject({ action: 'USER_CREATED', actor: 'demo@tpp.com', target: 'ana.perez@tpp.com' });
    expect(localStorage.getItem('tpp.mock-db')).not.toContain(temporaryPassword);
  });

  test('rechaza email repetido aunque cambien las mayúsculas', async () => {
    await make();
    await expect(make({ email: 'ANA.PEREZ@tpp.com' })).rejects.toMatchObject({ status: 409, field: 'email' });
  });

  test('rechaza dominio inactivo, nombre vacío y roles inválidos', async () => {
    await expect(make({ email: 'x@viejo.com' })).rejects.toMatchObject({ field: 'email' });
    await expect(make({ firstName: '   ' })).rejects.toMatchObject({ field: 'firstName' });
    await expect(make({ roleIds: [] })).rejects.toMatchObject({ field: 'roleIds' });
    await expect(make({ roleIds: ['legacy'] })).rejects.toMatchObject({ field: 'roleIds' });
  });

  test('usuario inactivo no puede ingresar; con clave temporal debe cambiarla', async () => {
    const off = await make({ active: false });
    await expect(authService.login({ email: 'ana.perez@tpp.com', password: off.temporaryPassword })).rejects.toMatchObject({ status: 401 });
    const on = await make({ email: 'luis@tpp.com' });
    const session = await authService.login({ email: 'luis@tpp.com', password: on.temporaryPassword });
    expect(session.user.mustChangePassword).toBe(true);
  });

  test('sin el permiso Gestión de usuarios, el backend rechaza', async () => {
    await make();
    as('ana.perez@tpp.com'); // rol Analista
    await expect(userService.list()).rejects.toMatchObject({ status: 403 });
    await expect(make({ email: 'otro@tpp.com' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('US-02 modificación', () => {
  test('normaliza y audita valor anterior y nuevo por cada campo modificado', async () => {
    const { user } = await make();
    const updated = await userService.update(user.id, { firstName: '  Ana  Lucía ', lastName: 'Pérez', roleIds: ['analyst', 'operator'] });
    expect(updated).toMatchObject({ firstName: 'Ana Lucía', email: 'ana.perez@tpp.com' }); // el email no cambia
    const entry = readDb().audit.find((a) => a.action === 'USER_UPDATED');
    expect(entry).toMatchObject({ actor: 'demo@tpp.com', target: 'ana.perez@tpp.com' });
    expect(entry.changes).toEqual([
      { field: 'firstName', before: 'Ana María', after: 'Ana Lucía' },
      { field: 'roles', before: ['Analista'], after: ['Analista', 'Operador'] },
    ]);
  });

  test('sin cambios no hay modificación ni auditoría', async () => {
    const { user } = await make();
    await userService.update(user.id, { firstName: 'Ana María', lastName: 'Pérez', roleIds: ['analyst'] });
    expect(readDb().audit.some((a) => a.action === 'USER_UPDATED')).toBe(false);
  });

  test('nombre y apellido obligatorios, al menos un rol y solo se agregan roles activos', async () => {
    const { user } = await make();
    const base = { firstName: 'Ana', lastName: 'Pérez', roleIds: ['analyst'] };
    await expect(userService.update(user.id, { ...base, firstName: '   ' })).rejects.toMatchObject({ field: 'firstName' });
    await expect(userService.update(user.id, { ...base, lastName: '' })).rejects.toMatchObject({ field: 'lastName' });
    await expect(userService.update(user.id, { ...base, roleIds: [] })).rejects.toMatchObject({ field: 'roleIds' });
    await expect(userService.update(user.id, { ...base, roleIds: ['analyst', 'legacy'] })).rejects.toMatchObject({ field: 'roleIds' });
  });

  test('un rol inactivo que ya tenía se puede conservar', async () => {
    const { user } = await make();
    const db = readDb();
    db.users.find((u) => u.id === user.id).roles = ['legacy', 'analyst'];
    writeDb(db);
    const updated = await userService.update(user.id, { firstName: 'Ana', lastName: 'Pérez', roleIds: ['legacy', 'operator'] });
    expect(updated.roles.map((r) => r.id)).toEqual(['operator', 'legacy']);
  });

  test('nadie se modifica ni ejecuta acciones administrativas sobre sí mismo', async () => {
    const data = { firstName: 'X', lastName: 'Y', roleIds: ['admin'] };
    await expect(userService.update('u-demo', data)).rejects.toMatchObject({ status: 403 });
    await expect(userService.deactivate('u-demo')).rejects.toMatchObject({ status: 403 });
    await expect(userService.reactivate('u-demo')).rejects.toMatchObject({ status: 403 });
    await expect(userService.generateTemporaryPassword('u-demo')).rejects.toMatchObject({ status: 403 });
    expect((await userService.get('u-demo')).firstName).toBe('Usuario'); // consultar sí se puede
  });

  test('baja: inactivo no inicia sesión, se audita y conserva datos y roles', async () => {
    const { user, temporaryPassword } = await make();
    const off = await userService.deactivate(user.id);
    expect(off).toMatchObject({ active: false, email: user.email, firstName: 'Ana María' });
    expect(off.roles.map((r) => r.id)).toEqual(['analyst']);
    await expect(userService.deactivate(user.id)).rejects.toMatchObject({ status: 409 });
    await expect(authService.login({ email: user.email, password: temporaryPassword })).rejects.toMatchObject({ status: 401 });
    expect(readDb().audit.some((a) => a.action === 'USER_DEACTIVATED')).toBe(true);
  });

  test('US-03: reactivar genera contraseña nueva, invalida la anterior y reinicia el estado', async () => {
    const { user, temporaryPassword: first } = await make({ active: false });
    const db = readDb();
    Object.assign(db.users.find((u) => u.id === user.id), { blocked: true, failedAttempts: 3, mustChangePassword: false });
    writeDb(db);

    const { user: back, temporaryPassword: second } = await userService.reactivate(user.id);
    expect(second).toHaveLength(12);
    expect(second).not.toBe(first);
    expect(back).toMatchObject({ active: true, blocked: false, failedAttempts: 0, mustChangePassword: true });
    expect(localStorage.getItem('tpp.mock-db')).not.toContain(second);

    await expect(authService.login({ email: user.email, password: first })).rejects.toMatchObject({ status: 401 });
    const session = await authService.login({ email: user.email, password: second });
    expect(session.user.mustChangePassword).toBe(true);

    const entry = readDb().audit.find((a) => a.action === 'USER_REACTIVATED');
    expect(entry.changes.map((c) => c.field)).toEqual(['active', 'blocked', 'failedAttempts', 'mustChangePassword']);
    expect(JSON.stringify(entry)).not.toContain(second);
  });

  test('reactivar a un usuario activo se rechaza', async () => {
    const { user } = await make();
    await expect(userService.reactivate(user.id)).rejects.toMatchObject({ status: 409 });
  });

  test('nueva contraseña temporal: reemplaza a la anterior, exige cambio y no queda guardada', async () => {
    const { user, temporaryPassword: first } = await make();
    const { user: after, temporaryPassword: second } = await userService.generateTemporaryPassword(user.id);
    expect(second).not.toBe(first);
    expect(after.mustChangePassword).toBe(true);
    expect(localStorage.getItem('tpp.mock-db')).not.toContain(second);
    await expect(authService.login({ email: user.email, password: first })).rejects.toMatchObject({ status: 401 });
    await expect(authService.login({ email: user.email, password: second })).resolves.toBeDefined();
  });

  test('el detalle expone los estados de solo lectura', async () => {
    const { user } = await make();
    expect(await userService.get(user.id)).toMatchObject({ active: true, blocked: false, failedAttempts: 0, mustChangePassword: true });
  });
});

describe('US-04 consulta de usuarios', () => {
  // demo (Usuario Demo, admin) + Ana María Pérez + Luis Gómez + Marta Pérez Díaz
  beforeEach(async () => {
    await make();
    await make({ firstName: 'Luis', lastName: 'Gómez', email: 'luis@gmail.com', roleIds: ['operator'] });
    await make({ firstName: 'Marta', lastName: 'Pérez Díaz', email: 'marta@tpp.com', roleIds: ['analyst', 'operator'], active: false });
  });
  const emails = (r) => r.items.map((u) => u.email);

  test('sin filtros trae todo, ordenado por email, con los datos que muestra la grilla', async () => {
    const r = await userService.list();
    expect(emails(r)).toEqual(['ana.perez@tpp.com', 'demo@tpp.com', 'luis@gmail.com', 'marta@tpp.com']);
    expect(r).toMatchObject({ total: 4, page: 1, pageSize: 10 });
    expect(r.items[0]).toMatchObject({ firstName: 'Ana María', lastName: 'Pérez', active: true, blocked: false });
  });

  test('email, nombre y apellido: coincidencia parcial sin distinguir mayúsculas', async () => {
    expect(emails(await userService.list({ email: 'GMAIL' }))).toEqual(['luis@gmail.com']);
    expect(emails(await userService.list({ firstName: 'mar' }))).toEqual(['ana.perez@tpp.com', 'marta@tpp.com']);
    expect(emails(await userService.list({ lastName: 'PÉREZ' }))).toEqual(['ana.perez@tpp.com', 'marta@tpp.com']);
  });

  test('los filtros se combinan con AND', async () => {
    expect(emails(await userService.list({ lastName: 'pérez', active: true }))).toEqual(['ana.perez@tpp.com']);
    expect(emails(await userService.list({ lastName: 'pérez', active: false, roleIds: ['operator'] }))).toEqual(['marta@tpp.com']);
    expect((await userService.list({ email: 'luis', lastName: 'pérez' })).total).toBe(0);
  });

  test('activo y credencial bloqueada', async () => {
    const db = readDb();
    db.users.find((u) => u.email === 'luis@gmail.com').blocked = true;
    writeDb(db);
    expect(emails(await userService.list({ active: false }))).toEqual(['marta@tpp.com']);
    expect(emails(await userService.list({ blocked: true }))).toEqual(['luis@gmail.com']);
    expect((await userService.list({ blocked: false })).total).toBe(3);
  });

  test('roles: OR entre los elegidos; sin elegir, no filtra; los inactivos también se pueden filtrar', async () => {
    expect(emails(await userService.list({ roleIds: ['operator'] }))).toEqual(['luis@gmail.com', 'marta@tpp.com']);
    expect(emails(await userService.list({ roleIds: ['admin', 'operator'] }))).toEqual(['demo@tpp.com', 'luis@gmail.com', 'marta@tpp.com']);
    expect((await userService.list({ roleIds: [] })).total).toBe(4);
    expect((await userService.list({ roleIds: ['legacy'] })).total).toBe(0); // rol inactivo: filtro válido
    expect((await userService.listRoles()).find((r) => r.id === 'legacy').active).toBe(false); // viene marcado para el (*)
  });

  test('orden ascendente y descendente por columna; Roles no se ordena', async () => {
    expect((await userService.list({ sort: 'lastName', order: 'desc' })).items.map((u) => u.lastName))
      .toEqual(['Pérez Díaz', 'Pérez', 'Gómez', 'Demo']);
    expect((await userService.list({ sort: 'active', order: 'asc' })).items[0].email).toBe('marta@tpp.com'); // No primero
    expect(emails(await userService.list({ sort: 'roles', order: 'desc' }))).toEqual(emails(await userService.list())); // ignorado
  });

  test('paginación: tamaño de página, orden y filtros se conservan entre páginas', async () => {
    // "z" aparece en Pérez, Gómez y Pérez Díaz (3 de los 4 usuarios): el filtro y el orden valen en todas las páginas.
    const query = { lastName: 'z', sort: 'email', order: 'desc', pageSize: 2 };
    const p1 = await userService.list({ ...query, page: 1 });
    const p2 = await userService.list({ ...query, page: 2 });
    expect(emails(p1)).toEqual(['marta@tpp.com', 'luis@gmail.com']);
    expect(emails(p2)).toEqual(['ana.perez@tpp.com']);
    expect(p2).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect((await userService.list({ pageSize: 3, page: 99 })).page).toBe(2); // página fuera de rango: se ajusta
  });

  test('sin coincidencias devuelve lista vacía con total 0', async () => {
    expect(await userService.list({ email: 'no-existe' })).toMatchObject({ items: [], total: 0 });
  });
});
