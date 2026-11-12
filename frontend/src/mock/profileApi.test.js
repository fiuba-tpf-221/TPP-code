import { profileService } from '../features/profile/profileService';
import { userService } from '../features/users/userService';
import { authService } from '../features/auth/authService';
import { sessionStore } from '../shared/utils/session';
import { readDb, toSession } from './db';

beforeEach(() => localStorage.clear());

const db = () => readDb();
const userByEmail = (email) => db().users.find((u) => u.email === email);
const asUser = (email) => sessionStore.set(toSession(db(), userByEmail(email)));
// Crea un usuario con rol dado (como administrador) y deja la sesión iniciada como él.
async function createAndSignIn(roleId, email = 'lucia@tpp.com') {
  asUser('demo@tpp.com');
  const { temporaryPassword } = await userService.create({ firstName: 'Lucía', lastName: 'Gómez', email, active: true, roleIds: [roleId] });
  const mine = 'MiClave#2026';
  sessionStore.set(await authService.login({ email, password: temporaryPassword }));
  await authService.changePassword({ newPassword: mine }); // cambio obligatorio
  asUser(email);
  return mine;
}

describe('datos personales', () => {
  test('devuelve email, nombre y apellido del usuario autenticado', async () => {
    asUser('demo@tpp.com');
    expect(await profileService.get()).toMatchObject({ email: 'demo@tpp.com', firstName: 'Usuario', lastName: 'Demo' });
  });

  test('cualquier usuario autenticado puede usarlo, aunque no tenga ningún permiso', async () => {
    await createAndSignIn('viewer'); // rol Consulta: sin permisos
    expect((await profileService.get()).email).toBe('lucia@tpp.com');
    await expect(profileService.update({ firstName: 'Lu', lastName: 'Gómez' })).resolves.toMatchObject({ firstName: 'Lu' });
  });

  test('sin sesión se rechaza', async () => {
    await expect(profileService.get()).rejects.toMatchObject({ status: 401 });
  });

  test('normaliza (bordes y espacios internos), guarda y audita valor anterior y nuevo con actor = afectado', async () => {
    asUser('demo@tpp.com');
    const result = await profileService.update({ firstName: '  Ana   María ', lastName: ' Pérez  ' });
    expect(result).toMatchObject({ firstName: 'Ana María', lastName: 'Pérez', name: 'Ana María Pérez' });
    const entry = db().audit.find((a) => a.action === 'PROFILE_UPDATED');
    expect(entry).toMatchObject({ actor: 'demo@tpp.com', target: 'demo@tpp.com' });
    expect(entry.changes).toEqual([
      { field: 'firstName', before: 'Usuario', after: 'Ana María' },
      { field: 'lastName', before: 'Demo', after: 'Pérez' },
    ]);
  });

  test('audita solo el campo que cambió', async () => {
    asUser('demo@tpp.com');
    await profileService.update({ firstName: 'Usuario', lastName: 'Nuevo' });
    expect(db().audit.find((a) => a.action === 'PROFILE_UPDATED').changes).toEqual([{ field: 'lastName', before: 'Demo', after: 'Nuevo' }]);
  });

  test('si tras normalizar no hay cambio real, no modifica nada ni genera auditoría', async () => {
    asUser('demo@tpp.com');
    await profileService.update({ firstName: '  Usuario  ', lastName: 'Demo' });
    expect(db().audit.some((a) => a.action === 'PROFILE_UPDATED')).toBe(false);
  });

  test('nombre y apellido son obligatorios (también si solo traen espacios)', async () => {
    asUser('demo@tpp.com');
    await expect(profileService.update({ firstName: '   ', lastName: 'X' })).rejects.toMatchObject({ status: 422, field: 'firstName' });
    await expect(profileService.update({ firstName: 'X', lastName: '' })).rejects.toMatchObject({ status: 422, field: 'lastName' });
    expect(db().audit.some((a) => a.action === 'PROFILE_UPDATED')).toBe(false);
  });

  test('el email no se puede modificar, aunque llegue en la petición', async () => {
    asUser('demo@tpp.com');
    const result = await profileService.update({ firstName: 'A', lastName: 'B', email: 'otro@tpp.com' });
    expect(result.email).toBe('demo@tpp.com');
    expect(userByEmail('otro@tpp.com')).toBeUndefined();
  });
});

