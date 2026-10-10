import React, { useState } from 'react';

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

// Contraseña enmascarada con botón para mostrarla u ocultarla temporalmente.
export default function PasswordField({ label, id, error, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input id={id} type={visible ? 'text' : 'password'} aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
        <button type="button" className="field__toggle" aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVisible((v) => !v)}>
          <svg {...icon}>
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
      {error && <p id={`${id}-error`} className="field__error">{error}</p>}
    </div>
  );
}
