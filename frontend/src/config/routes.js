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
  ROLE_NEW: '/roles/nuevo',
  ROLE_DETAIL: '/roles/:id',
  DOMAINS: '/dominios',
  AUDIT: '/auditoria',
  MODELS: '/modelos',
  PREDICTION: '/prediccion',
  SYSTEM: '/sistema',
};

export const userDetailPath = (id) => `/usuarios/${id}`;
export const roleDetailPath = (id) => `/roles/${id}`;

// Menú lateral. Cada ítem solo se muestra si el usuario tiene el permiso efectivo.
// Un grupo sin ítems visibles no se dibuja; sin ningún grupo, no hay menú lateral (US-05).
// Auditoría y Sistema tienen `children`: al entrar a esa sección (o alguna de sus sub-páginas)
// se despliega el submenú con sus nombres descriptivos (qué se ve, no la herramienta técnica).
export const NAV_GROUPS = [
  { label: 'Administración', icon: 'admin', items: [
    { to: ROUTES.USERS, label: 'Usuarios', icon: 'users', permission: P.USERS_MANAGE },
    { to: ROUTES.ROLES, label: 'Roles', icon: 'roles', permission: P.ROLES_MANAGE },
    { to: ROUTES.DOMAINS, label: 'Dominios', icon: 'domains', permission: P.DOMAINS_MANAGE },
    { to: ROUTES.AUDIT, label: 'Auditoría', icon: 'audit', permission: P.AUDIT_VIEW, children: [
      { to: ROUTES.AUDIT, label: 'Resumen de trazas', end: true },
      { to: `${ROUTES.AUDIT}/explorar`, label: 'Explorar trazas' },
      { to: `${ROUTES.AUDIT}/servicios`, label: 'Servicios de trazas' },
    ] },
    { to: ROUTES.SYSTEM, label: 'Sistema', icon: 'system', permission: P.SYSTEM_VIEW, children: [
      { to: ROUTES.SYSTEM, label: 'Vista general', end: true },
      { to: `${ROUTES.SYSTEM}/infraestructura`, label: 'Infraestructura' },
      { to: `${ROUTES.SYSTEM}/postgresql`, label: 'Base de datos' },
      { to: `${ROUTES.SYSTEM}/opentelemetry`, label: 'Visión del sistema' },
      { to: `${ROUTES.SYSTEM}/dashboards`, label: 'Dashboards' },
    ] },
  ] },
  { items: [
    { to: ROUTES.MODELS, label: 'Modelos', icon: 'models', permission: P.MODELS_MANAGE },
    { to: ROUTES.PREDICTION, label: 'Predicción', icon: 'prediction', permission: P.PREDICTIONS_USE },
  ] },
];
