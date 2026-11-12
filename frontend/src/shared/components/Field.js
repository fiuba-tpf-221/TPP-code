import React from 'react';

// Campo de formulario con etiqueta, ayuda y error asociados. `multiline` lo muestra como área de texto.
export default function Field({ label, id, error, hint, multiline = false, ...controlProps }) {
  const Control = multiline ? 'textarea' : 'input';
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Control id={id} aria-invalid={Boolean(error)} aria-describedby={described} {...controlProps} />
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field__error">{error}</p>}
    </div>
  );
}
