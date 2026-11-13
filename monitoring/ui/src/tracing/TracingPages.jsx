import { ChartPanel } from "../ChartPanel";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ActivityChart,
  Empty,
  FilterBar,
  Icon,
  Metric,
  PanelHeader,
  QueryState,
  TraceTable,
} from "./components";
import {
  duration,
  number,
  operationStats,
  percentile,
  serviceOf,
  serviceStats,
} from "./model";
import { useTracing } from "./useTracing";

// Presenta el título y las acciones de cada pantalla de trazas.
function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="obs-page-header">
      <div>
        <div className="obs-eyebrow">
          OBSERVABILIDAD <span>/</span> {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

// Permite actualizar la consulta de trazas y elegir su frecuencia.
function QueryToolbar() {
  const {
    loading,
    refreshing,
    updated,
    refresh,
    interval,
    setRefreshInterval,
  } = useTracing();
  const busy = loading || refreshing;
  return (
    <div className="obs-query-toolbar">
      <span className="obs-updated" aria-live="polite">
        <Icon name="clock" size={14} />
        {busy
          ? "Actualizando…"
          : updated
            ? `Actualizado ${updated.toLocaleTimeString("es-AR", { hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "Pendiente de consulta"}
      </span>
      <label className="obs-auto-refresh">
        <span className="obs-sr-only">Actualización automática</span>
        <select
          aria-label="Actualización automática"
          value={interval}
          onChange={(event) => setRefreshInterval(Number(event.target.value))}
        >
          <option value="0">Actualización manual</option>
          <option value="15">Actualizar cada 15 s</option>
          <option value="30">Actualizar cada 30 s</option>
          <option value="60">Actualizar cada 60 s</option>
        </select>
      </label>
      <button
        className="obs-btn obs-btn-secondary"
        onClick={refresh}
        disabled={busy}
      >
        <Icon name="refresh" className={busy ? "obs-spinning" : ""} size={16} />
        Actualizar
      </button>
    </div>
  );
}

// Aclara el alcance de la muestra recuperada desde Jaeger.
function SampleNote() {
  const { traces, loading, error } = useTracing();
  if (loading || error) return null;
  return (
    <p className="obs-sample-note">
      <Icon name="filter" size={13} />
      {traces.length >= 200
        ? "Se alcanzó el límite de 200 trazas. Acotá el período o la operación para explorar con más detalle."
        : `Indicadores calculados sobre ${number(traces.length)} trazas recuperadas. El muestreo y la retención pueden limitar la actividad visible.`}
    </p>
  );
}

// Compara la latencia de las operaciones presentes en la muestra.
function OperationsPanel({ traces }) {
  const { params } = useTracing();
  const rows = useMemo(() => operationStats(traces), [traces]);
  const maximum = Math.max(1, ...rows.map((row) => row.p95));
  return (
    <ChartPanel title="Latencia por operación">
      <PanelHeader
        title="Latencia por operación"
        description="p95 de la duración total de cada traza"
      />
      <div className="obs-operation-list">
        {!rows.length ? (
          <Empty icon="chart" />
        ) : (
          rows.slice(0, 6).map((row) => (
            <Link
              key={`${row.service}-${row.name}`}
              className="obs-operation-row"
              to={`/traces?${new URLSearchParams({ ...Object.fromEntries(params), operation: row.name, q: "" })}`}
            >
              <div>
                <strong title={row.name}>{row.name}</strong>
                <span>
                  {number(row.count)} {row.count === 1 ? "traza" : "trazas"}
                  {row.errors ? ` · ${row.errors} con errores` : ""}
                </span>
              </div>
              <div className="obs-operation-bar">
                <i
                  style={{
                    width: `${Math.max(2, (row.p95 / maximum) * 100)}%`,
                  }}
                />
              </div>
              <strong>{duration(row.p95)}</strong>
              <Icon name="chevron" size={13} />
            </Link>
          ))
        )}
      </div>
    </ChartPanel>
  );
}

// Resume volumen, latencia y errores de las trazas recuperadas.
export function TracingOverview() {
  const { traces, loading, error, params } = useTracing();
  const { window } = useTracing();
  const sorted = useMemo(
    () => [...traces].sort((a, b) => b.start - a.start),
    [traces],
  );
  const errors = traces.filter((trace) => trace.errors).length;
  const services = new Set(traces.flatMap((trace) => trace.services)).size;
  const pending = loading || !!error;
  return (
    <>
      <PageHeader
        eyebrow="RESUMEN"
        title="Resumen de trazas"
        description="Duración, errores y servicios de las trazas consultadas."
      >
        <QueryToolbar />
      </PageHeader>
      <FilterBar />
      <div className="obs-metrics">
        <Metric
          label="Trazas recuperadas"
          value={pending ? "—" : number(traces.length)}
          description="En el contexto de esta consulta"
          icon="trace"
          accent
        />
        <Metric
          label="Latencia p95"
          value={
            pending
              ? "—"
              : duration(percentile(traces.map((trace) => trace.duration)))
          }
          description="Percentil 95 de las trazas recuperadas"
          icon="clock"
        />
        <Metric
          label="Trazas con errores"
          value={
            pending || !traces.length
              ? "—"
              : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((errors / traces.length) * 100)} %`
          }
          description={
            pending
              ? "Pendiente de consulta"
              : `${number(errors)} de ${number(traces.length)} trazas recuperadas`
          }
          icon="error"
        />
        <Metric
          label="Servicios observados"
          value={pending ? "—" : number(services)}
          description="Presentes en las trazas consultadas"
          icon="services"
        />
      </div>
      <QueryState />
      {!pending && (
        <>
          <div className="obs-overview-charts">
            <ActivityChart traces={traces} window={window} />
            <OperationsPanel traces={traces} />
          </div>
          <section className="obs-panel">
            <PanelHeader
              title="Últimas trazas"
              description="Del evento más reciente al más antiguo"
            >
              <Link className="obs-text-link" to={`/traces?${params}`}>
                Explorar todas
                <Icon name="arrow" size={16} />
              </Link>
            </PanelHeader>
            <TraceTable traces={sorted} compact />
          </section>
        </>
      )}
      <SampleNote />
    </>
  );
}

// Filtra, ordena y abre las trazas de la consulta actual.
export function TraceExplorer() {
  const { traces, loading, error, params, updateParams } = useTracing();
  const search = params.get("q") || "";
  const sort = params.get("sort") || "recent";
  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const matching = traces.filter((trace) =>
      `${trace.name} ${trace.traceID} ${trace.service}`
        .toLowerCase()
        .includes(needle),
    );
    return matching.sort((a, b) =>
      sort === "slowest"
        ? b.duration - a.duration
        : sort === "errors"
          ? b.errors - a.errors || b.start - a.start
          : b.start - a.start,
    );
  }, [traces, search, sort]);
  return (
    <>
      <PageHeader
        eyebrow="EXPLORADOR"
        title="Explorador de trazas"
        description="Consultá trazas por servicio, operación, duración y estado."
      >
        <QueryToolbar />
      </PageHeader>
      <FilterBar />
      <section className="obs-panel">
        <PanelHeader
          title="Resultados de la consulta"
          description={
            loading
              ? "Recuperando actividad…"
              : `${number(filtered.length)} de ${number(traces.length)} trazas coinciden`
          }
        >
          <span className="obs-subtle-tag">Máximo 200 por consulta</span>
        </PanelHeader>
        <div className="obs-results-toolbar">
          <label className="obs-search-field">
            <Icon name="search" size={17} />
            <span className="obs-sr-only">Buscar por operación o ID</span>
            <input
              aria-label="Buscar por operación o ID"
              placeholder="Buscar por operación o Trace ID…"
              value={search}
              onChange={(event) =>
                updateParams({ q: event.target.value }, true)
              }
            />
            {search && (
              <button
                className="obs-icon-button"
                onClick={() => updateParams({ q: "" }, true)}
                aria-label="Limpiar búsqueda"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </label>
          {/^(?:[0-9a-f]{16}|[0-9a-f]{32})$/i.test(search.trim()) && (
            <Link
              className="obs-text-link"
              to={`/traces/${search.trim()}?${params}`}
            >
              Abrir por Trace ID
              <Icon name="arrow" size={14} />
            </Link>
          )}
          <label className="obs-sort-field">
            Ordenar por
            <select
              aria-label="Orden de las trazas"
              value={sort}
              onChange={(event) =>
                updateParams({ sort: event.target.value }, true)
              }
            >
              <option value="recent">Más recientes</option>
              <option value="slowest">Mayor duración</option>
              <option value="errors">Más errores</option>
            </select>
          </label>
        </div>
        <QueryState />
        {!loading && !error && <TraceTable traces={filtered} />}
      </section>
      <SampleNote />
    </>
  );
}

// Dibuja las relaciones padre-hijo observadas entre servicios.
function ServiceMap({ traces, services }) {
  const nodes = services.slice(0, 8);
  const relations = new Map();
  traces.forEach((trace) => {
    const spans = new Map(trace.spans.map((span) => [span.spanID, span]));
    trace.spans.forEach((span) =>
      (span.references || [])
        .filter(
          (ref) => ref.refType === "CHILD_OF" && ref.traceID === trace.traceID,
        )
        .forEach((ref) => {
          const parent = spans.get(ref.spanID);
          if (!parent) return;
          const from = serviceOf(trace, parent);
          const to = serviceOf(trace, span);
          if (
            from === to ||
            !nodes.some((node) => node.name === from) ||
            !nodes.some((node) => node.name === to)
          )
            return;
          const key = `${from}\0${to}`;
          if (!relations.has(key))
            relations.set(key, { from, to, traces: new Set() });
          relations.get(key).traces.add(trace.traceID);
        }),
    );
  });
  const positions = new Map(
    nodes.map((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
      return [
        node.name,
        {
          x: nodes.length === 1 ? 400 : 400 + Math.cos(angle) * 255,
          y: nodes.length === 1 ? 120 : 130 + Math.sin(angle) * 83,
        },
      ];
    }),
  );
  return (
    <ChartPanel title="Mapa de servicios">
      <PanelHeader
        title="Mapa de servicios"
        description="Relaciones padre-hijo entre servicios presentes en la muestra"
      />
      {!nodes.length ? (
        <Empty icon="services" />
      ) : (
        <>
          <svg
            className="obs-service-map"
            viewBox="0 0 800 270"
            role="img"
            aria-label={`Mapa de ${nodes.length} servicios y ${relations.size} relaciones observadas`}
          >
            <defs>
              <marker
                id="obs-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0 0 10 5 0 10Z" fill="#90aaa4" />
              </marker>
            </defs>
            {[...relations].map(([key, edge]) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
              return (
                <g key={key}>
                  <line
                    x1={from.x + ((to.x - from.x) / distance) * 35}
                    y1={from.y + ((to.y - from.y) / distance) * 35}
                    x2={to.x - ((to.x - from.x) / distance) * 35}
                    y2={to.y - ((to.y - from.y) / distance) * 35}
                    stroke="#90aaa4"
                    strokeWidth="1.5"
                    markerEnd="url(#obs-arrow)"
                  />
                  <title>
                    {edge.from} → {edge.to}: {edge.traces.size} trazas
                  </title>
                </g>
              );
            })}
            {nodes.map((node) => {
              const point = positions.get(node.name);
              return (
                <g
                  key={node.name}
                  transform={`translate(${point.x} ${point.y})`}
                >
                  <circle r="32" fill="#e8f3ef" stroke="#b7d9d0" />
                  <g
                    transform="translate(-10 -10)"
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth="1.6"
                  >
                    <rect x="1" y="1" width="18" height="6" rx="2" />
                    <rect x="1" y="12" width="18" height="6" rx="2" />
                  </g>
                  <text y="55" textAnchor="middle" className="obs-map-name">
                    {node.name.length > 25
                      ? `${node.name.slice(0, 23)}…`
                      : node.name}
                  </text>
                  <text y="73" textAnchor="middle">
                    {node.spans} spans · {duration(node.p95)} p95
                  </text>
                  <title>
                    {node.name}: {node.count} trazas, {node.spans} spans
                  </title>
                </g>
              );
            })}
          </svg>
          <p className="obs-map-caption">
            {relations.size
              ? `${relations.size} relaciones observadas entre los servicios mostrados.`
              : "No se observaron llamadas entre servicios distintos en esta consulta."}
            {services.length > 8 &&
              " El mapa muestra los primeros ocho servicios."}
          </p>
        </>
      )}
    </ChartPanel>
  );
}

