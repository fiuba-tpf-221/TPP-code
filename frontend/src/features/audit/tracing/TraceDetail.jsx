import { ChartPanel } from '../../../shared/components/ChartPanel';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTrace, nativeUrl } from './api';
import { Empty, Icon, Metric, PanelHeader, StatusBadge } from './components';
import {
  dateTime,
  duration,
  isError,
  number,
  serviceOf,
  spanKind,
  spanRows,
  summarize,
} from './model';
import { useTracing } from './useTracing';

// Convierte un atributo escalar o compuesto a texto legible.
const valueText = (value) =>
  typeof value === 'object' ? JSON.stringify(value) : String(value);

// Filtra y presenta los atributos del span o proceso seleccionado.
function AttributeTable({ values = [], search = '' }) {
  const rows = values.filter((item) =>
    `${item.key} ${valueText(item.value)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (!rows.length)
    return (
      <p className="obs-detail-empty">
        {search
          ? 'No hay atributos que coincidan.'
          : 'Sin atributos registrados.'}
      </p>
    );
  return (
    <dl className="obs-attributes">
      {rows.map((item, index) => (
        <div key={`${item.key}-${index}`}>
          <dt>{item.key}</dt>
          <dd>{valueText(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Muestra atributos, eventos y servicio del span seleccionado.
function SpanDetails({ trace, span }) {
  const [tab, setTab] = useState('attributes');
  const [search, setSearch] = useState('');
  useEffect(() => {
    setTab('attributes');
    setSearch('');
  }, [span.spanID]);
  const process = trace.processes?.[span.processID];
  return (
    <aside
      className="obs-span-details"
      aria-label="Detalles del span seleccionado"
    >
      <div className="obs-span-detail-heading">
        <span className="obs-eyebrow">SPAN SELECCIONADO</span>
        <h2>{span.operationName}</h2>
        <span className="obs-service-name">
          <span className="obs-service-mark" />
          {serviceOf(trace, span)}
        </span>
        <div className="obs-span-badges">
          <StatusBadge error={isError(span)} />
          <span className="obs-subtle-tag">{spanKind(span).toUpperCase()}</span>
        </div>
      </div>
      <dl className="obs-span-facts">
        <div>
          <dt>Duración</dt>
          <dd>{duration(span.duration)}</dd>
        </div>
        <div>
          <dt>Inicio relativo</dt>
          <dd>+{duration(span.startTime - trace.start)}</dd>
        </div>
        <div>
          <dt>Span ID</dt>
          <dd>
            <code>{span.spanID}</code>
          </dd>
        </div>
      </dl>
      <div
        className="obs-detail-tabs"
        role="tablist"
        aria-label="Información del span"
      >
        {[
          ['attributes', 'Atributos'],
          ['events', 'Eventos'],
          ['service', 'Servicio'],
        ].map(([id, label]) => (
          <button
            key={id}
            id={`obs-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls="obs-span-tabpanel"
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : ''}
            onKeyDown={(event) => {
              const ids = ['attributes', 'events', 'service'];
              const direction =
                event.key === 'ArrowRight'
                  ? 1
                  : event.key === 'ArrowLeft'
                    ? -1
                    : 0;
              if (direction) {
                event.preventDefault();
                const next =
                  ids[(ids.indexOf(tab) + direction + ids.length) % ids.length];
                setTab(next);
                document.getElementById(`obs-tab-${next}`).focus();
              }
            }}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'events' && <span>{(span.logs || []).length}</span>}
          </button>
        ))}
      </div>
      <div
        className="obs-span-tabpanel"
        id="obs-span-tabpanel"
        role="tabpanel"
        aria-labelledby={`obs-tab-${tab}`}
      >
        {tab === 'attributes' && (
          <>
            <label className="obs-search-field obs-attribute-search">
              <Icon name="search" size={15} />
              <input
                aria-label="Filtrar atributos"
                placeholder="Filtrar atributos…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <AttributeTable values={span.tags} search={search} />
          </>
        )}
        {tab === 'events' &&
          (!(span.logs || []).length ? (
            <p className="obs-detail-empty">
              Este span no tiene eventos registrados.
            </p>
          ) : (
            <ol className="obs-events">
              {span.logs.map((log, index) => (
                <li key={`${log.timestamp}-${index}`}>
                  <span className="obs-event-time">
                    +{duration(log.timestamp - trace.start)}
                  </span>
                  <AttributeTable values={log.fields} />
                </li>
              ))}
            </ol>
          ))}
        {tab === 'service' && (
          <>
            <p className="obs-resource-name">
              {process?.serviceName || 'Sin servicio'}
            </p>
            <AttributeTable values={process?.tags} />
          </>
        )}
      </div>
    </aside>
  );
}

