// US-05: la sesión expira a los 30 minutos sin actividad válida.
// Para demostrarlo sin esperar, se puede acortar con REACT_APP_SESSION_TIMEOUT_SECONDS en frontend/.env.
const custom = Number(process.env.REACT_APP_SESSION_TIMEOUT_SECONDS);
export const SESSION_TIMEOUT_MS = (custom > 0 ? custom : 30 * 60) * 1000;
