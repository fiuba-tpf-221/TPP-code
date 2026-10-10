import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from './authService';
import { sessionStore } from '../../shared/utils/session';
import { isExpired, touch } from '../../shared/session/activity';
import { setUnauthorizedHandler } from '../../shared/api/httpClient';
import { SESSION_TIMEOUT_NOTICE } from './messages';

const AuthContext = createContext(null);
const CHECK_EVERY_MS = 10000;

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

export function AuthProvider({ children }) {
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

  // Timeout por inactividad (también aplica en la pantalla de cambio obligatorio de contraseña).
  useEffect(() => {
    if (!session) return undefined;
    const id = setInterval(() => { if (isExpired()) expire(); }, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [session, expire]);

  // Si el backend responde 401 a una petición autenticada, la sesión ya no vale.
  useEffect(() => {
    setUnauthorizedHandler(expire);
    return () => setUnauthorizedHandler(null);
  }, [expire]);

  const login = useCallback((data) => start(() => authService.login(data)), [start]);
  const register = useCallback((data) => start(() => authService.register(data)), [start]);
  const loginWithGoogle = useCallback((cred) => start(() => authService.loginWithGoogle(cred)), [start]);
  const changePassword = useCallback((data) => start(() => authService.changePassword(data)), [start]);

  const logout = useCallback(async () => {
    await authService.logout();
    sessionStore.clear();
    setSession(null);
    setNotice('');
  }, []);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    return {
      user, notice,
      isAuthenticated: Boolean(session),
      can: (permission) => Boolean(user?.permissions?.includes(permission)),
      login, register, loginWithGoogle, changePassword, logout,
    };
  }, [session, notice, login, register, loginWithGoogle, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
