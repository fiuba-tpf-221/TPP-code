import { SESSION_TIMEOUT_MS } from '../../config/session';

const KEY = 'tpp.last-activity';

// Actividad válida = una petición autenticada aceptada por el backend (US-05).
// Mover el mouse, escribir o cambiar el foco NO llaman a touch(): no reinician el timeout.
export const touch = () => localStorage.setItem(KEY, String(Date.now()));
export const isExpired = () => Date.now() - (Number(localStorage.getItem(KEY)) || 0) > SESSION_TIMEOUT_MS;
