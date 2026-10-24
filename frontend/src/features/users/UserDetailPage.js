import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../auth/AuthContext';
import Field from '../../shared/components/Field';
import Alert from '../../shared/components/Alert';
import DemoDataNotice from '../../shared/components/DemoDataNotice';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import { normalizeSpaces } from '../../shared/utils/text';
import { userService } from './userService';
import TemporaryPasswordNotice from './components/TemporaryPasswordNotice';
import './users.css';

// Textos de los modales según US-03. Cada uno identifica claramente al usuario afectado.
const ACTIONS = {
  deactivate: { title: 'Dar de baja', confirm: 'Dar de baja', danger: true,
    body: (name, email) => (
      <>
        <p>Vas a dar de baja a <strong>{name}</strong> ({email}).</p>
        <ul>
          <li>Quedará inactivo y no podrá iniciar nuevas sesiones.</li>
          <li>Las sesiones que ya tenga abiertas continuarán vigentes hasta que finalicen por cierre de sesión, timeout u otra causa.</li>
          <li>Se conservan sus datos, roles e historial.</li>
        </ul>
      </>
    ) },
  reactivate: { title: 'Reactivar usuario', confirm: 'Reactivar', danger: false,
    body: (name, email) => (
      <>
        <p>Vas a reactivar a <strong>{name}</strong> ({email}).</p>
        <ul>
          <li>La contraseña anterior será invalidada para futuros inicios de sesión.</li>
          <li>Se generará una nueva contraseña temporal, que se muestra una sola vez.</li>
          <li>La generación de la nueva contraseña temporal no afecta las sesiones que ya estén abiertas.</li>
        </ul>
      </>
    ) },
  password: { title: 'Generar nueva contraseña temporal', confirm: 'Generar contraseña', danger: false,
    body: (name, email) => (
      <>
        <p>Vas a generar una nueva contraseña temporal para <strong>{name}</strong> ({email}).</p>
        <ul>
          <li>La contraseña actual quedará invalidada para nuevos inicios de sesión.</li>
          <li>Las sesiones que el usuario ya tenga abiertas no se ven afectadas.</li>
          <li>Si su credencial estaba bloqueada, se desbloquea.</li>
          <li>La nueva contraseña se muestra una sola vez y deberá cambiarla en su próximo inicio de sesión.</li>
        </ul>
      </>
    ) },
};

const toForm = (u) => ({ firstName: u.firstName, lastName: u.lastName, roleIds: u.roles.map((r) => r.id) });
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const yesNo = (value) => (value ? 'Sí' : 'No');

