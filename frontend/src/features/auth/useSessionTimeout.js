import { useEffect } from 'react';
import { isExpired } from '../../shared/session/activity';

const CHECK_EVERY_MS = 10000;

// Timeout por inactividad (US-05): vale igual con Keycloak o con el login simulado.
export function useSessionTimeout(active, onExpire) {
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => { if (isExpired()) onExpire(); }, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [active, onExpire]);
}
