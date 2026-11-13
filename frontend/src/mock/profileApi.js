// "Backend" simulado de Mi perfil (US-11). Cualquier usuario autenticado puede usarlo: no requiere permiso.
// En el actor y el afectado son siempre el propio usuario. Ninguna contraseña se registra jamás.
import { ApiError } from '../shared/api/httpClient';
import { readDb, writeDb, wait, pushAudit, makeCredential, checkPassword } from './db';
import { currentUser } from './session';
import { normalizeSpaces } from '../shared/utils/text';
import { validatePassword } from '../shared/utils/password';

function findMe(db) {
  const me = currentUser();
  const user = db.users.find((u) => u.id === me.id);
  if (!user) throw new ApiError(404, 'No se encontró tu usuario');
  return user;
}
const toProfile = (u) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, name: `${u.firstName} ${u.lastName}`.trim() });

export const mockProfileApi = {
  async get() {
    await wait(250);
    return toProfile(findMe(readDb()));
  },

  // Nombre y apellido con las mismas reglas de normalización del alta y la modificación de usuarios.
  // Si después de normalizar no hay ningún cambio real, no se modifica nada ni se genera auditoría.
  async update({ firstName, lastName }) {
    await wait(500);
    const db = readDb();
    const user = findMe(db);
    const first = normalizeSpaces(firstName ?? '');
    const last = normalizeSpaces(lastName ?? '');
    if (!first) throw new ApiError(422, 'El nombre es obligatorio.', 'firstName');
    if (!last) throw new ApiError(422, 'El apellido es obligatorio.', 'lastName');

    const changes = [
      { field: 'firstName', before: user.firstName, after: first },
      { field: 'lastName', before: user.lastName, after: last },
    ].filter((c) => c.before !== c.after);
    if (changes.length === 0) return toProfile(user);

    Object.assign(user, { firstName: first, lastName: last });
    pushAudit(db, { action: 'PROFILE_UPDATED', actor: user.email, target: user.email, changes });
    writeDb(db);
    return toProfile(user);
  },

  // Cambio voluntario. Un error NO suma intentos fallidos ni bloquea la credencial, y NO genera auditoría.
  // La contraseña anterior deja de valer ya, pero no se cierra ninguna sesión (ni esta ni las demás).
  // OJO con el contrato real: un error de contraseña actual debe responder 422, no 401 (un 401 cierra la sesión del usuario).
  async changePassword({ currentPassword, newPassword }) {
    await wait(500);
    const db = readDb();
    const user = findMe(db);
    if (!currentPassword) throw new ApiError(422, 'Ingresá tu contraseña actual.', 'currentPassword');
    if (!(await checkPassword(user, currentPassword))) {
      throw new ApiError(422, 'La contraseña actual no es correcta.', 'currentPassword');
    }
    const invalid = validatePassword(newPassword ?? '');
    if (invalid) throw new ApiError(422, invalid, 'newPassword');
    if (newPassword === currentPassword) {
      throw new ApiError(422, 'La nueva contraseña debe ser distinta de la actual.', 'newPassword');
    }
    Object.assign(user, await makeCredential(newPassword));
    pushAudit(db, { action: 'PASSWORD_CHANGED_VOLUNTARY', actor: user.email, target: user.email });
    writeDb(db);
    return null;
  },
};
