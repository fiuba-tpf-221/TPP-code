import { http } from '../../shared/api/httpClient';
import { FEATURES } from '../../config/features';
import { mockAuthApi } from '../../mock/authApi';

// Contratos con el backend (detalle en docs/contrato-backend.md).
const realAuthApi = {
  login: ({ email, password }) => http('/auth/login', { method: 'POST', body: { email, password } }),
  loginWithGoogle: (credential) => http('/auth/google', { method: 'POST', body: { credential } }),
  changePassword: ({ newPassword }) => http('/auth/change-password', { method: 'POST', body: { newPassword } }),
  register: (data) => http('/auth/register', { method: 'POST', body: data }),
  logout: () => http('/auth/logout', { method: 'POST' }).catch(() => {}),
  recordTimeout: () => {}, // el timeout lo audita el backend
};

// Con backend real: USE_MOCK_API = false y borrar src/mock/.
export const authService = FEATURES.USE_MOCK_API ? mockAuthApi : realAuthApi;
