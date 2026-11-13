import React, { useEffect } from "react";
import "./tracing/tracing.css";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { nativeUrl } from "./tracing/api";
import { Empty, Icon } from "./tracing/components";
import TraceDetail from "./tracing/TraceDetail";
import {
  TracingOverview,
  TraceExplorer,
  TraceServices,
} from "./tracing/TracingPages";
import { TracingContext, useTraceQuery } from "./tracing/useTracing";
import { MonitoringContext, useMonitoringState } from "./metrics/useMonitoring";
import {
  MonitoringOverview,
  Infrastructure,
  Databases,
  Telemetry,
  GrafanaDashboards,
} from "./metrics/MonitoringPages";

const PAGES = [
  {
    path: "/",
    label: "Vista General",
    icon: "overview",
    component: MonitoringOverview,
  },
  {
    path: "/infrastructure",
    label: "Infraestructura",
    icon: "services",
    component: Infrastructure,
  },
  {
    path: "/databases",
    label: "PostgreSQL",
    icon: "services",
    component: Databases,
  },
  {
    path: "/telemetry",
    label: "OpenTelemetry",
    icon: "trace",
    component: Telemetry,
  },
  {
    path: "/dashboards",
    label: "Dashboards",
    icon: "chart",
    component: GrafanaDashboards,
  },
  {
    path: "/tracing",
    label: "Resumen de trazas",
    icon: "trace",
    component: TracingOverview,
  },
  {
    path: "/traces",
    label: "Explorar trazas",
    icon: "trace",
    component: TraceExplorer,
  },
  {
    path: "/services",
    label: "Servicios de trazas",
    icon: "services",
    component: TraceServices,
  },
];

// Compone la navegación y los estados compartidos sin depender del portal de negocio.
function Shell() {
  const location = useLocation();
  const tracingPage = /^\/(tracing|traces|services)(\/|$)/.test(
    location.pathname,
  );
  const query = useTraceQuery(tracingPage);
  const monitoring = useMonitoringState();
  const { params } = query;
  useEffect(() => {
    document.title = "Central de monitoreo · FIUBA TPP";
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const connection = monitoring.error
    ? "Central sin actualizar"
    : monitoring.loading && !monitoring.data
      ? "Consultando"
      : "Central activa";
  return (
    <MonitoringContext.Provider value={monitoring}>
      <TracingContext.Provider value={query}>
        <div className="obs-app">
          <a className="obs-skip-link" href="#obs-main">
            Ir al contenido
          </a>
          <header className="obs-appbar">
            <Link to={`/?${params}`} className="obs-brand">
              <span className="obs-brand-symbol">
                <Icon name="trace" size={22} />
              </span>
              <span>
                FIUBA <b>TPP</b>
              </span>
              <span className="obs-brand-divider" />
              <span className="obs-brand-product">Monitoreo</span>
            </Link>
            <div className="obs-appbar-right">
              <span className="obs-local-label">Entorno local</span>
              <span className="obs-appbar-status">
                <span
                  className={`obs-status-dot ${monitoring.error ? "is-offline" : monitoring.loading && !monitoring.data ? "is-pending" : ""}`}
                />
                {connection}
              </span>
            </div>
          </header>
          <div className="obs-layout">
            <aside className="obs-sidebar">
              <div className="obs-sidebar-top">
                <p className="obs-nav-heading">MONITOREO</p>
                <nav aria-label="Observabilidad">
                  {PAGES.map(({ path, label, icon }) => (
                    <NavLink
                      key={path}
                      end={path === "/"}
                      to={`${path}?${params}`}
                    >
                      <Icon name={icon} />
                      {label}
                    </NavLink>
                  ))}
                </nav>
                <div className="obs-nav-separator" />
                <p className="obs-nav-heading">HERRAMIENTAS</p>
                <nav aria-label="Herramientas">
                  <a href={nativeUrl()} target="_blank" rel="noreferrer">
                    <Icon name="external" />
                    Jaeger
                    <Icon name="external" size={12} />
                  </a>
                  <a
                    href={`http://${window.location.hostname}:3001`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="overview" />
                    Grafana
                    <Icon name="external" size={12} />
                  </a>
                </nav>
              </div>
              <div className="obs-sidebar-bottom">
                <span className="obs-sidebar-badge">
                  <Icon name="trace" size={16} />
                  CENTRAL DE MONITOREO
                </span>
                <p>
                  Estado de servicios,
                  <br />métricas y trazas.
                </p>
                <a href={`http://${window.location.hostname}:3000`}>
                  Volver a la plataforma
                  <Icon name="arrow" size={14} />
                </a>
              </div>
            </aside>
            <main id="obs-main" className="obs-main">
              <Routes>
                {PAGES.map(({ path, component: Page }) => (
                  <Route key={path} path={path} element={<Page />} />
                ))}
                <Route path="/traces/:traceId" element={<TraceDetail />} />
                <Route
                  path="*"
                  element={
                    <Empty title="Esta página no existe">
                      <Link to="/">Volver al resumen</Link>
                    </Empty>
                  }
                />
              </Routes>
              <footer className="obs-footer">
                <span>
                  FIUBA TPP <span>·</span> Observabilidad
                </span>
                <span>Jaeger · Prometheus · OpenTelemetry · Grafana</span>
              </footer>
            </main>
          </div>
        </div>
      </TracingContext.Provider>
    </MonitoringContext.Provider>
  );
}

// Habilita las rutas de la central independiente.
export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
