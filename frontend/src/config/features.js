// ═══════════════════════════════════════════════════════════════════════════
//  INTERRUPTOR ÚNICO: cómo funciona la aplicación
//
//    'mock'      Ambiente controlado. Login y usuarios simulados en el navegador. Sistema y
//                Auditoría siguen consultando los servicios reales (necesitan Docker arriba);
//                sin una sesión real de Keycloak, esos paneles muestran que falta autenticación.
//    'keycloak'  Integración real. Login con el Keycloak de la infraestructura (los usuarios
//                siguen simulados hasta que el backend los tenga).
//
//  Dos formas de cambiarlo:
//    · Para todo el equipo: cambiar DEFAULT_MODE acá abajo.
//    · Solo para vos: REACT_APP_MODE en frontend/.env, o `npm run start:mock` / `npm run start:keycloak`.
//  Con Docker, después de cambiarlo hay que reconstruir: docker compose up -d --build frontend
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_MODE = 'keycloak';

const MODES = ['mock', 'keycloak'];
const requested = process.env.REACT_APP_MODE || DEFAULT_MODE;
if (!MODES.includes(requested)) {
  // eslint-disable-next-line no-console
  console.warn(`REACT_APP_MODE="${requested}" no es válido (usar ${MODES.join(' o ')}). Se usa "${DEFAULT_MODE}".`);
}
const MODE = MODES.includes(requested) ? requested : DEFAULT_MODE;

export const FEATURES = {
  // Cómo se autentica la app. Lo define el interruptor de arriba.
  AUTH_PROVIDER: MODE,
  // true = usuarios (alta, consulta, modificación) simulados en el navegador. Pasar a false cuando el backend los implemente.
  USE_MOCK_API: true,
  // Pestaña "Crear cuenta" en el acceso. Ver si otra US la reemplaza por el alta hecha por administradores.
  SELF_REGISTRATION: true,
};
