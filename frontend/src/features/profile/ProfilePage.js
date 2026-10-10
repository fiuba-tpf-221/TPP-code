import React from 'react';
import { useAuth } from '../auth/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <>
      <h1>Mi perfil</h1>
      <dl className="profile">
        <dt>Nombre</dt><dd>{user.name}</dd>
        <dt>Email</dt><dd>{user.email}</dd>
        <dt>Roles</dt><dd>{user.roles.map((r) => r.name).join(', ') || '—'}</dd>
      </dl>
    </>
  );
}
