import React from "react";
import { Metric, PanelHeader } from "../tracing/components";
import { RANGES } from "../tracing/model";
import { format } from "./charts";
import { useMonitoring, useRemote } from "./useMonitoring";

const COUNTS = [
  ["accepted", "Spans aceptados", "Recibidos por el Collector mediante OTLP", "trace"],
  ["exported", "Spans enviados", "Exportados desde el Collector hacia Jaeger", "trace"],
  ["refused", "Spans rechazados", "Rechazados al ingresar al Collector", "error"],
  ["failed", "Spans con fallo de envío", "Spans de envíos fallidos; pueden reintentarse", "error"],
];

const count = (value) => value == null ? "—" :
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);

// Compara incrementos de contadores, sin sumar puntos de las tasas temporales.
export default function TelemetrySummary() {
  const { window, range } = useMonitoring();
  const { data, loading, error } = useRemote(
    `/api/telemetry/summary?${new URLSearchParams(window)}`,
    `telemetry-summary:${range}`,
  );
  const values = data?.values || {};
  const partial = Object.keys(data?.errors || {}).length > 0;
  const status = error
    ? data ? "Datos anteriores" : "Sin datos"
    : loading ? "Actualizando" : "Prometheus";
  const description = (key, text) =>
    error && data ? "Dato anterior; no se pudo actualizar" :
      data?.errors?.[key] ? "No se pudo consultar esta métrica" :
        data && values[key] == null ? "Sin muestras disponibles" : text;
  return (
    <>
      <section className="obs-panel mon-telemetry-summary">
        <PanelHeader
          title="Spans del período"
          description={`Totales estimados · ${RANGES[range][0]}`}
        >
          <span className="obs-subtle-tag">{status}</span>
        </PanelHeader>
        {(error || partial) && (
          <p className="mon-inline-error" role="status">
            {error || "No se pudieron actualizar todas las métricas."}
          </p>
        )}
        <div className="obs-metrics">
          {COUNTS.map(([key, label, text, icon]) => (
            <Metric
              key={key}
              label={label}
              value={count(values[key])}
              description={description(key, text)}
              icon={icon}
              accent={key === "accepted" || key === "exported"}
            />
          ))}
        </div>
        <p className="mon-footnote">
          Los totales se estiman a partir de las muestras de Prometheus y contemplan
          reinicios del Collector. La diferencia entre aceptados y enviados puede
          incluir spans en procesamiento. Los fallos de envío pueden reintentarse;
          no equivalen a spans perdidos. «—» indica que no hay una medición disponible.
        </p>
      </section>
      <section className="obs-panel mon-telemetry-summary">
        <PanelHeader
          title="Recursos del Collector"
          description={data
            ? `Medición al ${new Date(data.end * 1000).toLocaleTimeString("es-AR", { hourCycle: "h23" })}`
            : "Consultando las últimas muestras"}
        />
        <div className="obs-metrics mon-collector-resources">
          <Metric
            label="Cola de envío a Jaeger"
            value={`${count(values.queue)} / ${count(values.queue_capacity)}`}
            description={description("queue",
              values.queue_capacity == null
                ? "Elementos pendientes / capacidad sin datos"
                : "Elementos pendientes / capacidad de la cola; no son spans")}
            icon="trace"
          />
          <Metric
            label="Memoria del Collector"
            value={format(values.collector_memory, "bytes")}
            description={description("collector_memory", "Memoria residente del proceso")}
            icon="services"
          />
        </div>
      </section>
    </>
  );
}
