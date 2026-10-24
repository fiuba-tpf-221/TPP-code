import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import Alert from '../../../shared/components/Alert';
import { KEYCLOAK } from '../../../config/services';

// Con el login real, los datos personales y la contraseña viven en Keycloak: acá solo se consultan.
export default function KeycloakProfile() {
  const { user } = useAuth();
  return (
    <section className="card" aria-labelledby="pd-title">
      <h2 id="pd-title">Datos personales</h2>
      <dl className="profile">
        <dt>Email</dt><dd>{user.email || '—'}</dd>
        <dt>Nombre</dt><dd>{user.name}</dd>
      </dl>
      <Alert kind="info">Con el login real, tus datos personales y tu contraseña se administran en Keycloak.</Alert>
      <p>
        <a className="btn btn--secondary" href={`${KEYCLOAK.url}/realms/${KEYCLOAK.realm}/account`} target="_blank" rel="noreferrer noopener">
          Administrar mi cuenta en Keycloak ↗
        </a>
      </p>
    </section>
  );
}
