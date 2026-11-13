// Token para hablar con la propia API (server/auth.py lo exige en todo /api).
// Lo maneja Keycloak (ver keycloak.js): acá solo se pide que esté vigente antes de cada request.

import { keycloak } from "./keycloak";

export async function getToken() {
  try {
    await keycloak.updateToken(30);
  } catch {
    // si no se puede renovar, Keycloak ya no tiene una sesión válida: se vuelve a pedir login
    keycloak.login();
    return null;
  }
  return keycloak.token;
}
