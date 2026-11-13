// Token de Keycloak para hablar con la propia API (server/auth.py lo exige en todo /api).
// La central no tiene login: cuando se abre sola (sin token) la API devuelve 401/403 y cada
// panel lo muestra como "no autorizado"; cuando el portal principal la embebe, le pasa el token.

const KEY = "tpp_monitor_token";

function readTokenFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (!token) return null;
  params.delete("token");
  const rest = params.toString();
  // Se limpia de la URL para que no quede ahí (historial, recarga de la página, etc.).
  window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
  return token;
}

function readStoredToken() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* almacenamiento no disponible (modo privado, etc.): se sigue solo con la copia en memoria */
  }
}

let current = readTokenFromQuery() ?? readStoredToken();
if (current) storeToken(current);

export function getToken() {
  return current;
}

// El portal principal refresca el token periódicamente por postMessage, sin recargar el iframe
// (ver frontend/src/features/system/MonitoringEmbed.js).
window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.type !== "tpp-monitoring:token") return;
  if (typeof event.data.token !== "string") return;
  current = event.data.token;
  storeToken(current);
});
