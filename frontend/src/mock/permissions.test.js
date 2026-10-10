import { readDb, writeDb, effectivePermissions } from './db';
import { userService } from '../features/users/userService';
import { authService } from '../features/auth/authService';
import { sessionStore } from '../shared/utils/session';

beforeEach(() => localStorage.clear());

const perms = (roles) => effectivePermissions(readDb(), { roles }).sort();
const patch = (fn) => { const db = readDb(); fn(db); writeDb(db); };

describe('US-06 permisos efectivos', () => {
  test('son la unión de los permisos de los roles activos del usuario', () => {
    expect(perms(['analyst'])).toEqual(['models.manage', 'predictions.use']);
    expect(perms(['operator'])).toEqual(['predictions.use']);
    expect(perms(['analyst', 'operator'])).toEqual(['models.manage', 'predictions.use']); // sin duplicados
    expect(perms(['viewer'])).toEqual([]); // un rol puede tener cero permisos
    expect(perms(['admin'])).toHaveLength(6);
  });

  test('un rol inactivo no otorga permisos', () => {
    expect(readDb().roles.find((r) => r.id === 'legacy').permissions).toContain('audit.view'); // los tiene asignados...
    expect(perms(['legacy'])).toEqual([]); // ...pero no los otorga
    patch((db) => { db.roles.find((r) => r.id === 'analyst').active = false; });
    expect(perms(['analyst'])).toEqual([]);
  });

  test('un permiso inactivo no otorga acceso aunque el rol esté activo', () => {
    patch((db) => { db.permissions.find((p) => p.code === 'models.manage').active = false; });
    expect(perms(['analyst'])).toEqual(['predictions.use']);
  });

  test('un módulo inactivo deshabilita sus permisos; al reactivarlo vuelven', () => {
    patch((db) => { db.modules.find((m) => m.code === 'modelos').active = false; });
    expect(perms(['analyst'])).toEqual(['predictions.use']);
    expect(readDb().roles.find((r) => r.id === 'analyst').permissions).toContain('models.manage'); // no se borró la asociación
    patch((db) => { db.modules.find((m) => m.code === 'modelos').active = true; });
    expect(perms(['analyst'])).toEqual(['models.manage', 'predictions.use']);
  });

  test('si varios roles dan el mismo permiso, se conserva mientras uno siga activo', () => {
    patch((db) => { db.roles.find((r) => r.id === 'analyst').active = false; });
    expect(perms(['analyst', 'operator'])).toEqual(['predictions.use']);
  });

  test('todo permiso pertenece a un módulo existente', () => {
    const db = readDb();
    db.permissions.forEach((p) => expect(db.modules.some((m) => m.code === p.module)).toBe(true));
  });

  test('el login devuelve solo los permisos efectivos', async () => {
    const { user } = await authService.login({ email: 'demo@tpp.com', password: 'demo1234' });
    expect(user.permissions.sort()).toEqual(perms(['admin']));
    patch((db) => { db.modules.find((m) => m.code === 'administracion').active = false; });
    const again = await authService.login({ email: 'demo@tpp.com', password: 'demo1234' });
    expect(again.user.permissions).toEqual(['models.manage', 'predictions.use']);
  });

  test('el backend rechaza aunque el menú se vea: si el rol deja de estar activo, el acceso directo da 403', async () => {
    sessionStore.set({ token: 't', user: { email: 'demo@tpp.com' } });
    await expect(userService.list()).resolves.toBeDefined();
    patch((db) => { db.roles.find((r) => r.id === 'admin').active = false; });
    await expect(userService.list()).rejects.toMatchObject({ status: 403 });
  });
});
