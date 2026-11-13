import { http } from '../../shared/api/httpClient';
import { FEATURES } from '../../config/features';
import { mockProfileApi } from '../../mock/profileApi';

// Contratos con el backend (detalle en docs/contrato-backend.md):
//   GET  /api/me           -> { id, email, firstName, lastName }
//   PUT  /api/me           { firstName, lastName } -> perfil actualizado
//   POST /api/me/password  { currentPassword, newPassword } -> 204. Contraseña actual incorrecta: 422 con { field: 'currentPassword' }.
const real = {
  get: () => http('/me'),
  update: ({ firstName, lastName }) => http('/me', { method: 'PUT', body: { firstName, lastName } }),
  changePassword: ({ currentPassword, newPassword }) => http('/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
};

export const profileService = FEATURES.USE_MOCK_API ? mockProfileApi : real;
