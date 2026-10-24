import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import Field from '../../shared/components/Field';
import DemoDataNotice from '../../shared/components/DemoDataNotice';
import { normalizeEmail, normalizeSpaces, EMAIL_RE } from '../../shared/utils/text';
import { userService } from './userService';
import TemporaryPasswordNotice from './components/TemporaryPasswordNotice';
import './users.css';

const EMPTY = { firstName: '', lastName: '', email: '', active: true, roleIds: [] };

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [roles, setRoles] = useState(null);
  const [rolesError, setRolesError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    // Solo se ofrecen roles activos (CA 8).
    userService.listRoles()
      .then((all) => setRoles(all.filter((r) => r.active)))
      .catch((e) => setRolesError(e.message));
  }, []);

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const change = (e) => set(e.target.name, e.target.value);
  // Al salir del campo se muestra ya el valor normalizado (CA 3 y 5).
  const tidy = (e) => {
    const { name, value } = e.target;
    set(name, name === 'email' ? normalizeEmail(value) : normalizeSpaces(value));
  };
  const toggleRole = (id) =>
    set('roleIds', form.roleIds.includes(id) ? form.roleIds.filter((r) => r !== id) : [...form.roleIds, id]);

  // CA de diseño: deshabilitado mientras falte Nombre, Apellido, Email o un Rol.
  const canSubmit = form.firstName.trim() && form.lastName.trim() && form.email.trim()
    && form.roleIds.length > 0 && !saving;

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      firstName: normalizeSpaces(form.firstName),
      lastName: normalizeSpaces(form.lastName),
      email: normalizeEmail(form.email),
      active: form.active,
      roleIds: form.roleIds,
    };
    setForm({ ...form, ...payload });
    if (!EMAIL_RE.test(payload.email)) return setErrors({ email: 'Ingresá un email válido' });

    setErrors({});
    setSaving(true);
    try {
      const { user, temporaryPassword } = await userService.create(payload);
      setCreated({ email: user.email, active: user.active, temporaryPassword });
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <TemporaryPasswordNotice title="Usuario creado" password={created.temporaryPassword}
        onContinue={() => navigate(ROUTES.USERS)}
        intro={(
          <>
            <p>Se creó el usuario <strong>{created.email}</strong>.</p>
            {!created.active && <p className="muted">Quedó inactivo: no podrá ingresar hasta que se active.</p>}
          </>
        )} />
    );
  }

  return (
    <>
      <h1>Nuevo usuario</h1>
      <DemoDataNotice />
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field id="u-first" name="firstName" label="Nombre" value={form.firstName}
            onChange={change} onBlur={tidy} error={errors.firstName} required />
          <Field id="u-last" name="lastName" label="Apellido" value={form.lastName}
            onChange={change} onBlur={tidy} error={errors.lastName} required />
          <div className="form-grid__full">
            <Field id="u-email" name="email" type="email" label="Email" value={form.email}
              onChange={change} onBlur={tidy} error={errors.email} autoComplete="off" required />
          </div>

          <fieldset className="choice form-grid__full">
            <legend>Activo</legend>
            <label><input type="radio" name="active" checked={form.active} onChange={() => set('active', true)} /> Sí</label>
            <label><input type="radio" name="active" checked={!form.active} onChange={() => set('active', false)} /> No</label>
          </fieldset>

          <fieldset className="choice choice--roles form-grid__full" aria-describedby={errors.roleIds ? 'roles-error' : undefined}>
            <legend>Roles</legend>
            {rolesError && <p role="alert" className="error">{rolesError}</p>}
            {!roles && !rolesError && <p className="muted">Cargando roles…</p>}
            {roles?.map((r) => (
              <label key={r.id}>
                <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} /> {r.name}
              </label>
            ))}
            {errors.roleIds && <p id="roles-error" className="field__error">{errors.roleIds}</p>}
          </fieldset>
        </div>

        {errors.form && <p role="alert" className="error">{errors.form}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--secondary" onClick={() => navigate(ROUTES.USERS)}>Cancelar</button>
          <button type="submit" className="btn" disabled={!canSubmit}>
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </>
  );
}
