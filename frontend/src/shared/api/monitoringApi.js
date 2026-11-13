import { currentToken } from './httpClient';
import { MONITORING_API_URL } from '../../config/services';

// Habla con la Central de Monitoreo (otro origen, otro contenedor): manda el token de esta misma
// sesión como Authorization en vez de depender de un login propio de esa app (ya no lo tiene).
export async function read(path, signal, timeoutMillis = 12000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMillis);
  try {
    const token = await currentToken();
    const response = await fetch(`${MONITORING_API_URL}${path}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'Necesitás iniciar sesión para ver esta información.'
          : response.status === 403
            ? 'Tu usuario no tiene permiso para ver esta información.'
            : response.status === 404
              ? 'No encontramos los datos solicitados. Pueden haber expirado.'
              : response.status === 422
                ? 'Este panel requiere una consulta o variable no soportada.'
                : 'La fuente de datos no está disponible.',
      );
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error.name === 'AbortError')
      throw new Error('La fuente no respondió dentro del plazo de consulta.');
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error('No se pudo leer la fuente de datos.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
