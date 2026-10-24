import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export const api = axios.create({ baseURL: `${baseURL}/api`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ast_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('ast_token');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const errMsg = (err, fallback = 'Request failed') => {
  const d = err?.response?.data;
  if (!d) return err?.message || fallback;
  if (typeof d.message === 'string') return d.message;
  if (Array.isArray(d.errors) && d.errors.length) {
    return d.errors.map((e) => e.msg || e.message || e.param).filter(Boolean).join(' | ') || fallback;
  }
  return fallback;
};

// Unwrap helpers: backend uses { success, data, meta }
export const listData = (res) => res?.data?.data ?? [];
export const metaOf = (res) => res?.data?.meta ?? {};
export const objData = (res) => res?.data?.data ?? null;

// Display helpers for serializer shape (_id + populated refs)
export const rid = (v) => (v && typeof v === 'object' ? (v._id ?? v.id) : v);
export const rlabel = (v, keys = ['name', 'fullName', 'email', 'title', 'code']) => {
  if (v == null) return '—';
  if (typeof v !== 'object') return String(v);
  for (const k of keys) if (v[k]) return String(v[k]);
  return String(v._id ?? v.id ?? '—');
};
