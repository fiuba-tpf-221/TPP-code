import React, { useEffect, useMemo, useRef, useState } from "react";
import { Empty, PanelHeader } from "../tracing/components";
import { useMetric, useMonitoring } from "./useMonitoring";
import { ChartPanel } from "../ChartPanel";
import {
  containerKey,
  containerName,
  matchesContainer,
  serviceContainer,
} from "./containers";

const COLORS = [
  "#0f766e",
  "#b47824",
  "#3b79ad",
  "#9e6378",
  "#597340",
  "#785eab",
  "#9b5d32",
  "#517a83",
];
// Formatea una medición según su unidad sin inventar valores ausentes.
export function format(value, unit = "short") {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "bytes") {
    const index = Math.min(
      4,
      Math.max(0, Math.floor(Math.log(Math.max(1, value)) / Math.log(1024))),
    );
    return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value / 1024 ** index)} ${["B", "KiB", "MiB", "GiB", "TiB"][index]}`;
  }
  const text = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(value);
  return unit === "percent"
    ? `${text} %`
    : unit === "ops"
      ? `${text} /s`
      : unit === "up"
        ? value === 1
          ? "Disponible"
          : "No saludable"
        : text;
}

// Identifica una serie a partir de sus etiquetas disponibles.
export const seriesName = (labels) =>
  ({ total: "Capacidad total", used: "Espacio ocupado" })[labels.kind] ||
  labels.database ||
  (labels.service ? containerName(serviceContainer(labels.service)) : null) ||
  ((labels.name || labels.id || labels.container_label_com_docker_compose_service)
    ? containerName(containerKey(labels))
    : null) ||
  labels.exporter ||
  labels.receiver ||
  labels.job ||
  "Total";
// Asigna un color estable a cada nombre de serie.
const color = (label) =>
  COLORS[
    Math.abs(
      [...label].reduce(
        (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
        0,
      ),
    ) % COLORS.length
  ];
// Presenta el instante de una muestra en la hora local.
const clock = (seconds) =>
  new Date(seconds * 1000).toLocaleTimeString("es-AR", {
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });

// Dibuja series temporales con selección de leyenda y navegación por teclado.
function TimeSeries({ series, unit }) {
  const { selectedContainer, selectContainer } = useMonitoring();
  const ref = useRef(null);
  const [width, setWidth] = useState(550);
  const [height, setHeight] = useState(194);
  const [hover, setHover] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(new Set());
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.max(1, entries[0].contentRect.width));
      setHeight(Math.max(1, entries[0].contentRect.height));
    });
    const canvas = ref.current?.querySelector(".mon-chart-canvas");
    if (canvas) observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  const shown = series.filter((item) => !hidden.has(seriesName(item.labels)));
  const points = shown.flatMap((item) =>
    item.points.filter((point) => point[1] != null),
  );
  const start = series.length
    ? Math.min(...series.map((item) => item.points[0]?.[0] ?? Infinity))
    : 0;
  const end = series.length
    ? Math.max(...series.map((item) => item.points.at(-1)?.[0] ?? 0))
    : 1;
  const maximum = Math.max(1, ...points.map((point) => point[1]));
  const left = Math.min(unit === "bytes" ? 76 : 60, width * 0.3);
  const plot = Math.max(1, width - left - 16);
  const x = (value) =>
    left + ((value - start) / Math.max(1, end - start)) * plot;
  const plotHeight = Math.max(1, height - 59);
  const y = (value) => height - 34 - (value / maximum) * plotHeight;
  const target = start + (end - start) * (hover ?? 1);
  const highlighted = shown.map((item) => ({
    ...item,
    point: item.points.reduce(
      (best, point) =>
        !best || Math.abs(point[0] - target) < Math.abs(best[0] - target)
          ? point
          : best,
      null,
    ),
  }));
  return (
    <div ref={ref} className="mon-chart">
      <div
        className="mon-chart-canvas"
        tabIndex="0"
        role="group"
        aria-label="Gráfico de métricas. Usá las flechas para recorrer el tiempo."
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setHover((value) =>
              Math.max(
                0,
                Math.min(
                  1,
                  (value ?? 1) + (event.key === "ArrowLeft" ? -0.05 : 0.05),
                ),
              ),
            );
          }
        }}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(1, (event.clientX - bounds.left - left) / plot),
            ),
          );
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Evolución de las series recuperadas de Prometheus"
        >
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1={left}
                x2={width - 16}
                y1={25 + fraction * plotHeight}
                y2={25 + fraction * plotHeight}
                className="obs-grid-line"
              />
              <text x={left - 9} y={29 + fraction * plotHeight} textAnchor="end">
                {format(
                  maximum * (1 - fraction),
                  unit === "up" ? "short" : unit,
                )}
              </text>
            </g>
          ))}
          {shown.map((item) => {
            let gap = true;
            const path = item.points
              .map(([timestamp, value]) => {
                if (value == null) {
                  gap = true;
                  return "";
                }
                const command = gap ? "M" : "L";
                gap = false;
                return `${command}${x(timestamp).toFixed(2)},${y(value).toFixed(2)}`;
              })
              .join(" ");
            return (
              <path
                key={seriesName(item.labels)}
                d={path}
                fill="none"
                stroke={color(seriesName(item.labels))}
                strokeWidth="1.8"
              />
            );
          })}
          {[0, 0.5, 1].map((point) => (
            <text
              key={point}
              x={left + point * plot}
              y={height - 10}
              textAnchor={
                point === 0 ? "start" : point === 1 ? "end" : "middle"
              }
            >
              {clock(start + point * (end - start))}
            </text>
          ))}
          {hover != null && (
            <line
              x1={left + hover * plot}
              x2={left + hover * plot}
              y1="20"
              y2={height - 32}
              stroke="#879c95"
              strokeDasharray="3 3"
            />
          )}
        </svg>
      </div>
      <div className="mon-chart-values" aria-live="polite">
        <span>{clock(target)}</span>
        {highlighted.slice(0, 6).map((item) => (
          <span key={seriesName(item.labels)}>
            <i style={{ background: color(seriesName(item.labels)) }} />
            {seriesName(item.labels)}
            <strong>{format(item.point?.[1], unit)}</strong>
          </span>
        ))}
      </div>
      <div
        className="mon-chart-series"
        role="group"
        aria-label="Series del gráfico"
      >
        {series.slice(0, expanded ? 40 : 6).map((item) => {
          const name = seriesName(item.labels);
          return (
            <button
              key={name}
              aria-pressed={
                item.labels.id || item.labels.name || item.labels.service
                  ? !!selectedContainer
                  : !hidden.has(name)
              }
              className={hidden.has(name) ? "is-hidden" : ""}
              onClick={() => {
                if (item.labels.id || item.labels.name || item.labels.service || item.labels.container_label_com_docker_compose_service) {
                  const labels = item.labels.service
                    ? { name: serviceContainer(item.labels.service) }
                    : item.labels;
                  const key = containerKey(labels);
                  selectContainer(
                    selectedContainer && matchesContainer(labels, selectedContainer) ? "" : key,
                  );
                  return;
                }
                setHidden((previous) => {
                  const next = new Set(previous);
                  next.has(name) ? next.delete(name) : next.add(name);
                  return next;
                });
              }}
            >
              <i style={{ background: color(name) }} />
              {name}
            </button>
          );
        })}
        {series.length > 6 && (
          <button
            className="mon-expand-series"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Mostrar menos" : `Ver las ${series.length} series`}
          </button>
        )}
      </div>
      <details className="mon-chart-data">
        <summary>Ver últimos valores en tabla</summary>
        <div className="obs-table-scroll">
          <table className="obs-table">
            <thead>
              <tr>
                <th>Serie</th>
                <th>Última muestra</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {series.map((item) => (
                <tr key={seriesName(item.labels)}>
                  <td>{seriesName(item.labels)}</td>
                  <td>
                    {item.points.length ? clock(item.points.at(-1)[0]) : "—"}
                  </td>
                  <td>{format(item.points.at(-1)?.[1], unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// Consulta una métrica y distingue datos actuales, anteriores y ausentes.
export function MetricPanel({ name, title, description, panel = null }) {
  const { data, loading, error } = useMetric(name, panel);
  const { selectedContainer } = useMonitoring();
  const series = useMemo(
    () =>
      data?.series?.filter((item) => {
        const labels = item.labels;
        const matches = labels.id || labels.name || labels.container_label_com_docker_compose_service
          ? matchesContainer(labels, selectedContainer)
          : name === "availability"
            ? matchesContainer({ name: serviceContainer(labels.service) }, selectedContainer)
            : true;
        return matches && item.points.some((point) => point[1] != null);
      }) || [],
    [data, selectedContainer, name],
  );
  return (
    <ChartPanel title={title || data?.title || "Métrica"} className="mon-metric-panel">
      <PanelHeader
        title={title || data?.title || "Métrica"}
        description={
          description || "Series observadas en el período seleccionado"
        }
      >
        <span className="obs-subtle-tag">
          {error && data
            ? "Dato anterior"
            : loading
              ? "Actualizando"
              : data?.source || "Prometheus"}
        </span>
      </PanelHeader>
      {error && (
        <p className="mon-inline-error" role="status">
          {error}
          {data && ` Última consulta válida: ${clock(data.queriedAt)}.`}
        </p>
      )}
      {series.length ? (
        <TimeSeries key={selectedContainer} series={series} unit={data.unit} />
      ) : loading && !data ? (
        <div className="obs-loading mon-chart-loading" role="status">
          <span className="obs-spinner" />
          Consultando métricas…
        </div>
      ) : (
        <Empty
          icon="chart"
          title={
            error ? "Fuente no disponible" : "Sin muestras en este período"
          }
        >
          {error
            ? "Las otras secciones continúan disponibles."
            : selectedContainer
              ? "No hay muestras para el contenedor seleccionado en este período."
              : "No hay muestras disponibles para este período."}
        </Empty>
      )}
    </ChartPanel>
  );
}
