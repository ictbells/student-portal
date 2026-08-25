import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'Bells-XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

const CSRF_EXEMPT = [
  '/api/login',
  '/api/register',
  '/api/nin/preview',
  '/api/forgot-password',
  '/api/reset-password',
];

function isCsrfExempt(url?: string) {
  const path = String(url || '');
  return CSRF_EXEMPT.some((prefix) => path.includes(prefix));
}

let csrfPromise: Promise<void> | null = null;

function ensureCsrfCookie() {
  if (!csrfPromise) {
    csrfPromise = api
      .get('/api/sanctum/csrf-cookie')
      .then(() => undefined)
      .catch((err) => {
        csrfPromise = null;
        throw err;
      });
  }
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method) && !isCsrfExempt(config.url)) {
    try {
      await ensureCsrfCookie();
    } catch {
      // Mobile Safari / www hosts may block the CSRF cookie. Login is CSRF-exempt.
    }
  }
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

export default api;
