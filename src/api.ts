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
    if (err.response?.status === 401 && !path.includes('/login') && !path.includes('/signup') && !path.includes('/forgot-password') && !path.includes('/reset-password') && !path.includes('/payments/callback') && !path.includes('/transcript-request') && !path.includes('/request-pay')) {
      sessionStorage.removeItem('bells_student_token');
      window.location.href = `${import.meta.env.BASE_URL}login`.replace('//', '/');
    }
    return Promise.reject(err);
  },
);

function flattenValidationErrors(errors: unknown): string {
  if (!errors || typeof errors !== 'object') return '';
  const parts: string[] = [];
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) parts.push(item.trim());
      }
    }
  }
  return parts.join(' ');
}

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const ax = err as { response?: { data?: unknown } };
  let data = ax.response?.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = undefined;
    }
  }
  const payload = data && typeof data === 'object'
    ? data as { message?: string; errors?: unknown }
    : undefined;
  const fromErrors = flattenValidationErrors(payload?.errors);
  if (fromErrors) return fromErrors;
  const fromMessage = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (fromMessage) return fromMessage;
  if (ax.response) return fallback;
  const apiHost = (baseURL || '(same origin)').replace(/\/$/, '');
  return `Cannot reach the API (${apiHost}). On this phone open that URL — if it fails, check www vs non-www and mobile data vs Wi‑Fi.`;
}

export function networkErrorMessage(err: unknown, fallback = 'Unable to sign in'): string {
  return apiErrorMessage(err, fallback);
}

export default api;
