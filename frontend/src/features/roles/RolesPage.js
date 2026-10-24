import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES, roleDetailPath } from '../../config/routes';
import Field from '../../shared/components/Field';
import Alert from '../../shared/components/Alert';
import DemoDataNotice from '../../shared/components/DemoDataNotice';
import Pager from '../../shared/components/Pager';
import SortableTh from '../../shared/components/SortableTh';
import { roleService } from './roleService';
import './roles.css';

const PAGE_SIZES = [10, 20, 50];
const COLUMNS = [
  { key: 'name', label: 'Nombre' },
  { key: 'description', label: 'Descripción' },
  { key: 'active', label: 'Activo' },
  { key: 'usersCount', label: 'Usuarios asignados', numeric: true },
  { key: 'permissionsCount', label: 'Permisos asignados', numeric: true },
];
const NO_FILTERS = { name: '', description: '', active: undefined };

const triState = (v) => (v === 'true' ? true : v === 'false' ? false : undefined);
const yesNo = (v) => (v ? 'Sí' : 'No');

// Filtros, orden y página viven en la URL: se mantienen al paginar, al volver desde un detalle y al recargar.
function readQuery(sp) {
  const size = Number(sp.get('size'));
  return {
    name: sp.get('name') ?? '', description: sp.get('description') ?? '', active: triState(sp.get('active')),
    sort: sp.get('sort') || 'name', order: sp.get('order') === 'desc' ? 'desc' : 'asc',
    page: Math.max(1, Number(sp.get('page')) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0],
  };
}

function toParams(q) {
  const sp = new URLSearchParams();
  ['name', 'description'].forEach((k) => { if (q[k].trim()) sp.set(k, q[k].trim()); }); // se procesan sin espacios en los bordes
  if (q.active !== undefined) sp.set('active', String(q.active));
  if (q.sort !== 'name') sp.set('sort', q.sort);
  if (q.order !== 'asc') sp.set('order', q.order);
  if (q.page > 1) sp.set('page', String(q.page));
  if (q.pageSize !== PAGE_SIZES[0]) sp.set('size', String(q.pageSize));
  return sp;
}

const filtersOf = ({ name, description, active }) => ({ name, description, active });

export default function RolesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryKey = searchParams.toString();
  const query = readQuery(searchParams);

  const [notice] = useState(location.state?.notice ?? ''); // confirmación tras crear o eliminar
  const [draft, setDraft] = useState(() => filtersOf(query));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { // el aviso se muestra una vez: recargar no lo repite
    if (location.state?.notice) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, []);

  useEffect(() => {
    let ignore = false;
    const applied = readQuery(new URLSearchParams(queryKey));
    setDraft(filtersOf(applied));
    setLoading(true);
    setError('');
    roleService.list(applied)
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

  return (
    <>
      <div className="page-header">
        <h1>Roles</h1>
        <Link to={ROUTES.ROLE_NEW} className="btn">Nuevo rol</Link>
      </div>
      <DemoDataNotice />
      {notice && <Alert kind="success">{notice}</Alert>}

      <form className="filters" onSubmit={search} aria-label="Filtros de roles">
        <div className="filters__grid">
          <Field id="rf-name" label="Nombre" value={draft.name} onChange={setField('name')} />
          <Field id="rf-description" label="Descripción" value={draft.description} onChange={setField('description')} />
          <div className="field">
            <label htmlFor="rf-active">Activo</label>
            <select id="rf-active" value={draft.active === undefined ? '' : String(draft.active)}
              onChange={(e) => setDraft({ ...draft, active: triState(e.target.value) })}>
              <option value="">Todos</option><option value="true">Sí</option><option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="form__actions">
          <button type="button" className="btn btn--secondary" onClick={clear}>Limpiar filtros</button>
          <button type="submit" className="btn">Buscar</button>
        </div>
      </form>

      {error && <Alert kind="error">{error}</Alert>}
      {loading && !result && <p className="muted">Cargando roles…</p>}
      {result && result.total === 0 && !error && <p role="status" className="empty">No se encontraron resultados.</p>}

      {result && result.total > 0 && (
        <div className={loading ? 'results is-loading' : 'results'} aria-busy={loading}>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Roles</caption>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <SortableTh key={c.key} column={c} sort={query.sort} order={query.order} onSort={sortBy} className={c.numeric ? 'num' : undefined} />
                  ))}
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}{r.protected && <span className="badge badge--lock tag-inline" title="Rol protegido del sistema">Protegido</span>}</td>
                    <td>{r.description}</td>
                    <td><span className={`badge${r.active ? '' : ' badge--off'}`}>{yesNo(r.active)}</span></td>
                    <td className="num">{r.usersCount}</td>
                    <td className="num">{r.permissionsCount}</td>
                    <td><Link to={roleDetailPath(r.id)}>Ver / Editar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={result.page} pageSize={result.pageSize} total={result.total} sizes={PAGE_SIZES}
            onPage={(page) => go({ page })} onSize={(pageSize) => go({ pageSize, page: 1 })} />
        </div>
      )}
    </>
  );
}
