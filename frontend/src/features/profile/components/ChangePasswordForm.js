import React, { useState } from 'react';
import PasswordField from '../../../shared/components/PasswordField';
import Alert from '../../../shared/components/Alert';
import PasswordRequirements from '../../auth/components/PasswordRequirements';
import { validatePassword } from '../../../shared/utils/password';
import { profileService } from '../profileService';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

// Cambio voluntario de contraseña. Independiente de los datos personales. No cierra ninguna sesión.
export default function ChangePasswordForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // { kind, text }
  const [saving, setSaving] = useState(false);

  // La habilitación solo indica que el formulario está completo; las validaciones se hacen al ejecutar la acción.
  const complete = Boolean(form.currentPassword && form.newPassword && form.confirm);

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setMessage(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!complete || saving) return;
    const found = {};
    if (form.newPassword !== form.confirm) found.confirm = 'Las contraseñas no coinciden.';
    const invalid = validatePassword(form.newPassword);
    if (invalid) found.newPassword = invalid;
    else if (form.newPassword === form.currentPassword) found.newPassword = 'La nueva contraseña debe ser distinta de la actual.';
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await profileService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(EMPTY); // se limpian los tres campos y se permanece en la pantalla
      setMessage({ kind: 'success', text: 'La contraseña se modificó correctamente.' });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setMessage({ kind: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" aria-labelledby="cp-title">
      <h2 id="cp-title">Cambiar contraseña</h2>
      <p className="muted">Podés cambiar tu contraseña en cualquier momento.</p>
      <form onSubmit={submit} noValidate>
        <div className="profile-password">
          <div className="profile-form">
            <PasswordField id="pw-current" name="currentPassword" label="Contraseña actual *" autoComplete="current-password"
              value={form.currentPassword} onChange={change} error={errors.currentPassword} />
            <PasswordField id="pw-new" name="newPassword" label="Nueva contraseña *" autoComplete="new-password"
              value={form.newPassword} onChange={change} error={errors.newPassword} />
            <PasswordField id="pw-confirm" name="confirm" label="Confirmar nueva contraseña *" autoComplete="new-password"
              value={form.confirm} onChange={change} error={errors.confirm} />
          </div>
          <PasswordRequirements variant="profile" />
        </div>
        <div className="profile-form__actions">
          <button type="submit" className="btn" disabled={!complete || saving}>{saving ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </div>
        {message && <Alert kind={message.kind}>{message.text}</Alert>}
      </form>
    </section>
  );
}
