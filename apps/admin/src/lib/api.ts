import { createApiClient } from '@tournament/api-client';
import { clearToken, getToken } from './session';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4010';

export const api = createApiClient({
  baseUrl,
  getToken,
  onUnauthenticated: () => {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
});
