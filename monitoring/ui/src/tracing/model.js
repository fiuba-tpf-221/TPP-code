export const RANGES = {
  "15m": ["Últimos 15 minutos", 15 * 60000],
  "1h": ["Última hora", 3600000],
  "6h": ["Últimas 6 horas", 6 * 3600000],
  "24h": ["Últimas 24 horas", 24 * 3600000],
};
// Convierte los atributos de Jaeger en un diccionario por clave.
export const tags = (values) =>
  Object.fromEntries((values || []).map(({ key, value }) => [key, value]));
// Resuelve el servicio del proceso asociado al span.
export const serviceOf = (trace, span) =>
  trace.processes?.[span.processID]?.serviceName || "Sin servicio";
// Reconoce los indicadores de error registrados por Jaeger y OpenTelemetry.
export const isError = (span) => {
  const data = tags(span.tags);
  return (
    data.error === true ||
    data.error === "true" ||
    data["otel.status_code"] === "ERROR"
  );
};
// Normaliza el tipo de span con un valor interno por defecto.
export const spanKind = (span) =>
  String(tags(span.tags)["span.kind"] || "internal").toLowerCase();
// Calcula el percentil 95 de una muestra sin modificarla.
export const percentile = (values) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]
    : null;
// Formatea un número con la configuración regional de la interfaz.
export const number = (value) => new Intl.NumberFormat("es-AR").format(value);
// Convierte un timestamp de Jaeger en una hora local.
export const time = (micros) =>
  new Date(micros / 1000).toLocaleTimeString("es-AR", {
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
// Convierte un timestamp de Jaeger en fecha y hora locales.
export const dateTime = (micros) =>
  new Date(micros / 1000).toLocaleString("es-AR", {
    hourCycle: "h23",
    dateStyle: "short",
    timeStyle: "medium",
  });

// Presenta una duración en microsegundos, milisegundos o segundos.
export function duration(micros) {
  if (micros == null || !Number.isFinite(micros)) return "—";
  if (micros < 1000) return `${Math.round(micros)} µs`;
  if (micros < 1000000)
    return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(micros / 1000)} ms`;
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(micros / 1000000)} s`;
}

// Calcula el recorrido total, la raíz y los errores de una traza.
export function summarize(trace) {
  const spans = trace.spans || [];
  const ids = new Set(spans.map((span) => span.spanID));
  const roots = spans.filter(
    (span) =>
      !(span.references || []).some(
        (ref) =>
          ref.refType === "CHILD_OF" &&
          ref.traceID === trace.traceID &&
          ids.has(ref.spanID),
      ),
  );
  const root =
    [...roots].sort((a, b) => a.startTime - b.startTime)[0] || spans[0];
  const start = spans.length
    ? Math.min(...spans.map((span) => span.startTime))
    : 0;
  const end = spans.length
    ? Math.max(...spans.map((span) => span.startTime + span.duration))
    : 0;
  return {
    ...trace,
    spans,
    start,
    duration: Math.max(0, end - start),
    root,
    name: root?.operationName || "Sin operación",
    service: root ? serviceOf(trace, root) : "Sin servicio",
    services: [...new Set(spans.map((span) => serviceOf(trace, span)))],
    errors: spans.filter(isError).length,
  };
}

// Agrupa las trazas por operación y calcula su latencia p95.
export function operationStats(traces) {
  const groups = new Map();
  traces.forEach((trace) => {
    const key = `${trace.service}\0${trace.name}`;
    if (!groups.has(key))
      groups.set(key, {
        name: trace.name,
        service: trace.service,
        count: 0,
        errors: 0,
        durations: [],
      });
    const group = groups.get(key);
    group.count += 1;
    group.errors += trace.errors > 0 ? 1 : 0;
    group.durations.push(trace.duration);
  });
  return [...groups.values()]
    .map((group) => ({ ...group, p95: percentile(group.durations) }))
    .sort((a, b) => b.p95 - a.p95);
}

// Agrupa los spans por servicio sin duplicar el conteo de trazas.
export function serviceStats(traces) {
  const groups = new Map();
  traces.forEach((trace) =>
    trace.spans.forEach((span) => {
      const name = serviceOf(trace, span);
      if (!groups.has(name))
        groups.set(name, {
          name,
          traces: new Set(),
          spans: 0,
          errors: 0,
          durations: [],
        });
      const group = groups.get(name);
      group.traces.add(trace.traceID);
      group.spans += 1;
      group.errors += isError(span) ? 1 : 0;
      group.durations.push(span.duration);
    }),
  );
  return [...groups.values()]
    .map((group) => ({
      ...group,
      count: group.traces.size,
      p95: percentile(group.durations),
    }))
    .sort((a, b) => b.count - a.count);
}

// Distribuye la muestra en doce intervalos de actividad y latencia.
export function activity(traces, window) {
  if (!window) return [];
  const size = (window.end - window.start) / 12;
  const buckets = Array.from({ length: 12 }, (_, index) => ({
    start: window.start + index * size,
    end: window.start + (index + 1) * size,
    count: 0,
    errors: 0,
    durations: [],
  }));
  traces.forEach((trace) => {
    const index = Math.max(
      0,
      Math.min(11, Math.floor((trace.start / 1000 - window.start) / size)),
    );
    buckets[index].count += 1;
    buckets[index].errors += trace.errors > 0 ? 1 : 0;
    buckets[index].durations.push(trace.duration);
  });
  return buckets.map((bucket) => ({
    ...bucket,
    p95: percentile(bucket.durations),
  }));
}

// Ordena la jerarquía de spans tolerando padres ausentes y ciclos.
export function spanRows(trace) {
  const ordered = [...trace.spans].sort((a, b) => a.startTime - b.startTime);
  const ids = new Set(ordered.map((span) => span.spanID));
  const children = new Map();
  ordered.forEach((span) => {
    const parent =
      (span.references || []).find(
        (ref) =>
          ref.refType === "CHILD_OF" &&
          ref.traceID === trace.traceID &&
          ids.has(ref.spanID) &&
          ref.spanID !== span.spanID,
      )?.spanID || null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(span);
  });
  const result = [];
  const visited = new Set();
  // Recorre la jerarquía una sola vez por span para evitar ciclos.
  const walk = (span, ancestors = []) => {
    if (visited.has(span.spanID)) return;
    visited.add(span.spanID);
    result.push({
      span,
      ancestors,
      children: (children.get(span.spanID) || []).length,
    });
    (children.get(span.spanID) || []).forEach((child) =>
      walk(child, [...ancestors, span.spanID]),
    );
  };
  (children.get(null) || []).forEach((span) => walk(span));
  // Un padre ausente o una referencia cíclica no debe ocultar spans recibidos.
  ordered.forEach((span) => walk(span));
  return result;
}
