// "Backend" simulado de usuarios (US-01 y US-02). Todo esto —validar, normalizar, generar contraseñas,
// auditar, chequear permisos— lo hace el servidor en producción.
import { ApiError } from '../shared/api/httpClient';
import { PERMISSIONS as P } from '../config/permissions';
import { readDb, writeDb, wait, newId, pushAudit, makeCredential, effectivePermissions } from './db';
import { normalizeSpaces, normalizeEmail, EMAIL_RE } from '../shared/utils/text';
import { sessionStore } from '../shared/utils/session';
import { touch } from '../shared/session/activity';

const SORTABLE = ['email', 'firstName', 'lastName', 'active', 'blocked'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // sin caracteres ambiguos

function generateTempPassword(length = 12) {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

// CA 1: requiere "Gestión de usuarios". Devuelve quién ejecuta la acción.
function actorOf(db) {
  const email = sessionStore.get()?.user?.email;
  const actor = db.users.find((u) => u.email === email);
  const allowed = actor && effectivePermissions(db, actor).includes(P.USERS_MANAGE); // US-06 CA 8: se verifica en el servidor
  if (!allowed) throw new ApiError(403, 'No tenés permiso para realizar esta acción');
  touch(); // petición autenticada aceptada = actividad válida
  return actor;
}

const roleObjects = (db, ids) => db.roles.filter((r) => ids.includes(r.id)).map(({ id, name }) => ({ id, name }));
const roleNames = (db, ids) => ids.map((id) => db.roles.find((r) => r.id === id)?.name ?? id);
const toListItem = (db, u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
  active: u.active, blocked: u.blocked, roles: roleObjects(db, u.roles) });
const toDetail = (db, u) => ({ ...toListItem(db, u), blocked: u.blocked, failedAttempts: u.failedAttempts,
  mustChangePassword: u.mustChangePassword });

const findUser = (db, id) => {
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'No se encontró el usuario');
  return user;
};
// CA 12: nadie ejecuta acciones administrativas sobre sí mismo.
const forbidSelf = (actor, user, message) => {
  if (actor.id === user.id) throw new ApiError(403, message);
};

