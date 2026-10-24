import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import Field from '../../shared/components/Field';
import Alert from '../../shared/components/Alert';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import DemoDataNotice from '../../shared/components/DemoDataNotice';
import { roleService } from './roleService';
import PermissionPicker from './components/PermissionPicker';
import './roles.css';

const NEXT_LOGIN = 'Las sesiones existentes no se ven afectadas: el cambio se aplicará en el próximo login.';

// Textos de confirmación según la US-07.
const ACTIONS = {
  deactivate: { title: 'Inactivar rol', confirm: 'Inactivar rol', danger: true,
    body: (name) => (
      <>
        <p>Vas a inactivar el rol <strong>{name}</strong>.</p>
        <ul>
          <li>El rol dejará temporalmente de otorgar permisos.</li>
          <li>Los usuarios conservarán la asociación al rol.</li>
          <li>El rol dejará de estar disponible para nuevas asignaciones.</li>
          <li>{NEXT_LOGIN}</li>
        </ul>
      </>
    ) },
  reactivate: { title: 'Reactivar rol', confirm: 'Reactivar rol', danger: false,
    body: (name) => (
      <>
        <p>Vas a reactivar el rol <strong>{name}</strong>.</p>
        <ul>
          <li>El rol volverá a estar activo.</li>
          <li>Los usuarios asociados volverán a recibir los permisos activos actualmente configurados en el rol.</li>
          <li>El rol volverá a estar disponible para nuevas asignaciones.</li>
          <li>{NEXT_LOGIN}</li>
        </ul>
      </>
    ) },
  delete: { title: 'Eliminar rol', confirm: 'Eliminar rol', danger: true,
    body: (name) => (
      <>
        <p>Vas a eliminar el rol <strong>{name}</strong>. <strong>La eliminación es definitiva.</strong></p>
        <ul>
          <li>Se eliminarán también todas las relaciones del rol con sus permisos.</li>
          <li>Para auditoría se conservan los valores que tenía el rol antes de eliminarse.</li>
        </ul>
      </>
    ) },
};

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function RoleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState({ description: '', permissionCodes: [] });
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([roleService.get(id), roleService.permissionsCatalog()])
      .then(([loaded, perms]) => {
        if (ignore) return;
        setRole(loaded);
        setCatalog(perms);
        setForm({ description: loaded.description, permissionCodes: [...loaded.permissions] });
      })
      .catch((e) => { if (!ignore) setLoadError(e.message); });
    return () => { ignore = true; };
  }, [id]);

  if (loadError) return <><Link to={ROUTES.ROLES} className="back">← Volver a roles</Link><Alert kind="error">{loadError}</Alert></>;
  if (!role || !catalog) return <p className="muted">Cargando rol…</p>;

  const locked = role.protected; // el rol Administrador solo se consulta
  const changed = form.description.trim() !== role.description || !sameSet(form.permissionCodes, role.permissions);
  const canSave = !locked && changed && form.description.trim() !== '' && !saving;
  const action = pending ? ACTIONS[pending] : null;

  const togglePermission = (code) => {
    setNotice('');
    setForm((f) => ({ ...f, permissionCodes: f.permissionCodes.includes(code)
      ? f.permissionCodes.filter((c) => c !== code) : [...f.permissionCodes, code] }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setErrors({});
    setNotice('');
    try {
      const updated = await roleService.update(id, { description: form.description.trim(), permissionCodes: form.permissionCodes });
      setRole(updated);
      setForm({ description: updated.description, permissionCodes: [...updated.permissions] });
      setNotice('Los cambios se guardaron correctamente.');
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async () => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      if (pending === 'delete') {
        await roleService.remove(id);
        navigate(ROUTES.ROLES, { state: { notice: `El rol "${role.name}" se eliminó correctamente.` } });
        return;
      }
      const updated = pending === 'deactivate' ? await roleService.deactivate(id) : await roleService.reactivate(id);
      setRole(updated);
      setNotice(pending === 'deactivate' ? `El rol quedó inactivo. ${NEXT_LOGIN}` : `El rol quedó activo. ${NEXT_LOGIN}`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <>
      <Link to={ROUTES.ROLES} className="back">← Volver a roles</Link>
      <h1>Detalle de rol</h1>
      <DemoDataNotice />
      {locked && <Alert kind="info">Rol protegido del sistema: puede consultarse, pero no puede modificarse, inactivarse ni eliminarse.</Alert>}
      {actionError && <Alert kind="error">{actionError}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <section className="panel panel--wide" aria-labelledby="role-data">
        <h2 id="role-data">Datos del rol</h2>
        <dl className="profile">
          <dt>Nombre</dt><dd>{role.name}</dd>
          <dt>Estado</dt><dd><span className={`badge${role.active ? '' : ' badge--off'}`}>{role.active ? 'Activo' : 'Inactivo'}</span></dd>
          <dt>Usuarios asignados</dt><dd>{role.usersCount}</dd>
          <dt>Permisos asignados</dt><dd>{role.permissionsCount}</dd>
        </dl>
      </section>

      <form className="form form--wide" onSubmit={save} noValidate>
        <Field id="rd-description" label="Descripción *" multiline rows={3} value={form.description} disabled={locked}
          onChange={(e) => { setForm({ ...form, description: e.target.value }); setNotice(''); }}
          error={errors.description || (form.description.trim() === '' ? 'La descripción es obligatoria.' : '')} />

        <h2 className="form-section-title">Permisos asociados</h2>
        <p className="muted">Los permisos o módulos que hoy están inactivos se muestran marcados: pueden quitarse, pero no volver a asignarse.</p>
        <PermissionPicker catalog={catalog} selected={form.permissionCodes} assigned={role.permissions}
          onToggle={togglePermission} disabled={locked} mode="edit" />
        {errors.permissionCodes && <p className="field__error">{errors.permissionCodes}</p>}
        {errors.form && <Alert kind="error">{errors.form}</Alert>}

        <div className="form__actions">
          <button type="submit" className="btn" disabled={!canSave}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>

      {!locked && (
        <section className="section section--actions" aria-labelledby="role-actions">
          <h2 id="role-actions">Acciones</h2>
          <div className="actions">
            {role.active
              ? <button type="button" className="btn btn--danger" onClick={() => setPending('deactivate')}>Inactivar rol</button>
              : <button type="button" className="btn" onClick={() => setPending('reactivate')}>Reactivar rol</button>}
            {role.usersCount === 0 && (
              <button type="button" className="btn btn--danger" onClick={() => setPending('delete')}>Eliminar rol</button>
            )}
          </div>
          {role.usersCount > 0 && (
            <p className="muted">
              Este rol tiene {role.usersCount} {role.usersCount === 1 ? 'usuario asignado' : 'usuarios asignados'}. Para eliminarlo,
              primero deben quitarse todas las asignaciones de usuarios.
            </p>
          )}
        </section>
      )}

      <ConfirmDialog open={Boolean(pending)} title={action?.title} confirmLabel={action?.confirm}
        danger={action?.danger} busy={busy} onConfirm={runAction} onCancel={() => setPending(null)}>
        {action?.body(role.name)}
      </ConfirmDialog>
    </>
  );
}
