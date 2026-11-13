import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getOperations } from "./api";
import { activity, dateTime, duration, number, RANGES, time } from "./model";
import { useTracing } from "./useTracing";
import { ChartPanel, ChartExpandButton } from "../ChartPanel";

const paths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 17h7m-3.5-3.5v7" />
    </>
  ),
  trace: (
    <>
      <path d="M4 6h11M8 12h12M12 18h8M4 6v12h4" />
      <circle cx="18" cy="6" r="2" />
    </>
  ),
  services: (
    <>
      <rect x="8" y="2" width="8" height="6" rx="1.5" />
      <rect x="2" y="16" width="8" height="6" rx="1.5" />
      <rect x="14" y="16" width="8" height="6" rx="1.5" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14" />
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  filter: (
    <>
      <path d="M3 5h18M6 12h12M9 19h6" />
      <circle cx="8" cy="5" r="2" />
      <circle cx="15" cy="12" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  error: (
    <>
      <path d="m12 3 10 17H2L12 3Z" />
      <path d="M12 9v4m0 3v.5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chart: (
    <>
      <path d="M4 3v17h17M8 15l4-5 4 2 5-7" />
    </>
  ),
};

// Renderiza un icono del catálogo visual compartido.
export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.trace}
    </svg>
  );
}

// Identifica visualmente si una traza o span registró errores.
export function StatusBadge({ error, label }) {
  return (
    <span className={`obs-badge ${error ? "is-error" : "is-success"}`}>
      <span className="obs-status-dot" />
      {label || (error ? "Con errores" : "Sin errores")}
    </span>
  );
}

// Presenta un estado sin resultados con su explicación.
export function Empty({
  title = "Todavía no hay trazas",
  children,
  icon = "trace",
}) {
  return (
    <div className="obs-empty">
      <span className="obs-empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      <p>
        {children ||
          "Generá una solicitud en la aplicación o ampliá el período de búsqueda."}
      </p>
    </div>
  );
}

// Muestra la carga o el fallo de una consulta de trazas.
export function QueryState() {
  const { loading, error, refresh } = useTracing();
  if (error)
    return (
      <div className="obs-error-state" role="alert">
        <Icon name="error" size={24} />
        <div>
          <h3>No pudimos cargar las trazas</h3>
          <p>{error}</p>
          <button className="obs-btn obs-btn-secondary" onClick={refresh}>
            Volver a intentar
          </button>
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="obs-loading" role="status">
        <span className="obs-spinner" />
        <span>Consultando trazas…</span>
        <small>Buscando actividad en el período seleccionado</small>
      </div>
    );
  return null;
}

// Presenta un indicador y el alcance de su valor.
export function Metric({ label, value, description, icon, accent = false }) {
  return (
    <article className={`obs-metric ${accent ? "is-accent" : ""}`}>
      <div className="obs-metric-label">
        {label}
        <Icon name={icon} size={17} />
      </div>
      <strong>{value}</strong>
      <span>{description}</span>
    </article>
  );
}

// Mantiene un encabezado consistente para los paneles.
export function PanelHeader({ title, description, children }) {
  return (
    <div className="obs-panel-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="obs-chart-panel-actions">
        {children}
        <ChartExpandButton />
      </div>
    </div>
  );
}

