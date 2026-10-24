import Keycloak from 'keycloak-js';
import { KEYCLOAK } from '../../config/services';

export const keycloak = new Keycloak({ url: KEYCLOAK.url, realm: KEYCLOAK.realm, clientId: KEYCLOAK.clientId });

// check-sso: al abrir o recargar la app se consulta en segundo plano (iframe) si ya hay sesión en Keycloak,
// sin mandar al usuario a su pantalla de login. PKCE S256, igual que la configuración original del equipo.
export const INIT_OPTIONS = {
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
  pkceMethod: 'S256',
  checkLoginIframe: false,
};
