import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
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
    if (err.response?.status === 401 && !path.includes('/login') && !path.includes('/signup') && !path.includes('/forgot-password') && !path.includes('/reset-password')) {
      sessionStorage.removeItem('bells_student_token');
      window.location.href = `${import.meta.env.BASE_URL}login`.replace('//', '/');
    }
    return Promise.reject(err);
  },
);

export default api;