// Resume la participación y el rendimiento de los servicios observados.
export function TraceServices() {
  const { traces, loading, error, params } = useTracing();
  const rows = useMemo(() => serviceStats(traces), [traces]);
  return (
    <>
      <PageHeader
        eyebrow="SERVICIOS"
        title="Servicios y recorridos"
        description="Servicios, latencias y relaciones observadas en las trazas."
      >
        <QueryToolbar />
      </PageHeader>
      <FilterBar />
      <QueryState />
      {!loading && !error && (
        <>
          <ServiceMap traces={traces} services={rows} />
          <section className="obs-panel">
            <PanelHeader
              title="Servicios observados"
              description="Latencia y errores calculados sobre sus spans recuperados"
            />
            {!rows.length ? (
              <Empty icon="services" />
            ) : (
              <div className="obs-table-scroll">
                <table className="obs-table">
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Trazas</th>
                      <th>Spans</th>
                      <th>Latencia p95 de spans</th>
                      <th>Spans con errores</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <span className="obs-service-name">
                            <Icon name="services" size={17} />
                            <strong>{row.name}</strong>
                          </span>
                        </td>
                        <td>{number(row.count)}</td>
                        <td>{number(row.spans)}</td>
                        <td>{duration(row.p95)}</td>
                        <td>
                          <span
                            className={
                              row.errors ? "obs-error-text" : "obs-muted"
                            }
                          >
                            {number(row.errors)}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="obs-text-link"
                            to={`/traces?${new URLSearchParams({ ...Object.fromEntries(params), service: row.name, operation: "", q: "" })}`}
                          >
                            Ver trazas
                            <Icon name="arrow" size={15} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <SampleNote />
    </>
  );
}
