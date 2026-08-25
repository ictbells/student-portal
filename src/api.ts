import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';

/**
 * Student portal auth is Bearer tokens in sessionStorage (not cookie sessions).
 * Keep withCredentials off so Mobile Safari / cross-subdomain hosts do not
 * abort requests while trying to attach third-party cookies to bells-api.
 */
const api = axios.create({
  baseURL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('bells_student_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const path = window.location.pathname;
    if (err.response?.status === 401 && !path.includes('/login') && !path.includes('/signup') && !path.includes('/forgot-password') && !path.includes('/reset-password') && !path.includes('/payments/callback')) {
      sessionStorage.removeItem('bells_student_token');
      window.location.href = `${import.meta.env.BASE_URL}login`.replace('//', '/');
    }
    return Promise.reject(err);
  },
);

export function networkErrorMessage(err: unknown, fallback = 'Unable to sign in'): string {
  const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string; code?: string };
  const fromApi = ax.response?.data?.message || ax.response?.data?.errors?.login?.[0];
  if (fromApi) return fromApi;
  if (ax.response) return fallback;
  const apiHost = (baseURL || '(same origin)').replace(/\/$/, '');
  return `Cannot reach the API (${apiHost}). On this phone open that URL — if it fails, check www vs non-www and mobile data vs Wi‑Fi.`;
}

export default api;
