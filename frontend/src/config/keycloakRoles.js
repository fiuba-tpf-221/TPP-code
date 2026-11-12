import { PERMISSIONS as P } from './permissions';

// PROVISORIO: relaciona los roles del realm de Keycloak con los permisos de la aplicación (US-06).
// Lo correcto es que el backend devuelva los permisos efectivos (por ejemplo GET /api/me) y esta tabla desaparezca.
// Los roles deben existir en Keycloak (Realm roles) con exactamente estos nombres; no distingue mayúsculas.
export const ROLE_PERMISSIONS = {
  administrador: Object.values(P),
  analista: [P.MODELS_MANAGE, P.PREDICTIONS_USE],
  operador: [P.PREDICTIONS_USE],
  consulta: [],
};
