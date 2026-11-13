// Quién llama y con qué permisos, como lo resolvería el servidor a partir del token.
// US-07: los permisos efectivos se calculan al iniciar sesión y se mantienen toda la sesión; un cambio en roles o permisos
// se refleja recién en el próximo login. Por eso se autoriza con el conjunto guardado en la sesión, no con la base actual.
import { ApiError } from '../shared/api/httpClient';
import { sessionStore } from '../shared/utils/session';
import { touch } from '../shared/session/activity';

// Cualquier usuario autenticado (por ejemplo Mi perfil: no requiere permiso).
export function currentUser() {
  const user = sessionStore.get()?.user;
  if (!user) throw new ApiError(401, 'Sesión inválida');
  touch(); // petición autenticada aceptada = actividad válida
  return user;
}

// Exige un permiso. Devuelve quién ejecuta la acción.
export function requirePermission(permission) {
  const user = sessionStore.get()?.user;
  if (!user?.permissions?.includes(permission)) throw new ApiError(403, 'No tenés permiso para realizar esta acción');
  touch();
  return { id: user.id, email: user.email || user.username };
}
