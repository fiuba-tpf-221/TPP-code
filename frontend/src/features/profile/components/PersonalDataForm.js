import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import Field from '../../../shared/components/Field';
import Alert from '../../../shared/components/Alert';
import { normalizeSpaces } from '../../../shared/utils/text';
import { profileService } from '../profileService';

// Datos personales: nombre y apellido (el email es de solo lectura). Independiente del cambio de contraseña.
export default function PersonalDataForm() {
  const { updateUser } = useAuth();
  const [stored, setStored] = useState(null); // lo último que guardó el servidor
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [message, setMessage] = useState(null); // { kind, text }
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    profileService.get()
      .then((profile) => { if (!ignore) { setStored(profile); setForm({ firstName: profile.firstName, lastName: profile.lastName }); } })
      .catch((err) => { if (!ignore) setLoadError(err.message); });
    return () => { ignore = true; };
  }, []);

  // Se compara ya normalizado: agregar espacios de más no cuenta como un cambio real.
  const normalized = { firstName: normalizeSpaces(form.firstName), lastName: normalizeSpaces(form.lastName) };
  const filled = Boolean(normalized.firstName && normalized.lastName);
  const changed = Boolean(stored) && (normalized.firstName !== stored.firstName || normalized.lastName !== stored.lastName);
  const canSave = filled && changed && !saving; // deshabilitado si falta un dato o no hay ningún cambio real

  const required = { firstName: 'El nombre es obligatorio.', lastName: 'El apellido es obligatorio.' };
  const errorOf = (name) => serverErrors[name] || (touched[name] && !normalized[name] ? required[name] : '');

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setServerErrors({});
    setMessage(null);
  };
  const blur = (e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setForm((f) => ({ ...f, [name]: normalizeSpaces(f[name]) })); // se muestra ya normalizado
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await profileService.update(normalized);
      setStored(updated);
      setForm({ firstName: updated.firstName, lastName: updated.lastName });
      setTouched({});
      updateUser?.({ name: updated.name }); // el nombre de la barra superior acompaña al guardado
      setMessage({ kind: 'success', text: 'Los datos se actualizaron correctamente.' });
    } catch (err) {
      if (err.field) setServerErrors({ [err.field]: err.message });
      else setMessage({ kind: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" aria-labelledby="pd-title">
      <h2 id="pd-title">Datos personales</h2>
      <p className="muted">Actualizá tu nombre y apellido.</p>
      {loadError && <Alert kind="error">{loadError}</Alert>}
      <form className="profile-form" onSubmit={submit} noValidate>
        <Field id="pf-email" name="email" label="Email" value={stored?.email ?? ''} readOnly
          hint="El email no puede modificarse." />
        <Field id="pf-first" name="firstName" label="Nombre *" value={form.firstName} onChange={change} onBlur={blur}
          error={errorOf('firstName')} autoComplete="given-name" />
        <Field id="pf-last" name="lastName" label="Apellido *" value={form.lastName} onChange={change} onBlur={blur}
          error={errorOf('lastName')} autoComplete="family-name" />
        <div className="profile-form__actions">
          <button type="submit" className="btn" disabled={!canSave}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
        {message && <Alert kind={message.kind}>{message.text}</Alert>}
        {!message && stored && filled && !changed && <Alert kind="info">No hay cambios para guardar.</Alert>}
      </form>
    </section>
  );
}
