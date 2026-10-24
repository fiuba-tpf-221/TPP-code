import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './context';
import { keycloak, INIT_OPTIONS } from './keycloak';
import { userFromToken } from './keycloakUser';
import { sessionStore } from '../../shared/utils/session';
import { touch } from '../../shared/session/activity';
import { setTokenProvider, setUnauthorizedHandler } from '../../shared/api/httpClient';
import { useSessionTimeout } from './useSessionTimeout';
import { SESSION_TIMEOUT_NOTICE } from './messages';
import { ROUTES } from '../../config/routes';
import { KEYCLOAK } from '../../config/services';
import AuthStatusScreen from './components/AuthStatusScreen';

const EXPIRED_PARAM = 'expired';
// Si Keycloak está caído, la consulta en segundo plano de keycloak-js puede no responder nunca (ni fallar):
// pasado este tiempo se muestra el error con "Reintentar" en vez de dejar la app esperando para siempre.
const INIT_TIMEOUT_MS = 15000;
const absolute = (path) => `${window.location.origin}${path}`;

// Tras un cierre por timeout, Keycloak nos devuelve a /login?expired=1: se lee el aviso y se limpia la URL.
function consumeExpiredFlag() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(EXPIRED_PARAM)) return false;
  params.delete(EXPIRED_PARAM);
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  return true;
}

// Autenticación real: la hace Keycloak (flujo estándar con PKCE). La app solo muestra el resultado.
// El token vive en memoria (keycloak-js); en el navegador solo queda una copia de los datos del usuario, sin token.
export default function KeycloakAuthProvider({ children }) {
  const [phase, setPhase] = useState('starting'); // starting | ready | error
  const [session, setSession] = useState(null); // { user } | null
  const [notice, setNotice] = useState(() => (consumeExpiredFlag() ? SESSION_TIMEOUT_NOTICE : ''));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), INIT_TIMEOUT_MS); });
    Promise.race([keycloak.init(INIT_OPTIONS), timeout])
      .then((authenticated) => {
        if (authenticated) {
          const next = { user: userFromToken(keycloak.tokenParsed) };
          touch(); // haber obtenido el token es una petición autenticada aceptada
          sessionStore.set(next);
          setSession(next);
        } else {
          sessionStore.clear();
        }
        setPhase('ready');
      })
      .catch(() => setPhase('error'))
      .finally(() => clearTimeout(timer));
  }, []);

  // Cierra la sesión local y también la de Keycloak (si no, "Iniciar sesión" volvería a entrar sin pedir credenciales).
  const endSession = useCallback((expired) => {
    sessionStore.clear();
    setSession(null);
    return keycloak.logout({ redirectUri: absolute(ROUTES.LOGIN + (expired ? `?${EXPIRED_PARAM}=1` : '')) });
  }, []);
  const expire = useCallback(() => endSession(true), [endSession]);
  const logout = useCallback(() => endSession(false), [endSession]);

  useSessionTimeout(Boolean(session), expire);

  useEffect(() => {
    setUnauthorizedHandler(expire); // el backend rechazó el token
    // Antes de cada petición se renueva el token si está por vencer; si Keycloak ya no tiene la sesión, se cierra.
    setTokenProvider(async () => {
      try {
        await keycloak.updateToken(30);
      } catch {
        expire();
        return undefined;
      }
      return keycloak.token;
    });
    return () => { setUnauthorizedHandler(null); setTokenProvider(null); };
  }, [expire]);

  // Redirigen a Keycloak y, al terminar, vuelven a la ruta indicada.
  const login = useCallback((path = ROUTES.HOME) => keycloak.login({ redirectUri: absolute(path) }), []);
  const register = useCallback((path = ROUTES.HOME) => keycloak.register({ redirectUri: absolute(path) }), []);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    return {
      provider: 'keycloak', user, notice,
      isAuthenticated: Boolean(session),
      can: (permission) => Boolean(user?.permissions?.includes(permission)),
      login, register, logout,
    };
  }, [session, notice, login, register, logout]);

  if (phase === 'starting') return <AuthStatusScreen message="Conectando con el servicio de autenticación…" />;
  if (phase === 'error') {
    return (
      <AuthStatusScreen error onRetry={() => window.location.reload()}
        message={`No se pudo conectar con el servicio de autenticación (${KEYCLOAK.url}). Verificá que Keycloak esté en línea.`} />
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
