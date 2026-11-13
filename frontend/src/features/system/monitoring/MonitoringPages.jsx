import React from 'react';
import { Link } from 'react-router-dom';
import ConsoleIcon from '../../../shared/components/icons';
import { CONSOLES } from '../../../config/services';
import { Empty, Icon, Metric, PanelHeader } from '../../audit/tracing/components';
import { RANGES } from '../../audit/tracing/model';
import '../../audit/tracing/tracing.css';
import { format, MetricPanel } from './charts';
import { useMonitoring, useRemote } from './useMonitoring';
import './monitoring.css';
import '../system.css';
import ContainerTable from './ContainerTable';
import TelemetrySummary from './TelemetrySummary';
import { ChartPanel } from '../../../shared/components/ChartPanel';
import { containerName, serviceContainer } from './containers';

// Distingue una fuente disponible, no saludable o sin observación actual.
export function SourceStatus({ up, stale = false }) {
  const unknown = up == null || stale;
  return (
    <span
      className={`obs-badge ${unknown ? 'mon-unknown' : up ? 'is-success' : 'is-error'}`}
    >
      <span className="obs-status-dot" />
      {unknown ? 'Sin dato actual' : up ? 'Disponible' : 'No saludable'}
    </span>
  );
}

// Normaliza la última observación y señala cuándo perdió vigencia.
function useSnapshot() {
  const state = useMonitoring();
  const stale =
    !!state.error ||
    !state.data?.checkedAt ||
    Date.now() / 1000 - state.data.checkedAt > 45 ||
    !!state.data.collectionError;
  return {
    ...state,
    stale,
    services: state.data?.services || [],
    database: {
      ...state.data?.database,
      stale: stale || !!state.data?.database?.stale,
    },
  };
}

