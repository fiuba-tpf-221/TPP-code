// Códigos de permiso definidos por el sistema (US-06): no tienen ABM en la aplicación.
// Cada permiso pertenece a exactamente un módulo (ver `modules` y `permissions` en el contrato del backend).
export const PERMISSIONS = {
  USERS_MANAGE: 'users.manage', // Administración · Gestión de usuarios
  ROLES_MANAGE: 'roles.manage', // Administración · Gestión de roles
  DOMAINS_MANAGE: 'domains.manage', // Administración · Gestión de dominios
  AUDIT_VIEW: 'audit.view', // Administración · Consulta de auditoría
  SYSTEM_VIEW: 'system.view', // Administración · Consulta del sistema (panel de infraestructura; no figura en la US-06)
  MODELS_MANAGE: 'models.manage', // Modelos · Gestión de modelos
  PREDICTIONS_USE: 'predictions.use', // Predicción · Uso de modelos
};
