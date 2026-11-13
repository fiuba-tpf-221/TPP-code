import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { TracingContext, useTraceQuery } from './tracing/useTracing';
import { ROUTES } from '../../config/routes';
import '../../shared/components/subnav.css';

const TABS = [
  { to: ROUTES.AUDIT, label: 'Resumen de trazas', end: true },
  { to: `${ROUTES.AUDIT}/explorar`, label: 'Explorar trazas' },
  { to: `${ROUTES.AUDIT}/servicios`, label: 'Servicios de trazas' },
];

// Lo que antes se veía en :3002 (Resumen, Explorar y Servicios de trazas) ahora vive acá, como
// sub-índice de Auditoría; la Central de Monitoreo quedó como API pura (ver
// shared/api/monitoringApi.js, server/auth.py).
export default function AuditLayout() {
  const query = useTraceQuery(true);
  return (
    <TracingContext.Provider value={query}>
      <div className="obs-scope">
        <nav className="subnav" aria-label="Secciones de Auditoría">
          {TABS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </TracingContext.Provider>
  );
}
