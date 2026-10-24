import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { NAV_GROUPS } from '../../config/routes';

export default function HomePage() {
  const { user, can } = useAuth();
  const hasModules = NAV_GROUPS.some((g) => g.items.some((i) => can(i.permission)));

  return (
    <section className="welcome">
      <h1>Bienvenido, {user?.name}</h1>
      <p className="muted">
        {hasModules
          ? 'Seleccioná una opción del menú para comenzar.'
          : 'Todavía no tenés permisos asignados. Contactá a un administrador.'}
      </p>
    </section>
  );
}
