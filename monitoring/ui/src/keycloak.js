import Keycloak from "keycloak-js";

// Mismo realm y cliente que usa el front principal (frontend/src/config/services.js -> KEYCLOAK):
// si ya hay una sesión de Keycloak abierta en el navegador, entra directo (SSO); si no, Keycloak
// pide usuario y contraseña antes de mostrar cualquier dato.
const host = window.location.hostname;

export const keycloak = new Keycloak({
  url: `http://${host}:8080`,
  realm: "tpp-realm",
  clientId: "frontend-client",
});

export const INIT_OPTIONS = {
  onLoad: "login-required",
  pkceMethod: "S256",
  checkLoginIframe: false,
};
