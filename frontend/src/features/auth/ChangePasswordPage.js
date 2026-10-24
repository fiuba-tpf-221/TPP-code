import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ROUTES } from '../../config/routes';
import { APP_NAME } from '../../config/app';
import PasswordField from '../../shared/components/PasswordField';
import Alert from '../../shared/components/Alert';
import PasswordRequirements from './components/PasswordRequirements';
import { validatePassword } from '../../shared/utils/password';
import './auth.css';

// Cambio obligatorio (US-05): sin menús, sin pedir la contraseña anterior (ya se validó en el login).
export default function ChangePasswordPage() {
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  // Con Keycloak el cambio de contraseña ocurre en su pantalla: esta ruta no tiene nada que hacer.
  if (!changePassword) return <Navigate to={ROUTES.HOME} replace />;

  const canSubmit = form.newPassword.length > 0 && form.confirm.length > 0 && !loading;

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.newPassword !== form.confirm) found.confirm = 'Las contraseñas no coinciden';
    const invalid = validatePassword(form.newPassword);
    if (invalid) found.newPassword = invalid;
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      await changePassword({ newPassword: form.newPassword });
      navigate(ROUTES.HOME, { replace: true }); // sin volver a autenticarse
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message }); // ej. "igual a la anterior" lo informa el backend
      setLoading(false);
    }
  };

  return (
    <main className="solo">
      <div className="window">
        <form className="window__body" onSubmit={submit} noValidate>
          <p className="window__brand">{APP_NAME}</p>
          <h1 className="window__title">Cambiar contraseña</h1>
          <Alert kind="info">Por seguridad, debés establecer una nueva contraseña antes de continuar.</Alert>
          <PasswordField id="cp-new" name="newPassword" label="Nueva contraseña" autoComplete="new-password"
            value={form.newPassword} onChange={change} error={errors.newPassword} />
          <PasswordField id="cp-confirm" name="confirm" label="Confirmar nueva contraseña" autoComplete="new-password"
            value={form.confirm} onChange={change} error={errors.confirm} />
          <PasswordRequirements showPrevious />
          {errors.form && <Alert kind="error">{errors.form}</Alert>}
          <button type="submit" className="btn btn--block" disabled={!canSubmit}>
            {loading ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
          <button type="button" className="link" onClick={logout}>Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
