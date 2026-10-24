import React from 'react';
import { APP_NAME } from '../../../config/app';
import Alert from '../../../shared/components/Alert';
import '../auth.css';

// Pantalla mínima mientras se conecta con el servicio de autenticación, o si no se pudo.
export default function AuthStatusScreen({ message, error = false, onRetry }) {
  return (
    <main className="solo">
      <div className="window">
        <div className="window__body">
          <p className="window__brand">{APP_NAME}</p>
          {error ? <Alert kind="error">{message}</Alert> : <p className="muted" role="status">{message}</p>}
          {error && <button type="button" className="btn btn--block" onClick={onRetry}>Reintentar</button>}
        </div>
      </div>
    </main>
  );
}
