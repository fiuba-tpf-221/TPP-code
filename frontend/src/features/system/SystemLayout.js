import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MonitoringContext, useMonitoringState } from './monitoring/useMonitoring';
import { ROUTES } from '../../config/routes';
import '../../shared/components/subnav.css';

const TABS = [
  { to: ROUTES.SYSTEM, label: 'Vista General', end: true },
  { to: `${ROUTES.SYSTEM}/infraestructura`, label: 'Infraestructura' },
  { to: `${ROUTES.SYSTEM}/postgresql`, label: 'PostgreSQL' },
  { to: `${ROUTES.SYSTEM}/opentelemetry`, label: 'OpenTelemetry' },
  { to: `${ROUTES.SYSTEM}/dashboards`, label: 'Dashboards' },
];

// Lo que antes se veía en :3002 (Vista General, Infraestructura, PostgreSQL, OpenTelemetry,
// Dashboards) ahora vive acá, como sub-índice de Sistema; la Central de Monitoreo quedó como
// API pura (ver shared/api/monitoringApi.js, server/auth.py).
export default function SystemLayout() {
  const monitoring = useMonitoringState();
  return (
    <MonitoringContext.Provider value={monitoring}>
      <div className="obs-scope">
        <nav className="subnav" aria-label="Secciones de Sistema">
          {TABS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </MonitoringContext.Provider>
  );
}
