import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './context';
import { authService } from './authService';
import { sessionStore } from '../../shared/utils/session';
import { isExpired, touch } from '../../shared/session/activity';
import { setUnauthorizedHandler } from '../../shared/api/httpClient';
import { useSessionTimeout } from './useSessionTimeout';
import { SESSION_TIMEOUT_NOTICE } from './messages';

// Si el navegador se cerró y la sesión guardada ya venció por inactividad, no se restaura.
function restoreSession() {
  const stored = sessionStore.get();
  if (stored && isExpired()) {
    authService.recordTimeout();
    sessionStore.clear();
    return { session: null, notice: SESSION_TIMEOUT_NOTICE };
  }
  return { session: stored, notice: '' };
}

// Login simulado en el navegador (src/mock). Para trabajar la interfaz sin levantar Keycloak.
export default function MockAuthProvider({ children }) {
  const [initial] = useState(restoreSession);
  const [session, setSession] = useState(initial.session);
  const [notice, setNotice] = useState(initial.notice);

  // Toda forma de entrar (email, Google, registro, cambio de contraseña) termina guardando la sesión acá.
  const start = useCallback(async (request) => {
    const next = await request();
    touch();
    sessionStore.set(next);
    setSession(next);
    setNotice('');
  }, []);

  const expire = useCallback(() => {
    authService.recordTimeout();
    sessionStore.clear();
    setSession(null);
    setNotice(SESSION_TIMEOUT_NOTICE);
  }, []);

  useSessionTimeout(Boolean(session), expire);

  // Si el backend responde 401 a una petición autenticada, la sesión ya no vale.
  useEffect(() => {
    setUnauthorizedHandler(expire);
    return () => setUnauthorizedHandler(null);
  }, [expire]);

  const login = useCallback((data) => start(() => authService.login(data)), [start]);
  const register = useCallback((data) => start(() => authService.register(data)), [start]);
  const loginWithGoogle = useCallback((cred) => start(() => authService.loginWithGoogle(cred)), [start]);
  const changePassword = useCallback((data) => start(() => authService.changePassword(data)), [start]);

  // Mi perfil: el nombre que se muestra arriba a la derecha acompaña al que se guardó.
  const updateUser = useCallback((patch) => {
    const current = sessionStore.get();
    if (!current) return;
    const next = { ...current, user: { ...current.user, ...patch } };
    sessionStore.set(next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    sessionStore.clear();
    setSession(null);
    setNotice('');
  }, []);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    return {
      provider: 'mock', user, notice,
      isAuthenticated: Boolean(session),
      can: (permission) => Boolean(user?.permissions?.includes(permission)),
      login, register, loginWithGoogle, changePassword, updateUser, logout,
    };
  }, [session, notice, login, register, loginWithGoogle, changePassword, updateUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
