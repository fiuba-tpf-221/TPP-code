import React from 'react';

// Cuerpo de la ventana de acceso cuando la autenticación la hace Keycloak: un botón que lleva a su pantalla.
export default function KeycloakEntry({ mode, onContinue }) {
  const register = mode === 'register';
  return (
    <div>
      <p className="muted">
        {register
          ? 'Vas a completar el alta en el servicio de autenticación y después volvés a la aplicación.'
          : 'Vas a ingresar con tu cuenta en el servicio de autenticación y después volvés a la aplicación.'}
      </p>
      <button type="button" className="btn btn--block" onClick={onContinue}>
        {register ? 'Crear cuenta' : 'Iniciar sesión'}
      </button>
    </div>
  );
}
