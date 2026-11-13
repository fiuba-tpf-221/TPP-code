import React from 'react';
import { PASSWORD_MIN, PASSWORD_MAX, PASSWORD_SPECIALS } from '../../../shared/utils/password';

// variant "profile": la lista detallada del wireframe de Mi perfil. Por defecto, la versión corta.
export default function PasswordRequirements({ showPrevious = false, variant = 'compact' }) {
  if (variant === 'profile') {
    return (
      <div className="requirements requirements--detailed">
        <p>Tu nueva contraseña debe:</p>
        <ul>
          <li>Tener entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres</li>
          <li>Usar solo caracteres ASCII</li>
          <li>No contener espacios en blanco</li>
          <li>Incluir solo los siguientes caracteres:
            <ul>
              <li>Letras (A-Z, a-z)</li>
              <li>Números (0-9)</li>
              <li>Caracteres especiales: <code>{PASSWORD_SPECIALS}</code></li>
            </ul>
          </li>
          <li>Ser distinta de tu contraseña actual</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="requirements">
      <p>Requisitos de la contraseña:</p>
      <ul>
        <li>Entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres</li>
        <li>Sin espacios</li>
        <li>Puede contener letras, números y caracteres especiales</li>
        <li>Especiales permitidos: <code>{PASSWORD_SPECIALS}</code> (solo caracteres ASCII)</li>
        {showPrevious && <li>Diferente de la contraseña anterior</li>}
      </ul>
    </div>
  );
}
