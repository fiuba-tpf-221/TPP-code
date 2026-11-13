import React, { useEffect, useRef, useState } from 'react';
import { MONITORING_URL } from '../../config/services';
import { keycloak } from '../auth/keycloak';
import Alert from '../../shared/components/Alert';

// El access token de Keycloak vence antes de que un admin termine de mirar el panel:
// se renueva solo, sin recargar el iframe (así no pierde la pantalla en la que está).
const REFRESH_MS = 4 * 60 * 1000;

// Embebe la central de monitoreo (docker-compose propio, puerto 3002) dentro del panel Sistema.
// server/auth.py exige el mismo rol administrador para servir datos, así que el token hay que
// pasárselo: por query string en la carga inicial y por postMessage en cada renovación.
export default function MonitoringEmbed() {
  const frameRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        await keycloak.updateToken(30);
      } catch {
        // seguimos con el token que haya en memoria; si no hay ninguno, abajo se marca error
      }
      if (cancelled) return;
      if (keycloak.token) setSrc(`${MONITORING_URL}/?token=${encodeURIComponent(keycloak.token)}`);
      else setError(true);
    }
    start();

    const timer = setInterval(async () => {
      try {
        await keycloak.updateToken(30);
        frameRef.current?.contentWindow?.postMessage(
          { type: 'tpp-monitoring:token', token: keycloak.token },
          MONITORING_URL,
        );
      } catch {
        // si Keycloak ya no puede renovar, KeycloakAuthProvider se encarga de cerrar la sesión
      }
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <Alert kind="error">No se pudo preparar el acceso a la Central de Monitoreo.</Alert>;
  }
  if (!src) return null;

  return <iframe ref={frameRef} src={src} title="Central de Monitoreo" className="monitoring-embed" />;
}
