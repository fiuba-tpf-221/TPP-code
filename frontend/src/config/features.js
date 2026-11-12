// ═══════════════════════════════════════════════════════════════════════════
//  INTERRUPTOR ÚNICO: cómo funciona la aplicación
//
//    'mock'      Ambiente controlado. Login, usuarios y panel Sistema simulados en el navegador.
//                No necesita Docker ni backend: todas las pantallas funcionan.
//    'keycloak'  Integración real. Login con el Keycloak de la infraestructura y panel Sistema con los
//                servicios reales (los usuarios siguen simulados hasta que el backend los tenga).
//
//  Dos formas de cambiarlo:
//    · Para todo el equipo: cambiar DEFAULT_MODE acá abajo.
//    · Solo para vos: REACT_APP_MODE en frontend/.env, o `npm run start:mock` / `npm run start:keycloak`.
//  Con Docker, después de cambiarlo hay que reconstruir: docker compose up -d --build frontend
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_MODE = 'mock';

const MODES = ['mock', 'keycloak'];
const requested = process.env.REACT_APP_MODE || DEFAULT_MODE;
if (!MODES.includes(requested)) {
  // eslint-disable-next-line no-console
  console.warn(`REACT_APP_MODE="${requested}" no es válido (usar ${MODES.join(' o ')}). Se usa "${DEFAULT_MODE}".`);
}
const MODE = MODES.includes(requested) ? requested : DEFAULT_MODE;

const asBoolean = (value, fallback) => (value === 'true' ? true : value === 'false' ? false : fallback);

export const FEATURES = {
  // Cómo se autentica la app. Lo define el interruptor de arriba.
  AUTH_PROVIDER: MODE,
  // El panel Sistema muestra estados simulados en vez de consultar los servicios reales.
  // Por defecto acompaña al modo; para ver el estado real con login simulado: REACT_APP_SIMULATE_INFRA=false.
  SIMULATE_INFRA: asBoolean(process.env.REACT_APP_SIMULATE_INFRA, MODE === 'mock'),
  // true = usuarios (alta, consulta, modificación) simulados en el navegador. Pasar a false cuando el backend los implemente.
  USE_MOCK_API: true,
  // Pestaña "Crear cuenta" en el acceso. Ver si otra US la reemplaza por el alta hecha por administradores.
  SELF_REGISTRATION: true,
};
