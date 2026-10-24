import { roleService } from '../features/roles/roleService';
import { userService } from '../features/users/userService';
import { authService } from '../features/auth/authService';
import { sessionStore } from '../shared/utils/session';
import { readDb, writeDb, toSession } from './db';

beforeEach(() => { localStorage.clear(); asUser('demo@tpp.com'); });

const db = () => readDb();
const patch = (fn) => { const d = db(); fn(d); writeDb(d); };
const asUser = (email) => { const d = db(); sessionStore.set(toSession(d, d.users.find((u) => u.email === email))); };
const roleByName = (name) => db().roles.find((r) => r.name === name);
const audit = (action) => db().audit.filter((a) => a.action === action);
const names = (result) => result.items.map((r) => r.name);
const valid = { name: 'Supervisor', description: 'Supervisa la operación', permissionCodes: [] };

describe('acceso', () => {
  test('requiere el permiso "Gestión de roles" en todas las operaciones', async () => {
    const { temporaryPassword } = await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst'] });
    expect(temporaryPassword).toBeTruthy();
    asUser('a@tpp.com'); // Analista: sin "Gestión de roles"
    const id = roleByName('Operador').id;
    await Promise.all([
      roleService.list(), roleService.get(id), roleService.permissionsCatalog(), roleService.create(valid),
      roleService.update(id, { description: 'x' }), roleService.deactivate(id), roleService.remove(id),
    ].map((call) => expect(call).rejects.toMatchObject({ status: 403 })));
  });
});

describe('consulta', () => {
  test('grilla con nombre, descripción, activo y las dos cantidades; por defecto ordenada por nombre', async () => {
    const result = await roleService.list();
    expect(names(result)).toEqual(['Administrador', 'Analista', 'Auditor (obsoleto)', 'Consulta', 'Operador']);
    expect(result.items[0]).toMatchObject({ name: 'Administrador', active: true, usersCount: 1, permissionsCount: 7, protected: true });
    expect(result.items[0].description).toBeTruthy();
  });

  test('cantidad de permisos = todas las relaciones, también con permisos hoy inactivos; cantidad de usuarios cuenta a todos los asignados', async () => {
    patch((d) => { d.permissions.find((p) => p.code === 'models.manage').active = false; });
    const analista = (await roleService.list({ name: 'Analista' })).items[0];
    expect(analista.permissionsCount).toBe(2); // incluye el inactivo
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: false, roleIds: ['analyst'] }); // usuario inactivo
    expect((await roleService.list({ name: 'Analista' })).items[0].usersCount).toBe(1);
  });

  test('filtros por nombre y descripción: parcial, sin distinguir mayúsculas y sin espacios en los bordes', async () => {
    expect(names(await roleService.list({ name: '  ANALI ' }))).toEqual(['Analista']);
    expect(names(await roleService.list({ description: ' PREDICCIONES ' }))).toEqual(['Analista']);
    expect(names(await roleService.list({ name: 'zzz' }))).toEqual([]);
  });

  test('filtro por Activo: todos, sí, no', async () => {
    expect((await roleService.list({})).total).toBe(5);
    expect(names(await roleService.list({ active: false }))).toEqual(['Auditor (obsoleto)']);
    expect((await roleService.list({ active: true })).total).toBe(4);
  });

  test('los filtros se combinan', async () => {
    expect(names(await roleService.list({ name: 'a', active: true }))).toEqual(['Administrador', 'Analista', 'Consulta', 'Operador']);
    expect(names(await roleService.list({ name: 'a', active: false }))).toEqual(['Auditor (obsoleto)']);
  });

  test('ordena ascendente o descendente por nombre, descripción, activo, cantidad de usuarios y de permisos', async () => {
    expect(names(await roleService.list({ sort: 'name', order: 'desc' }))[0]).toBe('Operador');
    expect(names(await roleService.list({ sort: 'description', order: 'asc' }))[0]).toBe('Consulta'); // "Acceso básico…" antes que "Acceso total…"
    expect(names(await roleService.list({ sort: 'active', order: 'asc' }))[0]).toBe('Auditor (obsoleto)'); // No primero
    expect(names(await roleService.list({ sort: 'usersCount', order: 'desc' }))[0]).toBe('Administrador');
    expect(names(await roleService.list({ sort: 'permissionsCount', order: 'desc' })).slice(0, 2)).toEqual(['Administrador', 'Analista']);
    expect(names(await roleService.list({ sort: 'permissionsCount', order: 'asc' }))[0]).toBe('Consulta');
  });

  test('paginada: conserva filtros y orden entre páginas', async () => {
    const q = { sort: 'name', order: 'desc', pageSize: 2 };
    expect(names(await roleService.list({ ...q, page: 1 }))).toEqual(['Operador', 'Consulta']);
    const p3 = await roleService.list({ ...q, page: 3 });
    expect(names(p3)).toEqual(['Administrador']);
    expect(p3).toMatchObject({ total: 5, page: 3, pageSize: 2 });
    expect((await roleService.list({ ...q, page: 99 })).page).toBe(3);
  });
});

