// BASE SIMULADA. Hace de "backend" mientras no exista: se borra la carpeta src/mock/ cuando esté listo.
// Nada de lo que hay acá pertenece al front real.
import { PERMISSIONS as P } from '../config/permissions';

const KEY = 'tpp.mock-db';
const VERSION = 6; // al subir la versión se reinicia la base simulada

const seed = () => ({
  version: VERSION,
  roles: [
    { id: 'admin', name: 'Administrador', description: 'Acceso total al sistema. Rol protegido: puede consultarse, pero no modificarse, inactivarse ni eliminarse.',
      active: true, protected: true, permissions: Object.values(P) },
    { id: 'analyst', name: 'Analista', description: 'Gestiona modelos y utiliza las predicciones.', active: true, permissions: [P.MODELS_MANAGE, P.PREDICTIONS_USE] },
    { id: 'operator', name: 'Operador', description: 'Utiliza los modelos de predicción.', active: true, permissions: [P.PREDICTIONS_USE] },
    { id: 'viewer', name: 'Consulta', description: 'Acceso básico, sin permisos funcionales.', active: true, permissions: [] }, // sin permisos
    { id: 'legacy', name: 'Auditor (obsoleto)', description: 'Rol en desuso: está inactivo, no se asigna y no otorga permisos.', active: false, permissions: [P.AUDIT_VIEW] }, // inactivo: no asignable ni otorga permisos
  ],
  // Catálogo definido por el sistema (US-06): sin ABM en la aplicación.
  modules: [
    { code: 'administracion', name: 'Administración', description: 'Usuarios, roles, dominios y auditoría', active: true, order: 1 },
    { code: 'modelos', name: 'Modelos', description: 'Gestión de modelos', active: true, order: 2 },
    { code: 'prediccion', name: 'Predicción', description: 'Uso de modelos', active: true, order: 3 },
  ],
  permissions: [
    { code: P.USERS_MANAGE, description: 'Gestión de usuarios', module: 'administracion', active: true },
    { code: P.ROLES_MANAGE, description: 'Gestión de roles', module: 'administracion', active: true },
    { code: P.DOMAINS_MANAGE, description: 'Gestión de dominios', module: 'administracion', active: true },
    { code: P.AUDIT_VIEW, description: 'Consulta de auditoría', module: 'administracion', active: true },
    { code: P.SYSTEM_VIEW, description: 'Consulta del sistema', module: 'administracion', active: true },
    { code: P.MODELS_MANAGE, description: 'Gestión de modelos', module: 'modelos', active: true },
    { code: P.PREDICTIONS_USE, description: 'Uso de modelos', module: 'prediccion', active: true },
  ],
  domains: [
    { name: 'tpp.com', active: true },
    { name: 'gmail.com', active: true },
    { name: 'outlook.com', active: true },
    { name: 'hotmail.com', active: true },
    { name: 'yahoo.com', active: true },
    { name: 'icloud.com', active: true },
    { name: 'viejo.com', active: false }, // sirve para probar el rechazo por dominio inactivo
  ],
  users: [
    { id: 'u-demo', firstName: 'Usuario', lastName: 'Demo', email: 'demo@tpp.com', active: true,
      roles: ['admin'], salt: 'demo-salt', passwordHash: '04c88dccabe1af11dec1c135d49914ba6995bad0986964b43e09f410198a7615', // = "demo1234"
      mustChangePassword: false, failedAttempts: 0, blocked: false },
  ],
  audit: [],
});

export function readDb() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (stored?.version === VERSION) return stored;
  } catch { /* se usa la semilla */ }
  return seed();
}

export const writeDb = (db) => localStorage.setItem(KEY, JSON.stringify(db));
export const wait = (ms) => new Promise((r) => setTimeout(r, process.env.NODE_ENV === 'test' ? 0 : ms));
export const newId = (prefix = 'u') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Ni siquiera en la demo se guardan contraseñas en texto plano. (Un SHA-256 simple NO alcanza en producción:
// el backend real debe usar un hash lento con sal, como argon2 o bcrypt.)
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const digest = async (salt, password) =>
  hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))));

export async function makeCredential(password) {
  const salt = hex(globalThis.crypto.getRandomValues(new Uint8Array(8)));
  return { salt, passwordHash: await digest(salt, password) };
}
export async function checkPassword(user, password) {
  return (await digest(user.salt, password)) === user.passwordHash;
}

// Nunca incluir contraseñas en `entry`.
export function pushAudit(db, entry) {
  db.audit.push({ at: new Date().toISOString(), ...entry });
}

// US-06: permisos efectivos = unión de los permisos de roles ACTIVOS, siempre que el permiso
// y su módulo estén activos. El estado del usuario y del dominio NO entra acá (se valida al autenticar).
export function effectivePermissions(db, user) {
  const activeModules = new Set(db.modules.filter((m) => m.active).map((m) => m.code));
  const grantable = new Set(db.permissions.filter((p) => p.active && activeModules.has(p.module)).map((p) => p.code));
  const granted = db.roles.filter((r) => r.active && user.roles.includes(r.id)).flatMap((r) => r.permissions);
  return [...new Set(granted)].filter((code) => grantable.has(code));
}

// Forma de la sesión que devolvería el backend al autenticar.
export function toSession(db, user, extra = {}) {
  const roles = db.roles.filter((r) => user.roles.includes(r.id));
  return {
    token: 'mock-token',
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      roles: roles.map(({ id, name }) => ({ id, name })),
      permissions: effectivePermissions(db, user),
      mustChangePassword: user.mustChangePassword,
      ...extra,
    },
  };
}
