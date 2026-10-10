import React from 'react';
import { PASSWORD_MIN, PASSWORD_MAX, PASSWORD_SPECIALS } from '../../../shared/utils/password';

export default function PasswordRequirements({ showPrevious = false }) {
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
