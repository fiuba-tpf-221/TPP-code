import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// US-01 CA 1. Ojo: esto solo oculta la pantalla; el backend debe validar el permiso en cada endpoint.
export default function RequirePermission({ permission }) {
  const { can } = useAuth();
  if (can(permission)) return <Outlet />;
  return (
    <>
      <h1>Sin acceso</h1>
      <p role="alert" className="muted">No tenés permiso para ver esta pantalla.</p>
    </>
  );
}
