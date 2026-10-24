import { http } from '../../shared/api/httpClient';
import { FEATURES } from '../../config/features';
import { mockUsersApi } from '../../mock/usersApi';

// Contratos con el backend (detalle en docs/contrato-backend.md).
function listQuery({ email, firstName, lastName, active, blocked, roleIds = [], sort, order, page, pageSize } = {}) {
  const params = new URLSearchParams();
  Object.entries({ email, firstName, lastName, active, blocked, sort, order, page, pageSize })
    .forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  if (roleIds.length) params.set('roleIds', roleIds.join(','));
  return params.toString();
}

const realUsersApi = {
  list: (query) => http(`/users?${listQuery(query)}`),
  listRoles: () => http('/roles/options'),
  get: (id) => http(`/users/${id}`),
  create: (payload) => http('/users', { method: 'POST', body: payload }),
  update: (id, payload) => http(`/users/${id}`, { method: 'PUT', body: payload }),
  deactivate: (id) => http(`/users/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id) => http(`/users/${id}/reactivate`, { method: 'POST' }),
  generateTemporaryPassword: (id) => http(`/users/${id}/temporary-password`, { method: 'POST' }),
};

export const userService = FEATURES.USE_MOCK_API ? mockUsersApi : realUsersApi;
