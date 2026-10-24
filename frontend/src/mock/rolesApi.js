// "Backend" simulado de la gestión de roles (US-07). Requiere el permiso "Gestión de roles".
// Los permisos están definidos por el sistema (módulos y permisos): acá solo se asocian a roles.
import { ApiError } from '../shared/api/httpClient';
import { PERMISSIONS as P } from '../config/permissions';
import { readDb, writeDb, wait, newId, pushAudit } from './db';
import { requirePermission } from './session';
import { normalizeSpaces } from '../shared/utils/text';

const SORTABLE = ['name', 'description', 'active', 'usersCount', 'permissionsCount'];
const actorOf = () => requirePermission(P.ROLES_MANAGE);
const PROTECTED_MESSAGE = 'El rol Administrador es un rol protegido del sistema: puede consultarse, pero no modificarse, inactivarse ni eliminarse.';

const usersCount = (db, role) => db.users.filter((u) => u.roles.includes(role.id)).length;
// "Cantidad de permisos" = relaciones rol-permiso, incluyendo las de permisos que hoy están inactivos.
const toItem = (db, r) => ({ id: r.id, name: r.name, description: r.description, active: r.active, protected: Boolean(r.protected),
  usersCount: usersCount(db, r), permissionsCount: r.permissions.length });
const toDetail = (db, r) => ({ ...toItem(db, r), permissions: [...r.permissions] });

function findRole(db, id) {
  const role = db.roles.find((r) => r.id === id);
  if (!role) throw new ApiError(404, 'No se encontró el rol');
  return role;
}
const forbidProtected = (role) => { if (role.protected) throw new ApiError(403, PROTECTED_MESSAGE); };

// Solo se asignan permisos activos de módulos activos. Los ya asignados que quedaron inactivos se conservan o se quitan.
function grantableCodes(db) {
  const activeModules = new Set(db.modules.filter((m) => m.active).map((m) => m.code));
  return new Set(db.permissions.filter((p) => p.active && activeModules.has(p.module)).map((p) => p.code));
}
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const sorted = (list) => [...list].sort();

function normalizedFields({ name, description }) {
  const cleanName = normalizeSpaces(name ?? '');
  const cleanDescription = (description ?? '').trim();
  if (!cleanName) throw new ApiError(422, 'El nombre es obligatorio.', 'name');
  if (!cleanDescription) throw new ApiError(422, 'La descripción es obligatoria.', 'description');
  return { cleanName, cleanDescription };
}
function checkNewPermissions(db, codes, alreadyAssigned = []) {
  const grantable = grantableCodes(db);
  const added = codes.filter((c) => !alreadyAssigned.includes(c));
  if (added.some((c) => !grantable.has(c))) {
    throw new ApiError(422, 'Solo pueden asignarse permisos activos de módulos activos.', 'permissionCodes');
  }
}