describe('alta', () => {
  test('nombre y descripción son obligatorios (también si solo traen espacios)', async () => {
    await expect(roleService.create({ ...valid, name: '   ' })).rejects.toMatchObject({ status: 422, field: 'name' });
    await expect(roleService.create({ ...valid, description: '  ' })).rejects.toMatchObject({ status: 422, field: 'description' });
  });

  test('normaliza el nombre: espacios en los bordes y múltiples espacios internos', async () => {
    const role = await roleService.create({ ...valid, name: '   Jefe    de   Pozo  ' });
    expect(role.name).toBe('Jefe de Pozo');
  });

  test('el nombre es único sin distinguir mayúsculas, sobre el valor ya normalizado', async () => {
    await expect(roleService.create({ ...valid, name: 'analista' })).rejects.toMatchObject({ status: 409, field: 'name' });
    await expect(roleService.create({ ...valid, name: '  ANALISTA ' })).rejects.toMatchObject({ status: 409 });
    await roleService.create({ ...valid, name: 'Jefe  de Pozo' });
    await expect(roleService.create({ ...valid, name: 'jefe de   pozo' })).rejects.toMatchObject({ status: 409 });
  });

  test('por defecto se crea activo, y puede crearse inactivo', async () => {
    expect((await roleService.create(valid)).active).toBe(true);
    expect((await roleService.create({ ...valid, name: 'Otro', active: false })).active).toBe(false);
  });

  test('puede existir sin permisos', async () => {
    expect(await roleService.create(valid)).toMatchObject({ permissionsCount: 0, permissions: [] });
  });

  test('solo se asignan permisos activos de módulos activos', async () => {
    patch((d) => { d.permissions.find((p) => p.code === 'audit.view').active = false; d.modules.find((m) => m.code === 'prediccion').active = false; });
    await expect(roleService.create({ ...valid, permissionCodes: ['audit.view'] })).rejects.toMatchObject({ status: 422, field: 'permissionCodes' }); // permiso inactivo
    await expect(roleService.create({ ...valid, permissionCodes: ['predictions.use'] })).rejects.toMatchObject({ status: 422 }); // módulo inactivo
    await expect(roleService.create({ ...valid, permissionCodes: ['no.existe'] })).rejects.toMatchObject({ status: 422 });
    expect((await roleService.create({ ...valid, permissionCodes: ['users.manage', 'users.manage'] })).permissions).toEqual(['users.manage']); // sin duplicados
  });

  test('queda auditado con los valores iniciales', async () => {
    await roleService.create({ ...valid, permissionCodes: ['models.manage', 'audit.view'] });
    expect(audit('ROLE_CREATED')[0]).toMatchObject({ actor: 'demo@tpp.com', target: 'Supervisor',
      values: { name: 'Supervisor', description: 'Supervisa la operación', active: true, permissions: ['audit.view', 'models.manage'] } });
  });

  test('un rol inactivo no puede asignarse a nuevos usuarios, y uno activo sí', async () => {
    await roleService.create({ ...valid, active: false });
    const inactiveId = roleByName('Supervisor').id;
    const user = { firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true };
    await expect(userService.create({ ...user, roleIds: [inactiveId] })).rejects.toMatchObject({ field: 'roleIds' });
    await expect(userService.create({ ...user, roleIds: ['analyst'] })).resolves.toBeDefined();
  });
});

