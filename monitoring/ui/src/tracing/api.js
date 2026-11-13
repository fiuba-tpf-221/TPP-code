import { read } from "../api";

const API = "/api/jaeger";

// Adapta la respuesta de Jaeger al contrato de datos usado por las pantallas.
async function query(path, params, signal) {
  const suffix = params ? `?${new URLSearchParams(params)}` : "";
  const result = await read(`${API}${path}${suffix}`, signal, 15000);
  if (!Array.isArray(result.data))
    throw new Error("La respuesta de Jaeger no tiene el formato esperado.");
  return result.data;
}

// Recupera los servicios presentes en Jaeger.
export const getServices = (signal) => query("/services", null, signal);
// Recupera las operaciones del servicio seleccionado.
export const getOperations = (service, signal) =>
  query("/operations", { service }, signal);
// Recupera el JSON original de una traza por ID.
export const getTrace = (id, signal) =>
  query(`/traces/${encodeURIComponent(id)}`, null, signal);

// Traduce los filtros de pantalla a una consulta acotada de Jaeger.
export function getTraces(filters, window, signal) {
  const params = {
    service: filters.service,
    start: String(window.start * 1000),
    end: String(window.end * 1000),
    limit: "200",
  };
  if (filters.operation) params.operation = filters.operation;
  if (filters.status === "error")
    params.tags = JSON.stringify({ error: "true" });
  if (filters.minDuration > 0) params.minDuration = `${filters.minDuration}ms`;
  return query("/traces", params, signal);
}

// Construye el enlace al visor nativo de Jaeger.
export function nativeUrl(path = "") {
  const base =
    import.meta.env.VITE_JAEGER_UI_URL ||
    `http://${window.location.hostname}:16686`;
  return `${base.replace(/\/$/, "")}/${path}`;
}
