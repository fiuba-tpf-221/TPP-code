import { userService } from '../features/users/userService';
import { FEATURES } from '../config/features';
import { sessionStore } from '../shared/utils/session';

beforeEach(() => { localStorage.clear(); FEATURES.AUTH_PROVIDER = 'keycloak'; });
afterEach(() => { FEATURES.AUTH_PROVIDER = 'mock'; });

test('con login real, el mock de usuarios autoriza según los permisos del token', async () => {
  sessionStore.set({ user: { id: 'kc-1', username: 'testuser', email: '', permissions: ['users.manage'] } });
  await expect(userService.list()).resolves.toMatchObject({ total: 1 }); // solo el usuario de demostración
});

test('sin el permiso en el token, el mock rechaza aunque el usuario conozca la URL', async () => {
  sessionStore.set({ user: { id: 'kc-1', username: 'testuser', email: '', permissions: ['models.manage'] } });
  await expect(userService.list()).rejects.toMatchObject({ status: 403 });
});

test('sin sesión también rechaza', async () => {
  await expect(userService.list()).rejects.toMatchObject({ status: 403 });
});

test('un usuario del token no puede operar sobre un usuario de demostración que casualmente tenga su email', async () => {
  // Con Keycloak los permisos vienen del token, no de la base de demostración: tener el mismo email no otorga nada.
  sessionStore.set({ user: { id: 'kc-1', email: 'demo@tpp.com', permissions: [] } });
  await expect(userService.list()).rejects.toMatchObject({ status: 403 });
});
