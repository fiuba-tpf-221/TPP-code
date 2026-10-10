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
import SystemStatusPage from '../features/system/SystemStatusPage';
import UsersPage from '../features/users/UsersPage';
import UserCreatePage from '../features/users/UserCreatePage';
import UserDetailPage from '../features/users/UserDetailPage';

// Módulos aún sin desarrollar: cuando exista la pantalla real, se reemplaza el elemento.
const PLACEHOLDERS = [
  { path: ROUTES.ROLES, title: 'Roles', permission: P.ROLES_MANAGE },
  { path: ROUTES.DOMAINS, title: 'Dominios', permission: P.DOMAINS_MANAGE },
  { path: ROUTES.AUDIT, title: 'Auditoría', permission: P.AUDIT_VIEW },
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
          {/* Diagnóstico de conexión con el backend: no es un módulo de la US-06, por eso no está en el menú. */}
          <Route path={ROUTES.SYSTEM} element={<SystemStatusPage />} />
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
