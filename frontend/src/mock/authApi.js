// "Backend" simulado de autenticación. Reglas de la US-05 que en producción implementa el servidor.
import { ApiError } from '../shared/api/httpClient';
import { readDb, writeDb, wait, newId, toSession, pushAudit, makeCredential, checkPassword } from './db';
import { normalizeEmail } from '../shared/utils/text';
import { validatePassword } from '../shared/utils/password';
import { sessionStore } from '../shared/utils/session';
import { LOGIN_ERROR } from '../features/auth/messages';

const MAX_FAILED_ATTEMPTS = 3;

function decodeJwt(token) { // el backend real verifica la firma con Google; acá solo se lee
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(b64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('');
  return JSON.parse(decodeURIComponent(json));
}

// Orden: inexistente -> usuario inactivo -> dominio inactivo -> credencial bloqueada (luego, contraseña incorrecta).
function checkAccess(db, mail) {
  const user = db.users.find((u) => u.email === mail);
  if (!user) return { reason: 'USER_NOT_FOUND' };
  if (!user.active) return { reason: 'USER_INACTIVE' };
  const domain = mail.split('@')[1]; // coincidencia exacta; un padre no habilita subdominios
  if (!db.domains.some((d) => d.name.toLowerCase() === domain && d.active)) return { reason: 'DOMAIN_INACTIVE' };
  if (user.blocked) return { reason: 'CREDENTIAL_BLOCKED' };
  return { user };
}

function rejectLogin(db, method, mail, reason) {
  pushAudit(db, { action: 'LOGIN_FAILED', method, reason, target: mail });
  writeDb(db);
  throw new ApiError(401, LOGIN_ERROR); // mensaje genérico: el motivo real solo queda en auditoría
}

export const mockAuthApi = {
  async login({ email, password }) {
    await wait(500);
    const db = readDb();
    const mail = normalizeEmail(email);
    const { user, reason } = checkAccess(db, mail);
    if (!user) return rejectLogin(db, 'password', mail, reason);

    if (!(await checkPassword(user, password))) {
      user.failedAttempts = (user.failedAttempts || 0) + 1; // solo con credencial habilitada
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) user.blocked = true;
      return rejectLogin(db, 'password', mail, 'WRONG_PASSWORD');
    }
    user.failedAttempts = 0; // también con contraseña temporal
    pushAudit(db, { action: 'LOGIN_SUCCESS', method: 'password', target: mail });
    writeDb(db);
    return toSession(db, user);
  },

  async loginWithGoogle(credential) {
    const { email, picture } = decodeJwt(credential);
    const db = readDb();
    const mail = normalizeEmail(email);
    const { user, reason } = checkAccess(db, mail);
    if (!user) return rejectLogin(db, 'google', mail, reason);
    pushAudit(db, { action: 'LOGIN_SUCCESS', method: 'google', target: mail });
    writeDb(db);
    return toSession(db, user, { picture });
  },

  async changePassword({ newPassword }) {
    await wait(500);
    const db = readDb();
    const user = db.users.find((u) => u.email === sessionStore.get()?.user.email);
    if (!user) throw new ApiError(401, 'Sesión inválida');
    const invalid = validatePassword(newPassword);
    if (invalid) throw new ApiError(422, invalid, 'newPassword');
    if (await checkPassword(user, newPassword)) {
      throw new ApiError(422, 'La nueva contraseña debe ser distinta de la anterior', 'newPassword');
    }
    Object.assign(user, await makeCredential(newPassword), { mustChangePassword: false });
    pushAudit(db, { action: 'PASSWORD_CHANGED', actor: user.email }); // no invalida otras sesiones
    writeDb(db);
    return toSession(db, user);
  },

  async register({ name, email, password }) {
    await wait(600);
    const db = readDb();
    const mail = normalizeEmail(email);
    const invalid = validatePassword(password);
    if (invalid) throw new ApiError(422, invalid, 'password');
    if (db.users.some((u) => u.email === mail)) throw new ApiError(409, 'Ya existe una cuenta con ese email');
    // Si no se valida acá, la cuenta se crea igual pero después no puede volver a iniciar sesión (US-05).
    const domain = mail.split('@')[1];
    if (!db.domains.some((d) => d.name === domain && d.active)) {
      throw new ApiError(422, 'Ese dominio de email no está habilitado', 'email');
    }
    const user = { id: newId(), firstName: name, lastName: '', email: mail, active: true, roles: ['viewer'],
      ...(await makeCredential(password)), mustChangePassword: false, failedAttempts: 0, blocked: false };
    db.users.push(user);
    pushAudit(db, { action: 'USER_REGISTERED', target: mail });
    writeDb(db);
    return toSession(db, user);
  },

  async logout() {
    const db = readDb();
    pushAudit(db, { action: 'LOGOUT', actor: sessionStore.get()?.user?.email ?? null });
    writeDb(db);
  },

  recordTimeout() { // en producción el timeout lo audita el servidor
    const db = readDb();
    pushAudit(db, { action: 'SESSION_TIMEOUT', actor: sessionStore.get()?.user?.email ?? null });
    writeDb(db);
  },
};
