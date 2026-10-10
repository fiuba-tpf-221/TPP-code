import React, { useState } from 'react';

// Se muestra una sola vez: vive solo en memoria (no en la URL ni en el storage).
export default function TemporaryPasswordNotice({ title, intro, extra, password, onContinue }) {
  const [status, setStatus] = useState('idle'); // idle | copied | failed

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <section className="notice" aria-labelledby="notice-title">
      <h1 id="notice-title">{title}</h1>
      <p>{intro}</p>
      {extra && <p className="muted">{extra}</p>}

      <p className="notice__label">Contraseña temporal</p>
      <div className="notice__password">
        <code>{password}</code>
        <button type="button" className="btn btn--secondary" onClick={copy}>
          {status === 'copied' ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      {status === 'failed' && <p role="alert" className="error">No se pudo copiar. Seleccionala y copiala a mano.</p>}

      <p className="notice__warning" role="note">
        Esta contraseña se muestra una sola vez. Copiala ahora: después no vas a poder volver a verla.
        El usuario deberá cambiarla al ingresar.
      </p>
      <button type="button" className="btn" onClick={onContinue}>Continuar</button>
    </section>
  );
}
