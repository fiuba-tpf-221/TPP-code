import React from 'react';
import { useAuth } from '../auth/AuthContext';
import Breadcrumb from '../../shared/components/Breadcrumb';
import { ROUTES } from '../../config/routes';
import PersonalDataForm from './components/PersonalDataForm';
import ChangePasswordForm from './components/ChangePasswordForm';
import KeycloakProfile from './components/KeycloakProfile';
import './profile.css';

// Mi perfil (US-11): solo email, nombre, apellido y cambio de contraseña. Sin roles, permisos ni datos internos de seguridad.
// Disponible para todo usuario autenticado, sin permiso específico.
export default function ProfilePage() {
  const { provider } = useAuth();
  return (
    <>
      <Breadcrumb items={[{ label: 'Inicio', to: ROUTES.HOME }, { label: 'Mi perfil' }]} />
      <h1>Mi perfil</h1>
      {provider === 'keycloak' ? <KeycloakProfile /> : (
        <>
          <PersonalDataForm />
          <ChangePasswordForm />
        </>
      )}
    </>
  );
}
