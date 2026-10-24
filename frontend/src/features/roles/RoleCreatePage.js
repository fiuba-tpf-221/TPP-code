import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import Field from '../../shared/components/Field';
import Alert from '../../shared/components/Alert';
import DemoDataNotice from '../../shared/components/DemoDataNotice';
import { normalizeSpaces } from '../../shared/utils/text';
import { roleService } from './roleService';
import PermissionPicker from './components/PermissionPicker';
import './roles.css';

export default function RoleCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', active: true, permissionCodes: [] }); // por defecto, activo
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    roleService.permissionsCatalog().then(setCatalog).catch((e) => setCatalogError(e.message));
  }, []);

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const change = (e) => { set(e.target.name, e.target.value); setErrors({}); };
  // Al salir del campo se muestra ya el valor normalizado.
  const tidy = (e) => set(e.target.name, e.target.name === 'name' ? normalizeSpaces(e.target.value) : e.target.value.trim());
  const togglePermission = (code) => set('permissionCodes',
    form.permissionCodes.includes(code) ? form.permissionCodes.filter((c) => c !== code) : [...form.permissionCodes, code]);

  const canSubmit = form.name.trim() && form.description.trim() && !saving; // los permisos son opcionales

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const role = await roleService.create({
        name: normalizeSpaces(form.name), description: form.description.trim(),
        active: form.active, permissionCodes: form.permissionCodes,
      });
      navigate(ROUTES.ROLES, { state: { notice: `El rol "${role.name}" se creó correctamente.` } });
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      setSaving(false);
    }
  };

  return (
    <>
      <h1>Nuevo rol</h1>
      <DemoDataNotice />
      <form className="form form--wide" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="form-grid__full">
            <Field id="r-name" name="name" label="Nombre *" value={form.name} onChange={change} onBlur={tidy} error={errors.name} />
          </div>
          <div className="form-grid__full">
            <Field id="r-description" name="description" label="Descripción *" multiline rows={3} value={form.description}
              onChange={change} onBlur={tidy} error={errors.description} />
          </div>

          <fieldset className="choice form-grid__full">
            <legend>Activo</legend>
            <label><input type="radio" name="active" checked={form.active} onChange={() => set('active', true)} /> Sí</label>
            <label><input type="radio" name="active" checked={!form.active} onChange={() => set('active', false)} /> No</label>
          </fieldset>

          <div className="form-grid__full">
            <h2 className="form-section-title">Permisos asociados</h2>
            <p className="muted">Son opcionales: un rol puede existir sin permisos. Solo se muestran los permisos y módulos activos.</p>
            {catalogError && <Alert kind="error">{catalogError}</Alert>}
            {!catalog && !catalogError && <p className="muted">Cargando permisos…</p>}
            {catalog && <PermissionPicker catalog={catalog} selected={form.permissionCodes} onToggle={togglePermission} mode="create" />}
            {errors.permissionCodes && <p className="field__error">{errors.permissionCodes}</p>}
          </div>
        </div>

        {errors.form && <Alert kind="error">{errors.form}</Alert>}

        <div className="form__actions">
          <button type="button" className="btn btn--secondary" onClick={() => navigate(ROUTES.ROLES)}>Cancelar</button>
          <button type="submit" className="btn" disabled={!canSubmit}>{saving ? 'Creando…' : 'Crear rol'}</button>
        </div>
      </form>
    </>
  );
}