export const mockRolesApi = {
  // GET /api/roles: filtros por nombre y descripción (parcial, sin distinguir mayúsculas, sin espacios en los bordes) y estado.
  async list({ name = '', description = '', active, sort = 'name', order = 'asc', page = 1, pageSize = 10 } = {}) {
    await wait(300);
    const db = readDb();
    actorOf();
    const contains = (value, term) => value.toLowerCase().includes(term.trim().toLowerCase());
    const rows = db.roles.map((r) => toItem(db, r))
      .filter((r) => contains(r.name, name) && contains(r.description, description) && (active === undefined || r.active === active));

    const key = SORTABLE.includes(sort) ? sort : 'name';
    const dir = order === 'desc' ? -1 : 1;
    const value = (r) => (typeof r[key] === 'string' ? r[key].toLowerCase() : Number(r[key]));
    rows.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const cmp = typeof x === 'string' ? x.localeCompare(y, 'es') : x - y;
      return cmp !== 0 ? cmp * dir : a.name.localeCompare(b.name, 'es');
    });

    const size = Math.min(Math.max(1, Number(pageSize) || 10), 100);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    return { items: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, pageSize: size };
  },

  // GET /api/roles/:id -> incluye los códigos de permisos asociados (también los que quedaron inactivos).
  async get(id) {
    await wait(250);
    const db = readDb();
    actorOf();
    return toDetail(db, findRole(db, id));
  },

  // GET /api/permissions -> módulos con sus permisos, con el estado de cada uno.
  async permissionsCatalog() {
    await wait(200);
    const db = readDb();
    actorOf();
    return [...db.modules].sort((a, b) => a.order - b.order).map((m) => ({
      code: m.code, name: m.name, active: m.active,
      permissions: db.permissions.filter((p) => p.module === m.code).map(({ code, description, active }) => ({ code, description, active })),
    }));
  },

  // POST /api/roles
  async create({ name, description, active = true, permissionCodes = [] }) {
    await wait(500);
    const db = readDb();
    const actor = actorOf();
    const { cleanName, cleanDescription } = normalizedFields({ name, description });
    if (db.roles.some((r) => r.name.toLowerCase() === cleanName.toLowerCase())) { // sin distinguir mayúsculas
      throw new ApiError(409, 'Ya existe un rol con ese nombre.', 'name');
    }
    const codes = [...new Set(permissionCodes)]; // un rol puede crearse sin permisos
    checkNewPermissions(db, codes);

    const role = { id: newId('r'), name: cleanName, description: cleanDescription, active: Boolean(active), permissions: codes };
    db.roles.push(role);
    pushAudit(db, { action: 'ROLE_CREATED', actor: actor.email, target: role.name,
      values: { name: role.name, description: role.description, active: role.active, permissions: sorted(codes) } });
    writeDb(db);
    return toDetail(db, role);
  },

  // PUT /api/roles/:id { description, permissionCodes }. El nombre no se modifica. El rol Administrador está protegido.
  async update(id, { description, permissionCodes }) {
    await wait(500);
    const db = readDb();
    const actor = actorOf();
    const role = findRole(db, id);
    forbidProtected(role);
    const cleanDescription = (description ?? '').trim();
    if (!cleanDescription) throw new ApiError(422, 'La descripción es obligatoria.', 'description');
    const codes = permissionCodes === undefined ? [...role.permissions] : [...new Set(permissionCodes)];
    checkNewPermissions(db, codes, role.permissions);

    const changes = [];
    if (cleanDescription !== role.description) changes.push({ field: 'description', before: role.description, after: cleanDescription });
    if (!sameSet(codes, role.permissions)) changes.push({ field: 'permissions', before: sorted(role.permissions), after: sorted(codes) });
    if (changes.length === 0) return toDetail(db, role); // sin cambios reales: no se modifica ni se audita

    Object.assign(role, { description: cleanDescription, permissions: codes });
    pushAudit(db, { action: 'ROLE_UPDATED', actor: actor.email, target: role.name, changes });
    writeDb(db);
    return toDetail(db, role);
  },

  // Inactivar no borra las relaciones con permisos: al reactivar, el rol vuelve a otorgarlos.
  async deactivate(id) { return setActive(id, false); },
  async reactivate(id) { return setActive(id, true); },

  // DELETE /api/roles/:id: solo si no tiene usuarios. Se elimina también su relación con los permisos y se conservan para auditoría.
  async remove(id) {
    await wait(500);
    const db = readDb();
    const actor = actorOf();
    const role = findRole(db, id);
    forbidProtected(role);
    if (usersCount(db, role) > 0) {
      throw new ApiError(409, 'No se puede eliminar el rol porque tiene usuarios asignados. Primero deben quitarse todas las asignaciones de usuarios.');
    }
    pushAudit(db, { action: 'ROLE_DELETED', actor: actor.email, target: role.name,
      values: { name: role.name, description: role.description, active: role.active, permissions: sorted(role.permissions) } });
    db.roles = db.roles.filter((r) => r.id !== id);
    writeDb(db);
    return null;
  },
};

async function setActive(id, active) {
  await wait(500);
  const db = readDb();
  const actor = actorOf();
  const role = findRole(db, id);
  forbidProtected(role);
  if (role.active === active) throw new ApiError(409, active ? 'El rol ya está activo' : 'El rol ya está inactivo');
  role.active = active;
  pushAudit(db, { action: active ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED', actor: actor.email, target: role.name,
    changes: [{ field: 'active', before: !active, after: active }] });
  writeDb(db);
  return toDetail(db, role);
}
