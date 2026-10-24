import { userFromToken } from './keycloakUser';

const token = (extra = {}) => ({ sub: 'abc-123', preferred_username: 'testuser', realm_access: { roles: [] }, ...extra });

test('el nombre sale del token: completo, nombre y apellido, o el usuario como último recurso', () => {
  expect(userFromToken(token({ name: 'Ana Pérez' })).name).toBe('Ana Pérez');
  expect(userFromToken(token({ given_name: 'Ana', family_name: 'Pérez' })).name).toBe('Ana Pérez');
  expect(userFromToken(token()).name).toBe('testuser'); // el testuser del realm no tiene nombre ni email
  expect(userFromToken({ sub: 'x' }).name).toBe('Usuario');
});

test('los roles técnicos de Keycloak no cuentan como roles de la aplicación', () => {
  const user = userFromToken(token({ realm_access: { roles: ['default-roles-tpp-realm', 'offline_access', 'uma_authorization', 'analista'] } }));
  expect(user.roles).toEqual([{ id: 'analista', name: 'analista' }]);
});

test('los permisos salen de los roles, sin duplicados y sin distinguir mayúsculas', () => {
  const user = userFromToken(token({ realm_access: { roles: ['Analista', 'operador'] } }));
  expect(user.permissions.sort()).toEqual(['models.manage', 'predictions.use']);
  expect(userFromToken(token({ realm_access: { roles: ['administrador'] } })).permissions).toHaveLength(7);
});

test('un usuario sin roles de la app, o con un rol desconocido, queda sin permisos', () => {
  expect(userFromToken(token()).permissions).toEqual([]);
  expect(userFromToken(token({ realm_access: { roles: ['inventado'] } })).permissions).toEqual([]);
  expect(userFromToken({ sub: 'x' }).permissions).toEqual([]); // token sin realm_access
});

test('nunca exige cambio de contraseña en la app: lo resuelve Keycloak', () => {
  expect(userFromToken(token()).mustChangePassword).toBe(false);
});
