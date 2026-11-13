import React from 'react';
import { FEATURES } from '../../config/features';
import Alert from './Alert';

// Con login real (Keycloak) pero sin backend de usuarios, estas pantallas trabajan con datos simulados.
export default function DemoDataNotice() {
  if (!(FEATURES.USE_MOCK_API && FEATURES.AUTH_PROVIDER === 'keycloak')) return null;
  return (
    <Alert kind="info">
      Datos de demostración: lo que ves en esta pantalla es simulado y no existe en Keycloak.
      Las altas, modificaciones y bajas todavía no llegan al servicio de autenticación.
    </Alert>
  );
}
