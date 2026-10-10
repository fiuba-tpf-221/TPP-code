import React from 'react';

export default function Field({ label, id, error, ...inputProps }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      {error && <p id={`${id}-error`} className="field__error">{error}</p>}
    </div>
  );
}
