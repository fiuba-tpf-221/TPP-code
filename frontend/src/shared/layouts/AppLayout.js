import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { NAV_GROUPS, ROUTES } from '../../config/routes';
import { APP_NAME } from '../../config/app';
import UserMenu from './UserMenu';
import Icon from '../components/icons';
import ModeBadge from '../components/ModeBadge';
import './layout.css';

// Barra superior + menú lateral filtrado por permisos efectivos + contenido.
// Sin permisos: no hay menú lateral; siguen disponibles Home, Mi perfil y Cerrar sesión.
export default function AppLayout() {
  const { can } = useAuth();
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar__left">
          <Link to={ROUTES.HOME} className="brand">{APP_NAME}</Link>
          <ModeBadge />
        </div>
        <UserMenu />
      </header>
      <div className="app__body">
        {groups.length > 0 && (
          <nav className="sidebar" aria-label="Principal">
            {groups.map((g, i) => (
              <div key={g.label || i} className="sidebar__group">
                {g.label && <p className="sidebar__label"><Icon name={g.icon} /> {g.label}</p>}
                {g.items.map(({ to, label, icon }) => (
                  <NavLink key={to} to={to}><Icon name={icon} /> {label}</NavLink>
                ))}
              </div>
            ))}
          </nav>
        )}
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
