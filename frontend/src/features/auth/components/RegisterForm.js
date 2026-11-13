import React, { useState } from 'react';
import Field from '../../../shared/components/Field';
import PasswordField from '../../../shared/components/PasswordField';
import Alert from '../../../shared/components/Alert';
import PasswordRequirements from './PasswordRequirements';
import { validatePassword } from '../../../shared/utils/password';

export default function RegisterForm({ onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const found = {};
    const invalid = validatePassword(form.password);
    if (invalid) found.password = invalid;
    else if (form.confirm !== form.password) found.confirm = 'Las contraseñas no coinciden';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      await onSubmit({ name: form.name.trim(), email: form.email, password: form.password });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message }); else setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Field id="reg-name" name="name" label="Nombre" autoComplete="name"
        value={form.name} onChange={change} required />
      <Field id="reg-email" name="email" type="email" label="Email" autoComplete="username"
        value={form.email} onChange={change} error={errors.email} required />
      <PasswordField id="reg-password" name="password" label="Contraseña" autoComplete="new-password"
        value={form.password} onChange={change} error={errors.password} required />
      <PasswordField id="reg-confirm" name="confirm" label="Repetir contraseña" autoComplete="new-password"
        value={form.confirm} onChange={change} error={errors.confirm} required />
      <PasswordRequirements />
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" className="btn btn--block" disabled={loading}>
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