export const mockUsersApi = {
  // US-04: filtros combinados con AND, roles con OR, orden y paginación en el servidor.
  async list({ email = '', firstName = '', lastName = '', active, blocked, roleIds = [],
    sort = 'email', order = 'asc', page = 1, pageSize = 10 } = {}) {
    await wait(300);
    const db = readDb();
    actorOf(db);

    const contains = (value, term) => value.toLowerCase().includes(term.trim().toLowerCase()); // parcial, sin distinguir mayúsculas
    const rows = db.users.filter((u) => contains(u.email, email) && contains(u.firstName, firstName)
      && contains(u.lastName, lastName)
      && (active === undefined || u.active === active)
      && (blocked === undefined || u.blocked === blocked)
      && (roleIds.length === 0 || u.roles.some((r) => roleIds.includes(r)))); // sin roles elegidos: no filtra

    const sortable = SORTABLE.includes(sort); // Roles no se ordena: se usa el orden por defecto (email ascendente)
    const key = sortable ? sort : 'email';
    const dir = sortable && order === 'desc' ? -1 : 1;
    const value = (u) => (typeof u[key] === 'string' ? u[key].toLowerCase() : Number(u[key]));
    rows.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const cmp = typeof x === 'string' ? x.localeCompare(y, 'es') : x - y;
      return cmp !== 0 ? cmp * dir : a.email.localeCompare(b.email);
    });

    const size = Math.min(Math.max(1, Number(pageSize) || 10), 100);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    return { items: rows.slice((current - 1) * size, current * size).map((u) => toListItem(db, u)),
      total: rows.length, page: current, pageSize: size };
  },

  async listRoles() {
    await wait(200);
    const db = readDb();
    actorOf(db);
    return db.roles.map(({ id, name, active }) => ({ id, name, active }));
  },

  async get(id) {
    await wait(300);
    const db = readDb();
    actorOf(db);
    return toDetail(db, findUser(db, id));
  },

  async create({ firstName, lastName, email, active, roleIds }) {
    await wait(600);
    const db = readDb();
    const actor = actorOf(db);

    const first = normalizeSpaces(firstName);
    const last = normalizeSpaces(lastName);
    const mail = normalizeEmail(email);
    if (!first) throw new ApiError(422, 'El nombre es obligatorio', 'firstName');
    if (!last) throw new ApiError(422, 'El apellido es obligatorio', 'lastName');
    if (!EMAIL_RE.test(mail)) throw new ApiError(422, 'Ingresá un email válido', 'email');
    if (!db.domains.some((d) => d.name === mail.split('@')[1] && d.active)) {
      throw new ApiError(422, 'El dominio del email no está habilitado', 'email');
    }
    if (db.users.some((u) => u.email === mail)) throw new ApiError(409, 'Ya existe un usuario con ese email', 'email');
    const validRoles = db.roles.filter((r) => r.active && roleIds.includes(r.id));
    if (roleIds.length === 0 || validRoles.length !== roleIds.length) {
      throw new ApiError(422, 'Asigná al menos un rol activo', 'roleIds');
    }

    const temporaryPassword = generateTempPassword();
    const user = { id: newId(), firstName: first, lastName: last, email: mail, active: Boolean(active), roles: roleIds,
      ...(await makeCredential(temporaryPassword)), mustChangePassword: true, failedAttempts: 0, blocked: false };
    db.users.push(user);
    pushAudit(db, { action: 'USER_CREATED', actor: actor.email, target: mail });
    writeDb(db);
    return { user: toListItem(db, user), temporaryPassword };
  },

  // US-02: solo nombre, apellido y roles. El email y los estados no se editan por acá.
  async update(id, { firstName, lastName, roleIds }) {
    await wait(600);
    const db = readDb();
    const actor = actorOf(db);
    const user = findUser(db, id);
    forbidSelf(actor, user, 'No podés modificar tu propio usuario');

    const first = normalizeSpaces(firstName);
    const last = normalizeSpaces(lastName);
    if (!first) throw new ApiError(422, 'El nombre es obligatorio', 'firstName');
    if (!last) throw new ApiError(422, 'El apellido es obligatorio', 'lastName');
    if (roleIds.length === 0) throw new ApiError(422, 'Debe conservarse al menos un rol', 'roleIds');
    // Solo se exige que estén activos los roles que se AGREGAN; uno inactivo ya asignado puede conservarse.
    const added = roleIds.filter((r) => !user.roles.includes(r));
    if (added.some((r) => !db.roles.some((x) => x.id === r && x.active))) {
      throw new ApiError(422, 'Solo se pueden agregar roles activos', 'roleIds');
    }

    const changes = [];
    if (first !== user.firstName) changes.push({ field: 'firstName', before: user.firstName, after: first });
    if (last !== user.lastName) changes.push({ field: 'lastName', before: user.lastName, after: last });
    const sameRoles = roleIds.length === user.roles.length && roleIds.every((r) => user.roles.includes(r));
    if (!sameRoles) changes.push({ field: 'roles', before: roleNames(db, user.roles), after: roleNames(db, roleIds) });

    if (changes.length) { // sin cambios no hay modificación que auditar
      Object.assign(user, { firstName: first, lastName: last, roles: roleIds });
      pushAudit(db, { action: 'USER_UPDATED', actor: actor.email, target: user.email, changes });
      writeDb(db);
    }
    return toDetail(db, user);
  },

  async deactivate(id) {
    await wait(400);
    const db = readDb();
    const actor = actorOf(db);
    const user = findUser(db, id);
    forbidSelf(actor, user, 'No podés darte de baja a vos mismo');
    if (!user.active) throw new ApiError(409, 'El usuario ya está inactivo');
    user.active = false;
    pushAudit(db, { action: 'USER_DEACTIVATED', actor: actor.email, target: user.email,
      changes: [{ field: 'active', before: true, after: false }] });
    writeDb(db);
    return toDetail(db, user);
  },

  async reactivate(id) {
    await wait(400);
    const db = readDb();
    const actor = actorOf(db);
    const user = findUser(db, id);
    forbidSelf(actor, user, 'No podés ejecutar acciones administrativas sobre tu propio usuario');
    if (user.active) throw new ApiError(409, 'El usuario ya está activo');
    // US-03 CA 8, 9 y 11: la reactivación SIEMPRE genera contraseña temporal nueva (la anterior queda inválida)
    // y deja Activo = Sí, Credencial bloqueada = No, Intentos fallidos = 0, Cambio de contraseña requerido = Sí.
    // No toca las sesiones abiertas (CA 10).
    const temporaryPassword = generateTempPassword();
    const changes = [
      { field: 'active', before: false, after: true },
      { field: 'blocked', before: user.blocked, after: false },
      { field: 'failedAttempts', before: user.failedAttempts, after: 0 },
      { field: 'mustChangePassword', before: user.mustChangePassword, after: true },
    ].filter((c) => c.before !== c.after);
    Object.assign(user, await makeCredential(temporaryPassword),
      { active: true, blocked: false, failedAttempts: 0, mustChangePassword: true });
    pushAudit(db, { action: 'USER_REACTIVATED', actor: actor.email, target: user.email, changes });
    writeDb(db);
    return { user: toDetail(db, user), temporaryPassword };
  },

  // Provisorio hasta tener su propia historia: no desbloquea la credencial ni toca los intentos fallidos.
  async generateTemporaryPassword(id) {
    await wait(500);
    const db = readDb();
    const actor = actorOf(db);
    const user = findUser(db, id);
    forbidSelf(actor, user, 'No podés generarte una contraseña temporal a vos mismo');
    const temporaryPassword = generateTempPassword();
    const before = user.mustChangePassword;
    Object.assign(user, await makeCredential(temporaryPassword), { mustChangePassword: true });
    pushAudit(db, { action: 'TEMP_PASSWORD_GENERATED', actor: actor.email, target: user.email,
      changes: [{ field: 'mustChangePassword', before, after: true }] });
    writeDb(db);
    return { user: toDetail(db, user), temporaryPassword };
  },
};
