import { ROLE_PERMISSIONS } from '../../config/keycloakRoles';

// Roles que Keycloak agrega a todos los usuarios: no son roles de la aplicación.
const isTechnical = (role) => role === 'offline_access' || role === 'uma_authorization' || role.startsWith('default-roles-');

// Convierte el token de Keycloak en el usuario de la aplicación. Los permisos salen de ROLE_PERMISSIONS.
export function userFromToken(token) {
  const roles = (token.realm_access?.roles ?? []).filter((role) => !isTechnical(role));
  const fullName = token.name || [token.given_name, token.family_name].filter(Boolean).join(' ');
  return {
    id: token.sub,
    name: fullName || token.preferred_username || 'Usuario',
    username: token.preferred_username ?? '',
    email: token.email ?? '',
    roles: roles.map((role) => ({ id: role, name: role })),
    permissions: [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role.toLowerCase()] ?? []))],
    mustChangePassword: false, // el cambio obligatorio de contraseña lo resuelve Keycloak antes de volver a la app
  };
}