export default function UserDetailPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null); // detalle tal como lo devuelve el servidor
  const [roles, setRoles] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(null); // 'deactivate' | 'reactivate' | 'password'
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [temp, setTemp] = useState(null); // { value, kind }: contraseña temporal, solo en memoria
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([userService.get(id), userService.listRoles()])
      .then(([u, r]) => { setData(u); setRoles(r); setForm(toForm(u)); })
      .catch((e) => setLoadError(e.status === 404 ? 'No se encontró el usuario.' : e.message));
  }, [id]);

  if (loadError) {
    return (<><Link to={ROUTES.USERS} className="back">← Volver a usuarios</Link><Alert kind="error">{loadError}</Alert></>);
  }
  if (!data || !roles || !form) return <p className="muted">Cargando usuario…</p>;

  const fullName = `${data.firstName} ${data.lastName}`;
  const isSelf = data.id === me.id; // CA 2 y 12: se consulta, pero no se modifica ni se ejecutan acciones

  // Roles activos + los inactivos que el usuario ya tiene (se pueden quitar, pero no volver a agregar).
  const originalIds = data.roles.map((r) => r.id);
  const visibleRoles = roles.filter((r) => r.active || originalIds.includes(r.id));

  const first = normalizeSpaces(form.firstName);
  const last = normalizeSpaces(form.lastName);
  const dirty = first !== data.firstName || last !== data.lastName || !sameSet(form.roleIds, originalIds);
  const canSave = !isSelf && dirty && first && last && form.roleIds.length > 0 && !saving;

  const edit = (changes) => { setForm({ ...form, ...changes }); setSaved(false); setErrors({}); };
  const tidy = (e) => edit({ [e.target.name]: normalizeSpaces(e.target.value) });
  const toggleRole = (rid) =>
    edit({ roleIds: form.roleIds.includes(rid) ? form.roleIds.filter((r) => r !== rid) : [...form.roleIds, rid] });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await userService.update(id, { firstName: first, lastName: last, roleIds: form.roleIds });
      setData(updated);
      setForm(toForm(updated));
      setSaved(true);
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
      if (pending === 'deactivate') {
        setData(await userService.deactivate(id));
        setNotice('El usuario quedó inactivo y no podrá iniciar nuevas sesiones. Sus sesiones abiertas continúan vigentes hasta que finalicen.');
      } else {
        const result = pending === 'reactivate'
          ? await userService.reactivate(id)
          : await userService.generateTemporaryPassword(id);
        setData(result.user);
        setTemp({ value: result.temporaryPassword, kind: pending });
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const action = ACTIONS[pending];

  return (
    <>
      <Link to={ROUTES.USERS} className="back">← Volver a usuarios</Link>
      <h1>Detalle de usuario</h1>
      <DemoDataNotice />
      {isSelf && (
        <Alert kind="info">
          Este es tu propio usuario. Podés consultarlo, pero no modificarlo ni ejecutar acciones administrativas sobre él.
        </Alert>
      )}

      <form className="panel" onSubmit={submit}>
        <h2>Datos</h2>
        <div className="form-grid">
          <div className="form-grid__full">
            <Field id="ud-email" label="Email" value={data.email} readOnly aria-readonly="true" />
          </div>
          <Field id="ud-first" name="firstName" label="Nombre" value={form.firstName} disabled={isSelf}
            onChange={(e) => edit({ firstName: e.target.value })} onBlur={tidy} error={errors.firstName} required />
          <Field id="ud-last" name="lastName" label="Apellido" value={form.lastName} disabled={isSelf}
            onChange={(e) => edit({ lastName: e.target.value })} onBlur={tidy} error={errors.lastName} required />

          <fieldset className="choice choice--roles form-grid__full" disabled={isSelf}>
            <legend>Roles</legend>
            {visibleRoles.map((r) => (
              <label key={r.id}>
                <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)}
                  disabled={!r.active && !form.roleIds.includes(r.id)} />
                {' '}{r.name}{!r.active && ' (inactivo)'}
              </label>
            ))}
            {form.roleIds.length === 0 && <p className="field__error">Debe conservarse al menos un rol</p>}
            {errors.roleIds && <p className="field__error">{errors.roleIds}</p>}
          </fieldset>
        </div>

        {saved && <Alert kind="success">Cambios guardados.</Alert>}
        {errors.form && <Alert kind="error">{errors.form}</Alert>}
        <div className="form__actions">
          <button type="submit" className="btn" disabled={!canSave}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>

      <section className="panel">
        <h2>Estado <span className="muted">(solo lectura)</span></h2>
        <dl className="profile">
          <dt>Activo</dt><dd>{yesNo(data.active)}</dd>
          <dt>Credencial bloqueada</dt><dd>{yesNo(data.blocked)}</dd>
          <dt>Intentos fallidos consecutivos</dt><dd>{data.failedAttempts}</dd>
          <dt>Cambio de contraseña requerido</dt><dd>{yesNo(data.mustChangePassword)}</dd>
        </dl>
      </section>

      <section className="panel panel--sensitive">
        <h2>Acciones</h2>
        <div className="actions">
          {data.active
            ? <button type="button" className="btn btn--danger" disabled={isSelf} onClick={() => setPending('deactivate')}>Dar de baja</button>
            : <button type="button" className="btn" disabled={isSelf} onClick={() => setPending('reactivate')}>Reactivar</button>}
          <button type="button" className="btn btn--secondary" disabled={isSelf} onClick={() => setPending('password')}>
            Generar nueva contraseña temporal
          </button>
        </div>
        {isSelf && <p className="muted">No se habilitan acciones administrativas sobre tu propio usuario.</p>}
        {actionError && <Alert kind="error">{actionError}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
      </section>

      {temp && (
        <TemporaryPasswordNotice modal
          title={temp.kind === 'reactivate' ? 'Usuario reactivado' : 'Contraseña temporal generada'}
          intro={temp.kind === 'reactivate'
            ? <>Se reactivó a <strong>{data.email}</strong> y se generó una nueva contraseña temporal.</>
            : <>Se generó una nueva contraseña temporal para <strong>{data.email}</strong>.</>}
          extra="La contraseña anterior quedó invalidada. Las sesiones que ya estén abiertas no se ven afectadas."
          password={temp.value}
          onContinue={() => setTemp(null)} />
      )}

      <ConfirmDialog open={Boolean(pending)} title={action?.title} confirmLabel={action?.confirm}
        danger={action?.danger} busy={busy} onConfirm={runAction} onCancel={() => setPending(null)}>
        {action?.body(fullName, data.email)}
      </ConfirmDialog>
    </>
  );
}
