import React, { useEffect, useRef, useState } from 'react';
import '../users.css';

// Modal que NO se cierra con Esc: la contraseña se muestra una sola vez y perderla por accidente obligaría a generar otra.
function ResultDialog({ children }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, []);
  return (
    <dialog ref={ref} className="dialog dialog--result" aria-labelledby="notice-title" onCancel={(e) => e.preventDefault()}>
      {children}
    </dialog>
  );
}

// Muestra la contraseña temporal una sola vez: vive solo en memoria (no en la URL ni en el storage).
// `modal`: se muestra como ventana sobre la pantalla actual (US-08); si no, ocupa la pantalla (alta de usuario, US-01).
export default function TemporaryPasswordNotice({ title, intro, extra, password, onContinue, modal = false }) {
  const [status, setStatus] = useState('idle'); // idle | copied | failed
  const Heading = modal ? 'h2' : 'h1';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  const content = (
    <section className={modal ? 'notice notice--modal' : 'notice'} aria-labelledby="notice-title">
      <Heading id="notice-title">{title}</Heading>
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
        El usuario deberá cambiarla en su próximo inicio de sesión.
      </p>
      <button type="button" className="btn" onClick={onContinue}>Continuar</button>
    </section>
  );

  return modal ? <ResultDialog>{content}</ResultDialog> : content;
}