describe('modificación', () => {
  const id = () => roleByName('Analista').id;

  test('el nombre no se puede modificar aunque llegue en la petición', async () => {
    const role = await roleService.update(id(), { name: 'Otro Nombre', description: 'Nueva descripción' });
    expect(role.name).toBe('Analista');
    expect(roleByName('Otro Nombre')).toBeUndefined();
  });

  test('la descripción es obligatoria', async () => {
    await expect(roleService.update(id(), { description: '   ' })).rejects.toMatchObject({ status: 422, field: 'description' });
  });

  test('descripción, permisos y estado se modifican; audita valor anterior y nuevo', async () => {
    await roleService.update(id(), { description: 'Nueva', permissionCodes: ['predictions.use', 'audit.view'] });
    expect(audit('ROLE_UPDATED')[0].changes).toEqual([
      { field: 'description', before: 'Gestiona modelos y utiliza las predicciones.', after: 'Nueva' },
      { field: 'permissions', before: ['models.manage', 'predictions.use'], after: ['audit.view', 'predictions.use'] },
    ]);
  });

  test('sin cambios reales no modifica ni audita', async () => {
    const role = roleByName('Analista');
    await roleService.update(id(), { description: `  ${role.description} `, permissionCodes: [...role.permissions].reverse() });
    expect(audit('ROLE_UPDATED')).toHaveLength(0);
  });

  test('puede dejarse sin permisos', async () => {
    expect((await roleService.update(id(), { description: 'x', permissionCodes: [] })).permissionsCount).toBe(0);
  });

  test('un permiso asociado que quedó inactivo se conserva, puede quitarse, pero no volver a asignarse', async () => {
    patch((d) => { d.permissions.find((p) => p.code === 'models.manage').active = false; });
    const keep = await roleService.update(id(), { description: 'nueva', permissionCodes: ['models.manage', 'predictions.use'] });
    expect(keep.permissions).toContain('models.manage'); // se conserva aunque esté inactivo
    await roleService.update(id(), { description: 'nueva', permissionCodes: ['predictions.use'] }); // se quita
    await expect(roleService.update(id(), { description: 'nueva', permissionCodes: ['models.manage', 'predictions.use'] }))
      .rejects.toMatchObject({ status: 422, field: 'permissionCodes' }); // ya no puede volver a asignarse
  });

  test('un permiso asociado de un módulo inactivo se trata igual', async () => {
    patch((d) => { d.modules.find((m) => m.code === 'modelos').active = false; });
    expect((await roleService.get(id())).permissions).toContain('models.manage');
    await expect(roleService.update(roleByName('Operador').id, { description: 'x', permissionCodes: ['models.manage'] })).rejects.toMatchObject({ status: 422 });
  });
});

describe('rol protegido Administrador', () => {
  const id = () => roleByName('Administrador').id;

  test('puede consultarse', async () => {
    expect(await roleService.get(id())).toMatchObject({ name: 'Administrador', protected: true, permissionsCount: 7 });
  });

  test('no puede modificarse (descripción ni permisos), inactivarse ni eliminarse', async () => {
    await expect(roleService.update(id(), { description: 'otra' })).rejects.toMatchObject({ status: 403 });
    await expect(roleService.update(id(), { description: roleByName('Administrador').description, permissionCodes: [] })).rejects.toMatchObject({ status: 403 });
    await expect(roleService.deactivate(id())).rejects.toMatchObject({ status: 403 });
    await expect(roleService.remove(id())).rejects.toMatchObject({ status: 403, message: expect.stringContaining('protegido') });
    expect(roleByName('Administrador')).toMatchObject({ active: true, permissions: expect.any(Array) });
    expect(audit('ROLE_DEACTIVATED')).toHaveLength(0);
  });
});

