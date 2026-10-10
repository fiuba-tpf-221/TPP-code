import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES, userDetailPath } from '../../config/routes';
import Field from '../../shared/components/Field';
import Alert from '../../shared/components/Alert';
import { userService } from './userService';
import './users.css';

const PAGE_SIZES = [10, 20, 50];
const COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'firstName', label: 'Nombre' },
  { key: 'lastName', label: 'Apellido' },
  { key: 'active', label: 'Activo' },
  { key: 'blocked', label: 'Credencial bloqueada' },
  { key: 'roles', label: 'Roles', sortable: false }, // Roles no se ordena (US-04 CA 15)
];
const NO_FILTERS = { email: '', firstName: '', lastName: '', active: undefined, blocked: undefined, roleIds: [] };

const triState = (v) => (v === 'true' ? true : v === 'false' ? false : undefined);
const yesNo = (v) => (v ? 'Sí' : 'No');

// Filtros, orden y página viven en la URL: se mantienen al paginar, al volver desde un detalle y al recargar.
function readQuery(sp) {
  const size = Number(sp.get('size'));
  return {
    email: sp.get('email') ?? '', firstName: sp.get('firstName') ?? '', lastName: sp.get('lastName') ?? '',
    active: triState(sp.get('active')), blocked: triState(sp.get('blocked')),
    roleIds: sp.get('roles') ? sp.get('roles').split(',') : [],
    sort: sp.get('sort') || 'email', order: sp.get('order') === 'desc' ? 'desc' : 'asc',
    page: Math.max(1, Number(sp.get('page')) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0],
  };
}

function toParams(q) {
  const sp = new URLSearchParams();
  ['email', 'firstName', 'lastName'].forEach((k) => { if (q[k].trim()) sp.set(k, q[k].trim()); });
  if (q.active !== undefined) sp.set('active', String(q.active));
  if (q.blocked !== undefined) sp.set('blocked', String(q.blocked));
  if (q.roleIds.length) sp.set('roles', q.roleIds.join(','));
  if (q.sort !== 'email') sp.set('sort', q.sort);
  if (q.order !== 'asc') sp.set('order', q.order);
  if (q.page > 1) sp.set('page', String(q.page));
  if (q.pageSize !== PAGE_SIZES[0]) sp.set('size', String(q.pageSize));
  return sp;
}

const filtersOf = ({ email, firstName, lastName, active, blocked, roleIds }) =>
  ({ email, firstName, lastName, active, blocked, roleIds });

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const query = readQuery(searchParams);

  const [draft, setDraft] = useState(() => filtersOf(query)); // lo escrito, hasta que se pulsa Buscar
  const [roles, setRoles] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { userService.listRoles().then(setRoles).catch(() => setRoles([])); }, []);

  useEffect(() => {
    let ignore = false;
    const applied = readQuery(new URLSearchParams(queryKey));
    setDraft(filtersOf(applied)); // si cambia la URL (atrás/adelante), el formulario la refleja
    setLoading(true);
    setError('');
    userService.list(applied)
      .then((r) => { if (!ignore) setResult(r); })
      .catch((e) => { if (!ignore) setError(e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [queryKey]);

  const go = (changes) => setSearchParams(toParams({ ...query, ...changes }));
  const search = (e) => { e.preventDefault(); go({ ...draft, page: 1 }); };
  const clear = () => go({ ...NO_FILTERS, page: 1 });
  const sortBy = (key) => go({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : 'asc', page: 1 });
  const setField = (name) => (e) => setDraft({ ...draft, [name]: e.target.value });
  const setTri = (name) => (e) => setDraft({ ...draft, [name]: triState(e.target.value) });
  const toggleRole = (id) => setDraft({
    ...draft, roleIds: draft.roleIds.includes(id) ? draft.roleIds.filter((r) => r !== id) : [...draft.roleIds, id],
  });

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const from = result && result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const to = result ? Math.min(result.page * result.pageSize, result.total) : 0;

  return (
    <>
      <div className="page-header">
        <h1>Usuarios</h1>
        <Link to={ROUTES.USER_NEW} className="btn">Nuevo usuario</Link>
      </div>

      <form className="filters" onSubmit={search} aria-label="Filtros de usuarios">
        <div className="filters__grid">
          <Field id="f-email" label="Email" value={draft.email} onChange={setField('email')} />
          <Field id="f-first" label="Nombre" value={draft.firstName} onChange={setField('firstName')} />
          <Field id="f-last" label="Apellido" value={draft.lastName} onChange={setField('lastName')} />
          <div className="field">
            <label htmlFor="f-active">Activo</label>
            <select id="f-active" value={draft.active === undefined ? '' : String(draft.active)} onChange={setTri('active')}>
              <option value="">Todos</option><option value="true">Sí</option><option value="false">No</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-blocked">Credencial bloqueada</label>
            <select id="f-blocked" value={draft.blocked === undefined ? '' : String(draft.blocked)} onChange={setTri('blocked')}>
              <option value="">Todas</option><option value="true">Sí</option><option value="false">No</option>
            </select>
          </div>
        </div>

        <fieldset className="choice filters__roles">
          <legend>Roles</legend>
          {roles.map((r) => (
            <label key={r.id}>
              <input type="checkbox" checked={draft.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
              {' '}{r.name}{!r.active && ' (*)'}
            </label>
          ))}
          <p className="filters__help">(*) Rol inactivo</p>
        </fieldset>

        <div className="form__actions">
          <button type="button" className="btn btn--secondary" onClick={clear}>Limpiar filtros</button>
          <button type="submit" className="btn">Buscar</button>
        </div>
      </form>

      {error && <Alert kind="error">{error}</Alert>}
      {loading && !result && <p className="muted">Cargando usuarios…</p>}

      {result && result.total === 0 && !error && <p role="status" className="empty">No se encontraron resultados.</p>}

      {result && result.total > 0 && (
        <div className={loading ? 'results is-loading' : 'results'} aria-busy={loading}>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Usuarios registrados</caption>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col"
                      aria-sort={c.sortable === false || query.sort !== c.key ? undefined : query.order === 'asc' ? 'ascending' : 'descending'}>
                      {c.sortable === false ? c.label : (
                        <button type="button" className="th-sort" onClick={() => sortBy(c.key)}>
                          {c.label}
                          <span aria-hidden="true">{query.sort === c.key ? (query.order === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
                        </button>
                      )}
                    </th>
                  ))}
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.firstName}</td>
                    <td>{u.lastName}</td>
                    <td><span className={`badge${u.active ? '' : ' badge--off'}`}>{yesNo(u.active)}</span></td>
                    <td><span className={`badge${u.blocked ? ' badge--warn' : ' badge--off'}`}>{yesNo(u.blocked)}</span></td>
                    <td>{u.roles.map((r) => r.name).join(', ')}</td>
                    <td><Link to={userDetailPath(u.id)}>Ver / Editar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span>Mostrando {from}–{to} de {result.total}</span>
            <label className="pager__size">
              Filas por página{' '}
              <select value={result.pageSize} onChange={(e) => go({ pageSize: Number(e.target.value), page: 1 })}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <nav className="pager__nav" aria-label="Paginación">
              <button type="button" className="btn btn--secondary" disabled={result.page <= 1}
                onClick={() => go({ page: result.page - 1 })}>Anterior</button>
              <span>Página {result.page} de {pages}</span>
              <button type="button" className="btn btn--secondary" disabled={result.page >= pages}
                onClick={() => go({ page: result.page + 1 })}>Siguiente</button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