// Representa la jerarquía y duración de spans con selección y colapso.
function Waterfall({ trace }) {
  const [selected, setSelected] = useState(
    trace.root?.spanID || trace.spans[0]?.spanID,
  );
  const [collapsed, setCollapsed] = useState(new Set());
  const [search, setSearch] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [limit, setLimit] = useState(500);
  useEffect(() => {
    setSelected((previous) =>
      trace.spans.some((span) => span.spanID === previous)
        ? previous
        : trace.root?.spanID || trace.spans[0]?.spanID,
    );
    setCollapsed(new Set());
  }, [trace]);
  useEffect(() => setLimit(500), [search, errorsOnly]);
  const rows = useMemo(() => spanRows(trace), [trace]);
  const visible = rows.filter((row) => {
    if (search || errorsOnly)
      return (
        (!errorsOnly || isError(row.span)) &&
        `${row.span.operationName} ${serviceOf(trace, row.span)} ${row.span.spanID}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    return !row.ancestors.some((id) => collapsed.has(id));
  });
  const span = trace.spans.find((item) => item.spanID === selected);
  const total = Math.max(1, trace.duration);
  return (
    <ChartPanel title="Recorrido de la traza" className="obs-waterfall-panel">
      <PanelHeader
        title="Recorrido de la traza"
        description="Seleccioná un span para explorar sus atributos y eventos"
      >
        <span className="obs-subtle-tag">
          {number(trace.spans.length)} spans
        </span>
      </PanelHeader>
      <div className="obs-waterfall-toolbar">
        <label className="obs-search-field">
          <Icon name="search" size={16} />
          <input
            aria-label="Buscar spans"
            placeholder="Buscar operación, servicio o Span ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="obs-checkbox">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(event) => setErrorsOnly(event.target.checked)}
          />
          Solo spans con errores
        </label>
        <button
          className="obs-btn obs-btn-secondary obs-btn-small"
          onClick={() => setCollapsed(new Set())}
          disabled={!collapsed.size}
        >
          Expandir todo
        </button>
      </div>
      <div className="obs-waterfall-layout">
        <div className="obs-waterfall-scroll">
          <div className="obs-waterfall-grid">
            <div className="obs-waterfall-scale">
              <span>Servicio / Operación</span>
              <div>
                {[0, 0.25, 0.5, 0.75, 1].map((point) => (
                  <span key={point}>{duration(trace.duration * point)}</span>
                ))}
              </div>
            </div>
            {!visible.length ? (
              <Empty title="No hay spans que coincidan" icon="search">
                Probá otra búsqueda o desactivá el filtro de errores.
              </Empty>
            ) : (
              visible.slice(0, limit).map((row) => {
                const left = Math.max(
                  0,
                  Math.min(
                    100,
                    ((row.span.startTime - trace.start) / total) * 100,
                  ),
                );
                const width = Math.max(
                  0.25,
                  Math.min(100 - left, (row.span.duration / total) * 100),
                );
                const failed = isError(row.span);
                return (
                  <div
                    key={row.span.spanID}
                    className={`obs-waterfall-row ${selected === row.span.spanID ? 'is-selected' : ''}`}
                    data-span-id={row.span.spanID}
                  >
                    <div
                      className="obs-span-label"
                      style={{
                        paddingLeft: `${12 + Math.min(row.ancestors.length, 12) * 15}px`,
                      }}
                    >
                      {row.children ? (
                        <button
                          className={`obs-collapse ${collapsed.has(row.span.spanID) ? '' : 'is-open'}`}
                          aria-label={`${collapsed.has(row.span.spanID) ? 'Expandir' : 'Contraer'} ${row.span.operationName}`}
                          aria-expanded={!collapsed.has(row.span.spanID)}
                          onClick={() =>
                            setCollapsed((previous) => {
                              const next = new Set(previous);
                              next.has(row.span.spanID)
                                ? next.delete(row.span.spanID)
                                : next.add(row.span.spanID);
                              return next;
                            })
                          }
                        >
                          <Icon name="chevron" size={13} />
                        </button>
                      ) : (
                        <span className="obs-leaf-mark" />
                      )}
                      <button
                        className="obs-select-span"
                        aria-pressed={selected === row.span.spanID}
                        onClick={() => setSelected(row.span.spanID)}
                        title={`${row.span.operationName} · ${serviceOf(trace, row.span)}`}
                      >
                        <span
                          className={`obs-service-mark ${failed ? 'is-error' : ''}`}
                        />
                        <span>
                          <strong>{row.span.operationName}</strong>
                          <small>{serviceOf(trace, row.span)}</small>
                        </span>
                        {failed && <Icon name="error" size={14} />}
                      </button>
                    </div>
                    <button
                      className="obs-span-track"
                      aria-label={`Seleccionar ${row.span.operationName}, duración ${duration(row.span.duration)}`}
                      onClick={() => setSelected(row.span.spanID)}
                    >
                      <span
                        className={`obs-span-bar ${failed ? 'is-error' : ''} ${spanKind(row.span) === 'client' ? 'is-client' : ''}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`Inicio +${duration(row.span.startTime - trace.start)} · Duración ${duration(row.span.duration)}`}
                      />
                      <span className="obs-span-duration">
                        {duration(row.span.duration)}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
            {visible.length > limit && (
              <button
                className="obs-btn obs-btn-secondary obs-show-more"
                onClick={() => setLimit(limit + 500)}
              >
                Mostrar los siguientes {Math.min(500, visible.length - limit)}{' '}
                spans
              </button>
            )}
            <p className="obs-waterfall-note">
              {number(Math.min(limit, visible.length))} de{' '}
              {number(trace.spans.length)} spans visibles. Los tiempos de spans
              anidados se superponen.
            </p>
          </div>
        </div>
        {span && <SpanDetails trace={trace} span={span} />}
      </div>
    </ChartPanel>
  );
}

// Consulta una traza por ID y ofrece su recorrido y exportación.
export default function TraceDetail() {
  const { traceId } = useParams();
  const { params } = useTracing();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    trace: null,
    source: null,
    loading: true,
    error: '',
  });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setState({ trace: null, source: null, loading: true, error: '' });
    if (!/^(?:[0-9a-f]{16}|[0-9a-f]{32})$/i.test(traceId)) {
      setState({
        trace: null,
        source: null,
        loading: false,
        error: 'El Trace ID debe contener 16 o 32 caracteres hexadecimales.',
      });
      return () => controller.abort();
    }
    getTrace(traceId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const source = data.find(
          (item) =>
            typeof item.traceID === 'string' &&
            item.traceID.toLowerCase().padStart(32, '0') ===
              traceId.toLowerCase().padStart(32, '0'),
        );
        if (!source?.spans?.length)
          throw new Error(
            'Esta traza no está disponible o ya expiró de la memoria de Jaeger.',
          );
        setState({
          trace: summarize(source),
          source,
          loading: false,
          error: '',
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            trace: null,
            source: null,
            loading: false,
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [traceId, revision]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Copia el Trace ID e informa si el navegador permite acceder al portapapeles.
  async function copy() {
    try {
      await navigator.clipboard.writeText(traceId);
      setNotice('Trace ID copiado');
    } catch {
      setNotice(
        'No se pudo copiar. Podés seleccionar el Trace ID directamente.',
      );
    }
  }
  // Exporta el JSON original y libera la URL temporal de descarga.
  function download() {
    const blob = new Blob([JSON.stringify({ data: [state.source] }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trace-${traceId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const { trace, loading, error } = state;
  return (
    <>
      <Link className="obs-back" to={`/auditoria/explorar?${params}`}>
        <Icon name="arrow" size={15} />
        Volver a las trazas
      </Link>
      <div className="obs-page-header obs-trace-header">
        <div>
          <div className="obs-eyebrow">
            AUDITORÍA <span>/</span> DETALLE DE TRAZA
          </div>
          <h1>{trace?.name || 'Detalle de traza'}</h1>
          <div className="obs-trace-id">
            <code>{traceId}</code>
            <button
              className="obs-icon-button"
              onClick={copy}
              aria-label="Copiar Trace ID"
            >
              <Icon name="copy" size={15} />
            </button>
          </div>
        </div>
        <div className="obs-detail-actions">
          <button
            className="obs-btn obs-btn-secondary"
            onClick={download}
            disabled={!trace}
          >
            <Icon name="download" size={16} />
            Exportar JSON
          </button>
          <a
            className="obs-btn obs-btn-secondary"
            href={nativeUrl(`trace/${traceId}`)}
            target="_blank"
            rel="noreferrer"
          >
            Abrir en Jaeger
            <Icon name="external" size={14} />
          </a>
        </div>
      </div>
      {notice && (
        <div className="obs-toast" role="status">
          <Icon name="check" size={16} />
          {notice}
        </div>
      )}
      {loading && (
        <div className="obs-loading" role="status">
          <span className="obs-spinner" />
          <span>Cargando el recorrido…</span>
        </div>
      )}
      {error && (
        <div className="obs-error-state" role="alert">
          <Icon name="error" size={24} />
          <div>
            <h3>No pudimos abrir la traza</h3>
            <p>{error}</p>
            <button
              className="obs-btn obs-btn-secondary"
              onClick={() => setRevision(revision + 1)}
            >
              Volver a intentar
            </button>
          </div>
        </div>
      )}
      {trace && (
        <>
          <div className="obs-trace-meta">
            <StatusBadge error={trace.errors > 0} />
            <span>
              <Icon name="clock" size={14} />
              {dateTime(trace.start)}
            </span>
            {trace.services.map((service) => (
              <span className="obs-subtle-tag" key={service}>
                {service}
              </span>
            ))}
          </div>
          <div className="obs-metrics">
            <Metric
              label="Duración total"
              value={duration(trace.duration)}
              description="Del primer inicio al último cierre"
              icon="clock"
              accent
            />
            <Metric
              label="Spans"
              value={number(trace.spans.length)}
              description="Operaciones registradas en la traza"
              icon="trace"
            />
            <Metric
              label="Servicios"
              value={number(trace.services.length)}
              description="Participantes en este recorrido"
              icon="services"
            />
            <Metric
              label="Spans con errores"
              value={number(trace.errors)}
              description="Con estado de error registrado"
              icon="error"
            />
          </div>
          <Waterfall key={trace.traceID} trace={trace} />
        </>
      )}
    </>
  );
}