describe('inactivación y reactivación', () => {
  test('inactivar conserva los usuarios y las relaciones con permisos, y se audita', async () => {
    const { user } = await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst'] });
    const role = await roleService.deactivate('analyst');
    expect(role).toMatchObject({ active: false, usersCount: 1, permissionsCount: 2 });
    expect(db().users.find((u) => u.id === user.id).roles).toEqual(['analyst']); // el usuario conserva el rol
    expect(audit('ROLE_DEACTIVATED')[0]).toMatchObject({ target: 'Analista', changes: [{ field: 'active', before: true, after: false }] });
    await expect(roleService.deactivate('analyst')).rejects.toMatchObject({ status: 409 });
  });

  test('mientras está inactivo no otorga permisos; al reactivarlo los vuelve a otorgar', async () => {
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst'] });
    const login = async () => (await authService.login({ email: 'a@tpp.com', password: await tempPasswordOf('a@tpp.com') })).user.permissions;
    // (la contraseña temporal se regenera para poder iniciar sesión en cada paso)
    async function tempPasswordOf(email) {
      asUser('demo@tpp.com');
      return (await userService.generateTemporaryPassword(db().users.find((u) => u.email === email).id)).temporaryPassword;
    }
    expect((await login()).sort()).toEqual(['models.manage', 'predictions.use']);
    asUser('demo@tpp.com');
    await roleService.deactivate('analyst');
    expect(await login()).toEqual([]);
    asUser('demo@tpp.com');
    await roleService.reactivate('analyst');
    expect((await login()).sort()).toEqual(['models.manage', 'predictions.use']);
    expect(audit('ROLE_ACTIVATED')).toHaveLength(1);
  });

  test('si un usuario tiene varios roles, sus permisos son la unión de los de sus roles activos', async () => {
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst', 'operator'] });
    const permissions = async () => {
      asUser('demo@tpp.com');
      const pw = (await userService.generateTemporaryPassword(db().users.find((u) => u.email === 'a@tpp.com').id)).temporaryPassword;
      asUser('demo@tpp.com');
      return (await authService.login({ email: 'a@tpp.com', password: pw })).user.permissions.sort();
    };
    expect(await permissions()).toEqual(['models.manage', 'predictions.use']);
    await roleService.deactivate('analyst'); // Operador sigue activo y aporta predictions.use
    expect(await permissions()).toEqual(['predictions.use']);
  });

  test('las sesiones existentes no se ven afectadas: el cambio se refleja en el próximo login', async () => {
    const { temporaryPassword } = await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['analyst'] });
    const open = await authService.login({ email: 'a@tpp.com', password: temporaryPassword }); // sesión abierta antes del cambio
    await roleService.update('analyst', { description: 'x', permissionCodes: ['users.manage'] }); // le da "Gestión de usuarios" y le quita lo demás
    await roleService.deactivate('analyst');
    sessionStore.set(open);
    expect(open.user.permissions.sort()).toEqual(['models.manage', 'predictions.use']); // conserva lo que tenía al entrar
    await expect(userService.list()).rejects.toMatchObject({ status: 403 }); // y sigue sin tener "Gestión de usuarios"
    asUser('demo@tpp.com');
    const pw = (await userService.generateTemporaryPassword(db().users.find((u) => u.email === 'a@tpp.com').id)).temporaryPassword;
    expect((await authService.login({ email: 'a@tpp.com', password: pw })).user.permissions).toEqual([]); // el próximo login ya lo refleja
  });
});

describe('eliminación', () => {
  test('con usuarios asignados se rechaza e informa el motivo', async () => {
    await userService.create({ firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roleIds: ['operator'] });
    await expect(roleService.remove('operator')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Primero deben quitarse todas las asignaciones de usuarios') });
    expect(roleByName('Operador')).toBeDefined();
    expect(audit('ROLE_DELETED')).toHaveLength(0);
  });

  test('sin usuarios se elimina (activo o inactivo), con sus relaciones con permisos, y se conservan los valores previos en la auditoría', async () => {
    await roleService.create({ ...valid, permissionCodes: ['models.manage', 'users.manage'] });
    const id = roleByName('Supervisor').id;
    expect(await roleService.remove(id)).toBeNull();
    expect(roleByName('Supervisor')).toBeUndefined();
    expect(db().roles.some((r) => r.id === id)).toBe(false);
    expect(audit('ROLE_DELETED')[0]).toMatchObject({ actor: 'demo@tpp.com', target: 'Supervisor',
      values: { name: 'Supervisor', description: 'Supervisa la operación', active: true, permissions: ['models.manage', 'users.manage'] } });

    await expect(roleService.remove(roleByName('Auditor (obsoleto)').id)).resolves.toBeNull(); // inactivo y sin usuarios
    await expect(roleService.get(id)).rejects.toMatchObject({ status: 404 });
  });

  test('un rol eliminado se puede volver a crear con el mismo nombre', async () => {
    await roleService.create(valid);
    await roleService.remove(roleByName('Supervisor').id);
    await expect(roleService.create(valid)).resolves.toMatchObject({ name: 'Supervisor' });
  });
});

describe('catálogo de permisos', () => {
  test('módulos con sus permisos y el estado de cada uno, en orden', async () => {
    const catalog = await roleService.permissionsCatalog();
    expect(catalog.map((m) => m.name)).toEqual(['Administración', 'Modelos', 'Predicción']);
    expect(catalog[0].permissions.map((p) => p.description)).toEqual(['Gestión de usuarios', 'Gestión de roles', 'Gestión de dominios', 'Consulta de auditoría', 'Consulta del sistema']);
    expect(catalog.flatMap((m) => m.permissions).every((p) => typeof p.active === 'boolean')).toBe(true);
  });
});
