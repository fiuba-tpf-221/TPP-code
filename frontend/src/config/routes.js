import { PERMISSIONS as P } from './permissions';

export const ROUTES = {
  LOGIN: '/login',
  CHANGE_PASSWORD: '/cambiar-contrasena',
  HOME: '/',
  PROFILE: '/perfil',
  USERS: '/usuarios',
  USER_NEW: '/usuarios/nuevo',
  USER_DETAIL: '/usuarios/:id',
  ROLES: '/roles',
  DOMAINS: '/dominios',
  AUDIT: '/auditoria',
  MODELS: '/modelos',
  PREDICTION: '/prediccion',
  SYSTEM: '/sistema',
};

export const userDetailPath = (id) => `/usuarios/${id}`;

// Menú lateral. Cada ítem solo se muestra si el usuario tiene el permiso efectivo.
// Un grupo sin ítems visibles no se dibuja; sin ningún grupo, no hay menú lateral (US-05).
export const NAV_GROUPS = [
  { label: 'Administración', icon: 'admin', items: [
    { to: ROUTES.USERS, label: 'Usuarios', icon: 'users', permission: P.USERS_MANAGE },
    { to: ROUTES.ROLES, label: 'Roles', icon: 'roles', permission: P.ROLES_MANAGE },
    { to: ROUTES.DOMAINS, label: 'Dominios', icon: 'domains', permission: P.DOMAINS_MANAGE },
    { to: ROUTES.AUDIT, label: 'Auditoría', icon: 'audit', permission: P.AUDIT_VIEW },
  ] },
  { items: [
    { to: ROUTES.MODELS, label: 'Modelos', icon: 'models', permission: P.MODELS_MANAGE },
    { to: ROUTES.PREDICTION, label: 'Predicción', icon: 'prediction', permission: P.PREDICTIONS_USE },
  ] },
];
