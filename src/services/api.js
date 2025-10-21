import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
});

// Attach token if available
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('fc_auth');
    if (raw) {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// Basic error handling passthrough
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    return Promise.reject(error?.response?.data || error);
  }
);

export default api;
