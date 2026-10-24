import { http } from '../../shared/api/httpClient';
import { FEATURES } from '../../config/features';
import { mockRolesApi } from '../../mock/rolesApi';

// Contratos con el backend (detalle en docs/contrato-backend.md).
function listQuery({ name, description, active, sort, order, page, pageSize } = {}) {
  const params = new URLSearchParams();
  Object.entries({ name, description, active, sort, order, page, pageSize })
    .forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return params.toString();
}

const real = {
  list: (query) => http(`/roles?${listQuery(query)}`),
  get: (id) => http(`/roles/${id}`),
  permissionsCatalog: () => http('/permissions'),
  create: (data) => http('/roles', { method: 'POST', body: data }),
  update: (id, data) => http(`/roles/${id}`, { method: 'PUT', body: data }),
  deactivate: (id) => http(`/roles/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id) => http(`/roles/${id}/reactivate`, { method: 'POST' }),
  remove: (id) => http(`/roles/${id}`, { method: 'DELETE' }), // 204
};

export const roleService = FEATURES.USE_MOCK_API ? mockRolesApi : real;
