import { authService } from './authService';
import { readDb, writeDb, makeCredential } from '../../mock/db';
import { sessionStore } from '../../shared/utils/session';

beforeEach(() => localStorage.clear());

const login = (email, password) => authService.login({ email, password });
const addUser = async ({ password = 'Correcta#1', ...overrides }) => {
  const db = readDb();
  db.users.push({ id: overrides.email, firstName: 'A', lastName: 'B', email: 'a@tpp.com', active: true, roles: ['analyst'],
    ...(await makeCredential(password)), mustChangePassword: false, failedAttempts: 0, blocked: false, ...overrides });
  writeDb(db);
};
const user = (email) => readDb().users.find((u) => u.email === email);
const reasons = () => readDb().audit.filter((a) => a.action === 'LOGIN_FAILED').map((a) => a.reason);

test('cada motivo de rechazo responde igual y solo se audita el real', async () => {
  await addUser({ email: 'off@tpp.com', active: false });
  await addUser({ email: 'dom@viejo.com' });
  await addUser({ email: 'blk@tpp.com', blocked: true });
  const messages = [];
  for (const email of ['nadie@tpp.com', 'off@tpp.com', 'dom@viejo.com', 'blk@tpp.com', 'demo@tpp.com']) {
    await login(email, 'incorrecta').catch((e) => messages.push(`${e.status}:${e.message}`));
  }
  expect(new Set(messages).size).toBe(1);
  expect(reasons()).toEqual(['USER_NOT_FOUND', 'USER_INACTIVE', 'DOMAIN_INACTIVE', 'CREDENTIAL_BLOCKED', 'WRONG_PASSWORD']);
});

test('solo la contraseña incorrecta de una credencial habilitada suma intentos', async () => {
  await addUser({ email: 'off@tpp.com', active: false });
  await addUser({ email: 'blk@tpp.com', blocked: true });
  await login('off@tpp.com', 'mal').catch(() => {});
  await login('blk@tpp.com', 'mal').catch(() => {});
  expect(user('off@tpp.com').failedAttempts).toBe(0);
  expect(user('blk@tpp.com').failedAttempts).toBe(0);
});

test('al tercer intento fallido se bloquea y sigue bloqueada con la contraseña correcta', async () => {
  for (let i = 0; i < 3; i += 1) await login('demo@tpp.com', 'mal').catch(() => {});
  expect(user('demo@tpp.com')).toMatchObject({ blocked: true, failedAttempts: 3 });
  await expect(login('demo@tpp.com', 'demo1234')).rejects.toMatchObject({ status: 401 });
  expect(reasons().pop()).toBe('CREDENTIAL_BLOCKED');
  expect(user('demo@tpp.com').failedAttempts).toBe(3);
});

test('un login exitoso reinicia los intentos, también con contraseña temporal', async () => {
  await addUser({ email: 'tmp@tpp.com', password: 'Temp12345', mustChangePassword: true });
  await login('tmp@tpp.com', 'mal').catch(() => {});
  await login('tmp@tpp.com', 'mal').catch(() => {});
  const { user: session } = await login('tmp@tpp.com', 'Temp12345');
  expect(session.mustChangePassword).toBe(true);
  expect(user('tmp@tpp.com').failedAttempts).toBe(0);
});

test('el dominio se compara exacto y sin distinguir mayúsculas; un padre no habilita subdominios', async () => {
  await addUser({ email: 'sub@sub.tpp.com' });
  await expect(login('sub@sub.tpp.com', 'Correcta#1')).rejects.toMatchObject({ status: 401 });
  expect(reasons().pop()).toBe('DOMAIN_INACTIVE');
  await expect(login('DEMO@TPP.COM', 'demo1234')).resolves.toBeDefined();
});

test('la contraseña nunca queda en auditoría ni en claro en la base', async () => {
  await login('demo@tpp.com', 'SecretaXYZ#9').catch(() => {});
  await login('demo@tpp.com', 'demo1234');
  expect(JSON.stringify(readDb())).not.toMatch(/SecretaXYZ|demo1234/);
  expect(readDb().audit.map((a) => a.action)).toEqual(['LOGIN_FAILED', 'LOGIN_SUCCESS']);
});

test('cambio obligatorio: debe ser distinta, invalida la temporal y baja la bandera', async () => {
  await addUser({ email: 'tmp@tpp.com', password: 'Temp12345', mustChangePassword: true });
  sessionStore.set(await login('tmp@tpp.com', 'Temp12345'));
  await expect(authService.changePassword({ newPassword: 'Temp12345' })).rejects.toMatchObject({ field: 'newPassword' });
  await expect(authService.changePassword({ newPassword: 'con espacio' })).rejects.toMatchObject({ field: 'newPassword' });

  const { user: updated } = await authService.changePassword({ newPassword: 'Nueva#2026' });
  expect(updated.mustChangePassword).toBe(false);
  await expect(login('tmp@tpp.com', 'Temp12345')).rejects.toMatchObject({ status: 401 });
  await expect(login('tmp@tpp.com', 'Nueva#2026')).resolves.toBeDefined();
});

test('el autoregistro valida el dominio igual que el login', async () => {
  await expect(authService.register({ name: 'X', email: 'x@viejo.com', password: 'Correcta#1' }))
    .rejects.toMatchObject({ field: 'email' });
});

test('una cuenta autoregistrada puede volver a iniciar sesión después de cerrarla', async () => {
  await authService.register({ name: 'Nueva', email: 'nueva@gmail.com', password: 'Correcta#1' });
  await authService.logout();
  await expect(login('nueva@gmail.com', 'Correcta#1')).resolves.toBeDefined();
});

test('logout y timeout quedan auditados', async () => {
  sessionStore.set(await login('demo@tpp.com', 'demo1234'));
  authService.recordTimeout();
  await authService.logout();
  expect(readDb().audit.map((a) => a.action)).toEqual(['LOGIN_SUCCESS', 'SESSION_TIMEOUT', 'LOGOUT']);
});