// Sincroniza los filtros de tracing con la URL y las operaciones disponibles.
export function FilterBar() {
  const { filters, services, serviceError, updateParams, loading } =
    useTracing();
  const [draft, setDraft] = useState(filters);
  const [operations, setOperations] = useState([]);
  const [operationsError, setOperationsError] = useState(false);
  useEffect(() => setDraft(filters), [filters]);
  useEffect(() => {
    const controller = new AbortController();
    setOperations([]);
    setOperationsError(false);
    getOperations(draft.service, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setOperations(
            [
              ...new Set(
                data
                  .map((item) => (typeof item === "string" ? item : item.name))
                  .filter(Boolean),
              ),
            ].sort(),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setOperationsError(true);
      });
    return () => controller.abort();
  }, [draft.service]);
  const available = [...new Set([filters.service, ...services])];

  return (
    <form
      className="obs-filters"
      onSubmit={(event) => {
        event.preventDefault();
        updateParams({
          ...draft,
          minDuration: draft.minDuration || "",
          page: "",
        });
      }}
    >
      <div className="obs-filter-heading">
        <Icon name="filter" size={15} />
        <span>CONTEXTO DE LA CONSULTA</span>
        <button
          type="button"
          className="obs-reset-filters"
          onClick={() => {
            setDraft({ ...filters, operation: "", status: "", minDuration: 0 });
            updateParams({
              operation: "",
              status: "",
              minDuration: "",
              q: "",
              sort: "",
            });
          }}
        >
          Limpiar filtros
        </button>
      </div>
      <div className="obs-filter-fields">
        <label>
          Servicio
          <select
            value={draft.service}
            onChange={(event) =>
              setDraft({ ...draft, service: event.target.value, operation: "" })
            }
          >
            {available.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>
        </label>
        <label>
          Operación
          <select
            value={draft.operation}
            onChange={(event) =>
              setDraft({ ...draft, operation: event.target.value })
            }
          >
            <option value="">Todas las operaciones</option>
            {[...new Set([...operations, draft.operation].filter(Boolean))].map(
              (operation) => (
                <option key={operation}>{operation}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Período
          <select
            value={draft.range}
            onChange={(event) =>
              setDraft({ ...draft, range: event.target.value })
            }
          >
            {Object.entries(RANGES).map(([key, [label]]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            value={draft.status}
            onChange={(event) =>
              setDraft({ ...draft, status: event.target.value })
            }
          >
            <option value="">Todos los estados</option>
            <option value="error">Con errores</option>
          </select>
        </label>
        <label className="obs-duration-filter">
          Duración mínima
          <div className="obs-input-unit">
            <input
              aria-label="Duración mínima en milisegundos"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={draft.minDuration || ""}
              onChange={(event) =>
                setDraft({ ...draft, minDuration: event.target.value })
              }
            />
            <span>ms</span>
          </div>
        </label>
        <button
          className="obs-btn obs-btn-primary"
          type="submit"
          disabled={loading}
        >
          <Icon name="search" size={16} />
          Buscar
        </button>
      </div>
      {(serviceError || operationsError) && (
        <p className="obs-filter-note">
          No pudimos actualizar{" "}
          {serviceError ? "la lista de servicios" : "la lista de operaciones"}.
          Podés volver a buscar.
        </p>
      )}
    </form>
  );
}

// Agrupa la muestra temporalmente para comparar actividad y latencia.
export function ActivityChart({ traces, window }) {
  const buckets = useMemo(() => activity(traces, window), [traces, window]);
  const [mode, setMode] = useState("volume");
  const [hover, setHover] = useState(null);
  const maximum = Math.max(
    1,
    ...buckets.map((bucket) =>
      mode === "volume" ? bucket.count : bucket.p95 || 0,
    ),
  );
  const height = 150;
  const width = 760;
  const slot = width / 12;
  return (
    <ChartPanel title="Actividad de trazas" className="obs-activity-panel">
      <PanelHeader
        title="Actividad de trazas"
        description="Distribución de la muestra en el período seleccionado"
      >
        <div
          className="obs-segmented"
          role="group"
          aria-label="Medición del gráfico"
        >
          <button
            className={mode === "volume" ? "active" : ""}
            aria-pressed={mode === "volume"}
            onClick={() => {
              setMode("volume");
              setHover(null);
            }}
          >
            Volumen
          </button>
          <button
            className={mode === "latency" ? "active" : ""}
            aria-pressed={mode === "latency"}
            onClick={() => {
              setMode("latency");
              setHover(null);
            }}
          >
            Latencia p95
          </button>
        </div>
      </PanelHeader>
      {!traces.length ? (
        <Empty icon="chart" />
      ) : (
        <>
          <div className="obs-chart-legend">
            <span>
              <i className="obs-key" />
              {mode === "volume" ? "Trazas recuperadas" : "Latencia p95"}
            </span>
            {mode === "volume" && (
              <span>
                <i className="obs-key is-error" />
                Con errores
              </span>
            )}
            <span className="obs-chart-readout" aria-live="polite">
              {hover != null
                ? `${time(buckets[hover].start * 1000)} — ${mode === "volume" ? `${buckets[hover].count} trazas · ${buckets[hover].errors} con errores` : duration(buckets[hover].p95)}`
                : "Explorá los intervalos del gráfico"}
            </span>
          </div>
          <svg
            className="obs-activity-chart"
            viewBox="0 0 820 205"
            role="img"
            aria-label={`Actividad: ${mode === "volume" ? "cantidad de trazas" : "latencia p95"} por intervalo`}
          >
            {[0, 0.5, 1].map((fraction) => (
              <g key={fraction}>
                <line
                  x1="47"
                  x2="807"
                  y1={12 + height * fraction}
                  y2={12 + height * fraction}
                  className="obs-grid-line"
                />
                <text x="37" y={16 + height * fraction} textAnchor="end">
                  {mode === "volume"
                    ? Math.round(maximum * (1 - fraction))
                    : duration(maximum * (1 - fraction))}
                </text>
              </g>
            ))}
            {buckets.map((bucket, index) => {
              const value = mode === "volume" ? bucket.count : bucket.p95 || 0;
              const barHeight = (value / maximum) * height;
              const errorHeight = (bucket.errors / maximum) * height;
              return (
                <g
                  key={bucket.start}
                  tabIndex="0"
                  role="group"
                  aria-label={`${time(bucket.start * 1000)}: ${bucket.count} trazas, ${bucket.errors} con errores, p95 ${duration(bucket.p95)}`}
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover(null)}
                >
                  <rect
                    x={47 + index * slot}
                    y="12"
                    width={slot}
                    height={height}
                    fill={hover === index ? "#edf5f3" : "transparent"}
                  />
                  <rect
                    x={55 + index * slot}
                    y={12 + height - barHeight}
                    width={slot - 16}
                    height={barHeight}
                    rx="3"
                    className="obs-chart-bar"
                  />
                  {mode === "volume" && errorHeight > 0 && (
                    <rect
                      x={55 + index * slot}
                      y={12 + height - errorHeight}
                      width={slot - 16}
                      height={errorHeight}
                      rx="3"
                      className="obs-chart-bar is-error"
                    />
                  )}
                  {index % 2 === 0 && (
                    <text
                      x={47 + index * slot + slot / 2}
                      y="188"
                      textAnchor="middle"
                    >
                      {new Date(bucket.start).toLocaleTimeString("es-AR", {
                        hourCycle: "h23",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <details className="obs-chart-data">
            <summary>Ver datos del gráfico</summary>
            <div className="obs-table-scroll">
              <table className="obs-table">
                <thead>
                  <tr>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Trazas</th>
                    <th>Con errores</th>
                    <th>Latencia p95</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket) => (
                    <tr key={bucket.start}>
                      <td>{time(bucket.start * 1000)}</td>
                      <td>{time(bucket.end * 1000)}</td>
                      <td>{bucket.count}</td>
                      <td>{bucket.errors}</td>
                      <td>{duration(bucket.p95)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </ChartPanel>
  );
}

// Pagina las trazas y conserva los filtros al abrir su detalle.
export function TraceTable({ traces, compact = false }) {
  const { params } = useTracing();
  const [page, setPage] = useState(1);
  const context = params.toString();
  useEffect(() => setPage(1), [context]);
  const pageSize = compact ? 5 : 15;
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(traces.length / pageSize)),
  );
  const rows = traces.slice((current - 1) * pageSize, current * pageSize);
  const maximum = Math.max(1, ...traces.map((trace) => trace.duration));
  if (!traces.length)
    return (
      <Empty title="No encontramos coincidencias">
        Probá otra operación, quitá filtros o ampliá el período.
      </Empty>
    );
  return (
    <>
      <div className="obs-table-scroll">
        <table className="obs-table obs-trace-table">
          <thead>
            <tr>
              <th>Operación / Trace ID</th>
              <th>Inicio</th>
              <th>Duración</th>
              <th>Spans</th>
              <th>Estado</th>
              <th>
                <span className="obs-sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((trace) => (
              <tr key={trace.traceID}>
                <td>
                  <Link
                    className="obs-trace-link"
                    to={`/traces/${trace.traceID}?${params}`}
                  >
                    <span
                      className={`obs-service-mark ${trace.errors ? "is-error" : ""}`}
                    />
                    <span>
                      <strong>{trace.name}</strong>
                      <small>
                        <span>{trace.service}</span>
                        <code>{trace.traceID.slice(0, 12)}</code>
                      </small>
                    </span>
                  </Link>
                </td>
                <td className="obs-nowrap">
                  <time title={dateTime(trace.start)}>{time(trace.start)}</time>
                </td>
                <td>
                  <div className="obs-table-duration">
                    <strong>{duration(trace.duration)}</strong>
                    <span>
                      <i
                        className={trace.errors ? "is-error" : ""}
                        style={{
                          width: `${Math.max(2, (trace.duration / maximum) * 100)}%`,
                        }}
                      />
                    </span>
                  </div>
                </td>
                <td>{number(trace.spans.length)}</td>
                <td>
                  <StatusBadge error={trace.errors > 0} />
                </td>
                <td>
                  <Link
                    className="obs-icon-link"
                    to={`/traces/${trace.traceID}?${params}`}
                    aria-label={`Abrir traza ${trace.traceID}`}
                  >
                    <Icon name="arrow" size={17} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (
        <div className="obs-pagination">
          <span>
            {number((current - 1) * pageSize + 1)}–
            {number(Math.min(current * pageSize, traces.length))} de{" "}
            {number(traces.length)} trazas
          </span>
          <div>
            <button
              className="obs-btn obs-btn-secondary obs-btn-small"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <span>
              {current} / {Math.max(1, Math.ceil(traces.length / pageSize))}
            </span>
            <button
              className="obs-btn obs-btn-secondary obs-btn-small"
              disabled={current * pageSize >= traces.length}
              onClick={() => setPage(current + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  );
}
