import React, { useEffect, useState } from 'react';
import { http } from '../../shared/api/httpClient';

// Reutiliza el health check que ya existía en el backend.
export default function SystemStatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    http('/health').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Estado del sistema</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {!data && !error && <p className="muted">Consultando al backend…</p>}
      {data && (
        <dl className="status">
          <dt>Servicio</dt><dd>{data.status}</dd>
          <dt>Base de datos</dt><dd>{data.database}</dd>
          <dt>Visitas (Redis)</dt><dd>{data.redis_visits}</dd>
        </dl>
      )}
    </>
  );
}