describe('cambio voluntario de contraseña', () => {
  test('la contraseña anterior deja de valer ya, la nueva sí, y queda auditado sin ningún valor de contraseña', async () => {
    asUser('demo@tpp.com');
    await profileService.changePassword({ currentPassword: 'demo1234', newPassword: 'Nueva#Clave9' });
    await expect(authService.login({ email: 'demo@tpp.com', password: 'demo1234' })).rejects.toMatchObject({ status: 401 });
    await expect(authService.login({ email: 'demo@tpp.com', password: 'Nueva#Clave9' })).resolves.toBeDefined();
    const entry = db().audit.find((a) => a.action === 'PASSWORD_CHANGED_VOLUNTARY');
    expect(entry).toMatchObject({ actor: 'demo@tpp.com', target: 'demo@tpp.com' });
    expect(JSON.stringify(db().audit)).not.toMatch(/demo1234|Nueva#Clave9/);
  });

  test('con la contraseña actual incorrecta se rechaza sin sumar intentos, sin bloquear y sin auditar', async () => {
    asUser('demo@tpp.com');
    for (let i = 0; i < 5; i += 1) {
      await expect(profileService.changePassword({ currentPassword: 'incorrecta', newPassword: 'Nueva#Clave9' }))
        .rejects.toMatchObject({ status: 422, field: 'currentPassword' }); // 422, no 401: un 401 cerraría la sesión
    }
    expect(userByEmail('demo@tpp.com')).toMatchObject({ failedAttempts: 0, blocked: false });
    expect(db().audit.some((a) => a.action === 'PASSWORD_CHANGED_VOLUNTARY')).toBe(false); // un fallo no genera evento
    await expect(authService.login({ email: 'demo@tpp.com', password: 'demo1234' })).resolves.toBeDefined(); // sigue entrando
  });

  test('la nueva debe ser distinta de la actual y cumplir la política', async () => {
    asUser('demo@tpp.com');
    await expect(profileService.changePassword({ currentPassword: 'demo1234', newPassword: 'demo1234' }))
      .rejects.toMatchObject({ field: 'newPassword', message: expect.stringContaining('distinta') });
    await expect(profileService.changePassword({ currentPassword: 'demo1234', newPassword: 'corta' })).rejects.toMatchObject({ field: 'newPassword' });
    await expect(profileService.changePassword({ currentPassword: 'demo1234', newPassword: 'con espacio 1' })).rejects.toMatchObject({ field: 'newPassword' });
    await expect(profileService.changePassword({ currentPassword: '', newPassword: 'Nueva#Clave9' })).rejects.toMatchObject({ field: 'currentPassword' });
  });

  test('no cierra ni invalida ninguna sesión: otra sesión abierta del mismo usuario sigue autorizada', async () => {
    asUser('demo@tpp.com');
    const otherSession = await authService.login({ email: 'demo@tpp.com', password: 'demo1234' });
    await profileService.changePassword({ currentPassword: 'demo1234', newPassword: 'Nueva#Clave9' });
    sessionStore.set(otherSession); // la sesión que ya estaba abierta
    await expect(userService.list()).resolves.toBeDefined();
    expect(db().audit.some((a) => /SESSION|LOGOUT/.test(a.action))).toBe(false);
  });

  test('si un administrador genera una contraseña temporal con la sesión abierta, la anterior se rechaza sin sumar intentos; la temporal vigente sirve', async () => {
    const mine = await createAndSignIn('viewer');
    asUser('demo@tpp.com');
    const { temporaryPassword } = await userService.generateTemporaryPassword(userByEmail('lucia@tpp.com').id);

    asUser('lucia@tpp.com'); // su sesión sigue abierta
    await expect(profileService.changePassword({ currentPassword: mine, newPassword: 'Otra#Clave77' }))
      .rejects.toMatchObject({ field: 'currentPassword' });
    expect(userByEmail('lucia@tpp.com')).toMatchObject({ failedAttempts: 0, blocked: false });

    await profileService.changePassword({ currentPassword: temporaryPassword, newPassword: 'Otra#Clave77' });
    await expect(authService.login({ email: 'lucia@tpp.com', password: 'Otra#Clave77' })).resolves.toBeDefined();
  });

  test('si el usuario se vuelve inactivo durante la sesión, Mi perfil sigue disponible', async () => {
    await createAndSignIn('viewer');
    asUser('demo@tpp.com');
    await userService.deactivate(userByEmail('lucia@tpp.com').id);
    asUser('lucia@tpp.com');
    await expect(profileService.get()).resolves.toMatchObject({ email: 'lucia@tpp.com' });
  });
});
