import React from 'react';
import { FEATURES } from '../../config/features';
import MockAuthProvider from './MockAuthProvider';
import KeycloakAuthProvider from './KeycloakAuthProvider';

export { useAuth } from './context';

// Elige cómo se autentica la app (ver FEATURES.AUTH_PROVIDER). Las pantallas solo usan useAuth().
export function AuthProvider({ children }) {
  const Provider = FEATURES.AUTH_PROVIDER === 'keycloak' ? KeycloakAuthProvider : MockAuthProvider;
  return <Provider>{children}</Provider>;
}
