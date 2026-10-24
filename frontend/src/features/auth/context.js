import { createContext, useContext } from 'react';

// Lo que toda forma de autenticación (Keycloak o simulada) le ofrece al resto de la app.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
