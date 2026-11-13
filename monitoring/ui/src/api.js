// Consulta JSON con timeout, cancelación y errores comunes a todas las fuentes.
export async function read(url, signal, timeoutMillis = 12000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMillis);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "No encontramos los datos solicitados. Pueden haber expirado."
          : response.status === 422
            ? "Este panel requiere una consulta o variable no soportada."
            : "La fuente de datos no está disponible.",
      );
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error.name === "AbortError")
      throw new Error("La fuente no respondió dentro del plazo de consulta.");
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error("No se pudo leer la fuente de datos.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
