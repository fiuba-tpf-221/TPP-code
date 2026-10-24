import React, { useState } from 'react';
import Field from '../../../shared/components/Field';
import PasswordField from '../../../shared/components/PasswordField';
import Alert from '../../../shared/components/Alert';
import { LOGIN_ERROR } from '../messages';

export default function LoginForm({ onSubmit }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // El botón solo indica "formulario completo"; las validaciones funcionales corren al enviar.
  const canSubmit = form.email.trim().length > 0 && form.password.length > 0 && !loading;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      // Nunca se revela el motivo real (usuario inexistente, inactivo, bloqueado, etc.).
      setError([401, 403].includes(err.status) ? LOGIN_ERROR : err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Field id="login-email" name="email" type="text" inputMode="email" label="Email"
        placeholder="usuario@dominio.com" autoComplete="username" value={form.email} onChange={change} />
      <PasswordField id="login-password" name="password" label="Contraseña"
        autoComplete="current-password" value={form.password} onChange={change} />
      <button type="submit" className="btn btn--block" disabled={!canSubmit}>
        {loading ? 'Ingresando…' : 'Iniciar sesión'}
      </button>
      {error && <Alert kind="error">{error}</Alert>}
      <p className="hint">Demo (Administrador): demo@tpp.com / demo1234</p>
    </form>
  );
}
