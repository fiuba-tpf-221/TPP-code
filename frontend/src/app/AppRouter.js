import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { PERMISSIONS as P } from '../config/permissions';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import RequirePermission from '../features/auth/RequirePermission';
import AuthPage from '../features/auth/AuthPage';
import ChangePasswordPage from '../features/auth/ChangePasswordPage';
import AppLayout from '../shared/layouts/AppLayout';
import PlaceholderPage from '../shared/components/PlaceholderPage';
import HomePage from '../features/home/HomePage';
import ProfilePage from '../features/profile/ProfilePage';
import SystemLayout from '../features/system/SystemLayout';
import {
  Databases,
  GrafanaDashboards,
  Infrastructure,
  MonitoringOverview,
  Telemetry,
} from '../features/system/monitoring/MonitoringPages';
import AuditLayout from '../features/audit/AuditLayout';
import {
  TraceExplorer,
  TraceServices,
  TracingOverview,
} from '../features/audit/tracing/TracingPages';
import TraceDetail from '../features/audit/tracing/TraceDetail';
import UsersPage from '../features/users/UsersPage';
import UserCreatePage from '../features/users/UserCreatePage';
import RolesPage from '../features/roles/RolesPage';
import RoleCreatePage from '../features/roles/RoleCreatePage';
import RoleDetailPage from '../features/roles/RoleDetailPage';
import UserDetailPage from '../features/users/UserDetailPage';

// Módulos aún sin desarrollar: cuando exista la pantalla real, se reemplaza el elemento.
const PLACEHOLDERS = [
  { path: ROUTES.DOMAINS, title: 'Dominios', permission: P.DOMAINS_MANAGE },
  { path: ROUTES.MODELS, title: 'Modelos', permission: P.MODELS_MANAGE },
  { path: ROUTES.PREDICTION, title: 'Predicción', permission: P.PREDICTIONS_USE },
];

// Para agregar una pantalla: crear la página en su feature y sumar una <Route> acá.
export default function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<AuthPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.CHANGE_PASSWORD} element={<ChangePasswordPage />} />
        <Route element={<AppLayout />}>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.PROFILE} element={<ProfilePage />} />

          <Route element={<RequirePermission permission={P.USERS_MANAGE} />}>
            <Route path={ROUTES.USERS} element={<UsersPage />} />
            <Route path={ROUTES.USER_NEW} element={<UserCreatePage />} />
            <Route path={ROUTES.USER_DETAIL} element={<UserDetailPage />} />
          </Route>
          <Route element={<RequirePermission permission={P.ROLES_MANAGE} />}>
            <Route path={ROUTES.ROLES} element={<RolesPage />} />
            <Route path={ROUTES.ROLE_NEW} element={<RoleCreatePage />} />
            <Route path={ROUTES.ROLE_DETAIL} element={<RoleDetailPage />} />
          </Route>

          {/* Antes vivían en :3002; ahora son sub-secciones de Sistema y Auditoría (ver
              SystemLayout/AuditLayout). La Central de Monitoreo quedó como API pura. */}
          <Route element={<RequirePermission permission={P.SYSTEM_VIEW} />}>
            <Route path={ROUTES.SYSTEM} element={<SystemLayout />}>
              <Route index element={<MonitoringOverview />} />
              <Route path="infraestructura" element={<Infrastructure />} />
              <Route path="postgresql" element={<Databases />} />
              <Route path="opentelemetry" element={<Telemetry />} />
              <Route path="dashboards" element={<GrafanaDashboards />} />
            </Route>
          </Route>
          <Route element={<RequirePermission permission={P.AUDIT_VIEW} />}>
            <Route path={ROUTES.AUDIT} element={<AuditLayout />}>
              <Route index element={<TracingOverview />} />
              <Route path="explorar" element={<TraceExplorer />} />
              <Route path="servicios" element={<TraceServices />} />
              <Route path="trazas/:traceId" element={<TraceDetail />} />
            </Route>
          </Route>

          {PLACEHOLDERS.map(({ path, title, permission }) => (
            <Route key={path} element={<RequirePermission permission={permission} />}>
              <Route path={path} element={<PlaceholderPage title={title} />} />
            </Route>
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}
