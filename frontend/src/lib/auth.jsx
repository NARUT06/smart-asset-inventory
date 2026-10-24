import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ast_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data?.data?.user || null);
    } catch {
      setUser(null);
      setToken('');
      localStorage.removeItem('ast_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem('ast_token', token);
      fetchMe();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token, fetchMe]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const t = res.data?.token;
    if (!t) throw new Error('No token returned');
    setToken(t);
    localStorage.setItem('ast_token', t);
    const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${t}` } });
    setUser(me.data?.data?.user || null);
    return me.data?.data?.user;
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    localStorage.removeItem('ast_token');
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, logout, refresh: fetchMe, setUser }),
    [token, user, loading, login, logout, fetchMe],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const can = (user, ...roles) => !!user && roles.includes(user.role);
