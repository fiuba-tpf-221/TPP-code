import { sessionStore } from '../utils/session';
import { touch } from '../session/activity';

// AuthContext registra acá qué hacer si el backend dice que la sesión ya no es válida.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

// Quién entrega el token: por defecto el de la sesión simulada; con Keycloak, un proveedor que lo renueva si hace falta.
const fromSession = async () => sessionStore.get()?.token;
let tokenProvider = fromSession;
export const setTokenProvider = (fn) => { tokenProvider = fn ?? fromSession; };

export class ApiError extends Error {
  // `field` (opcional) indica qué campo del formulario originó el error, ej. 'email'.
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

// Cliente único para hablar con el backend. Agrega el token solo.
export async function http(path, { method = 'GET', body, headers } = {}) {
  const token = await tokenProvider();

  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail || 'No se pudo completar la solicitud', data.field);
  }
  if (token) touch(); // petición autenticada aceptada = actividad válida
  return res.status === 204 ? null : res.json();
}