// Ofrece período y actualización comunes a las pantallas de métricas.
export function MonitoringHeader({ section, title, description }) {
  const {
    range, setRange, interval, setRefreshInterval, refresh, loading,
    selectedContainer, selectContainer,
  } = useMonitoring();
  return (
    <div className="obs-page-header">
      <div>
        <div className="obs-eyebrow">
          SISTEMA <span>/</span>
          {section}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="obs-query-toolbar">
        {selectedContainer && ['RESUMEN', 'INFRAESTRUCTURA', 'GRAFANA'].includes(section) && (
          <button className="obs-btn obs-btn-secondary mon-active-filter" onClick={() => selectContainer('')} aria-label="Quitar filtro de contenedor">
            {containerName(selectedContainer)} · Quitar filtro
          </button>
        )}
        <select
          className="mon-range"
          aria-label="Período de métricas"
          value={range}
          onChange={(event) => setRange(event.target.value)}
        >
          {Object.entries(RANGES).map(([id, [label]]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label className="obs-auto-refresh">
          <select
            aria-label="Actualización del monitoreo"
            value={interval}
            onChange={(event) => setRefreshInterval(Number(event.target.value))}
          >
            <option value="0">Actualización manual</option>
            <option value="15">Cada 15 segundos</option>
            <option value="30">Cada 30 segundos</option>
            <option value="60">Cada 60 segundos</option>
          </select>
        </label>
        <button
          className="obs-btn obs-btn-secondary"
          onClick={refresh}
          disabled={loading}
        >
          <Icon name="refresh" size={16} />
          Actualizar
        </button>
      </div>
    </div>
  );
}

// Indica cuándo se realizó la última observación válida.
export function MonitoringNotice() {
  const { data, error, stale } = useSnapshot();
  return (
    <div className="mon-observation" role="status">
      <Icon name="clock" size={14} />
      {error
        ? 'La central no pudo actualizar sus fuentes. Se conserva la última observación disponible.'
        : data?.checkedAt
          ? `${stale ? 'Observación desactualizada' : 'Última observación'}: ${new Date(data.checkedAt * 1000).toLocaleTimeString('es-AR', { hourCycle: 'h23' })}. Las sondas se ejecutan cada 15 segundos.`
          : 'Esperando la primera comprobación de servicios…'}
    </div>
  );
}

// Presenta la disponibilidad y el alcance de las sondas de servicios.
export function ServiceTable() {
  const { services, stale, selectedContainer, selectContainer } = useSnapshot();
  return (
    <section className="obs-panel">
      <PanelHeader
        title="Disponibilidad de servicios"
        description="Estado y tiempo de respuesta. Seleccioná un servicio para filtrar los gráficos."
      />
      {!services.length ? (
        <Empty title="Esperando la primera observación" icon="services" />
      ) : (
        <div className="obs-table-scroll">
          <table className="obs-table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Comprobación</th>
                <th>Respuesta de la sonda</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>
                    <button
                      className="mon-container-button"
                      aria-pressed={containerName(selectedContainer) === service.name}
                      onClick={() => {
                        const key = serviceContainer(service.id);
                        selectContainer(
                          containerName(selectedContainer) === containerName(key) ? '' : key,
                        );
                      }}
                    >
                      {service.name}
                    </button>
                    {!service.up && (
                      <small className="mon-probe-error">{service.error}</small>
                    )}
                  </td>
                  <td>
                    <span className="obs-subtle-tag">{service.kind}</span>
                  </td>
                  <td>
                    {stale
                      ? '—'
                      : `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(service.latencyMs)} ms`}
                  </td>
                  <td>
                    <SourceStatus up={service.up} stale={stale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mon-footnote">
        HTTP verifica el endpoint configurado. TCP comprueba que el puerto
        acepte conexiones; no valida autenticación ni funcionamiento del
        protocolo.
      </p>
    </section>
  );
}

// Enlaza las fuentes de observabilidad conservando el período seleccionado.
function Sources() {
  const { services, stale, params } = useSnapshot();
  return (
    <section className="obs-panel">
      <PanelHeader
        title="Fuentes de observabilidad"
        description="Estado de las herramientas de monitoreo"
      />
      <div className="mon-source-grid">
        {[
          ['prometheus', 'Prometheus', 'Series y recursos', '/sistema/infraestructura'],
          ['collector', 'Visión del sistema', 'Salud del Collector', '/sistema/opentelemetry'],
          ['grafana', 'Grafana', 'Paneles aprovisionados', '/sistema/dashboards'],
        ].map(([id, name, description, url]) => (
          <Link className="mon-source" key={id} to={`${url}?${params}`}>
            <div>
              <Icon
                name={id === 'grafana' ? 'chart' : 'services'}
                size={20}
              />
              <Icon name="arrow" size={15} />
            </div>
            <strong>{name}</strong>
            <small>{description}</small>
            <SourceStatus
              up={services.find((service) => service.id === id)?.up}
              stale={stale}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

// Resume la salud de servicios, fuentes y recursos del sistema.
export function MonitoringOverview() {
  const { services, database, data, stale } = useSnapshot();
  const online = services.filter((service) => service.up).length;
  const targets = data?.prometheus?.targets || [];
  const bytes =
    database.available && !database.stale
      ? database.databases.reduce((sum, db) => sum + db.bytes, 0)
      : null;
  return (
    <>
      <MonitoringHeader
        section="RESUMEN"
        title="Vista general"
        description="Estado de los servicios y consumo de recursos."
      />
      <MonitoringNotice />
      <div className="obs-metrics">
        <Metric
          label="Servicios saludables"
          value={stale ? '—' : `${online} / ${services.length}`}
          description="Resultado de las sondas configuradas"
          icon="services"
          accent
        />
        <Metric
          label="Requieren atención"
          value={stale ? '—' : services.length - online}
          description="Comprobaciones que no están saludables"
          icon="error"
        />
        <Metric
          label="Bases de datos"
          value={format(bytes, 'bytes')}
          description={
            database.available && !database.stale
              ? `${database.databases.length} bases · tamaño ocupado`
              : 'Consulta SQL no disponible'
          }
          icon="services"
        />
        <Metric
          label="Targets de Prometheus"
          value={
            !stale && data?.prometheus?.available
              ? `${targets.filter((item) => item.health === 'up').length} / ${targets.length}`
              : '—'
          }
          description="Exportadores y endpoints de recolección"
          icon="chart"
        />
      </div>
      <Sources />
      <div className="mon-chart-grid">
        <MetricPanel
          name="cpu"
          title="CPU de contenedores"
          description="100 % equivale a un núcleo lógico; puede superar ese valor"
        />
        <MetricPanel
          name="memory"
          title="Memoria de trabajo"
          description="Contenedores del host Docker observados por cAdvisor"
        />
      </div>
      <ContainerTable />
      <ServiceTable />
      <section className="obs-panel">
        <PanelHeader
          title="Consolas de administración"
          description="Acceso directo a la herramienta real (se abre en otra pestaña)"
        />
        <div className="console-grid">
          {CONSOLES.map((c) => (
            <a key={c.id} className="console" href={c.url} target="_blank" rel="noreferrer noopener">
              <span className="console__icon"><ConsoleIcon name={c.icon} size={22} /></span>
              <span>
                <strong>{c.name} <span aria-hidden="true">↗</span></strong>
                <small>{c.desc}</small>
              </span>
              <span className="obs-sr-only">(se abre en una pestaña nueva)</span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

// Combina disponibilidad, recursos e información de recolección.
export function Infrastructure() {
  const { data, stale } = useSnapshot();
  const targets = data?.prometheus?.targets || [];
  return (
    <>
      <MonitoringHeader
        section="INFRAESTRUCTURA"
        title="Servicios y recursos"
        description="Disponibilidad observada, consumo de contenedores y estado de la recolección."
      />
      <MonitoringNotice />
      <ServiceTable />
      <div className="mon-chart-grid">
        <MetricPanel
          name="cpu"
          title="CPU por contenedor"
          description="Uso expresado por núcleo lógico, no porcentaje total de la máquina"
        />
        <MetricPanel name="memory" title="Memoria de trabajo por contenedor" />
        <MetricPanel
          name="availability"
          title="Historial de disponibilidad"
          description="1: sonda saludable · 0: sonda no saludable"
        />
      </div>
      <ContainerTable />
      <section className="obs-panel">
        <PanelHeader
          title="Recolección de Prometheus"
          description="Estado del último scrape por target"
        />
        {!targets.length ? (
          <Empty title="No se pudo consultar la recolección" icon="chart" />
        ) : (
          <div className="obs-table-scroll">
            <table className="obs-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Instancia</th>
                  <th>Último scrape</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => (
                  <tr key={`${target.job}-${target.instance}`}>
                    <td>{target.job}</td>
                    <td>
                      <code>{target.instance}</code>
                    </td>
                    <td>
                      {new Date(target.lastScrape).toLocaleTimeString('es-AR', {
                        hourCycle: 'h23',
                      })}
                    </td>
                    <td>
                      <SourceStatus up={target.health === 'up'} stale={stale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// La capacidad medida pertenece al filesystem del volumen, no a una cuota SQL.
function DatabaseStorage() {
  const { data, stale } = useSnapshot();
  const storage = data?.storage;
  const available = storage?.available && !stale;
  const usedPercent = available ? storage.usedBytes / storage.totalBytes * 100 : null;
  return (
    <ChartPanel title="Almacenamiento de PostgreSQL">
      <PanelHeader
        title="Almacenamiento de PostgreSQL"
        description="Capacidad del disco donde reside el volumen de datos"
      />
      <div className="obs-metrics mon-storage-metrics">
        {[
          ['Capacidad total', 'totalBytes', 'Tamaño del sistema de archivos'],
          ['Espacio ocupado', 'usedBytes', available ? `${format(usedPercent, 'percent')} del disco ocupado` : 'Uso del sistema de archivos'],
          ['Espacio libre', 'freeBytes', 'Bloques libres, incluidos los reservados'],
          ['Disponible para PostgreSQL', 'availableBytes', 'Espacio libre sin bloques reservados'],
        ].map(([label, key, description]) => (
          <Metric
            key={key}
            label={label}
            value={format(available ? storage[key] : null, 'bytes')}
            description={stale ? 'Sin dato actual' : description}
            icon="services"
            accent={key === 'usedBytes'}
          />
        ))}
      </div>
      {available ? (
        <div className="mon-storage-meter">
          <div
            role="meter"
            aria-label="Espacio ocupado del almacenamiento de PostgreSQL"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usedPercent}
            aria-valuetext={`${format(storage.usedBytes, 'bytes')} de ${format(storage.totalBytes, 'bytes')}`}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, usedPercent))}%` }} />
          </div>
          <span>{format(usedPercent, 'percent')} ocupado</span>
        </div>
      ) : (
        <p className="mon-inline-error" role="status">
          {stale ? 'No hay una medición actual del almacenamiento.' : storage?.error || 'Esperando la primera medición del volumen.'}
        </p>
      )}
      <p className="mon-footnote">
        En Docker este disco puede compartirse con otros volúmenes y servicios.
        El espacio ocupado incluye todos sus datos; el tamaño de las bases se
        muestra por separado. La capacidad total no es una cuota exclusiva de PostgreSQL.
      </p>
    </ChartPanel>
  );
}

// Presenta tamaños y conexiones SQL con su estado de actualización.
export function Databases() {
  const { database } = useSnapshot();
  const total = database.databases?.reduce((sum, item) => sum + item.bytes, 0);
  const connections = database.databases?.reduce(
    (sum, item) => sum + item.connections,
    0,
  );
  return (
    <>
      <MonitoringHeader
        section="BASE DE DATOS"
        title="Base de datos"
        description="Capacidad del almacenamiento, tamaño de las bases y conexiones."
      />
      <MonitoringNotice />
      <DatabaseStorage />
      {!database.available && (
        <div className="obs-error-state" role="status">
          <Icon name="error" />
          <div>
            <h3>
              {database.configured
                ? 'No se pudo actualizar PostgreSQL'
                : 'Falta configurar la lectura de PostgreSQL'}
            </h3>
            <p>
              {database.error || 'Esperando la primera consulta.'}
              {database.stale &&
                ' Se muestra la última observación válida, marcada como anterior.'}
            </p>
          </div>
        </div>
      )}
      <div className="obs-metrics">
        <Metric
          label="Tamaño de bases"
          value={format(database.databases?.length ? total : null, 'bytes')}
          description={
            database.stale ? 'Dato anterior' : 'Datos e índices ocupados'
          }
          icon="services"
          accent
        />
        <Metric
          label="Conexiones observadas"
          value={database.databases?.length ? format(connections) : '—'}
          description={
            database.stale ? 'Dato anterior' : 'Incluye la sesión de monitoreo'
          }
          icon="services"
        />
        <Metric
          label="Máximo de conexiones"
          value={format(database.maxConnections)}
          description={
            database.stale
              ? 'Dato anterior'
              : 'Configuración del servidor PostgreSQL'
          }
          icon="services"
        />
        <Metric
          label="Bases observadas"
          value={database.databases?.length || '—'}
          description={
            database.stale
              ? 'Dato anterior'
              : 'Bases conectables, sin templates'
          }
          icon="services"
        />
      </div>
      <section className="obs-panel">
        <PanelHeader
          title="Detalle por base de datos"
          description={
            database.observedAt
              ? `Observado ${new Date(database.observedAt * 1000).toLocaleTimeString('es-AR', { hourCycle: 'h23' })}`
              : 'Esperando datos SQL'
          }
        />
        {database.databases?.length ? (
          <div className="obs-table-scroll">
            <table className="obs-table">
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Tamaño ocupado</th>
                  <th>Conexiones</th>
                  <th>Lectura</th>
                </tr>
              </thead>
              <tbody>
                {database.databases.map((item) => (
                  <tr key={item.name}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{format(item.bytes, 'bytes')}</td>
                    <td>{format(item.connections)}</td>
                    <td>
                      <SourceStatus
                        up={database.available}
                        stale={database.stale}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Sin observaciones SQL" icon="services">
            Configurá una credencial de lectura con el rol pg_monitor.
          </Empty>
        )}
        <p className="mon-footnote">
          El tamaño de cada base incluye sus datos e índices. La capacidad y el
          espacio libre del disco se muestran en Almacenamiento de PostgreSQL.
        </p>
      </section>
      <div className="mon-chart-grid">
        <MetricPanel name="storage" title="Capacidad total y espacio ocupado" description="Evolución del filesystem del volumen PostgreSQL; puede ser compartido con otros servicios" />
        <MetricPanel name="database" title="Evolución del tamaño de bases" />
        <MetricPanel name="connections" title="Conexiones por base de datos" />
      </div>
    </>
  );
}

// Describe el pipeline configurado y las métricas internas del Collector.
export function Telemetry() {
  const { services, stale } = useSnapshot();
  return (
    <>
      <MonitoringHeader
        section="VISIÓN DEL SISTEMA"
        title="Visión del sistema"
        description="Recepción de trazas, errores de envío y recursos del Collector."
      />
      <MonitoringNotice />
      <TelemetrySummary />
      <section className="obs-panel">
        <PanelHeader
          title="Pipeline de trazas configurado"
          description="Disponibilidad de sus componentes; el flujo efectivo se observa en los gráficos"
        />
        <div className="mon-pipeline">
          {[
            ['backend', 'Aplicación', 'Trazas del SDK'],
            ['collector', 'Collector', 'Recepción y exportación'],
            ['jaeger', 'Jaeger', 'Consulta de trazas'],
          ].map(([id, name, caption], index) => (
            <React.Fragment key={id}>
              {index > 0 && <Icon name="arrow" />}
              <div>
                <Icon
                  name={id === 'backend' ? 'services' : 'trace'}
                  size={24}
                />
                <strong>{name}</strong>
                <span>{caption}</span>
                <SourceStatus
                  up={services.find((item) => item.id === id)?.up}
                  stale={stale}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>
      <div className="mon-chart-grid">
        <MetricPanel
          name="accepted"
          title="Spans aceptados por segundo"
          description="Tasa de recepción por segundo"
        />
        <MetricPanel
          name="exported"
          title="Spans enviados por segundo"
          description="Tasa de exportación por segundo; no acredita retención en Jaeger"
        />
        <MetricPanel name="failed" title="Spans con fallo de envío por segundo" />
        <MetricPanel name="refused" title="Spans rechazados por segundo" />
        <MetricPanel name="queue" title="Cola de envío a Jaeger" description="Cantidad de elementos pendientes de envío; no equivale a cantidad de spans" />
        <MetricPanel name="collector_memory" title="Memoria del Collector" />
      </div>
      <p className="mon-footnote">
        Estas métricas describen al Collector. La aplicación actual emite
        trazas; tasas y métricas HTTP de negocio requieren instrumentación de
        métricas adicional. Una serie ausente no se interpreta como cero
        errores.
      </p>
    </>
  );
}

// Redibuja los paneles aprovisionados usando sus datos de Prometheus.
export function GrafanaDashboards() {
  const { revision, params } = useMonitoring();
  const { data, error, loading } = useRemote(
    `/api/dashboards?refresh=${revision}`,
    'dashboards',
  );
  const selected = params.get('dashboard');
  const dashboards = data?.dashboards || [];
  const visible = selected
    ? dashboards.filter((item) => item.uid === selected)
    : dashboards;
  return (
    <>
      <MonitoringHeader
        section="GRAFANA"
        title="Paneles de Grafana"
        description="Paneles configurados en Grafana. El panel de contenedores muestra CPU y memoria, también disponibles en Infraestructura."
      />
      <MonitoringNotice />
      <section className="obs-panel">
        <PanelHeader
          title="Paneles disponibles"
          description="Seleccioná un panel para consultar sus métricas. Los datos se obtienen de Prometheus."
        />
        <div className="mon-dashboard-list">
          {dashboards.map((dashboard) => (
            <Link
              className={`mon-dashboard-item ${selected === dashboard.uid ? 'is-selected' : ''}`}
              key={dashboard.uid}
              to={`/sistema/dashboards?${new URLSearchParams({ ...Object.fromEntries(params), dashboard: dashboard.uid })}`}
            >
              <Icon name="chart" size={22} />
              <span>
                <strong>{dashboard.title}</strong>
                <small>{dashboard.description || `${dashboard.panels.length} gráficos`}</small>
              </span>
              <Icon name="arrow" size={16} />
            </Link>
          ))}
        </div>
        {error && (
          <p className="mon-inline-error" role="status">
            {error}
          </p>
        )}
        {loading && !data && (
          <p className="mon-footnote">Cargando configuración de dashboards…</p>
        )}
      </section>
      {!loading && !visible.length && (
        <Empty title="Sin dashboards para mostrar" icon="chart">
          No hay dashboards aprovisionados que coincidan con esta selección.
        </Empty>
      )}
      {visible.map((dashboard) => (
        <section key={dashboard.uid}>
          <div className="mon-section-heading">
            <h2>{dashboard.title}</h2>
            <a
              className="obs-text-link"
              href={`http://${window.location.hostname}:3001/d/${encodeURIComponent(dashboard.uid)}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en Grafana
              <Icon name="external" size={14} />
            </a>
          </div>
          {dashboard.description && <p className="mon-dashboard-description">{dashboard.description}</p>}
          <div className="mon-chart-grid">
            {dashboard.panels.map((panel) => (
              <MetricPanel
                key={panel.id}
                title={panel.title}
                panel={{ uid: dashboard.uid, id: panel.id }}
                description={panel.description || 'Evolución durante el período seleccionado'}
              />
            ))}
          </div>
        </section>
      ))}
      {visible.length > 0 && <ContainerTable />}
    </>
  );
}
